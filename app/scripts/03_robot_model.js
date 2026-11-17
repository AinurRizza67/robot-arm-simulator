/* 03_robot_model.js
   JAKA ZU5 model: Standard DH chain, frame conventions (DH base Z-up vs Three.js Y-up), STEP meshes.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ==================================================================
   6-DOF ROBOT SIMULATOR (FK & IK), JAKA ZU5
   ================================================================== */

// DH JAKA ZU5 dalam meter/derajat, diturunkan dari geometri STEP resmi (Jaka Zu 5.STEP) pada
// pose nol (lengan lurus sepanjang +X). Nol & arah putar sendi mengikuti pose STEP, belum tentu
// sama dengan konvensi controller JAKA. Mesh per link di models/zu5_meshes.js
// memakai frame yang sama, jadi mengubah DH tidak menggeser mesh secara otomatis.
// DH of the active model (03a_model_library.js); the JAKA ZU5 is the default model.
const defaultDH = JSON.parse(JSON.stringify(ACTIVE_MODEL.dh));
let joints6 = JSON.parse(JSON.stringify(defaultDH));
let homePose = ACTIVE_MODEL.ready.slice();
// 0 Zone (Sesi 16c): pose awal yang dikunci pengguna. joints6[i].theta tetap absolut; slider menampilkan q = θ - θ₀ saat terkunci
const ZZ = { locked: false, q0: [0, 0, 0, 0, 0, 0] };
const zzOff = i => (ZZ.locked ? ZZ.q0[i] : 0);
const READY_POSE = ACTIVE_MODEL.ready.slice(); // lengan atas tegak, lengan bawah mendatar, alat ke bawah, |det J| = 0.076

// Massa & payload: massa total 23 kg dari datasheet publik, belum diverifikasi.
const defaultRobotMeta = { totalMass: ACTIVE_MODEL.totalMass || 20, payloadMode: '0', payloadCustom: 2 };
let robotMeta = JSON.parse(JSON.stringify(defaultRobotMeta));
let configIsPlaceholder = false;
function activePayloadKg() {
  return robotMeta.payloadMode === 'custom'
    ? parseFloat(robotMeta.payloadCustom) || 0
    : parseFloat(robotMeta.payloadMode);
}

function dhMatrix(theta, d, a, alpha) {
  const th = (theta * Math.PI) / 180,
    al = (alpha * Math.PI) / 180;
  const ct = Math.cos(th),
    st = Math.sin(th),
    ca = Math.cos(al),
    sa = Math.sin(al);
  const m = new THREE.Matrix4();
  m.set(ct, -st * ca, st * sa, a * ct, st, ct * ca, -ct * sa, a * st, 0, sa, ca, d, 0, 0, 0, 1);
  return m;
}
function computeChain6(thOvr) {
  let cum = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const frames = [cum.clone()];
  for (let i = 0; i < 6; i++) {
    const j = joints6[i];
    const th = thOvr ? thOvr[i] : j.theta;
    const m = dhMatrix(th, j.d, j.a, j.alpha);
    cum = cum.clone().multiply(m);
    frames.push(cum.clone());
  }
  return frames;
}
function eeFromThetas6(thOvr) {
  const f = computeChain6(thOvr);
  return new THREE.Vector3(0, 0, 0).applyMatrix4(f[f.length - 1]);
}
// T60 dalam frame base DH (Z ke atas): batalkan rotasi layar Rx(-90°) yang diawalkan computeChain6()
function T60dh(thOvr) {
  return new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(computeChain6(thOvr)[6]);
}
// Frame pengguna = frame base DH (Z ke atas, sama dengan MATLAB dan controller JAKA). Frame layar Three.js (Y ke atas)
// hanya dipakai internal untuk render; semua angka yang dilihat atau diketik pengguna lewat dua fungsi ini.
const toUser = v => ({ x: v.x, y: -v.z, z: v.y });
const fromUser = p => new THREE.Vector3(p.x, p.z, -p.y);

/* ============ MESH JAKA ZU5 (dari STEP, lihat models/zu5_meshes.js) ============ */
const ROBOT_VIS = 4; // 1 m robot = 4 unit scene

