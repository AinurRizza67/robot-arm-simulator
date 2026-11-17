/* 06_config_energy.js
   Robot configuration, presets, Jacobian, gravity torque, energy and live math panels.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ VIEW 9: KONFIGURASI ROBOT ============ */
const PRESET_KEY = 'jakaZu5Presets';
function getPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}');
  } catch (e) {
    return {};
  }
}
function setPresets(p) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(p));
  } catch (e) {}
}

function onRobotConfigChanged() {
  buildFKUi();
  updateFK6();
  buildIKTheta();
  updateIKReadout();
  refreshGhosts6();
  renderDhGuide();
}
function markConfigChanged() {
  configIsPlaceholder = false;
  refreshPlaceholderBanner();
}
function refreshPlaceholderBanner() {
  const b = document.getElementById('cfg-placeholder-banner');
  if (!b) return;
  if (configIsPlaceholder) {
    b.style.display = 'block';
    b.style.color = 'var(--gold)';
    b.style.borderLeftColor = 'var(--gold)';
    b.innerHTML =
      '⚠ Parameter DH & massa di bawah masih <b>placeholder</b> (belum diverifikasi dari manual/CAD resmi JAKA ZU5). Ganti begitu data asli didapat; tanda ini akan hilang otomatis setelah kamu mengubah nilai apa pun.';
  } else {
    b.style.display = 'none';
  }
}
function refreshPresetSelect() {
  const sel = document.getElementById('cfg-preset-select');
  if (!sel) return;
  const presets = getPresets();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Pilih preset</option>';
  Object.keys(presets).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  if (presets[cur]) sel.value = cur;
}
function buildCfgUi() {
  const body = document.getElementById('cfg-dh-body');
  if (!body) return;
  body.innerHTML = '';
  joints6.forEach((j, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="jname">q${i + 1}</td>
      <td><input type="number" step="1" value="${j.thMin}" data-i="${i}" data-k="thMin"></td>
      <td><input type="number" step="1" value="${j.thMax}" data-i="${i}" data-k="thMax"></td>
      <td><input type="number" step="0.001" value="${j.d}" data-i="${i}" data-k="d"></td>
      <td><input type="number" step="0.001" value="${j.a}" data-i="${i}" data-k="a"></td>
      <td><input type="number" step="1" value="${j.alpha}" data-i="${i}" data-k="alpha"></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = +inp.dataset.i,
        k = inp.dataset.k;
      joints6[i][k] = parseFloat(inp.value) || 0;
      if (k === 'thMin' || k === 'thMax')
        joints6[i].theta = Math.max(joints6[i].thMin, Math.min(joints6[i].thMax, joints6[i].theta));
      markConfigChanged();
      onRobotConfigChanged();
    });
  });
  document.getElementById('cfg-total-mass').value = robotMeta.totalMass;
  document.getElementById('cfg-payload-select').value = robotMeta.payloadMode;
  document.getElementById('cfg-payload-custom').value = robotMeta.payloadCustom;
  document.getElementById('cfg-payload-custom-wrap').style.display =
    robotMeta.payloadMode === 'custom' ? 'block' : 'none';
  refreshPlaceholderBanner();
  syncWeights();
  renderDhGuide();
}

document.getElementById('cfg-total-mass').addEventListener('input', e => {
  robotMeta.totalMass = parseFloat(e.target.value) || 0;
  markConfigChanged();
});
document.getElementById('cfg-payload-select').addEventListener('change', e => {
  robotMeta.payloadMode = e.target.value;
  document.getElementById('cfg-payload-custom-wrap').style.display =
    robotMeta.payloadMode === 'custom' ? 'block' : 'none';
  markConfigChanged();
  syncWeights();
});
document.getElementById('cfg-payload-custom').addEventListener('input', e => {
  robotMeta.payloadCustom = parseFloat(e.target.value) || 0;
  markConfigChanged();
});

