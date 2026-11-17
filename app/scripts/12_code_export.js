/* 12_code_export.js
   Code export: generate Python, MATLAB and Simulink code from the current page parameters.
   Classic script: all files share one global scope and are loaded in order by index.html. */
// ===== Sesi 22: Ekspor kode Python/MATLAB/Simulink (JAKA FK/IK/Blok Diagram) =====
function numFmt(v, nd) {
  return (+v).toFixed(nd === undefined ? 6 : nd);
}
function pyList(arr, nd) {
  return '[' + arr.map(v => numFmt(v, nd)).join(', ') + ']';
}
function matList(arr, nd) {
  return '[' + arr.map(v => numFmt(v, nd)).join(' ') + ']';
}
function matCol(arr, nd) {
  return '[' + arr.map(v => numFmt(v, nd)).join(';') + ']';
}
function pyMat(rows, nd) {
  return '[\n' + rows.map(r => '  ' + pyList(r, nd) + ',').join('\n') + '\n]';
}
function matMat(rows, nd) {
  return '[\n' + rows.map(r => '  ' + matList(r, nd) + ';').join('\n') + '\n]';
}
function matMatFlat(rows, nd) {
  return '[' + rows.map(r => matList(r, nd).slice(1, -1)).join('; ') + ']';
}

function codeHeader(lang, pageLabel, cfg, extraNote) {
  const ts = cfg.genAt.replace('T', ' ').slice(0, 19) + ' UTC';
  let lines = [
    'Kode dibangkitkan otomatis dari Vector7DofSimulator (JAKA ZU5), halaman ' + pageLabel + '.',
    'Dibuat: ' + ts + '.',
    'Konvensi: Denavit-Hartenberg standar, frame base robot (Z ke atas), sama dengan yang',
    'ditampilkan di halaman ini. Tabel DH dan angka lain diambil dari nilai yang sedang diatur',
    'di halaman ini saat kode ini dibuat.',
    'DH diturunkan dari geometri CAD (STEP) pose nol, BUKAN dari manual servis resmi JAKA;',
    'massa link adalah estimasi kasar dari volume mesh, dan parameter motor (K, N, arus) masih',
    'placeholder. Lihat README.md proyek untuk detail dan status verifikasi.'
  ];
  if (extraNote) {
    lines.push('');
    lines = lines.concat(String(extraNote).split('\n'));
  }
  const pre = lang === 'py' ? '# ' : '% ';
  return lines.map(l => (l ? pre + l : pre.trim())).join('\n');
}

// Potret parameter halaman untuk pembangkit kode (tidak bergantung Simpan Konfigurasi)
function rpCodeCfg(page) {
  const dh = joints6.map(j => [j.a, j.alpha, j.d]);
  const thMin = joints6.map(j => j.thMin),
    thMax = joints6.map(j => j.thMax);
  const theta = joints6.map(j => +j.theta.toFixed(4));
  const payloadKg = activePayloadKg();
  const mass = dashParams.linkMass.slice();
  const com = linkProps.map(p => [p.com.x, p.com.y, p.com.z]);
  const motor = rpClone(motorParams);
  const cfg = {
    page,
    dh,
    thMin,
    thMax,
    theta,
    payloadKg,
    mass,
    com,
    motor,
    torqueMode,
    g: G_ACC,
    genAt: new Date().toISOString()
  };
  if (page === 'ik') {
    const r = document.querySelector('input[name="ikStart"]:checked'),
      tgt = userTargetInputs();
    cfg.target = [tgt.x, tgt.y, tgt.z];
    cfg.startMode = r ? r.value : 'current';
    cfg.startTheta = cfg.startMode === 'home' ? (ZZ.locked ? ZZ.q0.slice() : READY_POSE.slice()) : theta.slice();
  }
  if (page === 'bd') {
    cfg.edges = rpClone(BD.edges);
    const sp = bdSetpoint();
    cfg.setpoint = sp ? sp.p : rpFK({ dh: joints6.map(j => ({ a: j.a, alpha: j.alpha, d: j.d })) }, theta);
    cfg.zzLocked = ZZ.locked;
  }
  return cfg;
}

