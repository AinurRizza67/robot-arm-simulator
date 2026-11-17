/* 16_start_control.js
   Start Control: real robot monitoring, teach pendant, FK/IK set position, Python editor, bridge IPC.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ JAKA REMAKE v2.0: LAYAR JUDUL, DASHBOARD UTAMA, START CONTROL ============ */
// Rute: #start (layar judul), #dash (dashboard 3 fitur), #home (halaman Simulation, dulu Dashboard),
// #settings, #control (Start Control). Kendali robot lewat window.jakaBridge (preload Electron) ke
// proses Python Program/JAKA_Control/robot_bridge.py. Semua sudut di halaman ini = sudut model (derajat),
// konversi ke sudut controller ada di jembatan (Settings, Pemetaan sudut sendi).
const CTL_DEF = { ip: '', python: '', cap: 30, sign: [1, 1, 1, 1, 1, 1], offset: [0, 0, 0, 0, 0, 0], mode: 'virtual' };
appSettings.ctl = Object.assign(
  {},
  CTL_DEF,
  (() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').ctl || {};
    } catch (e) {
      return {};
    }
  })()
);
const CTL_LIM = [
  [-360, 360],
  [-85, 265],
  [-175, 175],
  [-85, 265],
  [-360, 360],
  [-360, 360]
]; // Hardware Manual tabel 5-1
const CTL_DH = defaultDH.map((j, i) => Object.assign({}, j, { theta: 0, thMin: CTL_LIM[i][0], thMax: CTL_LIM[i][1] }));
const CTL = {
  scene: null,
  ghost: [],
  ghostOn: true,
  ghostQ: null,
  bridge: null,
  unsub: null,
  conn: false,
  mode: 'virtual',
  st: {},
  q: READY_POSE.slice(),
  step: 0,
  speed: 10,
  jogKeep: null,
  jogBtn: null,
  ik: null,
  pick: -1,
  eqOpen: false,
  eqT: 0,
  prog: 'idle',
  chart: null,
  hist: [],
  tab: 'teach',
  built: false,
  fkQ: null
};

// ---- layar judul dan dashboard ----
document.getElementById('st-go').addEventListener('click', () => nav('#dash'));
document.getElementById('dh-to-start').addEventListener('click', () => nav('#start'));
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.body.dataset.mode === 'start') {
    e.preventDefault();
    nav('#dash');
  }
});
function dashRefresh() {
  const b = document.getElementById('dh-chip-bridge'),
    r = document.getElementById('dh-chip-robot');
  b.className = 'dh-chip' + (CTL.bridge ? ' on' : window.jakaBridge ? '' : ' warn');
  b.lastElementChild.textContent = CTL.bridge
    ? 'Python ' + CTL.bridge.python + ' aktif'
    : window.jakaBridge
      ? 'Python: belum dinyalakan'
      : 'Python: hanya di aplikasi .exe';
  r.className = 'dh-chip' + (CTL.conn ? ' on' : '');
  r.lastElementChild.textContent = CTL.conn
    ? CTL.mode === 'real'
      ? 'Robot nyata ' + (CTL.st.ip || '')
      : 'Robot virtual'
    : 'Robot: tidak tersambung';
  // the dashboard shows two coloured lines; the full status lives in the tooltip
  [b, r].forEach(el => {
    el.dataset.tip = el.lastElementChild.textContent;
    el.setAttribute('aria-label', el.lastElementChild.textContent);
  });
}

// ---- Settings: koneksi robot ----
function ctlSettingsBuild() {
  const c = appSettings.ctl,
    ip = document.getElementById('set-ctl-ip'),
    py = document.getElementById('set-ctl-py'),
    cap = document.getElementById('set-ctl-cap'),
    map = document.getElementById('set-ctl-map');
  ip.value = c.ip;
  py.value = c.python;
  cap.value = c.cap;
  let h =
    '<span></span>' +
    [1, 2, 3, 4, 5, 6].map(i => '<span style="text-align:center;font-weight:700;">J' + i + '</span>').join('');
  h +=
    '<span>tanda</span>' +
    c.sign
      .map(
        (v, i) => '<input type="number" step="2" min="-1" max="1" data-k="sign" data-i="' + i + '" value="' + v + '">'
      )
      .join('');
  h +=
    '<span>offset</span>' +
    c.offset
      .map((v, i) => '<input type="number" step="0.1" data-k="offset" data-i="' + i + '" value="' + v + '">')
      .join('');
  map.innerHTML = h;
  map.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('change', () => {
      const k = inp.dataset.k,
        i = +inp.dataset.i;
      let v = parseFloat(inp.value) || 0;
      if (k === 'sign') {
        v = v < 0 ? -1 : 1;
        inp.value = v;
      }
      c[k][i] = v;
      saveSettings();
    })
  );
}
document.getElementById('set-ctl-ip').addEventListener('change', e => {
  appSettings.ctl.ip = e.target.value.trim();
  saveSettings();
  const f = document.getElementById('ctl-ip');
  if (f) f.value = appSettings.ctl.ip;
});
document.getElementById('set-ctl-py').addEventListener('change', e => {
  appSettings.ctl.python = e.target.value.trim();
  saveSettings();
});
document.getElementById('set-ctl-cap').addEventListener('change', e => {
  let v = Math.max(1, Math.min(100, parseFloat(e.target.value) || 30));
  e.target.value = v;
  appSettings.ctl.cap = v;
  saveSettings();
  if (CTL.bridge) jakaBridge.call('set_cap', { cap: v }).catch(() => {});
  ctlSpeedText();
});
ctlSettingsBuild();

// ---- matematika (memakai DH bawaan, tidak terpengaruh tabel DH yang diubah di Simulation) ----
const ctlFK = q => igFK(q, CTL_DH); // matriks baris 4x4, meter
function ctlRpy(T) {
  const ry = Math.atan2(-T[2][0], Math.hypot(T[0][0], T[1][0]));
  let rx, rz;
  if (Math.abs(Math.cos(ry)) < 1e-9) {
    rx = 0;
    rz = Math.atan2(-T[0][1], T[1][1]);
  } else {
    rx = Math.atan2(T[2][1], T[2][2]);
    rz = Math.atan2(T[1][0], T[0][0]);
  }
  return [rx, ry, rz].map(v => (v * 180) / Math.PI);
}
function ctlRfromRpy(rx, ry, rz) {
  const a = (rx * Math.PI) / 180,
    b = (ry * Math.PI) / 180,
    c = (rz * Math.PI) / 180,
    ca = Math.cos(a),
    sa = Math.sin(a),
    cb = Math.cos(b),
    sb = Math.sin(b),
    cc = Math.cos(c),
    sc = Math.sin(c);
  return [
    [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa],
    [sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa],
    [-sb, cb * sa, cb * ca]
  ];
}
const ctlPose = T => [T[0][3] * 1000, T[1][3] * 1000, T[2][3] * 1000, ...ctlRpy(T)]; // mm dan derajat
function ctlNear(v, ref, lim) {
  let best = null;
  for (let k = -2; k <= 2; k++) {
    const c = v + 360 * k;
    if (c >= lim[0] - 1e-6 && c <= lim[1] + 1e-6 && (best === null || Math.abs(c - ref) < Math.abs(best - ref)))
      best = c;
  }
  return best;
}
function ctlLimOk(q) {
  return q.every((v, i) => v >= CTL_LIM[i][0] - 1e-6 && v <= CTL_LIM[i][1] + 1e-6);
}
// IK geometri (igSolve) lalu tiap sendi dipilih kelipatan 360° yang masuk batas dan paling dekat dengan pose sekarang
function ctlIK(T, qref) {
  const res = igSolve(T, CTL_DH, qref[5]);
  const sols = res.sols.map(s => {
    const th = s.th.map((v, i) => {
      const n = ctlNear(v, qref[i], CTL_LIM[i]);
      return n === null ? v : n;
    });
    return Object.assign({}, s, {
      th,
      ok: ctlLimOk(th),
      errMm: s.err * 1000,
      dist: th.reduce((a, v, i) => a + Math.abs(v - qref[i]), 0)
    });
  });
  sols.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1) || a.dist - b.dist);
  return { sols, info: res.info, why: res.why };
}
function ctlJacDet(q) {
  let T = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  const F = [T];
  for (let i = 0; i < 6; i++) {
    T = igMul(T, igA(q[i], CTL_DH[i].d, CTL_DH[i].a, CTL_DH[i].alpha));
    F.push(T);
  }
  const o6 = [T[0][3], T[1][3], T[2][3]],
    J = [[], [], [], [], [], []];
  for (let i = 0; i < 6; i++) {
    const z = [F[i][0][2], F[i][1][2], F[i][2][2]],
      o = [F[i][0][3], F[i][1][3], F[i][2][3]],
      d = [o6[0] - o[0], o6[1] - o[1], o6[2] - o[2]];
    const l = [z[1] * d[2] - z[2] * d[1], z[2] * d[0] - z[0] * d[2], z[0] * d[1] - z[1] * d[0]];
    for (let k = 0; k < 3; k++) {
      J[k][i] = l[k];
      J[k + 3][i] = z[k];
    }
  }
  const A = J.map(r => r.slice());
  let s = 1;
  for (let c = 0; c < 6; c++) {
    let p = c;
    for (let r = c + 1; r < 6; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-15) return 0;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      s = -s;
    }
    s *= A[c][c];
    for (let r = c + 1; r < 6; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 6; k++) A[r][k] -= f * A[c][k];
    }
  }
  return s;
}

