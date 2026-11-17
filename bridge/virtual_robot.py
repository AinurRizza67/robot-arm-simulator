"""Robot virtual dengan antarmuka yang meniru jkrc.RC (SDK JAKA 2.2.2).

Dipakai untuk mencoba aplikasi tanpa robot fisik. Semua fungsi mengembalikan tuple
dengan kode 0 di elemen pertama, sudut dalam radian dan posisi dalam mm, persis
seperti SDK asli, sehingga lapisan di atasnya tidak perlu tahu robot mana yang dipakai.
Gerak dihitung oleh thread 50 Hz memakai model kinematika kinematics.
"""

import math
import threading
import time

import kinematics as M

R2D, D2R = M.R2D, M.D2R
DT = 0.02


class VirtualRobot:
    def __init__(self, ip="virtual"):
        self.ip = ip
        self.q = list(M.READY)  # derajat
        self.power = False
        self.enabled = False
        self.rate = 1.0
        self.payload = (0.0, [0.0, 0.0, 0.0])
        self.do = [0] * 16
        self._motion = None  # fungsi langkah gerak aktif
        self._lock = threading.Lock()
        self._run = False

    # ---------- sesi ----------
    def login(self):
        self._run = True
        threading.Thread(target=self._loop, daemon=True).start()
        return (0,)

    def logout(self):
        self._run = False
        return (0,)

    def get_sdk_version(self):
        return (0, "virtual")

    def power_on(self):
        self.power = True
        return (0,)

    def power_off(self):
        self.enabled = False
        self.power = False
        self._motion = None
        return (0,)

    def enable_robot(self):
        if not self.power:
            return (-1,)
        self.enabled = True
        return (0,)

    def disable_robot(self):
        self.enabled = False
        self._motion = None
        return (0,)

    def get_robot_state(self):
        return (0, (0, int(self.power), int(self.enabled)))

    # ---------- baca ----------
    def get_joint_position(self):
        with self._lock:
            return (0, [v * D2R for v in self.q])

    def get_tcp_position(self):
        with self._lock:
            p = M.pose_from_T(M.fk(self.q)[0])
        return (0, p[:3] + [v * D2R for v in p[3:]])

    def is_in_pos(self):
        return (0, self._motion is None)

    def kine_forward(self, q_rad):
        p = M.pose_from_T(M.fk([v * R2D for v in q_rad])[0])
        return (0, p[:3] + [v * D2R for v in p[3:]])

    def kine_inverse(self, ref_rad, pose):
        q = M.ik_pose(pose[:3] + [v * R2D for v in pose[3:]], [v * R2D for v in ref_rad])
        return (0, [v * D2R for v in q]) if q else (-4,)

    def get_robot_status(self):
        # tidak ada data listrik pada robot virtual: semua nol, bentuknya meniru blok monitor SDK
        sendi = [[0.0, 0.0, 25.0, 0.0, 0.0] for _ in range(6)]
        return (0, [0, 0, 30.0, 0.0, 0.0, sendi])

    def set_rapidrate(self, r):
        self.rate = max(0.01, min(1.0, float(r)))
        return (0,)

    def set_payload(self, mass=0.0, centroid=None):
        self.payload = (mass, centroid or [0, 0, 0])
        return (0,)

    def set_digital_output(self, iotype, index, value):
        if 0 <= index < 16:
            self.do[index] = int(bool(value))
        return (0,)

    def get_digital_input(self, iotype, index):
        return (0, 0)

    # ---------- gerak ----------
    def _ready(self):
        return self.power and self.enabled

    def joint_move(self, joint_pos, move_mode, is_block, speed):
        if not self._ready():
            return (-2,)
        tgt = [v * R2D for v in joint_pos]
        if move_mode == 1:
            tgt = [a + b for a, b in zip(self.q, tgt)]
        w = max(1e-3, speed * R2D * self.rate)
        q0 = list(self.q)
        T = max(0.05, M.sync_time(q0, tgt, w) * 1.875)  # puncak kuintik = 1,875 x rata-rata
        t0 = time.time()

        def step():
            s = M.quintic(time.time() - t0, T)
            self.q = [a + (b - a) * s for a, b in zip(q0, tgt)]
            return s >= 1.0

        self._motion = step
        return self._wait(is_block)

    def linear_move(self, end_pos, move_mode, is_block, speed):
        if not self._ready():
            return (-2,)
        p0 = M.pose_from_T(M.fk(self.q)[0])
        tgt = list(end_pos[:3]) + [v * R2D for v in end_pos[3:6]]
        if move_mode == 1:
            tgt = [a + b for a, b in zip(p0, tgt)]
        if M.ik_pose(tgt, self.q) is None:
            return (-4,)
        dist = math.dist(p0[:3], tgt[:3])
        T = max(0.1, dist / max(1e-3, speed * self.rate) * 1.875)
        t0, qref = time.time(), list(self.q)
        rot = [M.wrap(b - a) for a, b in zip(p0[3:], tgt[3:])]

        def step():
            s = M.quintic(time.time() - t0, T)
            p = [a + (b - a) * s for a, b in zip(p0[:3], tgt[:3])] + [a + d * s for a, d in zip(p0[3:], rot)]
            q = M.ik_pose(p, qref)
            if q is None:
                return True
            qref[:] = q
            self.q = q
            return s >= 1.0

        self._motion = step
        return self._wait(is_block)

    def jog(self, aj_num, move_mode, coord_type, jog_vel, pos_cmd):
        """move_mode 0 absolut, 1 inkremental, 2 kontinu; coord_type 0 base, 1 sendi, 2 alat."""
        if not self._ready():
            return (-2,)
        if coord_type == 1:
            if move_mode == 2:
                w = jog_vel * R2D * self.rate * (1 if pos_cmd >= 0 else -1)
                lim = M.LIMITS[aj_num]
                last = [time.time()]

                def step():
                    now = time.time()
                    v = self.q[aj_num] + w * (now - last[0])
                    last[0] = now
                    q = list(self.q)
                    q[aj_num] = max(lim[0], min(lim[1], v))
                    self.q = q
                    return False

                self._motion = step
                return (0,)
            dq = [0.0] * 6
            dq[aj_num] = pos_cmd
            return self.joint_move(dq, 1, False, jog_vel)
        # kartesian (base): sumbu 0..2 translasi mm, 3..5 rotasi rad
        if move_mode == 2:
            sgn = 1 if pos_cmd >= 0 else -1
            last = [time.time()]
            qref = list(self.q)

            def step():
                now = time.time()
                dt, last[0] = now - last[0], now
                p = M.pose_from_T(M.fk(self.q)[0])
                if aj_num < 3:
                    p[aj_num] += sgn * jog_vel * self.rate * dt
                    q = M.ik_pose(p, qref)
                else:
                    T = M.fk(self.q)[0]
                    ang = sgn * jog_vel * self.rate * dt * R2D
                    Rd = M.R_from_rpy(*(ang if k == aj_num - 3 else 0.0 for k in range(3)))
                    R = [[sum(Rd[i][k] * T[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
                    q = M.ik_pose(p[:3] + M.rpy_from_R(R), qref)
                if q is None:
                    return True
                qref[:] = q
                self.q = q
                return False

            self._motion = step
            return (0,)
        d = [0.0] * 6
        d[aj_num] = pos_cmd
        return self.linear_move(d, 1, False, jog_vel if aj_num < 3 else 50.0)

    def jog_stop(self, num):
        self._motion = None
        return (0,)

    def _wait(self, block):
        if block:
            while self._motion is not None and self._run:
                time.sleep(DT)
        return (0,)

    def _loop(self):
        while self._run:
            f = self._motion
            if f is not None and self._ready():
                with self._lock:
                    done = f()
                if done and self._motion is f:
                    self._motion = None
            time.sleep(DT)