function pyCodeFK(cfg) {
  return `${codeHeader('py', 'JAKA Forward Kinematics', cfg)}

import numpy as np

def dh_transform(theta_deg, d, a, alpha_deg):
    th = np.radians(theta_deg); al = np.radians(alpha_deg)
    ct, st = np.cos(th), np.sin(th); ca, sa = np.cos(al), np.sin(al)
    return np.array([
        [ct, -st*ca,  st*sa, a*ct],
        [st,  ct*ca, -ct*sa, a*st],
        [0,   sa,     ca,    d   ],
        [0,   0,      0,     1   ],
    ])

# Tabel DH: tiap baris = [a (m), alpha (deg), d (m)] untuk sendi 1..6
DH = ${pyMat(cfg.dh, 6)}

# Sudut sendi saat ini (deg), sesuai slider di halaman ini
theta = ${pyList(cfg.theta, 4)}

def forward_kinematics(theta_deg, dh=DH):
    T = np.eye(4)
    frames = [T.copy()]
    for i in range(6):
        a, alpha, d = dh[i]
        T = T @ dh_transform(theta_deg[i], d, a, alpha)
        frames.append(T.copy())
    return T, frames

if __name__ == "__main__":
    T06, frames = forward_kinematics(theta)
    pos = T06[:3, 3]
    print("Posisi end-effector (frame base DH, meter):")
    print(f"  x = {pos[0]:.6f}")
    print(f"  y = {pos[1]:.6f}")
    print(f"  z = {pos[2]:.6f}")
    print("Matriks transformasi T0_6:")
    print(T06)
`;
}

function matCodeFK(cfg) {
  return `${codeHeader('mat', 'JAKA Forward Kinematics', cfg)}

DH = ${matMat(cfg.dh, 6)};
theta = ${matList(cfg.theta, 4)}; % deg, sesuai slider di halaman ini

[T06, frames] = forward_kinematics_jaka(theta, DH);
pos = T06(1:3,4);
disp('Posisi end-effector (frame base DH, meter):');
fprintf('  x = %.6f\\n', pos(1));
fprintf('  y = %.6f\\n', pos(2));
fprintf('  z = %.6f\\n', pos(3));
disp('Matriks transformasi T0_6:'); disp(T06);

function T = dh_transform(theta_deg, d, a, alpha_deg)
  th = deg2rad(theta_deg); al = deg2rad(alpha_deg);
  ct = cos(th); st = sin(th); ca = cos(al); sa = sin(al);
  T = [ct -st*ca  st*sa  a*ct;
       st  ct*ca -ct*sa  a*st;
       0   sa     ca     d;
       0   0      0      1];
end

function [T, frames] = forward_kinematics_jaka(theta_deg, DH)
  T = eye(4); frames = {T};
  for i = 1:6
    a = DH(i,1); alpha = DH(i,2); d = DH(i,3);
    T = T * dh_transform(theta_deg(i), d, a, alpha);
    frames{end+1} = T;
  end
end
`;
}

function pyCodeIK(cfg) {
  return `${codeHeader('py', 'JAKA Inverse Kinematics', cfg)}

import numpy as np

def dh_transform(theta_deg, d, a, alpha_deg):
    th = np.radians(theta_deg); al = np.radians(alpha_deg)
    ct, st = np.cos(th), np.sin(th); ca, sa = np.cos(al), np.sin(al)
    return np.array([
        [ct, -st*ca,  st*sa, a*ct],
        [st,  ct*ca, -ct*sa, a*st],
        [0,   sa,     ca,    d   ],
        [0,   0,      0,     1   ],
    ])

DH = ${pyMat(cfg.dh, 6)}
JOINT_MIN = ${pyList(cfg.thMin, 2)}  # deg, batas bawah sendi
JOINT_MAX = ${pyList(cfg.thMax, 2)}  # deg, batas atas sendi
theta_start = ${pyList(cfg.startTheta, 4)}  # deg, titik awal iterasi (${cfg.startMode === 'home' ? 'dari 0 Zone' : 'posisi sekarang'})
target = ${pyList(cfg.target, 6)}  # meter, x, y, z, frame base DH

def forward_position(theta_deg, dh=DH):
    T = np.eye(4)
    for i in range(6):
        a, alpha, d = dh[i]
        T = T @ dh_transform(theta_deg[i], d, a, alpha)
    return T[:3, 3]

def solve_ik(target, theta0, dh=DH, jmin=JOINT_MIN, jmax=JOINT_MAX, lam=0.015, max_iter=300, tol=1e-3):
    # Damped Least Squares (posisi saja), sama dengan solver di simulator
    theta = np.array(theta0, dtype=float)
    for _ in range(max_iter):
        p = forward_position(theta, dh)
        e = np.array(target) - p
        if np.linalg.norm(e) < tol:
            break
        d = 0.5  # deg, langkah turunan numerik
        J = np.zeros((3, 6))
        for i in range(6):
            t2 = theta.copy(); t2[i] += d
            J[:, i] = (forward_position(t2, dh) - p) / d
        A = J @ J.T + (lam ** 2) * np.eye(3)
        y = np.linalg.solve(A, e)
        theta = np.clip(theta + J.T @ y, jmin, jmax)
    p_final = forward_position(theta, dh)
    return theta, np.linalg.norm(np.array(target) - p_final)

if __name__ == "__main__":
    theta_sol, err = solve_ik(target, theta_start)
    print("Sudut sendi hasil IK (deg):")
    for i, v in enumerate(theta_sol, start=1):
        print(f"  theta{i} = {v:.4f}")
    print(f"Galat posisi akhir: {err*1000:.4f} mm")
`;
}