// ---- adegan 3D ----
function ctlChain(q) {
  let cum = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const fr = [cum.clone()];
  for (let i = 0; i < 6; i++) {
    cum = cum.clone().multiply(dhMatrix(q[i], CTL_DH[i].d, CTL_DH[i].a, CTL_DH[i].alpha));
    fr.push(cum.clone());
  }
  return fr;
}
function ctlPoseScene(q) {
  if (!CTL.scene) return;
  const fr = ctlChain(q);
  CTL.scene.partGroups.forEach((g, i) => {
    g.matrix.copy(fr[i]);
    g.matrixWorldNeedsUpdate = true;
  });
  CTL.scene.axesHelpers.forEach((a, i) => {
    a.matrix.copy(fr[i + 1]);
    a.matrixWorldNeedsUpdate = true;
  });
}
function ctlGhost(q) {
  CTL.ghostQ = q;
  const vis = !!q && CTL.ghostOn;
  CTL.ghost.forEach(g => (g.visible = vis));
  if (!vis) return;
  const fr = ctlChain(q);
  CTL.ghost.forEach((g, i) => {
    g.matrix.copy(fr[i]);
    g.matrixWorldNeedsUpdate = true;
  });
}
function ctlBuildScene() {
  CTL.scene = makeRobotScene('ctl-stage', null, { noWeights: true, parts: ZU5_MESH.parts }); // real JAKA robot only
  const mat = new THREE.MeshBasicMaterial({ color: 0xe8a23d, transparent: true, opacity: 0.22, depthWrite: false });
  CTL.ghost = ZU5_MESH.parts.map(p => {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.visible = false;
    p.solids.forEach(s => g.add(new THREE.Mesh(zu5Geometry(s), mat)));
    CTL.scene.world.add(g);
    return g;
  });
  CTL.scene.axesHelpers.forEach(a => (a.visible = false));
  CTL.scene.setTarget(new THREE.Vector3(0.9, 1.3, 0), 2, 8);
  CTL.scene.setView(0.8, 0.4);
}
const CTL_VIEWS = { iso: [0.9, 0.55], front: [0, 0.08], side: [Math.PI / 2, 0.08], top: [0.0001, 1.4] };

// ---- jembatan ----
function ctlLog(stream, text) {
  const c = document.getElementById('ctl-console');
  if (!c) return;
  const d = document.createElement('div');
  if (stream === 'err') d.className = 'err';
  else if (stream === 'sys') d.className = 'sys';
  d.textContent = text;
  c.appendChild(d);
  while (c.childNodes.length > 600) c.removeChild(c.firstChild);
  c.scrollTop = c.scrollHeight;
}
async function ctlBridge() {
  if (CTL.bridge) return CTL.bridge;
  if (!window.jakaBridge) throw new Error('Kendali robot hanya tersedia di aplikasi JAKA Remake (.exe).');
  if (!CTL.unsub) CTL.unsub = jakaBridge.onEvent(ctlOnEvent);
  CTL.bridge = await jakaBridge.start({ python: appSettings.ctl.python });
  ctlLog(
    'sys',
    'Python ' +
      CTL.bridge.python +
      ' (' +
      CTL.bridge.py +
      ', ' +
      CTL.bridge.arch +
      '), SDK JAKA: ' +
      (CTL.bridge.sdk ? 'termuat' : 'TIDAK termuat (' + CTL.bridge.sdk_error + '), mode Robot nyata tidak bisa dipakai')
  );
  if (+appSettings.ctl.cap) jakaBridge.call('set_cap', { cap: appSettings.ctl.cap }).catch(() => {});
  dashRefresh();
  return CTL.bridge;
}
// Bila jembatan sudah hidup, perintah dikirim saat itu juga (sinkron) supaya urutan jog lalu jog_stop tidak tertukar
function ctlCall(cmd, args) {
  if (CTL.bridge && window.jakaBridge) return jakaBridge.call(cmd, args || {});
  return ctlBridge().then(() => jakaBridge.call(cmd, args || {}));
}
function ctlErr(e) {
  const m = ((e && e.message) || String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  toast(m);
  ctlLog('err', m);
}
function ctlOnEvent(m) {
  if (m.event === 'state') ctlState(m.data);
  else if (m.event === 'log') ctlLog(m.data.stream, m.data.text);
  else if (m.event === 'prog') ctlProgStatus(m.data.status);
  else if (m.event === 'bridge-exit') {
    CTL.bridge = null;
    ctlState({ connected: false });
    ctlProgStatus('idle');
    ctlLog('err', 'Jembatan Python berhenti (kode ' + m.data.code + ')');
    dashRefresh();
  }
}
function ctlReady() {
  return CTL.conn && CTL.st.power && CTL.st.enabled;
}
function ctlAsk(text) {
  return new Promise(res => {
    const m = document.getElementById('ctl-ask');
    document.getElementById('ctl-ask-t').textContent = text;
    m.classList.add('open');
    const y = document.getElementById('ctl-ask-yes'),
      n = document.getElementById('ctl-ask-no');
    const done = v => {
      m.classList.remove('open');
      y.onclick = n.onclick = null;
      res(v);
    };
    y.onclick = () => done(true);
    n.onclick = () => done(false);
    y.focus();
  });
}
async function ctlAskReal(text) {
  return (
    CTL.mode !== 'real' || ctlAsk(text + ' Pastikan area kerja kosong dan tombol emergency stop fisik dalam jangkauan.')
  );
}

// ---- status dari robot ----
function ctlState(d) {
  if (d.connected === false) {
    CTL.conn = false;
    CTL.st = {};
    ctlUiConn();
    return;
  }
  if (d.error) {
    ctlLog('err', 'Status: ' + d.error);
    return;
  }
  CTL.st = d;
  if (d.q) {
    CTL.q = d.q.slice();
    ctlPoseScene(CTL.q);
  }
  ctlHud();
  ctlUiConn();
  if (CTL.tab === 'mon') ctlMon();
  if (d.joints) {
    CTL.hist.push({ t: d.t, tau: d.joints.map(j => j.tau) });
    if (CTL.hist.length > 120) CTL.hist.shift();
  }
  if (CTL.eqOpen && !CTL.ghostQ && performance.now() - CTL.eqT > 400) ctlEqRender();
}
function ctlHud() {
  const f = (v, d) => (v == null ? '-' : (+v).toFixed(d)),
    t = CTL.st.tcp,
    q = CTL.q;
  [
    ['ctl-tx', 0],
    ['ctl-ty', 1],
    ['ctl-tz', 2]
  ].forEach(([id, k]) => (document.getElementById(id).textContent = t ? f(t[k], 1) + ' mm' : '-'));
  [
    ['ctl-trx', 3],
    ['ctl-try', 4],
    ['ctl-trz', 5]
  ].forEach(([id, k]) => (document.getElementById(id).textContent = t ? f(t[k], 2) + '°' : '-'));
  document.getElementById('ctl-hud-q').innerHTML =
    '<tr>' +
    q
      .slice(0, 3)
      .map((v, i) => '<td class="k">J' + (i + 1) + '</td><td class="v">' + f(v, 2) + '</td>')
      .join('') +
    '</tr><tr>' +
    q
      .slice(3)
      .map((v, i) => '<td class="k">J' + (i + 4) + '</td><td class="v">' + f(v, 2) + '</td>')
      .join('') +
    '</tr>';
  const ck = document.getElementById('ctl-check');
  if (t && CTL.conn) {
    const p = ctlPose(ctlFK(q)),
      e = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
    ck.textContent =
      'Model vs controller: FK model ' +
      p
        .slice(0, 3)
        .map(v => v.toFixed(1))
        .join(', ') +
      ' mm, selisih ' +
      e.toFixed(2) +
      ' mm';
    ck.className = e > 2 ? 'bad' : '';
    if (e > 2) ck.textContent += ' (periksa pemetaan sendi atau offset alat/TCP di controller)';
  } else {
    ck.textContent = 'Model vs controller: belum ada data';
    ck.className = '';
  }
  document.querySelectorAll('#ctl-jog-j .val').forEach((el, i) => {
    el.firstChild.textContent = f(q[i], 1) + '°';
    const L = CTL_LIM[i];
    el.lastChild.style.width = ((100 * (q[i] - L[0])) / (L[1] - L[0])).toFixed(1) + '%';
  });
  document.querySelectorAll('#ctl-jog-c .val').forEach((el, i) => {
    el.firstChild.textContent = t ? (i < 3 ? f(t[i], 1) + ' mm' : f(t[i], 1) + '°') : '-';
  });
}
function ctlUiConn() {
  const s = CTL.st,
    lamp = document.getElementById('ctl-lamp'),
    lt = document.getElementById('ctl-lamp-t');
  let st = 'off',
    txt = 'Tidak tersambung';
  if (CTL.conn) {
    if (s.estop) {
      st = 'red';
      txt = 'Emergency stop';
    } else if (s.enabled) {
      st = 'green';
      txt = 'Enable (siap gerak)';
    } else if (s.power) {
      st = 'blue';
      txt = 'Power on, belum enable';
    } else {
      st = 'white';
      txt = 'Tersambung, power off';
    }
    txt += CTL.mode === 'real' ? ' | ' + (s.ip || '') : ' | virtual';
  }
  lamp.dataset.s = st;
  lt.textContent = txt;
  const conn = document.getElementById('ctl-conn');
  conn.textContent = CTL.conn ? 'Putuskan' : 'Sambungkan';
  conn.classList.toggle('primary', !CTL.conn);
  const pw = document.getElementById('ctl-power'),
    en = document.getElementById('ctl-enable');
  pw.disabled = !CTL.conn;
  en.disabled = !CTL.conn || !s.power;
  pw.textContent = s.power ? 'Power Off' : 'Power On';
  en.textContent = s.enabled ? 'Disable' : 'Enable';
  pw.classList.toggle('ctl-btn-on', !!s.power);
  en.classList.toggle('ctl-btn-on', !!s.enabled);
  document.querySelectorAll('#ctl-mode button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === CTL.mode);
    b.disabled = CTL.conn;
  });
  document.getElementById('ctl-ip').disabled = CTL.conn;
  const ready = ctlReady();
  document.querySelectorAll('.ctl-jb').forEach(b => (b.disabled = !ready));
  ['ctl-go-ready', 'ctl-go-zero', 'ctl-fk-go'].forEach(id => (document.getElementById(id).disabled = !ready));
  const has = CTL.ik && CTL.pick >= 0 && CTL.ik.sols[CTL.pick] && CTL.ik.sols[CTL.pick].ok;
  document.getElementById('ctl-ik-goj').disabled = !ready || !has;
  document.getElementById('ctl-ik-gol').disabled = !ready || !has;
  if (document.body.dataset.mode === 'dash') dashRefresh();
}

