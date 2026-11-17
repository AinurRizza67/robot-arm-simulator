"""Model kinematika JAKA ZU5 yang sama persis dengan simulator (Vector7DofSimulator.html).

Satuan: panjang dalam meter, sudut dalam derajat, kecuali disebut lain.
Konvensi: Standard DH, frame base Z ke atas (sama dengan defaultDH di simulator).
Sudut di sini adalah "sudut model". Bila nol atau arah putar controller JAKA berbeda,
konversinya diatur di jembatan (map sign/offset), bukan di sini.
"""

import math

# a (m), alpha (derajat), d (m) tiap sendi; theta adalah variabel sendi
DH = [
    (0.0, 90.0, 0.1201),
    (0.43, 0.0, -0.1441),
    (0.3685, 0.0, 0.1436),
    (0.0, 90.0, -0.1135),
    (0.0, 90.0, 0.1135),
    (0.0, 180.0, -0.107),
]
# Rentang sendi menurut Hardware Manual JAKA Zu (tabel 5-1), derajat
LIMITS = [(-360, 360), (-85, 265), (-175, 175), (-85, 265), (-360, 360), (-360, 360)]
READY = [0.0, 90.0, -90.0, 90.0, 90.0, 0.0]
R2D, D2R = 180.0 / math.pi, math.pi / 180.0


def dh_matrix(theta, d, a, alpha):
    """T_i^{i-1} = Rot_z(theta) Trans_z(d) Trans_x(a) Rot_x(alpha)."""
    th, al = theta * D2R, alpha * D2R
    ct, st, ca, sa = math.cos(th), math.sin(th), math.cos(al), math.sin(al)
    return [[ct, -st * ca, st * sa, a * ct], [st, ct * ca, -ct * sa, a * st], [0.0, sa, ca, d], [0.0, 0.0, 0.0, 1.0]]


def matmul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def inv_h(T):
    R = [[T[j][i] for j in range(3)] for i in range(3)]
    p = [T[0][3], T[1][3], T[2][3]]
    t = [-(R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]) for i in range(3)]
    return [R[0] + [t[0]], R[1] + [t[1]], R[2] + [t[2]], [0.0, 0.0, 0.0, 1.0]]