document.getElementById('cfg-reset-btn').addEventListener('click', () => {
  if (!confirm('Reset semua parameter DH, massa, dan payload ke nilai default (STEP JAKA ZU5)?')) return;
  joints6 = JSON.parse(JSON.stringify(defaultDH));
  robotMeta = JSON.parse(JSON.stringify(defaultRobotMeta));
  configIsPlaceholder = false;
  buildCfgUi();
  buildFKUi();
  updateFK6();
  buildIKTheta();
  updateIKReadout();
  refreshGhosts6();
});
document.getElementById('cfg-save-preset-btn').addEventListener('click', () => {
  appPrompt('Nama preset:', 'JAKA ZU5 (dari STEP resmi)', name => {
    if (!name) return;
    const presets = getPresets();
    presets[name] = {
      joints6: JSON.parse(JSON.stringify(joints6)),
      robotMeta: JSON.parse(JSON.stringify(robotMeta)),
      isPlaceholder: configIsPlaceholder
    };
    setPresets(presets);
    refreshPresetSelect();
    document.getElementById('cfg-preset-select').value = name;
  });
});
document.getElementById('cfg-load-preset-btn').addEventListener('click', () => {
  const name = document.getElementById('cfg-preset-select').value;
  if (!name) return;
  const p = getPresets()[name];
  if (!p) return;
  joints6 = JSON.parse(JSON.stringify(p.joints6));
  robotMeta = JSON.parse(JSON.stringify(p.robotMeta));
  configIsPlaceholder = !!p.isPlaceholder;
  buildCfgUi();
  buildFKUi();
  updateFK6();
  buildIKTheta();
  updateIKReadout();
  refreshGhosts6();
});
document.getElementById('cfg-delete-preset-btn').addEventListener('click', () => {
  const name = document.getElementById('cfg-preset-select').value;
  if (!name) return;
  if (!confirm(`Hapus preset "${name}"?`)) return;
  const presets = getPresets();
  delete presets[name];
  setPresets(presets);
  refreshPresetSelect();
});

/* ============ SESI 6: FORMULA LIVE-BOUND (Jacobian, tau=K*N*i, daya, energi, error IK) ============ */
const motorParams = {
  K: [0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
  N: [100, 100, 100, 100, 100, 100],
  i: [2.1, 2.1, 1.5, 1.0, 0.8, 0.5]
};
const liveState = { prevTheta: null, prevT: 0, P: 0, E: 0, omega: [0, 0, 0, 0, 0, 0], lastKeys: {}, step: null };
const MAX_OMEGA = Math.PI * 4; // rad/s; lonjakan lebih besar (mis. hasil IK) dianggap teleport, bukan gerak

function kx(el, latex) {
  try {
    katex.render(latex, el, { displayMode: true, throwOnError: false, trust: true, strict: false });
  } catch (e) {
    el.textContent = latex;
  }
}
// Angka yang berubah dibungkus \htmlClass{hl} agar berkedip biru lalu memudar (~300 ms)
function hl(key, val, d) {
  const s = (+val).toFixed(d);
  const prev = liveState.lastKeys[key];
  liveState.lastKeys[key] = s;
  return prev !== undefined && prev !== s ? '\\htmlClass{hl}{' + s + '}' : s;
}
function vecTex(key, a, d) {
  return '\\begin{bmatrix}' + a.map((v, k) => hl(key + k, v, d)).join('\\\\') + '\\end{bmatrix}';
}
function renderBlocks(el, blocks) {
  el.innerHTML = '';
  blocks.forEach(b => {
    const lb = document.createElement('div');
    lb.className = 'eq-label';
    lb.textContent = b.label;
    el.appendChild(lb);
    const d = document.createElement('div');
    d.className = 'live-eq';
    el.appendChild(d);
    kx(d, b.tex);
  });
}
let torqueMode = 'gravity';
const inputTau = () => motorParams.K.map((k, i) => k * motorParams.N[i] * motorParams.i[i]);
// Torsi statis penahan gravitasi: tau_i = dU/dq_i (turunan numerik pusat), U = energi potensial link + payload
function gravityTorque() {
  const q = joints6.map(j => j.theta),
    d = 0.25,
    out = [];
  for (let i = 0; i < 6; i++) {
    const a = q.slice(),
      b = q.slice();
    a[i] += d;
    b[i] -= d;
    out.push((potentialEnergy(a).total - potentialEnergy(b).total) / ((2 * d * Math.PI) / 180));
  }
  return out;
}
const totalTau = () => (torqueMode === 'gravity' ? gravityTorque() : inputTau());
function currentI(tau) {
  return torqueMode === 'gravity'
    ? tau.map((t, k) => {
        const d = motorParams.K[k] * motorParams.N[k];
        return d ? t / d : 0;
      })
    : motorParams.i.slice();
}

function jacobian6() {
  const B = new THREE.Matrix4().makeRotationX(Math.PI / 2); // kembali ke frame base DH (Z ke atas)
  const F = computeChain6().map(m => B.clone().multiply(m));
  const pe = new THREE.Vector3().setFromMatrixPosition(F[6]);
  const J = [[], [], [], [], [], []],
    z = [],
    p = [];
  for (let i = 0; i < 6; i++) {
    const zi = new THREE.Vector3().setFromMatrixColumn(F[i], 2),
      pi = new THREE.Vector3().setFromMatrixPosition(F[i]);
    const jv = new THREE.Vector3().crossVectors(zi, pe.clone().sub(pi));
    J[0][i] = jv.x;
    J[1][i] = jv.y;
    J[2][i] = jv.z;
    J[3][i] = zi.x;
    J[4][i] = zi.y;
    J[5][i] = zi.z;
    z.push(zi);
    p.push(pi);
  }
  return { J, z, p, pe };
}
function det6(M) {
  const A = M.map(r => r.slice());
  let det = 1;
  for (let c = 0; c < 6; c++) {
    let piv = c;
    for (let r = c + 1; r < 6; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-14) return 0;
    if (piv !== c) {
      [A[piv], A[c]] = [A[c], A[piv]];
      det = -det;
    }
    det *= A[c][c];
    for (let r = c + 1; r < 6; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 6; k++) A[r][k] -= f * A[c][k];
    }
  }
  return det;
}
function accOpen(id) {
  const b = document.getElementById(id);
  return b && b.classList.contains('open');
}