// ---- koneksi, power, enable, stop ----
async function ctlPing() {
  const ip = document.getElementById('ctl-ip').value.trim(),
    out = document.getElementById('ctl-ping-out');
  if (!ip) {
    toast('Isi IP robot dulu');
    return { reachable: false };
  }
  out.textContent = 'ping...';
  try {
    const r = await ctlCall('ping', { ip, timeout: 1000 });
    out.textContent = r.reachable ? (r.ms != null ? r.ms + ' ms' : 'terjawab') : 'tidak terjawab';
    out.style.color = r.reachable ? 'var(--green)' : 'var(--rose)';
    ctlLog(
      r.reachable ? 'sys' : 'err',
      'Ping ' + ip + ': ' + (r.reachable ? 'terjawab' + (r.ms != null ? ' ' + r.ms + ' ms' : '') : 'tidak terjawab')
    );
    return r;
  } catch (e) {
    out.textContent = '';
    ctlErr(e);
    return { reachable: false };
  }
}
async function ctlConnect() {
  try {
    if (CTL.conn) {
      if (CTL.prog === 'running' && !(await ctlAsk('Program masih berjalan. Hentikan program dan putuskan koneksi?')))
        return;
      await ctlCall('disconnect');
      CTL.conn = false;
      CTL.st = {};
      ctlUiConn();
      ctlLog('sys', 'Koneksi diputus');
      return;
    }
    const mode = CTL.mode,
      ip = document.getElementById('ctl-ip').value.trim();
    if (mode === 'real') {
      if (!ip) {
        toast('Isi IP robot dulu');
        return;
      }
      const p = await ctlPing();
      if (
        !p.reachable &&
        !(await ctlAsk(
          'Ping ke ' + ip + ' tidak dijawab. Periksa kabel LAN atau WiFi dan IP laptop. Tetap coba sambungkan?'
        ))
      )
        return;
    }
    appSettings.ctl.ip = ip;
    appSettings.ctl.mode = mode;
    saveSettings();
    const c = appSettings.ctl;
    document.getElementById('ctl-conn').textContent = 'Menyambung...';
    const r = await ctlCall('connect', { mode, ip, sign: c.sign, offset: c.offset, cap: c.cap });
    CTL.conn = true;
    ctlLog('sys', 'Tersambung: ' + (mode === 'real' ? 'robot nyata ' + ip + ', SDK ' + r.sdk : 'robot virtual'));
    ctlUiConn();
  } catch (e) {
    CTL.conn = false;
    ctlUiConn();
    ctlErr(e);
  }
}
async function ctlPower() {
  try {
    const on = !CTL.st.power;
    if (on && !(await ctlAskReal('Robot akan di-POWER ON.'))) return;
    await ctlCall('power', { on });
  } catch (e) {
    ctlErr(e);
  }
}
async function ctlEnable() {
  try {
    const on = !CTL.st.enabled;
    if (on && !(await ctlAskReal('Robot akan di-ENABLE (motor aktif).'))) return;
    await ctlCall('enable', { on });
  } catch (e) {
    ctlErr(e);
  }
}
async function ctlStopAll() {
  ctlJogUp();
  if (!CTL.bridge) {
    toast('Tidak ada gerak yang berjalan dari aplikasi');
    return;
  }
  try {
    const r = await jakaBridge.call('stop_program', {});
    ctlLog('err', 'STOP ditekan' + (r.note && r.note.length ? ': ' + r.note.join(', ') : ''));
    toast('STOP dikirim');
  } catch (e) {
    ctlErr(e);
  }
}
async function ctlMoveJ(q, label) {
  if (!ctlLimOk(q)) {
    toast('Sudut di luar batas sendi');
    return;
  }
  if (
    !(await ctlAskReal(
      'Robot akan bergerak (MoveJ) ke ' + label + ' dengan kecepatan ' + Math.min(CTL.speed, appSettings.ctl.cap) + '%.'
    ))
  )
    return;
  try {
    await ctlCall('move_j', { q, speed: CTL.speed });
    ctlLog('sys', 'MoveJ ke ' + q.map(v => v.toFixed(1)).join(', '));
  } catch (e) {
    ctlErr(e);
  }
}

// ---- teach pendant ----
function ctlSpeedText() {
  const cap = +appSettings.ctl.cap || 30,
    v = Math.min(CTL.speed, cap);
  document.getElementById('ctl-speed-v').textContent = CTL.speed + '%';
  document.getElementById('ctl-speed-d').textContent =
    'Efektif ' +
    v +
    '%: sendi ' +
    (1.8 * v).toFixed(1) +
    ' °/s, linear ' +
    (5 * v).toFixed(0) +
    ' mm/s' +
    (CTL.speed > cap ? ' (dibatasi batas aplikasi ' + cap + '%, ubah di Settings)' : '');
}
function ctlJogDown(e) {
  const b = e.currentTarget;
  e.preventDefault();
  if (b.disabled) return;
  const kind = b.dataset.kind,
    axis = +b.dataset.axis,
    dir = +b.dataset.dir;
  if (CTL.step > 0) {
    ctlCall('jog', { kind, axis, dir, step: CTL.step, speed: CTL.speed }).catch(ctlErr);
    return;
  }
  ctlJogUp();
  CTL.jogBtn = b;
  b.classList.add('act');
  try {
    b.setPointerCapture(e.pointerId);
  } catch (_) {}
  ctlCall('jog', { kind, axis, dir, speed: CTL.speed }).catch(err => {
    ctlJogUp();
    ctlErr(err);
  });
  CTL.jogKeep = setInterval(() => {
    if (window.jakaBridge) jakaBridge.send('jog_alive');
  }, 150);
}
function ctlJogUp() {
  if (!CTL.jogBtn && !CTL.jogKeep) return;
  clearInterval(CTL.jogKeep);
  CTL.jogKeep = null;
  if (CTL.jogBtn) CTL.jogBtn.classList.remove('act');
  CTL.jogBtn = null;
  if (CTL.bridge) jakaBridge.call('jog_stop', {}).catch(() => {});
}
function ctlBuildJog() {
  const row = (kind, axis, name) =>
    '<div class="ctl-jog"><b>' +
    name +
    '</b><button type="button" class="ctl-jb" data-kind="' +
    kind +
    '" data-axis="' +
    axis +
    '" data-dir="-1" aria-label="' +
    name +
    ' minus">&#8722;</button>' +
    '<div class="val"><span>-</span><i></i></div><button type="button" class="ctl-jb" data-kind="' +
    kind +
    '" data-axis="' +
    axis +
    '" data-dir="1" aria-label="' +
    name +
    ' plus">+</button></div>';
  document.getElementById('ctl-jog-j').innerHTML = [1, 2, 3, 4, 5, 6].map(i => row('joint', i - 1, 'J' + i)).join('');
  document.getElementById('ctl-jog-c').innerHTML = ['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz']
    .map((n, i) => row('cart', i, n))
    .join('');
  document.querySelectorAll('.ctl-jb').forEach(b => {
    b.addEventListener('pointerdown', ctlJogDown);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev =>
      b.addEventListener(ev, () => {
        if (CTL.jogBtn === b) ctlJogUp();
      })
    );
  });
}

