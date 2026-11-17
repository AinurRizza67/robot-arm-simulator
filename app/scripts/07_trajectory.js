/* 07_trajectory.js
   Pick-and-place trajectory: quintic timing, Cartesian path, singularity checks, playback HUD.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ TRAJECTORY PICK AND PLACE (Cartesian, IK 6D, time-scaling quintic) ============ */
const TRAJ_SUF = ['', '-ik'];
const TRAJ = {
  plan: null,
  t: 0,
  playing: false,
  last: 0,
  speed: 1,
  kg: 3,
  wmax: 90,
  vmax: 0.25,
  lastFull: 0,
  lastState: null,
  error: ''
};
const quintic = u => {
  u = Math.min(1, Math.max(0, u));
  return u * u * u * (10 - 15 * u + 6 * u * u);
};

function toolFeat(th) {
  const F = computeChain6(th)[6];
  const p = new THREE.Vector3().setFromMatrixPosition(F),
    z = new THREE.Vector3().setFromMatrixColumn(F, 2);
  return [p.x, p.y, p.z, z.x, z.y, z.z];
}
function invertN(M) {
  const n = M.length,
    A = M.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-18) return null;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c];
    for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const f = A[r][c];
        if (f) for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k];
      }
  }
  return A.map(r => r.slice(n));
}
// IK 6D: posisi flange + sumbu z alat menghadap ke bawah (yaw bebas), damped least squares
function ik6d(target, seed, maxIter, zdIn, wOIn) {
  const th = seed.slice(),
    lam = 0.003,
    wO = wOIn === undefined ? 0.5 : wOIn,
    zd = zdIn || [0, -1, 0];
  let err = 1e9,
    eo = 1e9;
  for (let it = 0; it < maxIter; it++) {
    const f = toolFeat(th);
    const e = [
      target[0] - f[0],
      target[1] - f[1],
      target[2] - f[2],
      wO * (zd[0] - f[3]),
      wO * (zd[1] - f[4]),
      wO * (zd[2] - f[5])
    ];
    err = Math.hypot(e[0], e[1], e[2]);
    eo = wO > 0 ? Math.hypot(e[3], e[4], e[5]) / wO : 0;
    if (err < 0.0005 && eo < 0.01) break;
    const J = [[], [], [], [], [], []],
      d = 0.2;
    for (let i = 0; i < 6; i++) {
      const t2 = th.slice();
      t2[i] += d;
      const f2 = toolFeat(t2);
      for (let r = 0; r < 6; r++) J[r][i] = (r < 3 ? f2[r] - f[r] : wO * (f2[r] - f[r])) / d;
    }
    const A = Array.from({ length: 6 }, () => Array(6).fill(0));
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        let s = 0;
        for (let k = 0; k < 6; k++) s += J[r][k] * J[c][k];
        A[r][c] = s + (r === c ? lam * lam : 0);
      }
    const inv = invertN(A);
    if (!inv) break;
    const y = inv.map(row => row.reduce((s, v, k) => s + v * e[k], 0));
    for (let i = 0; i < 6; i++) {
      let dq = 0;
      for (let r = 0; r < 6; r++) dq += J[r][i] * y[r];
      dq = Math.max(-30, Math.min(30, dq));
      th[i] = Math.max(joints6[i].thMin, Math.min(joints6[i].thMax, th[i] + dq));
    }
  }
  return { th, err, eo };
}
function seedList(q0) {
  const seeds = [
    q0.slice(),
    [0, 30, -60, 30, 0, 0],
    [0, -30, 60, -30, 0, 0],
    [0, 60, -90, 30, 0, 0],
    [0, -60, 90, -30, 0, 0]
  ];
  let r = 12345;
  const rnd = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  for (let k = 0; k < 40; k++)
    seeds.push([
      (rnd() - 0.5) * 120,
      (rnd() - 0.5) * 160,
      (rnd() - 0.5) * 160,
      (rnd() - 0.5) * 160,
      (rnd() - 0.5) * 160,
      (rnd() - 0.5) * 160
    ]);
  return seeds;
}
function solvePose(pos, q0) {
  let best = null;
  for (const sd of seedList(q0)) {
    const r = ik6d(pos, sd, 150);
    if (!best || r.err + r.eo * 0.05 < best.err + best.eo * 0.05) best = r;
    if (r.err < 0.001 && r.eo < 0.02) {
      best = r;
      break;
    }
  }
  if (best.err > 0.003 || best.eo > 0.05)
    throw new Error('Target di luar jangkauan atau IK tidak konvergen (galat ' + (best.err * 1000).toFixed(1) + ' mm)');
  return best.th;
}