function renderJacobian() {
  const el = document.getElementById('jac-display-fk');
  if (!el || !window.katex) return;
  const { J, z, p, pe } = jacobian6();
  const c = +document.getElementById('jac-col').value,
    n = c + 1;
  const zi = [z[c].x, z[c].y, z[c].z],
    pi = [p[c].x, p[c].y, p[c].z],
    pev = [pe.x, pe.y, pe.z];
  const d = pev.map((v, k) => v - pi[k]),
    jv = [J[0][c], J[1][c], J[2][c]];
  const rows = J.map((r, ri) => r.map((v, ci) => hl('J' + ri + ci, v, 3)).join(' & '));
  const body = rows.slice(0, 3).join(' \\\\ ') + ' \\\\ \\hline ' + rows.slice(3).join(' \\\\ ');
  renderBlocks(el, [
    {
      label: '1. Bentuk umum (sendi putar / revolute)',
      tex: '\\begin{aligned}J(\\theta)&=\\begin{bmatrix}J_{v}\\\\J_{\\omega}\\end{bmatrix}\\in\\mathbb{R}^{6\\times6}\\\\J_{v,i}&=z_{i-1}\\times\\left(p_e-p_{i-1}\\right)\\quad[\\mathrm{m/rad}]\\\\J_{\\omega,i}&=z_{i-1}\\end{aligned}'
    },
    {
      label: '2. Substitusi nilai untuk kolom i = ' + n + ' (pilih kolom di atas), frame base DH (Z ke atas)',
      tex:
        '\\begin{aligned}z_{' +
        c +
        '}&=' +
        vecTex('jz', zi, 3) +
        '\\\\p_{' +
        c +
        '}&=' +
        vecTex('jp', pi, 3) +
        '\\ \\mathrm{m}\\\\p_e&=' +
        vecTex('je', pev, 3) +
        '\\ \\mathrm{m}\\\\J_{v,' +
        n +
        '}&=z_{' +
        c +
        '}\\times(p_e-p_{' +
        c +
        '})=' +
        vecTex('jzc', zi, 3) +
        '\\times' +
        vecTex('jd', d, 3) +
        '=' +
        vecTex('jv', jv, 3) +
        '\\\\J_{\\omega,' +
        n +
        '}&=z_{' +
        c +
        '}=' +
        vecTex('jzw', zi, 3) +
        '\\end{aligned}'
    },
    {
      label: '3. Hasil: J(θ) lengkap dan determinannya',
      tex:
        'J(\\theta)=\\left[\\begin{array}{cccccc}' +
        body +
        '\\end{array}\\right],\\quad \\det J=' +
        hl('detJ', det6(J), 6)
    }
  ]);
}
function renderTorque() {
  const el = document.getElementById('tau-display-fk'),
    el2 = document.getElementById('energy-display-fk');
  if (!el || !window.katex) return;
  const tau = totalTau(),
    m = motorParams,
    s = liveState.step;
  const tl = tau.map(
    (t, i) =>
      '\\tau_' +
      (i + 1) +
      '&=K_' +
      (i + 1) +
      'N_' +
      (i + 1) +
      'i_' +
      (i + 1) +
      '=' +
      hl('K' + i, m.K[i], 2) +
      '\\times' +
      hl('N' + i, m.N[i], 2) +
      '\\times' +
      hl('i' + i, m.i[i], 2) +
      '=' +
      hl('tau' + i, t, 3) +
      '\\ \\mathrm{N\\cdot m}'
  );
  if (torqueMode === 'gravity') renderGravityTorqueBlocks(el, tau);
  else
    renderBlocks(el, [
      {
        label: '1. Bentuk umum torsi sendi',
        tex: '\\tau_i=K_i\\,N_i\\,i_i\\qquad(K:\\ \\mathrm{N\\cdot m/A},\\ N:\\ \\text{rasio gearbox},\\ i:\\ \\mathrm{A})'
      },
      { label: '2. Substitusi nilai dan hasil', tex: '\\begin{aligned}' + tl.join('\\\\') + '\\end{aligned}' }
    ]);
  const dt = s ? s.dt : 0,
    dth = s ? s.dth : [0, 0, 0, 0, 0, 0];
  const wl = dth.map(
    (d, i) =>
      '\\dot\\theta_' +
      (i + 1) +
      '&=\\frac{\\Delta\\theta_' +
      (i + 1) +
      '}{\\Delta t}=\\frac{' +
      hl('dth' + i, d, 4) +
      '}{' +
      hl('dt', dt, 3) +
      '}=' +
      hl('w' + i, liveState.omega[i], 3) +
      '\\ \\mathrm{rad/s}'
  );
  const pl = tau.map(
    (t, i) =>
      'P_' +
      (i + 1) +
      '&=\\tau_' +
      (i + 1) +
      '\\dot\\theta_' +
      (i + 1) +
      '=' +
      hl('t' + i, t, 3) +
      '\\times(' +
      hl('w2' + i, liveState.omega[i], 3) +
      ')=' +
      hl('p' + i, t * liveState.omega[i], 3) +
      '\\ \\mathrm{W}'
  );
  pl.push('P&=\\sum_iP_i=' + hl('P', liveState.P, 3) + '\\ \\mathrm{W}');
  renderBlocks(el2, [
    {
      label: '3. Kecepatan sendi (beda hingga tiap langkah waktu)',
      tex: '\\dot\\theta_i\\approx\\frac{\\theta_i(t_k)-\\theta_i(t_{k-1})}{\\Delta t}'
    },
    {
      label: '4. Substitusi kecepatan (Δθ dalam rad, Δt dalam s)',
      tex: '\\begin{aligned}' + wl.join('\\\\') + '\\end{aligned}'
    },
    { label: '5. Daya mekanik sendi: bentuk umum', tex: 'P_i=\\tau_i\\,\\dot\\theta_i,\\qquad P=\\sum_{i=1}^{6}P_i' },
    { label: '6. Substitusi daya', tex: '\\begin{aligned}' + pl.join('\\\\') + '\\end{aligned}' },
    {
      label: '7. Energi kumulatif (aturan trapesium): bentuk umum',
      tex: 'E_k=E_{k-1}+\\tfrac{1}{2}\\left(P_{k-1}+P_k\\right)\\Delta t\\quad\\Leftarrow\\quad E(t)=\\int_0^t P\\,dt'
    },
    {
      label: '8. Substitusi energi',
      tex:
        'E_k=' +
        hl('Ep', s ? s.Eprev : 0, 4) +
        '+\\tfrac{1}{2}\\left(' +
        hl('Pp', s ? s.Pprev : 0, 3) +
        '+' +
        hl('Pn', s ? s.Pnew : 0, 3) +
        '\\right)\\times' +
        hl('dt2', dt, 3) +
        '=' +
        hl('E', liveState.E, 4) +
        '\\ \\mathrm{J}'
    }
  ]);
}
function renderIKLive() {
  const el = document.getElementById('ik-live-display');
  if (!el || !window.katex) return;
  const tu = userTargetInputs(),
    tg = [tu.x, tu.y, tu.z];
  const eu = toUser(eeFromThetas6()),
    pv = [eu.x, eu.y, eu.z],
    e = tg.map((v, k) => v - pv[k]),
    n = Math.hypot(...e);
  // Tampilkan parameter solver yang benar-benar dipakai tombol "Selesaikan IK":
  // animasi aktif -> ik6d (posisi + sumbu z alat, per sampel garis lurus); animasi mati -> solveIK6 (posisi saja)
  const anim = document.getElementById('ik-animate').checked;
  const blocks = [
    {
      label: 'Error posisi: substitusi (frame base, Z ke atas, meter)',
      tex:
        '\\mathbf{e}_p=\\mathbf{p}_{target}-\\mathbf{p}(\\theta)=' +
        vecTex('it', tg, 3) +
        '-' +
        vecTex('ip', pv, 3) +
        '=' +
        vecTex('ie', e, 3) +
        ',\\quad\\|\\mathbf{e}_p\\|=' +
        hl('en', n * 1000, 2) +
        '\\ \\mathrm{mm}'
    }
  ];
  if (anim) {
    blocks.push({
      label: 'Solver aktif: IK 6D per sampel (kotak "animasikan penyelesaian" dicentang)',
      tex: '\\mathbf{e}=\\begin{bmatrix}\\mathbf{p}_{target}-\\mathbf{p}(\\theta)\\\\ w_o\\,(\\mathbf{z}_{d}-\\mathbf{z}_{alat}(\\theta))\\end{bmatrix}\\in\\mathbb{R}^6,\\quad \\lambda=0.003,\\quad w_o=0.5\\ (\\text{dilonggarkan ke }0.05\\text{ lalu }0\\text{ bila tidak konvergen})'
    });
    blocks.push({
      label: 'Langkah per iterasi (Jacobian beda hingga, Δθ = 0.2°, langkah dibatasi 30° per sendi)',
      tex: '\\Delta\\theta=J^{T}\\left(JJ^{T}+\\lambda^{2}I\\right)^{-1}\\mathbf{e},\\qquad J\\in\\mathbb{R}^{6\\times6}'
    });
  } else {
    blocks.push({
      label: 'Solver aktif: IK posisi saja (animasi dimatikan)',
      tex:
        '\\lambda=' +
        IK_LAMBDA +
        ',\\quad\\lambda^{2}=' +
        (IK_LAMBDA * IK_LAMBDA).toExponential(2) +
        '\\qquad\\Delta\\theta=J^{T}\\left(JJ^{T}+\\lambda^{2}I\\right)^{-1}\\mathbf{e}_p,\\quad J\\in\\mathbb{R}^{3\\times6}\\ (\\text{beda hingga, }\\Delta\\theta=0.5^\\circ)'
    });
  }
  renderBlocks(el, blocks);
}
document.getElementById('ik-animate').addEventListener('change', () => renderLive());
function renderLive() {
  const r = document.getElementById('energy-readout');
  if (r) r.textContent = liveState.E.toFixed(3) + ' J';
  if (accOpen('acc-jac-fk')) renderJacobian();
  if (accOpen('acc-tau-fk')) renderTorque();
  if (accOpen('acc-math-ik')) renderIKLive();
}