function matCodeIK(cfg) {
  return `${codeHeader('mat', 'JAKA Inverse Kinematics', cfg)}

DH = ${matMat(cfg.dh, 6)};
JOINT_MIN = ${matList(cfg.thMin, 2)}; % deg, batas bawah sendi
JOINT_MAX = ${matList(cfg.thMax, 2)}; % deg, batas atas sendi
theta_start = ${matList(cfg.startTheta, 4)}; % deg, titik awal iterasi (${cfg.startMode === 'home' ? 'dari 0 Zone' : 'posisi sekarang'})
target = ${matList(cfg.target, 6)}; % meter, x, y, z, frame base DH

[theta_sol, err] = solve_ik_jaka(target, theta_start, DH, JOINT_MIN, JOINT_MAX);
disp('Sudut sendi hasil IK (deg):'); disp(theta_sol);
fprintf('Galat posisi akhir: %.4f mm\\n', err * 1000);

function T = dh_transform(theta_deg, d, a, alpha_deg)
  th = deg2rad(theta_deg); al = deg2rad(alpha_deg);
  ct = cos(th); st = sin(th); ca = cos(al); sa = sin(al);
  T = [ct -st*ca  st*sa  a*ct;
       st  ct*ca -ct*sa  a*st;
       0   sa     ca     d;
       0   0      0      1];
end

function p = forward_position_jaka(theta_deg, dh)
  T = eye(4);
  for i = 1:6
    T = T * dh_transform(theta_deg(i), dh(i,3), dh(i,1), dh(i,2));
  end
  p = T(1:3,4)';
end

function [theta, err] = solve_ik_jaka(target, theta0, dh, jmin, jmax)
  theta = theta0; lam = 0.015;
  for it = 1:300
    p = forward_position_jaka(theta, dh);
    e = target - p;
    if norm(e) < 1e-3
      break;
    end
    d = 0.5; J = zeros(3,6);
    for i = 1:6
      t2 = theta; t2(i) = t2(i) + d;
      p2 = forward_position_jaka(t2, dh);
      J(:,i) = ((p2 - p) / d)';
    end
    A = J * J' + (lam^2) * eye(3);
    y = A \\ e';
    theta = theta + (J' * y)';
    theta = max(jmin, min(jmax, theta));
  end
  p_final = forward_position_jaka(theta, dh);
  err = norm(target - p_final);
end
`;
}