// segmen: 'joint' (interpolasi sendi), 'line' (garis lurus Cartesian, IK tiap sampel), 'dwell' (diam)
function jointSeg(label, q0, q1, wmax) {
  const dmax = Math.max(...q0.map((v, i) => Math.abs(q1[i] - v)));
  return { type: 'joint', label, q0, q1, T: Math.max(0.6, (1.875 * dmax) / wmax) };
}
function lineSeg(label, pA, pB, qStart, wmax, vmax) {
  const K = 48,
    q = [qStart.slice()];
  let prev = qStart.slice(),
    dqmax = 0;
  for (let k = 1; k <= K; k++) {
    const s = k / K,
      pos = [pA[0] + (pB[0] - pA[0]) * s, pA[1] + (pB[1] - pA[1]) * s, pA[2] + (pB[2] - pA[2]) * s];
    const r = ik6d(pos, prev, 60);
    if (r.err > 0.003)
      throw new Error(
        'IK gagal di sampel ' + k + ' segmen "' + label + '" (galat ' + (r.err * 1000).toFixed(1) + ' mm)'
      );
    for (let i = 0; i < 6; i++) dqmax = Math.max(dqmax, Math.abs(r.th[i] - prev[i]) * K);
    q.push(r.th);
    prev = r.th;
  }
  const L = Math.hypot(pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]);
  return { type: 'line', label, q, T: Math.max(0.6, (1.875 * dqmax) / wmax, (1.875 * L) / vmax) };
}
function segQ(seg, u) {
  const s = quintic(u);
  if (seg.type === 'joint') return seg.q0.map((v, i) => v + (seg.q1[i] - v) * s);
  if (seg.type === 'dwell') return seg.q0;
  const K = seg.q.length - 1,
    x = s * K,
    k = Math.min(K - 1, Math.floor(x)),
    f = x - k;
  return seg.q[k].map((v, i) => v + (seg.q[k + 1][i] - v) * f);
}

function planPickPlace(kg) {
  const w = fkScene.weights.find(x => x.kg === kg),
    hp = new THREE.Vector3().setFromMatrixPosition(w.home),
    sz = w.size;
  const yg = sz + 0.005,
    yh = yg + 0.16,
    q0 = joints6.map(j => j.theta);
  const pick = [hp.x, yg, hp.z],
    place = [hp.x, yg, -hp.z];
  const up = p => [p[0], yh, p[2]];
  const qAbovePick = solvePose(up(pick), q0);
  const segs = [];
  segs.push(jointSeg('Menuju atas balok ' + kg + ' kg', q0, qAbovePick, TRAJ.wmax));
  const sDown = lineSeg('Turun ke balok', up(pick), pick, qAbovePick, TRAJ.wmax, TRAJ.vmax);
  segs.push(sDown);
  const qGrasp = sDown.q[sDown.q.length - 1];
  segs.push({ type: 'dwell', label: 'Ambil balok', q0: qGrasp, T: 0.5, mark: 'grasp' });
  const sUp = lineSeg('Angkat balok', pick, up(pick), qGrasp, TRAJ.wmax, TRAJ.vmax);
  segs.push(sUp);
  const qAbovePlace = solvePose(up(place), sUp.q[sUp.q.length - 1]);
  segs.push(jointSeg('Pindah ke atas lokasi tujuan', sUp.q[sUp.q.length - 1], qAbovePlace, TRAJ.wmax));
  const sDown2 = lineSeg('Turun ke lokasi tujuan', up(place), place, qAbovePlace, TRAJ.wmax, TRAJ.vmax);
  segs.push(sDown2);
  const qPlace = sDown2.q[sDown2.q.length - 1];
  segs.push({ type: 'dwell', label: 'Lepas balok', q0: qPlace, T: 0.5, mark: 'release' });
  const sUp2 = lineSeg('Naik dari lokasi tujuan', place, up(place), qPlace, TRAJ.wmax, TRAJ.vmax);
  segs.push(sUp2);
  segs.push(
    jointSeg(
      ZZ.locked ? 'Kembali ke 0 Zone' : 'Kembali ke pose awal',
      sUp2.q[sUp2.q.length - 1],
      ZZ.locked ? ZZ.q0.slice() : q0,
      TRAJ.wmax
    )
  );
  let t = 0,
    tGrasp = 0,
    tRelease = 0;
  segs.forEach(sg => {
    sg.t0 = t;
    t += sg.T;
    if (sg.mark === 'grasp') tGrasp = sg.t0 + sg.T / 2;
    if (sg.mark === 'release') tRelease = sg.t0 + sg.T / 2;
  });
  const relSeg = segs.find(sg => sg.mark === 'release'),
    Fr = computeChain6(relSeg.q0)[6];
  const placedM = Fr.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, sz / 2 + 0.005));
  return { kg, segs, D: t, tGrasp, tRelease, placedM, q0 };
}