function buildMotorUi() {
  const body = document.getElementById('motor-body');
  if (!body) return;
  body.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="jname">q' +
      (i + 1) +
      '</td><td><input type="number" step="0.01" value="' +
      motorParams.K[i] +
      '" data-i="' +
      i +
      '" data-k="K"></td><td><input type="number" step="0.1" value="' +
      motorParams.N[i] +
      '" data-i="' +
      i +
      '" data-k="N"></td><td><input type="number" step="0.1" value="' +
      motorParams.i[i] +
      '" data-i="' +
      i +
      '" data-k="i"></td>';
    body.appendChild(tr);
  }
  body.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', () => {
      motorParams[inp.dataset.k][+inp.dataset.i] = parseFloat(inp.value) || 0;
      renderLive();
    })
  );
}
document.getElementById('jac-col').addEventListener('change', renderLive);

buildMotorUi();

/* ============ SESI 7: DASHBOARD ENERGI & TORSI ============ */
const G_ACC = 9.81;
// Parameter tambahan dashboard (semua PLACEHOLDER/estimasi, ganti dengan data resmi)
const dashParams = {
  V: 48,
  b: [0, 0, 0, 0, 0, 0],
  c: [0, 0, 0, 0, 0, 0],
  linkMass: [0, 0, 0, 0, 0, 0],
  rated: [100, 100, 50, 25, 25, 25]
}; // rated: PLACEHOLDER kapasitas torsi (N.m)