// ---- set posisi: FK dan IK ----
function ctlBuildPos() {
  document.getElementById('ctl-fk-in').innerHTML = [1, 2, 3, 4, 5, 6]
    .map(i => '<label>J' + i + ' (°)<input type="number" step="0.1" data-i="' + (i - 1) + '"></label>')
    .join('');
  document.getElementById('ctl-ik-in').innerHTML = ['x (mm)', 'y (mm)', 'z (mm)', 'rx (°)', 'ry (°)', 'rz (°)']
    .map((n, i) => '<label>' + n + '<input type="number" step="0.1" data-i="' + i + '"></label>')
    .join('');
  ctlFkFill(CTL.q);
  ctlIkFill(ctlPose(ctlFK(CTL.q)));
  document.querySelectorAll('#ctl-fk-in input').forEach(inp => inp.addEventListener('input', ctlFkPreview));
}
function ctlFkFill(q) {
  document.querySelectorAll('#ctl-fk-in input').forEach((inp, i) => (inp.value = (+q[i]).toFixed(2)));
  ctlFkPreview();
}
function ctlIkFill(p) {
  document.querySelectorAll('#ctl-ik-in input').forEach((inp, i) => (inp.value = (+p[i]).toFixed(i < 3 ? 1 : 2)));
}
function ctlFkQ() {
  return [...document.querySelectorAll('#ctl-fk-in input')].map(i => parseFloat(i.value) || 0);
}
function ctlFkPreview() {
  const q = ctlFkQ(),
    p = ctlPose(ctlFK(q)),
    ok = ctlLimOk(q);
  CTL.fkQ = q;
  document.getElementById('ctl-fk-out').innerHTML =
    'Posisi: <b>' +
    p
      .slice(0, 3)
      .map(v => v.toFixed(1))
      .join(', ') +
    '</b> mm &nbsp; Orientasi: <b>' +
    p
      .slice(3)
      .map(v => v.toFixed(2))
      .join(', ') +
    '</b>°' +
    (ok
      ? ''
      : '<br><span style="color:var(--rose)">Ada sendi di luar batas (J2 dan J4: -85 sampai 265, J3: ±175).</span>');
  if (CTL.tab === 'pos') {
    ctlGhost(q);
    if (CTL.eqOpen) ctlEqRender();
  }
}
function ctlIkSolve() {
  const v = [...document.querySelectorAll('#ctl-ik-in input')].map(i => parseFloat(i.value) || 0),
    keep = document.getElementById('ctl-ik-keep').checked,
    qr = CTL.q.slice();
  let R;
  if (keep) {
    const T = ctlFK(qr);
    R = T.slice(0, 3).map(r => r.slice(0, 3));
  } else R = ctlRfromRpy(v[3], v[4], v[5]);
  const T = [
    [...R[0], v[0] / 1000],
    [...R[1], v[1] / 1000],
    [...R[2], v[2] / 1000],
    [0, 0, 0, 1]
  ];
  CTL.ik = Object.assign(ctlIK(T, qr), { T, target: v, keep });
  CTL.pick = CTL.ik.sols.findIndex(s => s.ok && s.errMm < 0.5);
  const msg = document.getElementById('ctl-ik-msg'),
    box = document.getElementById('ctl-ik-sols');
  if (!CTL.ik.sols.length) {
    msg.innerHTML = '<span style="color:var(--rose)">Tidak ada solusi. ' + (CTL.ik.why || '') + '</span>';
    box.innerHTML = '';
    ctlGhost(null);
    ctlUiConn();
    return;
  }
  msg.textContent =
    CTL.ik.sols.length +
    ' solusi (bahu kiri/kanan, pergelangan ±, siku atas/bawah). Bawaan: solusi layak terdekat dengan pose sekarang.';
  box.innerHTML = CTL.ik.sols
    .map(
      (s, k) =>
        '<label class="ctl-sol' +
        (k === CTL.pick ? ' on' : '') +
        (s.ok ? '' : ' bad') +
        '"><input type="radio" name="ctl-sol" value="' +
        k +
        '"' +
        (k === CTL.pick ? ' checked' : '') +
        '><span>' +
        s.th.map(x => x.toFixed(1)).join(', ') +
        '<br><small>' +
        (s.ok ? 'layak' : 'di luar batas sendi') +
        ', galat ' +
        s.errMm.toFixed(4) +
        ' mm, beda total ' +
        s.dist.toFixed(0) +
        '°</small></span></label>'
    )
    .join('');
  box.querySelectorAll('input').forEach(r =>
    r.addEventListener('change', () => {
      CTL.pick = +r.value;
      box.querySelectorAll('.ctl-sol').forEach((l, k) => l.classList.toggle('on', k === CTL.pick));
      ctlGhost(CTL.ik.sols[CTL.pick].th);
      ctlUiConn();
      if (CTL.eqOpen) ctlEqRender();
    })
  );
  ctlGhost(CTL.pick >= 0 ? CTL.ik.sols[CTL.pick].th : null);
  ctlUiConn();
  if (CTL.eqOpen) ctlEqRender();
}
async function ctlIkMoveL() {
  const S = CTL.ik && CTL.ik.sols[CTL.pick];
  if (!S) return;
  const v = CTL.ik.target,
    t = CTL.st.tcp;
  const pose = [v[0], v[1], v[2], ...(CTL.ik.keep && t ? t.slice(3, 6) : v.slice(3, 6))];
  if (
    !(await ctlAskReal(
      'Robot akan bergerak lurus (MoveL) ke ' +
        v
          .slice(0, 3)
          .map(x => x.toFixed(1))
          .join(', ') +
        ' mm.'
    ))
  )
    return;
  try {
    await ctlCall('move_l', { pose, speed: CTL.speed });
    ctlLog('sys', 'MoveL ke ' + pose.map(x => x.toFixed(1)).join(', '));
  } catch (e) {
    ctlErr(e);
  }
}