function b64u16(b) {
  const bin = atob(b),
    n = bin.length >> 1,
    a = new Uint16Array(n);
  for (let i = 0; i < n; i++) a[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
  return a;
}
// Posisi & indeks 16-bit terkuantisasi -> BufferGeometry non-indexed dengan normal halus per permukaan (sudut crease 40°)
function zu5Geometry(s) {
  if (s.geometry) return s.geometry; // generated or uploaded part
  if (s._geo) return s._geo;
  const q = b64u16(s.pos),
    idx = b64u16(s.idx),
    nv = s.nv,
    nt = s.nt;
  const P = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++)
    for (let k = 0; k < 3; k++) P[i * 3 + k] = s.lo[k] + (q[i * 3 + k] / 65535) * (s.hi[k] - s.lo[k]);
  const FN = new Float32Array(nt * 3),
    FL = new Float32Array(nt),
    adj = Array.from({ length: nv }, () => []);
  for (let t = 0; t < nt; t++) {
    const a = idx[3 * t],
      b = idx[3 * t + 1],
      c = idx[3 * t + 2];
    const ux = P[3 * b] - P[3 * a],
      uy = P[3 * b + 1] - P[3 * a + 1],
      uz = P[3 * b + 2] - P[3 * a + 2],
      vx = P[3 * c] - P[3 * a],
      vy = P[3 * c + 1] - P[3 * a + 1],
      vz = P[3 * c + 2] - P[3 * a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    FN[3 * t] = nx;
    FN[3 * t + 1] = ny;
    FN[3 * t + 2] = nz;
    FL[t] = Math.hypot(nx, ny, nz);
    adj[a].push(t);
    adj[b].push(t);
    adj[c].push(t);
  }
  const pos = new Float32Array(nt * 9),
    nor = new Float32Array(nt * 9),
    cosT = Math.cos((40 * Math.PI) / 180);
  for (let t = 0; t < nt; t++) {
    for (let j = 0; j < 3; j++) {
      const v = idx[3 * t + j];
      let sx = 0,
        sy = 0,
        sz = 0;
      for (const u of adj[v]) {
        if (FL[u] === 0 || FL[t] === 0) continue;
        if (
          (FN[3 * u] * FN[3 * t] + FN[3 * u + 1] * FN[3 * t + 1] + FN[3 * u + 2] * FN[3 * t + 2]) / (FL[u] * FL[t]) >
          cosT
        ) {
          sx += FN[3 * u];
          sy += FN[3 * u + 1];
          sz += FN[3 * u + 2];
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1,
        o = t * 9 + j * 3;
      nor[o] = sx / l;
      nor[o + 1] = sy / l;
      nor[o + 2] = sz / l;
      pos[o] = P[3 * v];
      pos[o + 1] = P[3 * v + 1];
      pos[o + 2] = P[3 * v + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return (s._geo = g);
}

/* ============ OBJEK BEBAN 1/3/5 kg (visual saja) ============ */
function makeCoordLabel() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(0.24, 0.09, 1);
  sp.renderOrder = 10;
  sp.userData.last = '';
  sp.userData.set = lines => {
    const key = lines.join('|');
    if (key === sp.userData.last) return;
    sp.userData.last = key;
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = 'rgba(10,14,22,0.82)';
    ctx.fillRect(4, 6, 248, 84);
    ctx.strokeStyle = '#8b93a3';
    ctx.strokeRect(4, 6, 248, 84);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eef1f6';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(lines[0], 128, 28);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#9fc4ee';
    ctx.fillText(lines[1], 128, 64);
    tex.needsUpdate = true;
  };
  return sp;
}
const placedWeights = {}; // kg -> matriks dunia balok yang sudah diletakkan oleh trajectory
const attachedKg = () => {
  const m = robotMeta.payloadMode;
  return m === '1' || m === '3' || m === '5' ? +m : null;
};
function updateWeights(inst, frames) {
  const att = attachedKg();
  inst.weights.forEach(w => {
    if (w.kg === att)
      w.group.matrix.copy(frames[6]).multiply(new THREE.Matrix4().makeTranslation(0, 0, w.size / 2 + 0.005));
    else if (placedWeights[w.kg]) w.group.matrix.copy(placedWeights[w.kg]);
    else w.group.matrix.copy(w.home);
    w.group.matrixWorldNeedsUpdate = true;
    const nowT = performance.now();
    if (!w.tl || nowT - w.tl > 120) {
      w.tl = nowT;
      const pp = toUser(new THREE.Vector3().setFromMatrixPosition(w.group.matrix));
      w.label.userData.set([
        w.kg + ' kg',
        'x ' + pp.x.toFixed(2) + '  y ' + pp.y.toFixed(2) + '  z ' + pp.z.toFixed(2)
      ]);
    }
  });
}
function syncWeights() {
  [fkScene, ikScene].forEach(sc => poseScene6(sc));
}
function setPayloadMode(mode) {
  robotMeta.payloadMode = mode;
  const sel = document.getElementById('cfg-payload-select');
  if (sel) sel.value = mode;
  const wrap = document.getElementById('cfg-payload-custom-wrap');
  if (wrap) wrap.style.display = mode === 'custom' ? 'block' : 'none';
  syncWeights();
}
// Posisi lantai balok (frame layar, meter). Jarak dari base dibatasi agar tetap terjangkau robot;
// marka tujuan pick and place selalu di sisi seberang (x, -z).
const WEIGHT_R_MIN = 0.22,
  WEIGHT_R_MAX = 0.75;
function moveWeightHome(kg, x, z) {
  let r = Math.hypot(x, z);
  if (r < 1e-6) {
    x = WEIGHT_R_MIN;
    z = 0;
    r = WEIGHT_R_MIN;
  }
  const k = Math.min(WEIGHT_R_MAX, Math.max(WEIGHT_R_MIN, r)) / r;
  x *= k;
  z *= k;
  [fkScene, ikScene].forEach(sc =>
    sc.weights
      .filter(w => w.kg === kg)
      .forEach(w => {
        w.home.makeTranslation(x, w.size / 2, z);
        w.mark.position.set(x, 0.004, -z);
        w.tl = 0;
      })
  );
  if (TRAJ.plan && !TRAJ.plan.ik) TRAJ.replan = true;
  syncWeights();
}
function onWeightClick(kg) {
  if (attachedKg() !== kg) delete placedWeights[kg];
  setPayloadMode(attachedKg() === kg ? '0' : String(kg));
}