// Volume & pusat massa (frame lokal link) dari mesh STEP, asumsi kerapatan seragam (estimasi kasar)
function linkMassProps() {
  const out = [];
  for (let i = 1; i <= 6; i++) {
    let V = 0,
      sx = 0,
      sy = 0,
      sz = 0;
    ROBOT_PARTS[i].solids.forEach(s => {
      const P = zu5Geometry(s).attributes.position.array;
      for (let t = 0; t < P.length; t += 9) {
        const ax = P[t],
          ay = P[t + 1],
          az = P[t + 2],
          bx = P[t + 3],
          by = P[t + 4],
          bz = P[t + 5],
          cx = P[t + 6],
          cy = P[t + 7],
          cz = P[t + 8];
        const v = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
        V += v;
        sx += (v * (ax + bx + cx)) / 4;
        sy += (v * (ay + by + cy)) / 4;
        sz += (v * (az + bz + cz)) / 4;
      }
    });
    if (V < 0) {
      V = -V;
      sx = -sx;
      sy = -sy;
      sz = -sz;
    }
    out.push({ vol: V, com: new THREE.Vector3(sx / V, sy / V, sz / V) });
  }
  return out;
}
const linkProps = linkMassProps();
function distributeLinkMass() {
  const tot = linkProps.reduce((a, p) => a + p.vol, 0);
  dashParams.linkMass = linkProps.map(p => +((robotMeta.totalMass * p.vol) / tot).toFixed(2));
}
distributeLinkMass();