// ---- monitoring ----
function ctlMon() {
  const s = CTL.st,
    f = (v, d) => (v == null || !isFinite(v) ? '-' : (+v).toFixed(d));
  document.getElementById('ctl-mon-st').innerHTML = CTL.conn
    ? 'Mode: <b>' +
      (CTL.mode === 'real' ? 'robot nyata ' + (s.ip || '') : 'virtual') +
      '</b> &nbsp; Power: <b>' +
      (s.power ? 'on' : 'off') +
      '</b> &nbsp; Enable: <b>' +
      (s.enabled ? 'ya' : 'tidak') +
      '</b> &nbsp; E-stop: <b>' +
      (s.estop ? 'AKTIF' : 'tidak') +
      '</b> &nbsp; Bergerak: <b>' +
      (s.moving ? 'ya' : 'tidak') +
      '</b>' +
      (s.cab && s.cab.length >= 2
        ? '<br>Daya rata-rata robot: <b>' +
          f(s.cab[s.cab.length - 2], 1) +
          ' W</b>, arus rata-rata: <b>' +
          f(s.cab[s.cab.length - 1], 2) +
          ' A</b>'
        : '')
    : 'Tidak tersambung';
  const J = s.joints || [];
  document.getElementById('ctl-mon-body').innerHTML = [0, 1, 2, 3, 4, 5]
    .map(i => {
      const j = J[i] || {};
      return (
        '<tr><td>J' +
        (i + 1) +
        '</td><td>' +
        f(CTL.q[i], 2) +
        '</td><td>' +
        f(j.i, 2) +
        '</td><td>' +
        f(j.v, 1) +
        '</td><td>' +
        f(j.temp, 1) +
        '</td><td>' +
        f(j.tau, 2) +
        '</td></tr>'
      );
    })
    .join('');
  document.getElementById('ctl-mon-note').textContent =
    CTL.mode === 'real'
      ? 'Data listrik dibaca dari get_robot_status (diperbarui 2 kali per detik). Susunan data mengikuti 02_rekam_data.py.'
      : 'Robot virtual tidak punya data listrik, nilainya 0. Sambungkan ke robot nyata untuk arus, tegangan, suhu, dan torsi.';
  if (window.Chart && !CTL.chart) {
    const cv = document.getElementById('ctl-mon-chart');
    if (cv && cv.offsetWidth) {
      const cols = ['#e07a6c', '#e8a23d', '#7fc47a', '#49c7d6', '#6fa3d8', '#d16bb7'];
      CTL.chart = new Chart(cv, {
        type: 'line',
        data: {
          labels: [],
          datasets: cols.map((c, i) => ({
            label: 'τ' + (i + 1),
            data: [],
            borderColor: c,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2
          }))
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } },
          scales: { x: { display: false }, y: { title: { display: true, text: 'N·m' } } }
        }
      });
    }
  }
  if (CTL.chart && performance.now() - (CTL.chartT || 0) > 500) {
    CTL.chartT = performance.now();
    const t0 = CTL.hist.length ? CTL.hist[0].t : 0;
    CTL.chart.data.labels = CTL.hist.map(h => (h.t - t0).toFixed(1));
    CTL.chart.data.datasets.forEach((d, i) => (d.data = CTL.hist.map(h => h.tau[i])));
    CTL.chart.update();
  }
}