function trajSetWeightState(mode) {
  if (TRAJ.lastState === mode) return;
  TRAJ.lastState = mode;
  const kg = TRAJ.plan.kg;
  if (mode === 'attached') {
    delete placedWeights[kg];
    setPayloadMode(String(kg));
  } else if (mode === 'placed') {
    placedWeights[kg] = TRAJ.plan.placedM.clone();
    setPayloadMode('0');
  } else {
    delete placedWeights[kg];
    setPayloadMode('0');
  }
}
function applyPose(q, full) {
  q.forEach((v, i) => {
    joints6[i].theta = v;
  });
  document.querySelectorAll('#theta-fk input[type=range]').forEach((sl, i) => {
    const r = q[i] - zzOff(i);
    sl.value = r;
    const l = document.getElementById('fkthv' + i);
    if (l) l.textContent = r.toFixed(0) + '°';
  });
  document.querySelectorAll('#theta-ik input[type=range]').forEach((sl, i) => {
    const r = q[i] - zzOff(i);
    sl.value = r;
    const l = document.getElementById('ikthv' + i);
    if (l) l.textContent = r.toFixed(0) + '°';
  });
  if (full) {
    updateFK6();
    updateIKReadout();
  } else {
    poseScene6(fkScene);
    poseScene6(ikScene);
  }
}
function trajApply(t, playing) {
  const P = TRAJ.plan;
  if (!P) return;
  let seg = P.segs[P.segs.length - 1];
  for (const sg of P.segs) {
    if (t < sg.t0 + sg.T) {
      seg = sg;
      break;
    }
  }
  const u = Math.min(1, Math.max(0, (t - seg.t0) / seg.T));
  if (!P.ik) trajSetWeightState(t < P.tGrasp ? 'home' : t < P.tRelease ? 'attached' : 'placed');
  const now = performance.now(),
    full = !playing || now - TRAJ.lastFull > 250;
  if (full) TRAJ.lastFull = now;
  applyPose(segQ(seg, u), full);
  TRAJ.phase = seg.label;
  if (playing)
    TRAJ_SUF.forEach(x => {
      const pr = document.getElementById('traj-prog' + x);
      if (pr) pr.value = Math.round((t / P.D) * 1000);
    });
}
function trajFrame(now) {
  if (!TRAJ.playing) return;
  // timestamp rAF bisa sedikit lebih kecil dari performance.now() saat Play ditekan: dt dijaga tidak negatif
  const dt = Math.max(0, Math.min(0.1, (now - TRAJ.last) / 1000));
  TRAJ.last = now;
  TRAJ.t += dt * TRAJ.speed;
  if (TRAJ.t >= TRAJ.plan.D) {
    TRAJ.t = TRAJ.plan.D;
    TRAJ.playing = false;
    trajApply(TRAJ.t, false);
    applyPose(
      joints6.map(j => j.theta),
      true
    );
    TRAJ.phase = 'Selesai';
    rpCapture(TRAJ.plan);
    if (TRAJ.plan.ik) ikAnimateDone();
    else bdCycleDone();
  } else trajApply(TRAJ.t, true);
  if (TRAJ.playing) requestAnimationFrame(trajFrame);
}
function trajStatus(msg) {
  TRAJ_SUF.forEach(x => {
    const el = document.getElementById('traj-status' + x);
    if (el) el.textContent = msg;
  });
}
function trajPlay() {
  if (!ZZ.locked) {
    trajStatus('Kunci 0 Zone dulu sebelum menjalankan trajectory');
    return;
  }
  try {
    if (TRAJ.plan && TRAJ.plan.ik && TRAJ.t >= TRAJ.plan.D) {
      TRAJ.plan = null;
      TRAJ.t = 0;
    }
    const needPlan = !TRAJ.plan || (!TRAJ.plan.ik && TRAJ.plan.kg !== TRAJ.kg) || TRAJ.replan || TRAJ.t >= TRAJ.plan.D;
    if (needPlan) {
      if (TRAJ.plan) trajReset(true);
      trajStatus('Menghitung trajectory...');
      TRAJ.plan = planPickPlace(TRAJ.kg);
      TRAJ.t = 0;
      TRAJ.lastState = null;
      TRAJ.replan = false;
      TRAJ.plan.src = BDLOOP.on ? 'bd' : JK.cur; // halaman pemilik rekaman (Mode Laporan)
      resetEnergy();
    }
  } catch (e) {
    TRAJ.plan = null;
    trajStatus('Gagal: ' + e.message);
    return;
  }
  trajStatus('Berjalan, durasi total ' + TRAJ.plan.D.toFixed(1) + ' s');
  TRAJ.playing = true;
  TRAJ.last = performance.now();
  requestAnimationFrame(trajFrame);
}
function trajPause() {
  TRAJ.playing = false;
  trajStatus('Jeda');
}
function trajReset(silent) {
  TRAJ.playing = false;
  if (TRAJ.plan) {
    TRAJ.t = 0;
    TRAJ.lastState = null;
    if (!TRAJ.plan.ik) {
      Object.keys(placedWeights).forEach(k => delete placedWeights[k]);
      setPayloadMode('0');
    }
    applyPose(TRAJ.plan.q0, true);
  }
  TRAJ.plan = null;
  TRAJ.t = 0;
  TRAJ.phase = '';
  TRAJ_SUF.forEach(x => {
    const pr = document.getElementById('traj-prog' + x);
    if (pr) pr.value = 0;
  });
  if (!silent) trajStatus('Siap');
}
function trajHud() {
  const els = TRAJ_SUF.map(x => document.getElementById('traj-hud' + x)).filter(Boolean);
  if (!els.length) return;
  const tau = totalTau(),
    mx = Math.max(...tau.map(Math.abs)),
    k = tau.map(Math.abs).indexOf(mx);
  const lines = ['Payload: ' + activePayloadKg() + ' kg', 'Fase: ' + (TRAJ.phase || 'diam')];
  if (document.body.dataset.mode !== 'jaka')
    lines.push(
      'τ maks: ' + mx.toFixed(2) + ' N·m (J' + (k + 1) + ')',
      'P mekanik: ' + liveState.P.toFixed(1) + ' W',
      'E mekanik: ' + liveState.E.toFixed(1) + ' J',
      'E mekanik absolut: ' + liveState.Eabs.toFixed(1) + ' J',
      'E elektrik: ' + liveState.Ee.toFixed(0) + ' J',
      'ΔE potensial: ' + (potentialEnergy().total - liveState.Ep0).toFixed(1) + ' J'
    );
  els.forEach(el => {
    el.innerHTML = lines.join('<br>');
  });
}
const syncVal = (id, v) =>
  TRAJ_SUF.forEach(x => {
    const el = document.getElementById(id + x);
    if (el) el.value = v;
  });