function pyCodeBD(cfg) {
  const setp = cfg.setpoint.map(v => +v.toFixed(6));
  const note =
    'Blok Trajectory dan Energi/Daya pada diagram butuh lintasan waktu penuh (bukan satu\n' +
    'titik), jadi tidak direproduksi di sini. Kode ini mereproduksi satu evaluasi: Setpoint ->\n' +
    'Inverse Kinematics -> Eksekusi (ideal, tanpa model dinamika) -> Forward Kinematics (umpan\n' +
    'balik) -> Torsi -> Arus, untuk titik acuan Setpoint (' +
    (cfg.zzLocked ? 'dari 0 Zone' : 'posisi end-effector saat ini, 0 Zone belum dikunci') +
    ').\n' +
    'Titik awal iterasi IK memakai 0 derajat semua sendi; ganti THETA0_START kalau perlu titik awal lain.';
  return `${codeHeader('py', 'JAKA + Blok Diagram', cfg, note)}

import numpy as np

def dh_transform(theta_deg, d, a, alpha_deg):
    th = np.radians(theta_deg); al = np.radians(alpha_deg)
    ct, st = np.cos(th), np.sin(th); ca, sa = np.cos(al), np.sin(al)
    return np.array([
        [ct, -st*ca,  st*sa, a*ct],
        [st,  ct*ca, -ct*sa, a*st],
        [0,   sa,     ca,    d   ],
        [0,   0,      0,     1   ],
    ])

DH = ${pyMat(cfg.dh, 6)}
LINK_MASS = ${pyList(cfg.mass, 4)}  # kg, estimasi kasar dari volume mesh STEP
LINK_COM = ${pyMat(cfg.com, 5)}  # meter, pusat massa lokal tiap link (frame sendi ke-i)
PAYLOAD_KG = ${numFmt(cfg.payloadKg, 3)}
MOTOR_K = ${pyList(cfg.motor.K, 4)}  # N.m/A, placeholder
MOTOR_N = ${pyList(cfg.motor.N, 2)}  # rasio gearbox, placeholder
MOTOR_I = ${pyList(cfg.motor.i, 4)}  # A, arus contoh (dipakai kalau TORQUE_MODE == "current")
TORQUE_MODE = "${cfg.torqueMode === 'gravity' ? 'gravity' : 'current'}"  # "gravity" = estimasi statika gravitasi, "current" = tau = K*N*i
G = ${numFmt(cfg.g, 3)}
SETPOINT = ${pyList(setp, 6)}  # meter, x, y, z, frame base DH
THETA0_START = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]  # deg, titik awal iterasi IK

def forward_position(theta_deg, dh=DH):
    T = np.eye(4)
    for i in range(6):
        a, alpha, d = dh[i]
        T = T @ dh_transform(theta_deg[i], d, a, alpha)
    return T, T[:3, 3]

def link_frames(theta_deg, dh=DH):
    T = np.eye(4)
    frames = [T.copy()]
    for i in range(6):
        a, alpha, d = dh[i]
        T = T @ dh_transform(theta_deg[i], d, a, alpha)
        frames.append(T.copy())
    return frames

def solve_ik(target, theta0, dh=DH, lam=0.015, max_iter=300, tol=1e-3):
    theta = np.array(theta0, dtype=float)
    for _ in range(max_iter):
        _, p = forward_position(theta, dh)
        e = np.array(target) - p
        if np.linalg.norm(e) < tol:
            break
        d = 0.5
        J = np.zeros((3, 6))
        for i in range(6):
            t2 = theta.copy(); t2[i] += d
            _, p2 = forward_position(t2, dh)
            J[:, i] = (p2 - p) / d
        A = J @ J.T + (lam ** 2) * np.eye(3)
        y = np.linalg.solve(A, e)
        theta = theta + J.T @ y
    return theta

def potential_energy(theta_deg, payload_kg, dh=DH, mass=LINK_MASS, com=LINK_COM, g=G):
    frames = link_frames(theta_deg, dh)
    e_links = 0.0
    for i in range(6):
        c_local = np.array([com[i][0], com[i][1], com[i][2], 1.0])
        c_world = frames[i + 1] @ c_local
        e_links += mass[i] * g * c_world[2]
    _, p_end = forward_position(theta_deg, dh)
    e_payload = payload_kg * g * p_end[2]
    return e_links + e_payload

def gravity_torque(theta_deg, payload_kg, dh=DH):
    d = 0.25  # deg, langkah turunan numerik torsi
    tau = np.zeros(6)
    for i in range(6):
        a = list(theta_deg); a[i] += d
        b = list(theta_deg); b[i] -= d
        tau[i] = (potential_energy(a, payload_kg, dh) - potential_energy(b, payload_kg, dh)) / (2 * np.radians(d))
    return tau

if __name__ == "__main__":
    theta_cmd = solve_ik(SETPOINT, THETA0_START)          # blok Inverse Kinematics
    # blok Eksekusi 6 Joint: dianggap ideal (theta_aktual = theta_cmd), tanpa model dinamika
    _, p_check = forward_position(theta_cmd)               # blok Forward Kinematics (umpan balik)
    if TORQUE_MODE == "gravity":
        tau = gravity_torque(theta_cmd, PAYLOAD_KG)         # blok Torsi
        KN = np.array(MOTOR_K) * np.array(MOTOR_N)
        i_motor = np.where(KN != 0, tau / KN, 0.0)          # blok Arus motor
    else:
        i_motor = np.array(MOTOR_I)                         # blok Arus motor
        tau = np.array(MOTOR_K) * np.array(MOTOR_N) * i_motor  # blok Torsi

    print("Setpoint (m):", np.round(SETPOINT, 6))
    print("Sudut sendi hasil IK (deg):", np.round(theta_cmd, 4))
    print("Posisi umpan balik FK (m):", np.round(p_check, 6))
    print("Torsi per sendi (N.m):", np.round(tau, 4))
    print("Arus per sendi (A):", np.round(i_motor, 4))
`;
}