// ---- sidebar persamaan ----
function ctlEqOpen(open) {
  CTL.eqOpen = open;
  document.getElementById('ctl-eq').classList.toggle('open', open);
  if (open) ctlEqRender();
}
function ctlEqRender() {
  const body = document.getElementById('ctl-eq-body');
  if (!body || !window.katex) return;
  CTL.eqT = performance.now();
  const R = String.raw,
    f = (v, d) => RPF(v, d === undefined ? 3 : d),
    src = CTL.ghostQ ? 'pratinjau target' : 'robot sekarang',
    q = (CTL.ghostQ || CTL.q).slice();
  const mat = (M, d) => R`\begin{bmatrix}` + M.map(r => r.map(v => f(v, d)).join('&')).join(R`\\`) + R`\end{bmatrix}`;
  const parts = [];
  const H = t => parts.push(['h', t]),
    Pp = t => parts.push(['p', t]),
    E = t => parts.push(['e', t]);
  H('Tabel DH (Standard DH) dan sudut ' + src);
  E(
    R`\begin{array}{c|cccc} i & a_i\,(\text{m}) & \alpha_i & d_i\,(\text{m}) & \theta_i\\\hline ` +
      CTL_DH.map(
        (j, i) =>
          i + 1 + '&' + f(j.a, 4) + '&' + f(j.alpha, 0) + R`^{\circ}&` + f(j.d, 4) + '&' + f(q[i], 2) + R`^{\circ}`
      ).join(R`\\`) +
      R`\end{array}`
  );
  H('Transformasi tiap sendi');
  E(
    R`T_i^{\,i-1}=\operatorname{Rot}_z(\theta_i)\operatorname{Trans}_z(d_i)\operatorname{Trans}_x(a_i)\operatorname{Rot}_x(\alpha_i)`
  );
  E(
    R`T_i^{\,i-1}=\begin{bmatrix}c\theta_i&-s\theta_i c\alpha_i&s\theta_i s\alpha_i&a_i c\theta_i\\s\theta_i&c\theta_i c\alpha_i&-c\theta_i s\alpha_i&a_i s\theta_i\\0&s\alpha_i&c\alpha_i&d_i\\0&0&0&1\end{bmatrix}`
  );
  let T = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  for (let i = 0; i < 6; i++) {
    const A = igA(q[i], CTL_DH[i].d, CTL_DH[i].a, CTL_DH[i].alpha);
    T = igMul(T, A);
    E('T_{' + (i + 1) + '}^{\\,' + i + '}=' + mat(A, 3));
  }
  H('Forward kinematics');
  E(R`T_6^{\,0}=T_1^{\,0}T_2^{\,1}T_3^{\,2}T_4^{\,3}T_5^{\,4}T_6^{\,5}=` + mat(T, 4));
  const p = ctlPose(T);
  E(R`\mathbf{p}=\begin{bmatrix}x\\y\\z\end{bmatrix}=` + mat([[p[0]], [p[1]], [p[2]]], 1) + R`\ \text{mm}`);
  E(
    R`r_x=\operatorname{atan2}(r_{32},r_{33})=` +
      f(p[3], 2) +
      R`^{\circ},\ r_y=\operatorname{atan2}\!\left(-r_{31},\sqrt{r_{11}^2+r_{21}^2}\right)=` +
      f(p[4], 2) +
      R`^{\circ},\ r_z=\operatorname{atan2}(r_{21},r_{11})=` +
      f(p[5], 2) +
      R`^{\circ}`
  );
  const dJ = ctlJacDet(q);
  H('Jacobian dan singularitas');
  E(
    R`\dot{\mathbf{x}}=J(\theta)\,\dot\theta,\qquad J_i=\begin{bmatrix}\mathbf{z}_{i-1}\times(\mathbf{o}_6-\mathbf{o}_{i-1})\\\mathbf{z}_{i-1}\end{bmatrix},\qquad |\det J|=` +
      f(Math.abs(dJ), 4)
  );
  Pp(
    Math.abs(dJ) < 1e-3
      ? 'Pose dekat singular: gerak linear di sekitar pose ini bisa gagal atau sangat cepat di sendi, pakai MoveJ.'
      : 'Pose jauh dari singular (|det J| di atas 0,001).'
  );
  const S = CTL.tab === 'pos' && CTL.ik && CTL.ik.sols[CTL.pick];
  if (S) {
    const I = CTL.ik.info,
      j = CTL_DH,
      t = S.th;
    H('Inverse kinematics geometri (solusi ' + (CTL.pick + 1) + ')');
    Pp(
      'Sumbu sendi 2, 3, 4 sejajar, jadi IK punya rumus tertutup sampai 8 solusi. Target: ' +
        CTL.ik.target
          .slice(0, 3)
          .map(v => v.toFixed(1))
          .join(', ') +
        ' mm.'
    );
    E(
      R`\mathbf{p}_5=\mathbf{p}_6+d_6\mathbf{z}_6=` +
        mat(
          I.p5.map(v => [v]),
          4
        ) +
        R`\ \text{m},\quad D=d_2+d_3+d_4=` +
        f(I.D, 4) +
        R`,\quad \rho=` +
        f(I.rho, 4)
    );
    E(
      R`\theta_1=\operatorname{atan2}(p_{5y},p_{5x})` +
        (S.k1 ? R`+180^{\circ}-` : '+') +
        R`\arcsin\frac{D}{\rho}=` +
        f(t[0], 2) +
        R`^{\circ}`
    );
    E(
      R`\cos\theta_5=\frac{D-(p_{6x}\sin\theta_1-p_{6y}\cos\theta_1)}{d_6}=` +
        f(S.c5, 4) +
        R`\Rightarrow\theta_5=` +
        f(t[4], 2) +
        R`^{\circ}`
    );
    E(
      R`\theta_6=\operatorname{atan2}\!\left(\frac{v_y}{\sin\theta_5},\frac{v_x}{\sin\theta_5}\right)=` +
        f(t[5], 2) +
        R`^{\circ}`
    );
    E(
      R`\cos\theta_3=\frac{x^2+y^2-a_2^2-a_3^2}{2a_2a_3}=` +
        f(S.c3, 4) +
        R`\Rightarrow\theta_3=` +
        f(t[2], 2) +
        R`^{\circ}`
    );
    E(
      R`\theta_2=\operatorname{atan2}(y,x)-\operatorname{atan2}(a_3\sin\theta_3,a_2+a_3\cos\theta_3)=` +
        f(t[1], 2) +
        R`^{\circ},\quad\theta_4=\theta_{234}-\theta_2-\theta_3=` +
        f(t[3], 2) +
        R`^{\circ}`
    );
    E(R`\left\|\mathbf{p}_{FK}(\theta)-\mathbf{p}^{*}\right\|=` + f(S.errMm, 4) + R`\ \text{mm}`);
  }
  H('Trajectory dan torsi (dipakai Code Template)');
  E(
    R`s(\tau)=10\tau^3-15\tau^4+6\tau^5,\quad \tau=\frac{t}{T},\quad T=\max_i\frac{|\Delta\theta_i|}{\dot\theta_{\max}}`
  );
  E(R`\tau_i=K_i N_i\, i_i,\qquad E=\int_0^{T}\sum_{j=1}^{6}V_j I_j\,dt`);
  body.innerHTML = '';
  parts.forEach(([k, t]) => {
    const el = document.createElement(k === 'h' ? 'h3' : k === 'p' ? 'p' : 'div');
    if (k === 'e') kx(el, t);
    else el.textContent = t;
    body.appendChild(el);
  });
}
(function () {
  const eq = document.getElementById('ctl-eq'),
    grip = document.getElementById('ctl-eq-grip');
  document.getElementById('ctl-eq-tab').addEventListener('click', () => ctlEqOpen(!CTL.eqOpen));
  document.getElementById('ctl-eq-x').addEventListener('click', () => ctlEqOpen(false));
  let drag = false;
  grip.addEventListener('pointerdown', e => {
    drag = true;
    grip.classList.add('drag');
    grip.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  grip.addEventListener('pointermove', e => {
    if (!drag) return;
    const w = Math.max(320, Math.min(window.innerWidth * 0.92, window.innerWidth - e.clientX));
    eq.style.setProperty('--eqw', w + 'px');
  });
  const end = () => {
    if (!drag) return;
    drag = false;
    grip.classList.remove('drag');
    try {
      localStorage.setItem('jakaRemakeEqW', eq.style.getPropertyValue('--eqw'));
    } catch (e) {}
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  try {
    const w = localStorage.getItem('jakaRemakeEqW');
    if (w) eq.style.setProperty('--eqw', w);
  } catch (e) {}
})();

// ---- program Python dan Code Template ----
const CTL_TPL = [
  {
    id: 'pipeline',
    t: 'Pipeline blok diagram penuh',
    d: 'Setpoint, trajectory kuintik, IK, eksekusi (rigid body), FK sebagai umpan balik, galat tiap titik.',
    code: String.raw`# Pipeline blok diagram: Setpoint -> Trajectory -> IK -> Eksekusi (rigid body) -> FK
# Sudut dalam derajat (sudut model, sama dengan simulator), posisi dalam mm, kecepatan dalam persen.
import math

# 1. Setpoint: titik awal = pose sekarang, titik tujuan digeser dari situ (frame base, Z ke atas)
q0 = robot.joints()
p0 = robot.fk(q0)                         # [x, y, z, rx, ry, rz]
tujuan = [p0[0] + 80.0, p0[1] - 60.0, p0[2] - 50.0]
print("Setpoint awal  :", [round(v, 1) for v in p0[:3]])
print("Setpoint tujuan:", [round(v, 1) for v in tujuan])

# 2. Trajectory: garis lurus di ruang Cartesian dengan profil waktu kuintik
N = 8
titik = []
for k in range(1, N + 1):
    s = model.quintic(k, N)               # 0 sampai 1, kecepatan dan percepatan nol di ujung
    titik.append([p0[i] + (tujuan[i] - p0[i]) * s for i in range(3)])

# 3. Inverse kinematics geometri: tiap titik jadi sudut sendi (solusi terdekat dengan titik sebelumnya)
q_ref = q0
jalur = []
for p in titik:
    q = model.ik_xyz(p[0], p[1], p[2], q_ref)   # orientasi alat dipertahankan
    if q is None:
        raise SystemExit("Titik %s di luar jangkauan" % [round(v, 1) for v in p])
    jalur.append(q)
    q_ref = q

# 4. Eksekusi (rigid body): sudut dikirim ke robot, servo di controller JAKA yang mengikutinya
# 5. Forward kinematics: posisi aktual dari sudut terbaca, dibandingkan dengan titik target
galat = []
for k, q in enumerate(jalur, 1):
    robot.move_j(q, speed=15)
    p_akt = robot.fk(robot.joints())
    e = math.dist(p_akt[:3], titik[k - 1])
    galat.append(e)
    print("titik %d: target %s  galat %.3f mm" % (k, [round(v, 1) for v in titik[k - 1]], e))

rmse = math.sqrt(sum(e * e for e in galat) / len(galat))
print("RMSE posisi: %.3f mm" % rmse)
print("TCP akhir (controller):", [round(v, 1) for v in robot.tcp()[:3]])
`
  },
  {
    id: 'dh',
    t: 'Fokus tabel DH dan FK',
    d: 'Cetak tabel DH, matriks tiap sendi, T60, posisi, orientasi, dan det J. Tidak menggerakkan robot.',
    code: String.raw`# Tabel DH dan forward kinematics. Program ini TIDAK menggerakkan robot.
# Sudut diambil dari robot bila tersambung; kalau tidak, memakai pose siap.
q = robot.joints() if robot else list(model.READY)
print("Sudut sendi (derajat):", [round(v, 2) for v in q])
print()
print(" i |   a (m)  | alpha (deg) |   d (m)  | theta (deg)")
for i, ((a, al, d), th) in enumerate(zip(model.DH, q), 1):
    print("%2d | %8.4f | %11.1f | %8.4f | %10.2f" % (i, a, al, d, th))


def tampil(nama, T):
    print(nama)
    for baris in T:
        print("   [" + "  ".join("%9.4f" % v for v in baris) + " ]")


T = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
for i, ((a, al, d), th) in enumerate(zip(model.DH, q), 1):
    A = model.dh_matrix(th, d, a, al)      # Rot_z(theta) Trans_z(d) Trans_x(a) Rot_x(alpha)
    tampil("\nT_%d^%d =" % (i, i - 1), A)
    T = model.matmul(T, A)
tampil("\nT_6^0 = T_1^0 T_2^1 T_3^2 T_4^3 T_5^4 T_6^5 =", T)
pose = model.pose_from_T(T)
print("\nPosisi end-effector (mm)     :", [round(v, 2) for v in pose[:3]])
print("Orientasi rx, ry, rz (derajat):", [round(v, 2) for v in pose[3:]])
print("det J = %.5f (mendekati 0 berarti dekat singular)" % model.det(model.jacobian(q)))
`
  },
  {
    id: 'ik',
    t: 'IK geometri: semua solusi',
    d: 'Hitung sampai 8 solusi untuk satu target x, y, z, tampilkan tabelnya, lalu gerak ke solusi terdekat.',
    code: String.raw`# IK geometri rumus tertutup: semua solusi untuk satu target, lalu gerak ke solusi layak terdekat
target_mm = [450.0, 120.0, 300.0]          # ubah sesuai kebutuhan (frame base, Z ke atas)
q_now = robot.joints() if robot else list(model.READY)
T, _ = model.fk(q_now)                     # orientasi alat dipertahankan dari pose sekarang
T = [baris[:] for baris in T]
T[0][3], T[1][3], T[2][3] = [v / 1000.0 for v in target_mm]
sols = model.ik(T, q_now)
print("Jumlah solusi:", len(sols))
for k, s in enumerate(sols, 1):
    status = "layak" if s["ok"] else "di luar batas sendi"
    print("%d. %s  galat %.4f mm  (%s)" % (k, [round(v, 1) for v in s["q"]], s["err_mm"], status))
terbaik = next((s for s in sols if s["ok"] and s["err_mm"] < 0.5), None)
if terbaik is None:
    print("Target tidak terjangkau.")
elif robot:
    print("Gerak ke solusi terdekat dengan pose sekarang")
    robot.move_j(terbaik["q"], speed=15)
    print("TCP sekarang:", [round(v, 1) for v in robot.tcp()[:3]])
`
  },
  {
    id: 'pick',
    t: 'Pick and place',
    d: 'Above, Pick, Above, Above bowl, Drop dengan MoveJ dan MoveL, gripper lewat DO, set_payload saat menjepit.',
    code: String.raw`# Pick and place: Above, Pick, Above, Above bowl, Drop
# Gripper lewat digital output kabinet. CEK nomor DO ke teknisi sebelum dipakai di robot nyata.
DO_GRIP = 0              # nomor DO gripper
MASSA_KG = 1.0           # massa benda yang diambil
TINGGI = 80.0            # jarak aman di atas benda (mm)
ambil = [450.0, -150.0, 250.0]
letak = [450.0, 150.0, 250.0]
v = 15                   # kecepatan (persen)


def di_atas(p):
    return [p[0], p[1], p[2] + TINGGI]


robot.set_do(DO_GRIP, False)                        # buka gripper
robot.move_j(robot.ik(*di_atas(ambil)), speed=v)    # 1. Above: MoveJ di ruang kosong
robot.move_l(*ambil, speed=v)                       # 2. Pick: turun lurus (MoveL)
robot.set_do(DO_GRIP, True)
robot.wait(0.8)
robot.set_payload(MASSA_KG)                         # beban berubah: deteksi tabrakan tetap benar
robot.move_l(*di_atas(ambil), speed=v)              # 3. Above: naik lurus
robot.move_j(robot.ik(*di_atas(letak)), speed=v)    # 4. Above bowl
robot.move_l(*letak, speed=v)                       # 5. Drop
robot.set_do(DO_GRIP, False)
robot.wait(0.8)
robot.set_payload(0)
robot.move_l(*di_atas(letak), speed=v)
print("Pick and place selesai")
`
  },
  {
    id: 'payload',
    t: 'Uji payload 1, 3, 5 kg',
    d: 'Inti proyek T-17: lintasan sama untuk tiap beban, rekam 10 Hz, hitung energi listrik dan torsi maksimum per siklus.',
    code: String.raw`# Uji payload: lintasan sama untuk 1, 3, 5 kg, rekam data 10 Hz, hitung energi dan torsi maksimum.
# Ganti beban fisik saat jeda. Pada robot virtual data listrik bernilai 0.
PAYLOAD = [1.0, 3.0, 5.0]
A = [450.0, -150.0, 300.0]
B = [450.0, 150.0, 300.0]
v = 20
JEDA = 15                 # detik untuk mengganti beban

hasil = []
for m in PAYLOAD:
    print("Pasang beban %.0f kg. Siklus dimulai dalam %d detik." % (m, JEDA))
    robot.wait(JEDA)
    robot.set_payload(m)
    robot.rec_start()
    for p in (A, B, A):
        robot.move_j(robot.ik(*p), speed=v)
    rec = robot.rec_stop()
    E, tau_maks = 0.0, [0.0] * 6
    for k in range(1, len(rec)):
        js = rec[k].get("joints")
        if not js:
            continue
        dt = rec[k]["t"] - rec[k - 1]["t"]
        E += sum(abs(j["v"] * j["i"]) for j in js) * dt          # E = jumlah V I dt
        tau_maks = [max(a, abs(j["tau"])) for a, j in zip(tau_maks, js)]
    hasil.append((m, E, tau_maks, rec[-1]["t"] - rec[0]["t"] if rec else 0))
    print("  energi %.1f J, torsi maks %s N.m" % (E, [round(t, 2) for t in tau_maks]))

robot.set_payload(0)
print("\nRingkasan")
print("beban | waktu (s) | energi (J) | torsi maks J2 (N.m) | torsi maks J3 (N.m)")
for m, E, tm, w in hasil:
    print("%4.0f  | %9.2f | %10.1f | %19.2f | %19.2f" % (m, w, E, tm[1], tm[2]))
`
  },
  {
    id: 'rekam',
    t: 'Rekam data ke CSV',
    d: 'Rekam sudut, TCP, arus, tegangan, suhu, torsi selama beberapa detik ke folder Dokumen.',
    code: String.raw`# Rekam status robot 10 Hz ke CSV di folder Dokumen. Gerakkan robot dari Teach Pendant selama perekaman.
import csv
import os
DETIK = 10
berkas = os.path.join(os.path.expanduser("~"), "Documents", "jaka_rekam_%s.csv" % time.strftime("%Y%m%d_%H%M%S"))
print("Merekam %d detik..." % DETIK)
robot.rec_start()
robot.wait(DETIK)
rec = robot.rec_stop()
with open(berkas, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    kolom = ["t_s"] + ["q%d_deg" % i for i in range(1, 7)] + ["x_mm", "y_mm", "z_mm"]
    for i in range(1, 7):
        kolom += ["I%d_A" % i, "V%d_V" % i, "T%d_C" % i, "tau%d_Nm" % i]
    w.writerow(kolom)
    t0 = rec[0]["t"] if rec else 0
    for r in rec:
        baris = [round(r["t"] - t0, 3)] + r.get("q", [""] * 6) + r.get("tcp", [""] * 3)[:3]
        for j in r.get("joints") or [{}] * 6:
            baris += [j.get("i", ""), j.get("v", ""), j.get("temp", ""), j.get("tau", "")]
        w.writerow(baris)
print("Tersimpan %d baris di %s" % (len(rec), berkas))
`
  },
  {
    id: 'aman',
    t: 'Gerak pertama yang aman',
    d: 'Sendi 6 berputar +10 lalu -10 derajat, kecepatan 5 persen. Cocok untuk uji pertama di robot nyata.',
    code: String.raw`# Gerak pertama yang aman: sendi 6 berputar +10 lalu -10 derajat dengan kecepatan 5 persen
print("Sudut awal:", [round(v, 2) for v in robot.joints()])
robot.move_rel_j([0, 0, 0, 0, 0, 10], speed=5)
robot.move_rel_j([0, 0, 0, 0, 0, -10], speed=5)
print("Selesai. Sudut akhir:", [round(v, 2) for v in robot.joints()])
`
  },
  {
    id: 'kosong',
    t: 'Program kosong + daftar API',
    d: 'Mulai dari nol, dengan ringkasan semua fungsi robot dan model.',
    code: String.raw`# Program kosong. Ringkasan API (sudut derajat sudut model, posisi mm, kecepatan persen):
#   robot.joints()                      -> [q1..q6]
#   robot.tcp()                         -> [x, y, z, rx, ry, rz] dari controller
#   robot.fk(q=None)                    -> pose dari model DH (tanpa q: pose sekarang)
#   robot.ik(x, y, z[, rx, ry, rz])     -> sudut sendi solusi terdekat atau None
#   robot.move_j(q, speed=10)           -> gerak sendi, menunggu sampai selesai
#   robot.move_rel_j(dq, speed=10)      -> gerak sendi relatif
#   robot.move_l(x, y, z, rx=None, ry=None, rz=None, speed=10) -> gerak lurus
#   robot.wait(detik), robot.set_payload(kg, cog_mm=(0, 0, 50))
#   robot.set_do(nomor, nilai), robot.get_di(nomor), robot.status()
#   robot.rec_start(), robot.rec_stop() -> rekaman 10 Hz
#   model.DH, model.fk(q), model.ik(T, q_ref), model.ik_xyz(x, y, z, q_ref), model.quintic(t, T)
#   model.jacobian(q), model.det(M), model.pose_from_T(T), model.T_from_pose(p)
# Tekan STOP atau Stop untuk menghentikan program kapan saja.

print("Halo JAKA")
`
  }
];
function ctlGutter() {
  const ta = document.getElementById('ctl-code'),
    n = ta.value.split('\n').length,
    g = document.getElementById('ctl-gutter');
  if (g.dataset.n != String(n)) {
    g.dataset.n = n;
    g.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  }
  g.scrollTop = ta.scrollTop;
}
function ctlLoadTemplate(id) {
  const t = CTL_TPL.find(x => x.id === id);
  if (!t) return;
  const ta = document.getElementById('ctl-code');
  ta.value = t.code;
  ctlGutter();
  ctlSaveCode();
  document.getElementById('ctl-tpl-menu').classList.remove('open');
  ctlLog('sys', 'Code Template dimuat: ' + t.t);
}
function ctlSaveCode() {
  try {
    localStorage.setItem('jakaRemakeCode', document.getElementById('ctl-code').value);
  } catch (e) {}
}
function ctlProgStatus(s) {
  CTL.prog = s;
  const el = document.getElementById('ctl-prog-st');
  el.textContent =
    { running: 'Berjalan...', done: 'Selesai', error: 'Berhenti karena galat', stopped: 'Dihentikan', idle: 'Siap' }[
      s
    ] || s;
  el.className = s === 'running' ? 'run' : '';
  if (s !== 'running' && s !== 'idle') ctlLog('sys', 'Program ' + el.textContent.toLowerCase());
}
async function ctlRun(skipAsk) {
  const code = document.getElementById('ctl-code').value;
  if (!code.trim()) {
    toast('Editor kosong');
    return;
  }
  try {
    await ctlBridge();
    const usesRobot = /\brobot\./.test(code);
    if (
      usesRobot &&
      CTL.conn &&
      CTL.mode === 'real' &&
      !skipAsk &&
      !(await ctlAsk(
        'Program akan dijalankan di ROBOT NYATA dan bisa menggerakkannya. Pastikan area kerja kosong dan tombol emergency stop fisik dalam jangkauan.'
      ))
    )
      return;
    ctlLog(
      'sys',
      '=== Program dijalankan ' +
        new Date().toLocaleTimeString() +
        (CTL.conn
          ? ' (' + (CTL.mode === 'real' ? 'robot nyata' : 'robot virtual') + ')'
          : ' (belum tersambung ke robot)') +
        ' ==='
    );
    await jakaBridge.call('run', { code, allow_real: true });
  } catch (e) {
    ctlErr(e);
  }
}
function ctlBuildProg() {
  const menu = document.getElementById('ctl-tpl-menu');
  menu.innerHTML = CTL_TPL.map(
    t => '<button type="button" data-id="' + t.id + '"><b>' + t.t + '</b><small>' + t.d + '</small></button>'
  ).join('');
  menu.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', async () => {
      const ta = document.getElementById('ctl-code');
      if (
        ta.value.trim() &&
        !CTL_TPL.some(t => t.code === ta.value) &&
        !(await ctlAsk(
          'Ganti isi editor dengan template ini? Isi sekarang akan hilang (simpan dulu dengan Simpan .py bila perlu).'
        ))
      )
        return;
      ctlLoadTemplate(b.dataset.id);
    })
  );
  document.getElementById('ctl-tpl-btn').addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) menu.classList.remove('open');
  });
  const ta = document.getElementById('ctl-code');
  let saved = null;
  try {
    saved = localStorage.getItem('jakaRemakeCode');
  } catch (e) {}
  ta.value = saved || CTL_TPL[0].code;
  ctlGutter();
  let tm = null;
  ta.addEventListener('input', () => {
    ctlGutter();
    clearTimeout(tm);
    tm = setTimeout(ctlSaveCode, 400);
  });
  ta.addEventListener('scroll', ctlGutter);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      ctlRun();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart,
        en = ta.selectionEnd;
      ta.setRangeText('    ', s, en, 'end');
      ctlGutter();
      return;
    }
    if (e.key === 'Enter') {
      const s = ta.selectionStart,
        ln = ta.value.slice(0, s).split('\n').pop(),
        ind = (ln.match(/^\s*/) || [''])[0] + (/:\s*$/.test(ln) ? '    ' : '');
      e.preventDefault();
      ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end');
      ctlGutter();
    }
  });
  document.getElementById('ctl-run').addEventListener('click', () => ctlRun());
  document.getElementById('ctl-run-stop').addEventListener('click', () => {
    if (CTL.bridge) jakaBridge.call('stop_program', {}).catch(ctlErr);
  });
  document.getElementById('ctl-save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ta.value], { type: 'text/x-python' }));
    a.download = 'program_jaka.py';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const file = document.getElementById('ctl-file');
  document.getElementById('ctl-open').addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      ta.value = String(r.result);
      ctlGutter();
      ctlSaveCode();
      ctlLog('sys', 'Dibuka: ' + f.name);
    };
    r.readAsText(f);
    file.value = '';
  });
}