// Energi potensial terhadap bidang dasar base (sumbu Y simulator = tinggi)
function potentialEnergy(thOvr) {
  const F = computeChain6(thOvr),
    payload = activePayloadKg();
  let links = 0;
  for (let i = 1; i <= 6; i++) {
    const c = linkProps[i - 1].com.clone().applyMatrix4(F[i]);
    links += dashParams.linkMass[i - 1] * G_ACC * c.y;
  }
  const ee = new THREE.Vector3().setFromMatrixPosition(F[6]);
  const pay = payload * G_ACC * ee.y;
  return { links, payload: pay, total: links + pay };
}

// Buffer data dashboard (maks 600 sampel, laju 10 Hz)
const dash = {
  t0: performance.now(),
  time: [],
  tau: [[], [], [], [], [], []],
  theta: [[], [], [], [], [], []],
  omega: [[], [], [], [], [], []],
  cur: [[], [], [], [], [], []],
  Pe: [],
  Pm: [],
  Pf: [],
  Ee: [],
  Em: [],
  Ef: [],
  Ep: [],
  dEp: [],
  Eabs: [],
  payload: []
};
const DASH_MAX = 600;
function dashPush(th, w, tau, pw, pot) {
  if (dash.time.length >= DASH_MAX) {
    Object.keys(dash).forEach(k => {
      if (Array.isArray(dash[k])) {
        if (Array.isArray(dash[k][0])) dash[k].forEach(a => a.shift());
        else dash[k].shift();
      }
    });
  }
  dash.time.push(((performance.now() - dash.t0) / 1000).toFixed(1));
  const ci = currentI(tau);
  for (let i = 0; i < 6; i++) {
    dash.tau[i].push(tau[i]);
    dash.theta[i].push(th[i]);
    dash.omega[i].push(w[i]);
    dash.cur[i].push(ci[i]);
  }
  dash.Pe.push(pw.Pe);
  dash.Pm.push(pw.Pm);
  dash.Pf.push(pw.Pf);
  dash.Ee.push(liveState.Ee);
  dash.Em.push(liveState.E);
  dash.Ef.push(liveState.Ef);
  dash.Eabs.push(liveState.Eabs);
  dash.Ep.push(pot.total);
  dash.dEp.push(pot.total - liveState.Ep0);
  dash.payload.push(activePayloadKg());
}
function resetEnergy() {
  liveState.E = 0;
  liveState.P = 0;
  liveState.Ee = 0;
  liveState.Pe = 0;
  liveState.Ef = 0;
  liveState.Pf = 0;
  liveState.Eabs = 0;
  liveState.Pa = 0;
  liveState.step = null;
  liveState.Ep0 = potentialEnergy().total;
  renderLive();
}
function clearDash() {
  Object.keys(dash).forEach(k => {
    if (Array.isArray(dash[k])) {
      if (Array.isArray(dash[k][0])) dash[k].forEach(a => (a.length = 0));
      else dash[k].length = 0;
    }
  });
  dash.t0 = performance.now();
  resetEnergy();
  dashRender();
}

// ---- UI ----
const dashCharts = { tau: null, en: null };
const EN_CLR = ['#e8a23d', '#6fa3d8', '#c98a7a', '#6fbf8b', '#b58fd6'];
function dashChartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: true, labels: { color: CT().tick, boxWidth: 10, font: { size: 9 } } } },
    scales: {
      x: { ticks: { maxTicksLimit: 6, color: CT().tick, font: { size: 8 } }, grid: { color: CT().grid } },
      y: { ticks: { maxTicksLimit: 6, color: CT().tick, font: { size: 8 } }, grid: { color: CT().grid } }
    }
  };
}
function dashInitCharts() {
  if (dashCharts.tau) return;
  const ds = (label, c) => ({
    label,
    data: [],
    borderColor: c,
    backgroundColor: c + '20',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.2
  });
  dashCharts.tau = new Chart(document.getElementById('dash-tau-chart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: jClrs.map((c, i) => ds('τ' + (i + 1) + ' (N·m)', c)) },
    options: dashChartOpts()
  });
  dashCharts.en = new Chart(document.getElementById('dash-en-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        ds('E elektrik (J)', EN_CLR[0]),
        ds('E mekanik (J)', EN_CLR[1]),
        ds('E gesekan (J)', EN_CLR[2]),
        ds('ΔE potensial (J)', EN_CLR[3]),
        ds('E mekanik absolut (J)', EN_CLR[4])
      ]
    },
    options: dashChartOpts()
  });
}
themeHooks.push(t => {
  [dashCharts.tau, dashCharts.en].forEach(c => {
    if (!c) return;
    c.options.plugins.legend.labels.color = THEME_JS[t].tick;
    ['x', 'y'].forEach(ax => {
      c.options.scales[ax].ticks.color = THEME_JS[t].tick;
      c.options.scales[ax].grid.color = THEME_JS[t].grid;
    });
    c.update('none');
  });
});