TRAJ_SUF.forEach(x => {
  const $ = id => document.getElementById(id + x);
  $('traj-kg').addEventListener('change', e => {
    TRAJ.kg = +e.target.value;
    syncVal('traj-kg', e.target.value);
  });
  $('traj-speed').addEventListener('change', e => {
    TRAJ.speed = +e.target.value;
    syncVal('traj-speed', e.target.value);
  });
  $('traj-wmax').addEventListener('change', e => {
    TRAJ.wmax = Math.max(10, parseFloat(e.target.value) || 90);
    TRAJ.replan = true;
    syncVal('traj-wmax', e.target.value);
  });
  $('torque-mode').addEventListener('change', e => {
    torqueMode = e.target.value;
    syncVal('torque-mode', e.target.value);
    resetEnergy();
  });
  $('traj-play').addEventListener('click', trajPlay);
  $('traj-pause').addEventListener('click', trajPause);
  $('traj-reset').addEventListener('click', () => trajReset(false));
  $('traj-prog').addEventListener('input', e => {
    if (!TRAJ.plan) {
      e.target.value = 0;
      return;
    }
    TRAJ.playing = false;
    TRAJ.t = (e.target.value / 1000) * TRAJ.plan.D;
    trajApply(TRAJ.t, false);
    applyPose(
      joints6.map(j => j.theta),
      true
    );
    trajStatus('Jeda (t = ' + TRAJ.t.toFixed(1) + ' s)');
  });
});