function matCodeBD(cfg) {
  const setp = cfg.setpoint.map(v => +v.toFixed(6));
  const note =
    'Blok Trajectory dan Energi/Daya pada diagram butuh lintasan waktu penuh (bukan satu\n' +
    'titik), jadi tidak direproduksi di sini. Kode ini mereproduksi satu evaluasi: Setpoint ->\n' +
    'Inverse Kinematics -> Eksekusi (ideal, tanpa model dinamika) -> Forward Kinematics (umpan\n' +
    'balik) -> Torsi -> Arus, untuk titik acuan Setpoint (' +
    (cfg.zzLocked ? 'dari 0 Zone' : 'posisi end-effector saat ini, 0 Zone belum dikunci') +
    ').\n' +
    'Titik awal iterasi IK memakai 0 derajat semua sendi; ganti THETA0_START kalau perlu titik awal lain.';
  return `${codeHeader('mat', 'JAKA + Blok Diagram', cfg, note)}

DH = ${matMat(cfg.dh, 6)};
LINK_MASS = ${matList(cfg.mass, 4)}; % kg, estimasi kasar dari volume mesh STEP
LINK_COM = ${matMat(cfg.com, 5)}; % meter, pusat massa lokal tiap link (frame sendi ke-i)
PAYLOAD_KG = ${numFmt(cfg.payloadKg, 3)};
MOTOR_K = ${matList(cfg.motor.K, 4)}; % N.m/A, placeholder
MOTOR_N = ${matList(cfg.motor.N, 2)}; % rasio gearbox, placeholder
MOTOR_I = ${matList(cfg.motor.i, 4)}; % A, arus contoh (dipakai kalau TORQUE_MODE = 'current')
TORQUE_MODE = '${cfg.torqueMode === 'gravity' ? 'gravity' : 'current'}'; % 'gravity' atau 'current'
G = ${numFmt(cfg.g, 3)};
SETPOINT = ${matList(setp, 6)}; % meter, x, y, z, frame base DH
THETA0_START = [0 0 0 0 0 0]; % deg, titik awal iterasi IK

theta_cmd = solve_ik_jaka(SETPOINT, THETA0_START, DH); % blok Inverse Kinematics
% blok Eksekusi 6 Joint: dianggap ideal (theta_aktual = theta_cmd), tanpa model dinamika
[~, p_check] = forward_position_jaka(theta_cmd, DH); % blok Forward Kinematics (umpan balik)
if strcmp(TORQUE_MODE, 'gravity')
  tau = gravity_torque_jaka(theta_cmd, PAYLOAD_KG, DH, LINK_MASS, LINK_COM, G); % blok Torsi
  KN = MOTOR_K .* MOTOR_N;
  i_motor = zeros(1,6);
  i_motor(KN ~= 0) = tau(KN ~= 0) ./ KN(KN ~= 0); % blok Arus motor
else
  i_motor = MOTOR_I; % blok Arus motor
  tau = MOTOR_K .* MOTOR_N .* i_motor; % blok Torsi
end

disp('Setpoint (m):'); disp(SETPOINT);
disp('Sudut sendi hasil IK (deg):'); disp(theta_cmd);
disp('Posisi umpan balik FK (m):'); disp(p_check);
disp('Torsi per sendi (N.m):'); disp(tau);
disp('Arus per sendi (A):'); disp(i_motor);

function T = dh_transform(theta_deg, d, a, alpha_deg)
  th = deg2rad(theta_deg); al = deg2rad(alpha_deg);
  ct = cos(th); st = sin(th); ca = cos(al); sa = sin(al);
  T = [ct -st*ca  st*sa  a*ct;
       st  ct*ca -ct*sa  a*st;
       0   sa     ca     d;
       0   0      0      1];
end

function [T, p] = forward_position_jaka(theta_deg, dh)
  T = eye(4);
  for i = 1:6
    T = T * dh_transform(theta_deg(i), dh(i,3), dh(i,1), dh(i,2));
  end
  p = T(1:3,4)';
end

function frames = link_frames_jaka(theta_deg, dh)
  T = eye(4); frames = {T};
  for i = 1:6
    T = T * dh_transform(theta_deg(i), dh(i,3), dh(i,1), dh(i,2));
    frames{end+1} = T;
  end
end

function e = potential_energy_jaka(theta_deg, payload_kg, dh, mass, com, g)
  frames = link_frames_jaka(theta_deg, dh);
  e_links = 0;
  for i = 1:6
    c_world = frames{i+1} * [com(i,1); com(i,2); com(i,3); 1];
    e_links = e_links + mass(i) * g * c_world(3);
  end
  [~, p_end] = forward_position_jaka(theta_deg, dh);
  e = e_links + payload_kg * g * p_end(3);
end

function tau = gravity_torque_jaka(theta_deg, payload_kg, dh, mass, com, g)
  d = 0.25; tau = zeros(1,6);
  for i = 1:6
    a = theta_deg; a(i) = a(i) + d;
    b = theta_deg; b(i) = b(i) - d;
    tau(i) = (potential_energy_jaka(a, payload_kg, dh, mass, com, g) - potential_energy_jaka(b, payload_kg, dh, mass, com, g)) / (2 * deg2rad(d));
  end
end

function theta = solve_ik_jaka(target, theta0, dh)
  theta = theta0; lam = 0.015;
  for it = 1:300
    [~, p] = forward_position_jaka(theta, dh);
    e = target - p;
    if norm(e) < 1e-3
      break;
    end
    d = 0.5; J = zeros(3,6);
    for i = 1:6
      t2 = theta; t2(i) = t2(i) + d;
      [~, p2] = forward_position_jaka(t2, dh);
      J(:,i) = ((p2 - p) / d)';
    end
    A = J * J' + (lam^2) * eye(3);
    y = A \\ e';
    theta = theta + (J' * y)';
  end
end
`;
}