function dashBuildStatic() {
  const g = document.getElementById('dash-gauges');
  g.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('div');
    d.className = 'gauge';
    d.innerHTML =
      '<div class="gl">τ' +
      (i + 1) +
      '</div><div class="gv" id="gv' +
      i +
      '">0.000</div><div class="gs">N·m</div><div class="gs" id="gi' +
      i +
      '"></div>';
    g.appendChild(d);
  }
  const tb = document.getElementById('dash-param-body');
  tb.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="jname">q' +
      (i + 1) +
      '</td><td><input type="number" step="0.1" value="' +
      dashParams.linkMass[i] +
      '" data-k="linkMass" data-i="' +
      i +
      '"></td><td><input type="number" step="0.01" value="' +
      dashParams.b[i] +
      '" data-k="b" data-i="' +
      i +
      '"></td><td><input type="number" step="0.01" value="' +
      dashParams.c[i] +
      '" data-k="c" data-i="' +
      i +
      '"></td><td><input type="number" step="1" value="' +
      dashParams.rated[i] +
      '" data-k="rated" data-i="' +
      i +
      '"></td>';
    tb.appendChild(tr);
  }
  tb.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', () => {
      dashParams[inp.dataset.k][+inp.dataset.i] = parseFloat(inp.value) || 0;
    })
  );
  document.getElementById('dash-V').value = dashParams.V;
}
document.getElementById('dash-V').addEventListener('input', e => {
  dashParams.V = parseFloat(e.target.value) || 0;
});
document.getElementById('dash-remass').addEventListener('click', () => {
  distributeLinkMass();
  dashBuildStatic();
});

function dashRender() {
  if (!document.getElementById('dashModal').classList.contains('open')) return;
  document.getElementById('dash-payload').textContent = activePayloadKg() + ' kg';
  const tau = totalTau(),
    ci = currentI(tau),
    last = dash.time.length - 1,
    w = last >= 0 ? dash.omega.map(a => a[last]) : [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    const over = dashParams.rated[i] > 0 && Math.abs(tau[i]) > dashParams.rated[i];
    const gvEl = document.getElementById('gv' + i);
    gvEl.textContent = tau[i].toFixed(3);
    gvEl.style.color = over ? 'var(--rose)' : '';
    document.getElementById('gi' + i).textContent =
      'i=' +
      ci[i].toFixed(2) +
      ' A · ' +
      joints6[i].theta.toFixed(0) +
      '° · ' +
      w[i].toFixed(2) +
      ' rad/s' +
      (over ? ' | melebihi kapasitas motor' : '');
  }
  const pot = potentialEnergy(),
    s = (id, v, d) => {
      document.getElementById(id).textContent = (+v).toFixed(d);
    };
  s('de-Pa', liveState.Pa, 2);
  s('de-Eabs', liveState.Eabs, 2);
  s('de-Pe', liveState.Pe, 2);
  s('de-Ee', liveState.Ee, 2);
  s('de-Pm', liveState.P, 3);
  s('de-Em', liveState.E, 3);
  s('de-Pf', liveState.Pf, 3);
  s('de-Ef', liveState.Ef, 3);
  s('de-Ep', pot.total, 2);
  s('de-dEp', pot.total - liveState.Ep0, 3);
  s('de-Eppay', pot.payload, 2);
  s('de-Eplink', pot.links, 2);
  dashInitCharts();
  dashCharts.tau.data.labels = dash.time;
  dashCharts.tau.data.datasets.forEach((d, i) => (d.data = dash.tau[i]));
  dashCharts.tau.update('none');
  const ser = [dash.Ee, dash.Em, dash.Ef, dash.dEp, dash.Eabs];
  dashCharts.en.data.labels = dash.time;
  dashCharts.en.data.datasets.forEach((d, i) => (d.data = ser[i]));
  dashCharts.en.update('none');
}
// Dashboard energi dan torsi kini eksklusif di upside bar halaman JAKA + Blok Diagram (Sesi 17a)
function openDash() {
  if (appSettings.observer) {
    toast(tr('pg.blocked'));
    return;
  }
  if (!(document.body.dataset.mode === 'jaka' && JK.cur === 'bd')) nav('#jaka-bd');
  bdUp(true, 'energi');
  const m = document.getElementById('dashModal');
  m.classList.add('open');
  setTimeout(() => {
    dashInitCharts();
    dashCharts.tau.resize();
    dashCharts.en.resize();
    dashRender();
  }, 60);
}
function closeDash() {
  document.getElementById('dashModal').classList.remove('open');
  if (BDU.tab === 'energi') bdUp(false);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDash();
});