def fk(q, dh=DH):
    """Forward kinematics. Mengembalikan (T60, daftar T0i untuk i = 0..6)."""
    T = [[1.0, 0, 0, 0], [0, 1.0, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]
    frames = [T]
    for (a, al, d), th in zip(dh, q):
        T = matmul(T, dh_matrix(th, d, a, al))
        frames.append(T)
    return T, frames


def position(q, dh=DH):
    T, _ = fk(q, dh)
    return [T[0][3], T[1][3], T[2][3]]


def rpy_from_R(R):
    """R = Rz(rz) Ry(ry) Rx(rx), sudut dalam derajat (konvensi RPY controller JAKA)."""
    ry = math.atan2(-R[2][0], math.hypot(R[0][0], R[1][0]))
    if abs(math.cos(ry)) < 1e-9:
        rx, rz = 0.0, math.atan2(-R[0][1], R[1][1])
    else:
        rx, rz = math.atan2(R[2][1], R[2][2]), math.atan2(R[1][0], R[0][0])
    return [rx * R2D, ry * R2D, rz * R2D]


def R_from_rpy(rx, ry, rz):
    a, b, c = rx * D2R, ry * D2R, rz * D2R
    ca, sa, cb, sb, cc, sc = math.cos(a), math.sin(a), math.cos(b), math.sin(b), math.cos(c), math.sin(c)
    return [
        [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa],
        [sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa],
        [-sb, cb * sa, cb * ca],
    ]


def pose_from_T(T):
    """[x, y, z] dalam mm dan [rx, ry, rz] dalam derajat."""
    return [T[0][3] * 1000, T[1][3] * 1000, T[2][3] * 1000] + rpy_from_R(T)


def T_from_pose(pose):
    R = R_from_rpy(*pose[3:6])
    return [R[0] + [pose[0] / 1000], R[1] + [pose[1] / 1000], R[2] + [pose[2] / 1000], [0, 0, 0, 1.0]]


def wrap(v):
    v = ((v + 180.0) % 360.0 + 360.0) % 360.0 - 180.0
    return 180.0 if v == -180.0 else v


def _near_in_limits(v, ref, lim):
    """Pilih v + 360k yang berada dalam batas sendi dan paling dekat dengan ref."""
    best = None
    for k in range(-2, 3):
        c = v + 360.0 * k
        if lim[0] - 1e-6 <= c <= lim[1] + 1e-6 and (best is None or abs(c - ref) < abs(best - ref)):
            best = c
    return best


def ik(T, q_ref=None, dh=DH, limits=LIMITS):
    """IK geometri rumus tertutup (sama dengan igSolve di simulator).

    Struktur ZU5: sumbu sendi 2, 3, 4 sejajar. Maksimal 8 solusi.
    Mengembalikan daftar dict {q, err_mm, ok}, diurutkan dari yang paling dekat dengan q_ref.
    """
    q_ref = q_ref or READY
    r = D2R
    a2, a3 = dh[1][0], dh[2][0]
    D = dh[1][2] + dh[2][2] + dh[3][2]
    d6 = dh[5][2]
    p6 = [T[0][3], T[1][3], T[2][3]]
    z6 = [T[0][2], T[1][2], T[2][2]]
    p5 = [p6[i] + d6 * z6[i] for i in range(3)]
    rho = math.hypot(p5[0], p5[1])
    out = []
    if rho < abs(D) - 1e-9:
        return out
    phi = math.atan2(p5[1], p5[0])
    g = math.asin(max(-1.0, min(1.0, D / rho)))
    for t1 in (phi + g, phi + math.pi - g):
        s1, c1 = math.sin(t1), math.cos(t1)
        c5 = (D - (p6[0] * s1 - p6[1] * c1)) / d6
        if abs(c5) > 1 + 1e-7:
            continue
        c5 = max(-1.0, min(1.0, c5))
        for sg5 in (1, -1):
            t5 = sg5 * math.acos(c5)
            s5 = math.sin(t5)
            v = [T[0][k] * s1 - T[1][k] * c1 for k in range(3)]
            t6 = q_ref[5] * r if abs(s5) < 1e-7 else math.atan2(v[1] / s5, v[0] / s5)
            A1 = dh_matrix(t1 / r, dh[0][2], dh[0][0], dh[0][1])
            A5 = dh_matrix(t5 / r, dh[4][2], dh[4][0], dh[4][1])
            A6 = dh_matrix(t6 / r, dh[5][2], dh[5][0], dh[5][1])
            T14 = matmul(matmul(matmul(inv_h(A1), T), inv_h(A6)), inv_h(A5))
            x, y = T14[0][3], T14[1][3]
            t234 = math.atan2(T14[1][0], T14[0][0])
            c3 = (x * x + y * y - a2 * a2 - a3 * a3) / (2 * a2 * a3)
            if abs(c3) > 1 + 1e-7:
                continue
            c3 = max(-1.0, min(1.0, c3))
            for sg3 in (1, -1):
                t3 = sg3 * math.acos(c3)
                t2 = math.atan2(y, x) - math.atan2(a3 * math.sin(t3), a2 + a3 * math.cos(t3))
                t4 = t234 - t2 - t3
                raw = [wrap(t / r) for t in (t1, t2, t3, t4, t5, t6)]
                q = [_near_in_limits(raw[i], q_ref[i], limits[i]) for i in range(6)]
                ok = all(v is not None for v in q)
                q = [raw[i] if q[i] is None else q[i] for i in range(6)]
                F, _ = fk(q, dh)
                err = math.hypot(math.hypot(F[0][3] - p6[0], F[1][3] - p6[1]), F[2][3] - p6[2]) * 1000
                out.append({"q": q, "err_mm": err, "ok": ok})
    out.sort(key=lambda s: (not s["ok"], sum(abs(a - b) for a, b in zip(s["q"], q_ref))))
    return out


def ik_pose(pose, q_ref=None):
    """IK dari [x, y, z (mm), rx, ry, rz (derajat)]. Mengembalikan solusi terbaik atau None."""
    sols = [s for s in ik(T_from_pose(pose), q_ref) if s["ok"] and s["err_mm"] < 0.5]
    return sols[0]["q"] if sols else None


def ik_xyz(x_mm, y_mm, z_mm, q_ref=None):
    """IK ke posisi x, y, z dengan orientasi alat dipertahankan seperti pada q_ref."""
    q_ref = q_ref or READY
    T, _ = fk(q_ref)
    T = [row[:] for row in T]
    T[0][3], T[1][3], T[2][3] = x_mm / 1000, y_mm / 1000, z_mm / 1000
    sols = [s for s in ik(T, q_ref) if s["ok"] and s["err_mm"] < 0.5]
    return sols[0]["q"] if sols else None


def jacobian(q, dh=DH):
    """Jacobian geometri 6x6 (baris 0..2 linear m/rad, baris 3..5 angular)."""
    _, F = fk(q, dh)
    o6 = [F[6][0][3], F[6][1][3], F[6][2][3]]
    J = [[0.0] * 6 for _ in range(6)]
    for i in range(6):
        z = [F[i][0][2], F[i][1][2], F[i][2][2]]
        o = [F[i][0][3], F[i][1][3], F[i][2][3]]
        d = [o6[k] - o[k] for k in range(3)]
        lin = [z[1] * d[2] - z[2] * d[1], z[2] * d[0] - z[0] * d[2], z[0] * d[1] - z[1] * d[0]]
        for k in range(3):
            J[k][i], J[k + 3][i] = lin[k], z[k]
    return J


def det(M):
    """Determinan dengan eliminasi Gauss (untuk peringatan singular)."""
    A = [row[:] for row in M]
    n, s = len(A), 1.0
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(A[r][c]))
        if abs(A[p][c]) < 1e-15:
            return 0.0
        if p != c:
            A[c], A[p] = A[p], A[c]
            s = -s
        s *= A[c][c]
        for r in range(c + 1, n):
            f = A[r][c] / A[c][c]
            for k in range(c, n):
                A[r][k] -= f * A[c][k]
    return s


def quintic(t, T):
    """Profil waktu kuintik s(t): kecepatan dan percepatan nol di kedua ujung."""
    if T <= 0:
        return 1.0
    u = max(0.0, min(1.0, t / T))
    return 10 * u**3 - 15 * u**4 + 6 * u**5


def sync_time(q0, q1, w_max_deg_s):
    """T = max |dq_i| / w_max, supaya keenam sendi selesai bersamaan."""
    return max(abs(b - a) for a, b in zip(q0, q1)) / max(w_max_deg_s, 1e-6)