function renderGravityTorqueBlocks(el, tau) {
  const cur = currentI(tau);
  const gl = tau.map(
    (t, i) =>
      '\\tau_' +
      (i + 1) +
      '&=\\frac{\\partial U}{\\partial q_' +
      (i + 1) +
      '}=' +
      hl('gtau' + i, t, 3) +
      '\\ \\mathrm{N\\cdot m},\\quad i_' +
      (i + 1) +
      '=\\frac{\\tau_' +
      (i + 1) +
      '}{K_' +
      (i + 1) +
      'N_' +
      (i + 1) +
      '}=' +
      hl('gie' + i, cur[i], 2) +
      '\\ \\mathrm{A}'
  );
  renderBlocks(el, [
    {
      label: '1. Bentuk umum: torsi statis penahan gravitasi (bukan dinamika penuh)',
      tex: '\\tau_{g,i}=\\frac{\\partial U}{\\partial q_i},\\qquad U=\\sum_{k}m_k\\,g\\,h_k(q)\\quad(k:\\ \\text{link 1 sampai 6 dan payload})'
    },
    {
      label: '2. Substitusi nilai (turunan numerik U terhadap q) dan arus estimasi',
      tex: '\\begin{aligned}' + gl.join('\\\\') + '\\end{aligned}'
    }
  ]);
}