// ---- tab, masuk dan keluar halaman ----
function ctlTab(t) {
  CTL.tab = t;
  document.querySelectorAll('.ctl-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.ctl-pane').forEach(p => p.classList.toggle('on', p.id === 'ctl-pane-' + t));
  if (t === 'pos') {
    ctlFkPreview();
    if (CTL.ik && CTL.pick >= 0) ctlGhost(CTL.ik.sols[CTL.pick].th);
  } else ctlGhost(null);
  if (t === 'mon') ctlMon();
  if (CTL.eqOpen) ctlEqRender();
}
function ctlBuild() {
  if (CTL.built) return;
  CTL.built = true;
  ctlBuildScene();
  ctlBuildJog();
  ctlBuildPos();
  ctlBuildProg();
  document.getElementById('ctl-ip').value = appSettings.ctl.ip;
  CTL.mode = appSettings.ctl.mode === 'real' ? 'real' : 'virtual';
  document.querySelectorAll('#ctl-mode button').forEach(b =>
    b.addEventListener('click', () => {
      if (CTL.conn) return;
      CTL.mode = b.dataset.v;
      ctlUiConn();
    })
  );
  document.getElementById('ctl-ping').addEventListener('click', ctlPing);
  document.getElementById('ctl-conn').addEventListener('click', ctlConnect);
  document.getElementById('ctl-power').addEventListener('click', ctlPower);
  document.getElementById('ctl-enable').addEventListener('click', ctlEnable);
  document.getElementById('ctl-stop').addEventListener('click', ctlStopAll);
  document.getElementById('ctl-back').addEventListener('click', () => nav('#dash'));
  document.querySelectorAll('.ctl-tabs button').forEach(b => b.addEventListener('click', () => ctlTab(b.dataset.t)));
  document.querySelectorAll('.ctl-views button[data-v]').forEach(b =>
    b.addEventListener('click', () => {
      const v = CTL_VIEWS[b.dataset.v];
      CTL.scene.setView(v[0], v[1]);
    })
  );
  document.getElementById('ctl-ghost-btn').addEventListener('click', e => {
    CTL.ghostOn = !CTL.ghostOn;
    e.target.textContent = 'Target: ' + (CTL.ghostOn ? 'tampil' : 'sembunyi');
    ctlGhost(CTL.ghostQ);
  });
  const sp = document.getElementById('ctl-speed');
  sp.addEventListener('input', () => {
    CTL.speed = +sp.value;
    ctlSpeedText();
  });
  ctlSpeedText();
  document.querySelectorAll('#ctl-step button').forEach(b =>
    b.addEventListener('click', () => {
      CTL.step = +b.dataset.v;
      document.querySelectorAll('#ctl-step button').forEach(x => x.classList.toggle('on', x === b));
    })
  );
  document
    .getElementById('ctl-go-ready')
    .addEventListener('click', () => ctlMoveJ(READY_POSE.slice(), 'pose siap (0, 90, -90, 90, 90, 0)'));
  document
    .getElementById('ctl-go-zero')
    .addEventListener('click', () =>
      ctlMoveJ([0, 0, 0, 0, 0, 0], 'pose nol (lengan lurus mendatar, butuh ruang 0,8 m)')
    );
  document.getElementById('ctl-fk-take').addEventListener('click', () => ctlFkFill(CTL.q));
  document.getElementById('ctl-fk-go').addEventListener('click', () =>
    ctlMoveJ(
      ctlFkQ(),
      'sudut ' +
        ctlFkQ()
          .map(v => v.toFixed(1))
          .join(', ')
    )
  );
  document
    .getElementById('ctl-ik-take')
    .addEventListener('click', () => ctlIkFill(CTL.st.tcp || ctlPose(ctlFK(CTL.q))));
  document.getElementById('ctl-ik-solve').addEventListener('click', ctlIkSolve);
  document.getElementById('ctl-ik-goj').addEventListener('click', () => {
    const S = CTL.ik && CTL.ik.sols[CTL.pick];
    if (S) ctlMoveJ(S.th.slice(), 'solusi IK ' + (CTL.pick + 1));
  });
  document.getElementById('ctl-ik-gol').addEventListener('click', ctlIkMoveL);
  window.addEventListener('blur', ctlJogUp);
  if (!window.jakaBridge) {
    const n = document.getElementById('ctl-nobridge');
    n.hidden = false;
    n.innerHTML =
      '<b>Mode lihat saja.</b> Kendali robot butuh aplikasi JAKA Remake (.exe) dengan Python 3 64-bit. Di sini model 3D, FK, IK, persamaan, dan editor program tetap bisa dipakai.';
    ['ctl-conn', 'ctl-ping', 'ctl-run'].forEach(id => (document.getElementById(id).disabled = true));
  }
  ctlUiConn();
}
function ctlEnter() {
  ctlBuild();
  window.dispatchEvent(new Event('resize'));
  ctlPoseScene(CTL.q);
  ctlHud();
  ctlUiConn();
  if (CTL.tab === 'pos') ctlFkPreview();
}
function ctlLeave() {
  ctlJogUp();
  if (CTL.eqOpen) ctlEqOpen(false);
}
// Uji asap Electron: robot virtual lewat jembatan Python sungguhan
async function ctlSmoke() {
  CTL.mode = 'virtual';
  ctlUiConn();
  if (!CTL.conn) await ctlConnect();
  await ctlCall('power', { on: true });
  await ctlCall('enable', { on: true });
  await ctlCall('move_j', { q: [25, 80, -75, 85, 90, 15], speed: 80 });
  await new Promise(r => setTimeout(r, 3000));
  return {
    conn: CTL.conn,
    q: CTL.q.map(v => +v.toFixed(2)),
    tcp: CTL.st.tcp,
    lamp: document.getElementById('ctl-lamp').dataset.s,
    bridge: CTL.bridge && { py: CTL.bridge.py, python: CTL.bridge.python, sdk: CTL.bridge.sdk }
  };
}