function matCodeSimulink(cfg) {
  const setp = cfg.setpoint.map(v => +v.toFixed(6));
  const note =
    'Blok Trajectory dan Energi/Daya pada diagram diringkas: Trajectory dilewati (satu titik\n' +
    'acuan, bukan lintasan waktu penuh) dan blok Energi diganti Scope torsi/arus (integral energi\n' +
    'butuh lintasan waktu penuh). Blok Setpoint dibuat sebagai Constant sehingga tidak menerima\n' +
    'sambungan balik; kalau ada sambungan balik ke Setpoint di halaman ini, itu diarahkan ke Scope\n' +
    'Posisi di sini, bukan ke Setpoint. Butuh Simulink terpasang; jalankan skrip ini di MATLAB.';
  return `${codeHeader('mat', 'JAKA + Blok Diagram (Simulink)', cfg, note)}

modelName = 'jaka_bd_model';
if bdIsLoaded(modelName)
  close_system(modelName, 0);
end
new_system(modelName);
open_system(modelName);

add_block('simulink/Sources/Constant', [modelName '/Setpoint']);
set_param([modelName '/Setpoint'], 'Value', '${matCol(setp, 6)}', 'Position', '[20 60 170 120]');

add_block('simulink/User-Defined Functions/MATLAB Function', [modelName '/Inverse Kinematics']);
set_param([modelName '/Inverse Kinematics'], 'Position', '[230 60 380 120]');

add_block('simulink/Discrete/Unit Delay', [modelName '/Eksekusi 6 Joint']);
set_param([modelName '/Eksekusi 6 Joint'], 'Position', '[440 60 540 120]');

add_block('simulink/User-Defined Functions/MATLAB Function', [modelName '/Forward Kinematics']);
set_param([modelName '/Forward Kinematics'], 'Position', '[600 60 750 120]');

add_block('simulink/User-Defined Functions/MATLAB Function', [modelName '/Torsi dan Arus']);
set_param([modelName '/Torsi dan Arus'], 'Position', '[440 220 640 300]');

add_block('simulink/Sinks/Scope', [modelName '/Scope Posisi']);
set_param([modelName '/Scope Posisi'], 'Position', '[810 70 850 110]');

add_block('simulink/Sinks/Scope', [modelName '/Scope Torsi Arus']);
set_param([modelName '/Scope Torsi Arus'], 'Position', '[700 230 740 290]');
set_param([modelName '/Scope Torsi Arus'], 'NumInputPorts', '2');

add_line(modelName, 'Setpoint/1', 'Inverse Kinematics/1', 'autorouting', 'on');
add_line(modelName, 'Inverse Kinematics/1', 'Eksekusi 6 Joint/1', 'autorouting', 'on');
add_line(modelName, 'Eksekusi 6 Joint/1', 'Forward Kinematics/1', 'autorouting', 'on');
add_line(modelName, 'Forward Kinematics/1', 'Scope Posisi/1', 'autorouting', 'on');
add_line(modelName, 'Eksekusi 6 Joint/1', 'Torsi dan Arus/1', 'autorouting', 'on');
add_line(modelName, 'Torsi dan Arus/1', 'Scope Torsi Arus/1', 'autorouting', 'on');
add_line(modelName, 'Torsi dan Arus/2', 'Scope Torsi Arus/2', 'autorouting', 'on');

ikLines = {
  'function theta = fcn(p)'
  'DH = ${matMatFlat(cfg.dh, 6)};'
  'theta = zeros(6,1); lam = 0.015; th = theta;'
  'for it = 1:300'
  '  T = eye(4);'
  '  for i = 1:6'
  '    T = T * dh_step(th(i), DH(i,3), DH(i,1), DH(i,2));'
  '  end'
  '  pc = T(1:3,4); e = p - pc;'
  '  if norm(e) < 1e-3'
  '    break;'
  '  end'
  '  d = 0.5; J = zeros(3,6);'
  '  for i = 1:6'
  '    t2 = th; t2(i) = t2(i) + d;'
  '    T2 = eye(4);'
  '    for k = 1:6'
  '      T2 = T2 * dh_step(t2(k), DH(k,3), DH(k,1), DH(k,2));'
  '    end'
  '    J(:,i) = (T2(1:3,4) - pc) / d;'
  '  end'
  '  A = J * transpose(J) + (lam^2) * eye(3);'
  '  y = A \\ e;'
  '  th = th + transpose(J) * y;'
  'end'
  'theta = th;'
  'end'
  ''
  'function T = dh_step(theta_deg, d, a, alpha_deg)'
  'th = deg2rad(theta_deg); al = deg2rad(alpha_deg);'
  'ct = cos(th); st = sin(th); ca = cos(al); sa = sin(al);'
  'T = [ct -st*ca  st*sa  a*ct; st  ct*ca -ct*sa  a*st; 0  sa  ca  d; 0  0  0  1];'
  'end'
};
set_param([modelName '/Inverse Kinematics'], 'Script', strjoin(ikLines, newline));

fkLines = {
  'function p = fcn(theta)'
  'DH = ${matMatFlat(cfg.dh, 6)};'
  'T = eye(4);'
  'for i = 1:6'
  '  T = T * dh_step(theta(i), DH(i,3), DH(i,1), DH(i,2));'
  'end'
  'p = T(1:3,4);'
  'end'
  ''
  'function T = dh_step(theta_deg, d, a, alpha_deg)'
  'th = deg2rad(theta_deg); al = deg2rad(alpha_deg);'
  'ct = cos(th); st = sin(th); ca = cos(al); sa = sin(al);'
  'T = [ct -st*ca  st*sa  a*ct; st  ct*ca -ct*sa  a*st; 0  sa  ca  d; 0  0  0  1];'
  'end'
};
set_param([modelName '/Forward Kinematics'], 'Script', strjoin(fkLines, newline));

taLines = {
  'function [tau, i_out] = fcn(theta)'
  'DH = ${matMatFlat(cfg.dh, 6)};'
  'mass = ${matList(cfg.mass, 4)};'
  'com = ${matMatFlat(cfg.com, 5)};'
  'K = ${matList(cfg.motor.K, 4)};'
  'N = ${matList(cfg.motor.N, 2)};'
  'i_in = ${matList(cfg.motor.i, 4)};'
  'g = ${numFmt(cfg.g, 3)};'
  'mode = ${cfg.torqueMode === 'gravity' ? 1 : 0}; % 1 = gravitasi, 0 = arus input'
  'payload = ${numFmt(cfg.payloadKg, 3)};'
  'if mode == 1'
  '  d = 0.25; tau = zeros(6,1);'
  '  for k = 1:6'
  '    a = theta; a(k) = a(k) + d;'
  '    b = theta; b(k) = b(k) - d;'
  '    tau(k) = (pe_step(a, DH, mass, com, payload, g) - pe_step(b, DH, mass, com, payload, g)) / (2 * deg2rad(d));'
  '  end'
  '  KN = K .* N; i_out = zeros(6,1);'
  '  for k = 1:6'
  '    if KN(k) ~= 0'
  '      i_out(k) = tau(k) / KN(k);'
  '    end'
  '  end'
  'else'
  '  i_out = i_in;'
  '  tau = K .* N .* i_out;'
  'end'
  'end'
  ''
  'function e = pe_step(theta, DH, mass, com, payload, g)'
  'T = eye(4); e = 0;'
  'for i = 1:6'
  '  T = T * dh_step(theta(i), DH(i,3), DH(i,1), DH(i,2));'
  '  c = T * [com(i,1); com(i,2); com(i,3); 1];'
  '  e = e + mass(i) * g * c(3);'
  'end'
  'e = e + payload * g * T(3,4);'
  'end'
  ''
  'function T = dh_step(theta_deg, d, a, alpha_deg)'
  'th = deg2rad(theta_deg); al = deg2rad(alpha_deg);'
  'ct = cos(th); st = sin(th); ca = cos(al); sa = sin(al);'
  'T = [ct -st*ca  st*sa  a*ct; st  ct*ca -ct*sa  a*st; 0  sa  ca  d; 0  0  0  1];'
  'end'
};
set_param([modelName '/Torsi dan Arus'], 'Script', strjoin(taLines, newline));

save_system(modelName);
disp(['Model Simulink dibuat: ' modelName '.slx']);
`;
}