/* ============ INDIKATOR POSE (kasar) ============ */
const POSE_MIN_DIST = 0.035; // m, jarak minimum antar garis sumbu link non-tetangga
function segSegDist(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1),
    d2 = q2.clone().sub(p2),
    r = p1.clone().sub(p2);
  const a = d1.dot(d1),
    e = d2.dot(d2),
    f = d2.dot(r),
    cl = THREE.MathUtils.clamp;
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) return r.length();
  if (a <= 1e-12) {
    s = 0;
    t = cl(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-12) {
      t = 0;
      s = cl(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2),
        den = a * e - b * b;
      s = den > 1e-12 ? cl((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = cl(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = cl((b - c) / a, 0, 1);
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
function poseIssues() {
  const P = computeChain6().map(m => new THREE.Vector3().setFromMatrixPosition(m)),
    out = [];
  for (let i = 1; i <= 6; i++) if (P[i].y < -0.005) out.push('sendi ' + i + ' menembus lantai');
  for (let i = 0; i < 6; i++)
    for (let k = i + 2; k < 6; k++)
      if (segSegDist(P[i], P[i + 1], P[k], P[k + 1]) < POSE_MIN_DIST)
        out.push('link ' + (i + 1) + ' dan link ' + (k + 1) + ' bertabrakan');
  return out;
}

/* ============ SESI 9: PANDUAN DAN ISTILAH ============ */
function renderDhGuide() {
  const b = document.getElementById('pd-dh-body');
  if (!b) return;
  const notes = [
    'waist, rotasi pada sumbu Z vertikal',
    'bahu, sejajar joint 3 dan 4',
    'siku, sejajar joint 2 dan 4',
    'wrist 1, sejajar joint 2 dan 3',
    'wrist 2, tegak lurus joint 4',
    'wrist 3, flange (titik alat)'
  ];
  b.innerHTML = joints6
    .map(
      (j, i) =>
        '<tr><td class="jname">' +
        (i + 1) +
        '</td><td>θ' +
        (i + 1) +
        '</td><td>' +
        j.d +
        '</td><td>' +
        j.a +
        '</td><td>' +
        j.alpha +
        '</td><td>' +
        notes[i] +
        '</td></tr>'
    )
    .join('');
}
renderDhGuide();
document.querySelectorAll('[data-goto]').forEach(a =>
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.getElementById(a.dataset.goto);
    if (!t) return;
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    t.classList.remove('pd-hl');
    void t.offsetWidth;
    t.classList.add('pd-hl');
  })
);
document.addEventListener('DOMContentLoaded', function () {
  if (window.renderMathInElement) {
    renderMathInElement(document.getElementById('guide-content'), {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
});

/* ============ ANIMASI PENYELESAIAN IK (gerak lurus dari pose sekarang ke target) ============ */
// Alih-alih melompat langsung ke solusi akhir, end-effector digerakkan lurus dari posisi sekarang ke target;
// tiap sampel diselesaikan IK dengan tebakan awal dari sampel sebelumnya sehingga sendi bergerak mulus (norma minimum).
function ikPathPlan(target) {
  const q0 = joints6.map(j => j.theta),
    F0 = computeChain6(q0)[6];
  const p0 = new THREE.Vector3().setFromMatrixPosition(F0),
    z0 = new THREE.Vector3().setFromMatrixColumn(F0, 2),
    zh = [z0.x, z0.y, z0.z];
  const pB = [target.x, target.y, target.z],
    K = 60,
    q = [q0.slice()];
  let prev = q0.slice(),
    dqmax = 0,
    mode = 'orientasi alat ditahan',
    reached = 0;
  for (let k = 1; k <= K; k++) {
    const s = k / K,
      pos = [p0.x + (pB[0] - p0.x) * s, p0.y + (pB[1] - p0.y) * s, p0.z + (pB[2] - p0.z) * s];
    let r = ik6d(pos, prev, 80, zh, 0.5);
    if (r.err > 0.003) r = ik6d(pos, prev, 80, zh, 0.05);
    if (r.err > 0.003) {
      r = ik6d(pos, prev, 80, zh, 0);
      if (r.err <= 0.003) mode = 'orientasi alat dibiarkan bebas';
    }
    if (r.err > 0.003) break;
    for (let i = 0; i < 6; i++) dqmax = Math.max(dqmax, Math.abs(r.th[i] - prev[i]) * K);
    q.push(r.th);
    prev = r.th;
    reached = k;
  }
  const L = Math.hypot(pB[0] - p0.x, pB[1] - p0.y, pB[2] - p0.z);
  const seg = {
    type: 'line',
    label: 'Gerak lurus menuju target IK',
    t0: 0,
    q,
    T: Math.max(0.8, (1.875 * dqmax) / TRAJ.wmax, (1.875 * L) / 0.4)
  };
  return {
    ik: true,
    kg: 0,
    segs: [seg],
    D: seg.T,
    tGrasp: Infinity,
    tRelease: Infinity,
    q0,
    target,
    frac: reached / K,
    reachedAll: reached === K,
    mode
  };
}
function ikAnimate(target) {
  const st = document.getElementById('ikStatus');
  const plan = ikPathPlan(target);
  if (plan.segs[0].q.length < 2) {
    st.className = 'status warn';
    st.textContent =
      'Tidak ada gerak: target tidak terjangkau dari pose sekarang (di luar jangkauan atau tepat di singularitas). Coba Reset atau target lain.';
    return;
  }
  plan.src = 'ik';
  plan.payload0 = activePayloadKg();
  REP.ik = {
    method: 'path6d',
    at: new Date().toISOString(),
    start: plan.q0.slice(),
    target: userTargetInputs(),
    mode: plan.mode
  };
  TRAJ.plan = plan;
  TRAJ.t = 0;
  TRAJ.lastState = null;
  TRAJ.playing = true;
  TRAJ.last = performance.now();
  TRAJ.phase = plan.segs[0].label;
  st.className = 'status ok';
  st.textContent = 'Menganimasikan IK: gerak lurus ke target (' + plan.mode + '), durasi ' + plan.D.toFixed(1) + ' s.';
  trajStatus('Animasi IK berjalan');
  requestAnimationFrame(trajFrame);
}
function ikAnimateDone() {
  const P = TRAJ.plan,
    st = document.getElementById('ikStatus'),
    ee = eeFromThetas6(),
    t = P.target;
  const err = Math.hypot(t.x - ee.x, t.y - ee.y, t.z - ee.z);
  buildIKTheta();
  buildFKUi();
  if (P.reachedAll && err < 0.003) {
    st.className = 'status ok';
    st.textContent = 'Konvergen, error ' + (err * 1000).toFixed(2) + ' mm (' + P.mode + ').';
  } else {
    st.className = 'status warn';
    st.textContent =
      'Berhenti di ' +
      Math.round(P.frac * 100) +
      '% jalur, error ' +
      (err * 1000).toFixed(0) +
      ' mm: target di luar jangkauan atau mendekati singularity dari pose ini.';
  }
  appendPlotData('ik');
  renderDHMatrices6('math-display-ik');
  updateHandPose('ik');
  updateTargetViz();
  trajStatus('Selesai');
}

/* ============ MARKA TARGET IK, ISI TARGET DARI BALOK, METERAN ============ */
function userTargetInputs() {
  return {
    x: parseFloat(document.getElementById('tx').value) || 0,
    y: parseFloat(document.getElementById('ty').value) || 0,
    z: parseFloat(document.getElementById('tz').value) || 0
  };
}
function targetFromInputs() {
  return fromUser(userTargetInputs());
} // frame layar, untuk IK dan render
function updateTargetViz() {
  const sc = ikScene,
    t = targetFromInputs(),
    ee = eeFromThetas6(),
    tv = new THREE.Vector3(t.x, t.y, t.z);
  sc.targetMarker.position.copy(tv);
  sc.targetMarker.visible = true;
  sc.pathLine.geometry.setFromPoints([ee, tv]);
  sc.pathLine.computeLineDistances();
  sc.pathLine.visible = true;
  sc.targetLabel.position.set(t.x, t.y + 0.09, t.z);
  sc.targetLabel.visible = true;
  const tu = userTargetInputs();
  sc.targetLabel.userData.set([
    'Target IK',
    'x ' + tu.x.toFixed(2) + '  y ' + tu.y.toFixed(2) + '  z ' + tu.z.toFixed(2)
  ]);
}
['tx', 'ty', 'tz'].forEach(id => document.getElementById(id).addEventListener('input', updateTargetViz));
document.querySelectorAll('.ik-fill').forEach(b =>
  b.addEventListener('click', () => {
    const w = ikScene.weights.find(x => x.kg === +b.dataset.kg),
      hp = new THREE.Vector3().setFromMatrixPosition(w.home);
    const hu = toUser(hp);
    document.getElementById('tx').value = hu.x.toFixed(3);
    document.getElementById('ty').value = hu.y.toFixed(3);
    document.getElementById('tz').value = (w.size + 0.005).toFixed(3);
    updateTargetViz();
  })
);
document.querySelectorAll('.ruler-toggle').forEach(cb =>
  cb.addEventListener('change', () => {
    [fkScene, ikScene].forEach(sc => {
      sc.rulers.visible = cb.checked;
    });
    document.querySelectorAll('.ruler-toggle').forEach(o => {
      o.checked = cb.checked;
    });
  })
);
updateTargetViz();

/* ============ SESI 10: PERINGATAN INDIKATIF (bukan analisis stabilitas) ============ */
// Hanya perbandingan angka: torsi vs kapasitas motor (placeholder), determinan Jacobian, batas sudut, lantai dan tabrakan kasar.
const SING_DET_MIN = 1e-3; // |det J| (m^3), sekitar persentil 10 pose acak; pose ambil balok bernilai sekitar 7e-2
function warnList() {
  const out = poseIssues(),
    tau = totalTau();
  tau.forEach((t, i) => {
    const r = dashParams.rated[i];
    if (r > 0 && Math.abs(t) > r)
      out.push('τ' + (i + 1) + ' = ' + Math.abs(t).toFixed(0) + ' N·m melebihi kapasitas motor (' + r + ' N·m)');
  });
  const d = Math.abs(det6(jacobian6().J));
  if (d < SING_DET_MIN) out.push('mendekati singularity (|det J| = ' + d.toExponential(1) + '), presisi gerak menurun');
  joints6.forEach((j, i) => {
    if (j.thMax - j.thMin < 359 && (j.theta - j.thMin < 5 || j.thMax - j.theta < 5))
      out.push('q' + (i + 1) + ' mendekati batas sudut');
  });
  return out;
}
let warnLast = '';
function warnUpdate() {
  const w = warnList(),
    msg = w.length
      ? 'Peringatan indikatif: ' + w.slice(0, 4).join('; ') + (w.length > 4 ? ' (+' + (w.length - 4) + ' lainnya)' : '')
      : 'Tidak ada peringatan';
  if (msg === warnLast) return;
  warnLast = msg;
  document.querySelectorAll('.pose-check').forEach(el => {
    el.className = (w.length ? 'status warn' : 'status ok') + ' pose-check';
    el.textContent = msg;
  });
}