function exportDashCSV() {
  if (dash.time.length === 0) {
    alert('Tidak ada data.');
    return;
  }
  const idx = [1, 2, 3, 4, 5, 6];
  let csv =
    'time_s,payload_kg,' +
    idx.map(i => 'theta' + i + '_deg').join(',') +
    ',' +
    idx.map(i => 'i' + i + '_A').join(',') +
    ',' +
    idx.map(i => 'tau' + i + '_Nm').join(',') +
    ',' +
    idx.map(i => 'omega' + i + '_rads').join(',') +
    ',P_elec_W,P_mech_W,P_fric_W,E_elec_J,E_mech_J,E_fric_J,Epot_J,dEpot_J,E_mech_abs_J\n';
  for (let k = 0; k < dash.time.length; k++) {
    csv +=
      [
        dash.time[k],
        dash.payload[k],
        ...dash.theta.map(a => a[k]),
        ...dash.cur.map(a => a[k]),
        ...dash.tau.map(a => a[k]),
        ...dash.omega.map(a => a[k]),
        dash.Pe[k],
        dash.Pm[k],
        dash.Pf[k],
        dash.Ee[k],
        dash.Em[k],
        dash.Ef[k],
        dash.Ep[k],
        dash.dEp[k],
        dash.Eabs[k]
      ].join(',') + '\n';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard_energi_torsi_' + Date.now() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Sampling 10 Hz (menggantikan loop Sesi 6: menambah energi elektrik, gesekan, potensial) ----
liveState.Ee = 0;
liveState.Pe = 0;
liveState.Ef = 0;
liveState.Pf = 0;
liveState.Eabs = 0;
liveState.Pa = 0;
liveState.Ep0 = potentialEnergy().total;
document.getElementById('energy-reset').addEventListener('click', resetEnergy);
setInterval(() => {
  const now = performance.now(),
    th = joints6.map(j => j.theta),
    pot = potentialEnergy();
  let w = [0, 0, 0, 0, 0, 0];
  const tau = totalTau();
  // saat trajectory berjalan, waktu fisika = waktu simulasi (jam dinding x kecepatan animasi), supaya energi
  // penahan beban dan gesekan tidak bergantung pilihan kecepatan 0.5x sampai 4x (temuan Sesi 20b)
  const dt = liveState.prevTheta ? ((now - liveState.prevT) / 1000) * (TRAJ.playing ? TRAJ.speed : 1) : 0;
  if (dt > 0) {
    const dth = th.map((v, i) => ((v - liveState.prevTheta[i]) * Math.PI) / 180);
    w = dth.map(x => x / dt);
    const Pe = dashParams.V * currentI(tau).reduce((sum, x) => sum + Math.abs(x), 0);
    liveState.Ee += 0.5 * (liveState.Pe + Pe) * dt;
    liveState.Pe = Pe;
    if (w.some(x => Math.abs(x) > MAX_OMEGA)) {
      w = [0, 0, 0, 0, 0, 0];
      liveState.omega = w;
      liveState.P = 0;
      liveState.Pf = 0;
      liveState.Pa = 0;
      liveState.step = null;
    } else {
      const P = tau.reduce((sum, t, i) => sum + t * w[i], 0),
        Eprev = liveState.E,
        Pprev = liveState.P;
      const Pf = w.reduce((sum, x, i) => sum + dashParams.b[i] * x * x + dashParams.c[i] * Math.abs(x), 0);
      liveState.E = Eprev + 0.5 * (Pprev + P) * dt;
      liveState.omega = w;
      liveState.P = P;
      liveState.step = { dt, dth, Eprev, Pprev, Pnew: P };
      liveState.Ef += 0.5 * (liveState.Pf + Pf) * dt;
      liveState.Pf = Pf;
      const Pa = tau.reduce((sum, t, i) => sum + Math.abs(t * w[i]), 0);
      liveState.Eabs += 0.5 * (liveState.Pa + Pa) * dt;
      liveState.Pa = Pa;
    }
  }
  liveState.prevTheta = th;
  liveState.prevT = now;
  dashPush(th, w, tau, { Pe: liveState.Pe, Pm: liveState.P, Pf: liveState.Pf }, pot);
  renderLive();
  dashRender();
  trajHud();
  warnUpdate();
  updateTargetViz();
}, 100);
dashBuildStatic();