function rpCodeGen(page, lang) {
  const cfg = rpCodeCfg(page);
  if (page === 'fk') return lang === 'py' ? pyCodeFK(cfg) : matCodeFK(cfg);
  if (page === 'ik') return lang === 'py' ? pyCodeIK(cfg) : matCodeIK(cfg);
  if (lang === 'py') return pyCodeBD(cfg);
  if (lang === 'mat') return matCodeBD(cfg);
  return matCodeSimulink(cfg);
}
const RP_CODE = { page: null, lang: 'py' };
const RP_CODE_LANGS = {
  fk: [
    ['py', 'Python'],
    ['mat', 'MATLAB']
  ],
  ik: [
    ['py', 'Python'],
    ['mat', 'MATLAB']
  ],
  bd: [
    ['py', 'Python'],
    ['mat', 'MATLAB'],
    ['sim', 'Simulink']
  ]
};
function rpCodeTabsHtml(page) {
  return RP_CODE_LANGS[page]
    .map(
      ([k, label]) =>
        '<button type="button" class="' +
        (k === RP_CODE.lang ? 'on' : '') +
        '" data-code-lang="' +
        k +
        '">' +
        label +
        '</button>'
    )
    .join('');
}
function rpCodeShow() {
  document.getElementById('lp-code-pre').textContent = rpCodeGen(RP_CODE.page, RP_CODE.lang);
  document.getElementById('lp-code-tabs').innerHTML = rpCodeTabsHtml(RP_CODE.page);
}
function rpCodeOpen(page) {
  const avail = RP_CODE_LANGS[page].map(l => l[0]);
  if (!avail.includes(RP_CODE.lang)) RP_CODE.lang = avail[0];
  RP_CODE.page = page;
  const pageName = { fk: 'FK', ik: 'IK', bd: 'Blok Diagram' }[page];
  document.getElementById('lp-code-t').textContent = tr('lp.code.title') + ' (' + pageName + ')';
  rpCodeShow();
  document.getElementById('lp-code').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function rpCodeClose() {
  document.getElementById('lp-code').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('lp-code-tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-code-lang]');
  if (!b) return;
  RP_CODE.lang = b.dataset.codeLang;
  rpCodeShow();
});
document.getElementById('lp-code-x').addEventListener('click', rpCodeClose);
document.getElementById('lp-code').addEventListener('click', e => {
  if (e.target.id === 'lp-code') rpCodeClose();
});
function rpCodeFallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (e) {}
  document.body.removeChild(ta);
}
document.getElementById('lp-code-copy').addEventListener('click', () => {
  const text = document.getElementById('lp-code-pre').textContent;
  const done = () => toast(tr('lp.code.copied'));
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard
      .writeText(text)
      .then(done)
      .catch(() => {
        rpCodeFallbackCopy(text);
        done();
      });
  else {
    rpCodeFallbackCopy(text);
    done();
  }
});
