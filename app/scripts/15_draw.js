/* 15_draw.js
   Draw page and block diagram pop-up: axis drawing, DH visuals, cinematic mode, closed-form IK.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ BLOK DIAGRAM SEBAGAI POP-UP (v1.2.1) ============ */
// Diagram tidak lagi bersebelahan dengan robot 3D. Kartu perhitungan blok dipindah ke dalam pop-up selama terbuka,
// lalu dikembalikan ke upside bar saat ditutup (id tetap satu, jadi bdRender tidak berubah).
function bdPopOpen() {
  return document.getElementById('bd-pop').classList.contains('open');
}
function bdPop(open) {
  const p = document.getElementById('bd-pop');
  if (p.classList.contains('open') === open) return;
  const calc = document.getElementById('bd-calc');
  p.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    if (BDU.open && BDU.tab === 'rumus') bdUp(false);
    document.getElementById('bd-pop-calc').appendChild(calc);
    bdRender(true);
    document.getElementById('bd-pop-x').focus();
  } else document.querySelector('.bd-up-panel[data-panel="rumus"]').appendChild(calc);
}
document.getElementById('bd-open').addEventListener('click', () => bdPop(true));
document.getElementById('bd-pop-x').addEventListener('click', () => bdPop(false));
document.getElementById('bd-pop').addEventListener('click', e => {
  if (e.target.id === 'bd-pop') bdPop(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !TUT.on) bdPop(false);
});

/* ============ MENU DRAW (v1.2.1): Axis Draw, visual DH, Cinematic, IK geometri ============ */
// Meminjam kanvas FK (satu renderer), jadi pose robot sama dengan FK, IK, dan Blok Diagram.
// DRAW.v = elemen visual DH; DRAW.s dan DRAW.c = elemen adegan untuk tampilan biasa dan Cinematic.
const DRAW = {
  active: false,
  cine: false,
  axis: false,
  dh: false,
  lock: true,
  sols: [],
  pick: -1,
  tgt: null,
  ori: 'now',
  ghost: false,
  mathT: 0,
  focus: 'all',
  // parameter yang digambar: 'dh' (tabel DH), 'ik' (notasi buku Asada & Slotine), 'both' (gabungan)
  pm: 'dh',
  k: { p: true, ntb: true, w: true, t1: true, arm: true, t5: true },
  v: {
    links: true,
    axes: true,
    rot: true,
    rev: true,
    a: true,
    d: true,
    theta: true,
    alpha: true,
    labels: true,
    ee: true
  },
  s: {
    frames: true,
    xray: true,
    grid: true,
    gridnum: false,
    ruler: true,
    weights: true,
    ground: true,
    hud: true,
    spin: false
  },
  c: {
    frames: false,
    xray: true,
    grid: false,
    gridnum: false,
    ruler: false,
    weights: false,
    ground: true,
    hud: false,
    spin: false
  }
};
const DR_COL = {
  link: 0x8794a8,
  axis: 0x9aa7ba,
  rot: 0x62c98a,
  rev: 0xf0b23e,
  a: 0xe0685f,
  d: 0x4d9bea,
  th: 0xf0b23e,
  al: 0xb98ae6,
  ee: 0xff5d5d
};
const DR_V = [
  ['links', 'Garis link (kerangka)', '#8794a8'],
  ['axes', 'Sumbu sendi z', '#9aa7ba'],
  ['rot', 'Arah putar positif', '#62c98a'],
  ['rev', 'Simbol revolute', '#f0b23e'],
  ['a', 'Panjang a', '#e0685f'],
  ['d', 'Offset d', '#4d9bea'],
  ['theta', 'Sudut θ', '#f0b23e'],
  ['alpha', 'Sudut α (twist)', '#b98ae6'],
  ['ee', 'Titik end-effector', '#ff5d5d'],
  ['labels', 'Label angka', '']
];
// Elemen visual IK menurut notasi buku (Asada & Slotine, Robot Analysis and Control, bab 2.3)
const DR_K = [
  ['p', 'Vektor posisi p', '#ffa94d'],
  ['ntb', 'Vektor n, t, b', '#4dabf7'],
  ['w', 'Titik W dan l₂b', '#e599f7'],
  ['t1', 'Proyeksi W, l₁, θ₁', '#74c0fc'],
  ['arm', 'Segitiga a₂, a₃, r', '#ffd43b'],
  ['t5', 'Sudut θ₅ (z₁ ke b)', '#63e6be']
];
const DR_COLK = {
  p: 0xffa94d,
  n: 0xff6b6b,
  t: 0x51cf66,
  b: 0x4dabf7,
  w: 0xe599f7,
  t1: 0x74c0fc,
  arm: 0xffd43b,
  t5: 0x63e6be
};
const DR_S = [
  ['frames', 'Frame x, y, z'],
  ['xray', 'Badan robot tembus pandang'],
  ['grid', 'Garis grid lantai'],
  ['gridnum', 'Angka grid'],
  ['ruler', 'Meteran'],
  ['weights', 'Balok payload'],
  ['ground', 'Lantai'],
  ['hud', 'Tombol kamera dan legenda'],
  ['spin', 'Putar kamera otomatis']
];
const drS = () => (DRAW.cine ? DRAW.c : DRAW.s);
const DR_FOCUS = [
  ['all', 'Seluruh adegan'],
  ['robot', 'Robot'],
  ['1', 'Sendi 1'],
  ['2', 'Sendi 2'],
  ['3', 'Sendi 3'],
  ['4', 'Sendi 4'],
  ['5', 'Sendi 5'],
  ['6', 'Sendi 6'],
  ['ee', 'End-effector']
];
// Titik fokus kamera: sendi i dilihat di tengah ruas DH-nya (antara origin frame i-1 dan frame i). Zoom boleh lebih dekat saat fokus ke sendi.
function drFocus(frames, snap) {
  if (!DRAW.active) return;
  const f = DRAW.focus,
    sc = fkScene,
    P = k => new THREE.Vector3().setFromMatrixPosition(frames[k]);
  let t,
    rm = 2,
    r = 0;
  if (f === 'all' && !DRAW.cine) t = new THREE.Vector3(1.5, 0.7, 0);
  else if (f === 'all' || f === 'robot') {
    t = P(0)
      .add(P(3))
      .add(P(6))
      .multiplyScalar(ROBOT_VIS / 3);
    rm = 1.2;
  } else if (f === 'ee') {
    t = P(6).multiplyScalar(ROBOT_VIS);
    rm = 0.6;
    r = snap ? 1.8 : 0;
  } else {
    const k = +f;
    t = P(k - 1)
      .add(P(k))
      .multiplyScalar(ROBOT_VIS / 2);
    rm = 0.6;
    r = snap ? 1.8 : 0;
  }
  if (r) {
    const v = sc.getView();
    sc.setView(v[0], v[1], r);
  }
  sc.setTarget(t, rm);
}

function drLabel(css) {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 72;
  const x = c.getContext('2d'),
    tex = new THREE.CanvasTexture(c);
  // sizeAttenuation:false = ukuran tetap di layar; skala dibagi ROBOT_VIS karena sprite ikut skala grup world
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false })
  );
  sp.scale.set(0.0355, 0.008, 1);
  sp.renderOrder = 30;
  sp.userData.last = null;
  sp.userData.set = t => {
    if (t === sp.userData.last) return;
    sp.userData.last = t;
    x.clearRect(0, 0, 320, 72);
    x.font = 'bold 32px Arial';
    let mt = x.measureText(t),
      tw = (mt && mt.width) || 200;
    if (tw > 284) {
      x.font = 'bold ' + Math.floor((32 * 284) / tw) + 'px Arial';
      mt = x.measureText(t);
      tw = (mt && mt.width) || 284;
    } // teks panjang dikecilkan supaya tidak terpotong
    const w = Math.min(312, tw + 28),
      l = (320 - w) / 2;
    x.fillStyle = 'rgba(8,12,20,0.88)';
    x.fillRect(l, 10, w, 52);
    x.strokeStyle = css;
    x.lineWidth = 3;
    x.strokeRect(l, 10, w, 52);
    x.fillStyle = css;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(t, 160, 37);
    tex.needsUpdate = true;
  };
  return sp;
}
// Pembuat objek gambar bersama untuk overlay DH dan overlay parameter IK buku
function drKit() {
  const V = (x, y, z) => new THREE.Vector3(x, y, z),
    UP = V(0, 1, 0),
    ZP = V(0, 0, 1);
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const mat = (c, o) =>
    new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: o === undefined ? 1 : o,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  const cylG = new THREE.CylinderGeometry(1, 1, 1, 14, 1),
    coneG = new THREE.ConeGeometry(0.0075, 0.022, 12);
  const seg = (c, r) => {
    const m = new THREE.Mesh(cylG, mat(c));
    m.renderOrder = 22;
    m.userData.r = r;
    return m;
  };
  const setSeg = (m, p, q) => {
    const d = new THREE.Vector3().subVectors(q, p),
      L = d.length();
    if (L < 1e-5) return false;
    m.position.copy(p).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.scale.set(m.userData.r, L, m.userData.r);
    return true;
  };
  const cone = c => {
    const m = new THREE.Mesh(coneG, mat(c));
    m.renderOrder = 24;
    return m;
  };
  const aim = (m, p, dir) => {
    m.position.copy(p);
    m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  };
  const NA = 28;
  const arc = c => {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NA + 1) * 3), 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: c, transparent: true, depthTest: false }));
    line.renderOrder = 23;
    line.frustumCulled = false;
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NA + 2) * 3), 3));
    const idx = [];
    for (let k = 0; k < NA; k++) idx.push(0, k + 1, k + 2);
    fg.setIndex(idx);
    const fan = new THREE.Mesh(fg, mat(c, 0.24));
    fan.renderOrder = 20;
    fan.frustumCulled = false;
    return {
      line,
      fan,
      set(ctr, f) {
        const lp = lg.attributes.position,
          fp = fg.attributes.position;
        fp.setXYZ(0, ctr.x, ctr.y, ctr.z);
        for (let k = 0; k <= NA; k++) {
          const p = f(k / NA);
          lp.setXYZ(k, p.x, p.y, p.z);
          fp.setXYZ(k + 1, p.x, p.y, p.z);
        }
        lp.needsUpdate = true;
        fp.needsUpdate = true;
      }
    };
  };
  // dua ruas garis putus-putus (garis bantu arah sumbu sebelum dan sesudah)
  const dash = c => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    const l = new THREE.LineSegments(
      g,
      new THREE.LineDashedMaterial({ color: c, dashSize: 0.012, gapSize: 0.008, transparent: true, depthTest: false })
    );
    l.renderOrder = 23;
    l.frustumCulled = false;
    l.userData.set = (a, b, p, q) => {
      const P = g.attributes.position;
      P.setXYZ(0, a.x, a.y, a.z);
      P.setXYZ(1, b.x, b.y, b.z);
      P.setXYZ(2, p.x, p.y, p.z);
      P.setXYZ(3, q.x, q.y, q.z);
      P.needsUpdate = true;
      l.computeLineDistances();
    };
    return l;
  };
  return { V, UP, ZP, hex, mat, cylG, seg, setSeg, cone, aim, arc, dash };
}
function drBuildOverlay(sc) {
  const root = new THREE.Group();
  root.visible = false;
  sc.world.add(root);
  const { V, ZP, hex, mat, cylG, seg, setSeg, cone, aim, arc, dash } = drKit();
  const J = [];
  for (let k = 0; k < 6; k++) {
    const gA = new THREE.Group(),
      gB = new THREE.Group();
    gA.matrixAutoUpdate = false;
    gB.matrixAutoUpdate = false;
    root.add(gA, gB);
    const o = { gA, gB };
    o.axis = seg(DR_COL.axis, 0.0022);
    o.axisTip = cone(DR_COL.axis);
    o.rev = new THREE.Mesh(cylG, mat(DR_COL.rev, 0.38));
    o.rev.scale.set(0.03, 0.08, 0.03);
    o.rev.rotation.x = Math.PI / 2;
    o.rev.renderOrder = 19;
    o.ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.003, 8, 44, 5.1), mat(DR_COL.rot));
    o.ring.renderOrder = 22;
    o.ringTip = cone(DR_COL.rot);
    o.dSeg = seg(DR_COL.d, 0.0055);
    o.aSeg = seg(DR_COL.a, 0.0055);
    o.th = arc(DR_COL.th);
    o.thTip = cone(DR_COL.th);
    o.thRef = dash(DR_COL.th);
    o.al = arc(DR_COL.al);
    o.alTip = cone(DR_COL.al);
    o.alRef = dash(DR_COL.al);
    o.lAxis = drLabel(hex(DR_COL.axis));
    o.lD = drLabel(hex(DR_COL.d));
    o.lA = drLabel(hex(DR_COL.a));
    o.lTh = drLabel(hex(DR_COL.th));
    o.lAl = drLabel(hex(DR_COL.al));
    gA.add(
      o.axis,
      o.axisTip,
      o.rev,
      o.ring,
      o.ringTip,
      o.dSeg,
      o.aSeg,
      o.th.line,
      o.th.fan,
      o.thTip,
      o.thRef,
      o.lAxis,
      o.lD,
      o.lA,
      o.lTh
    );
    gB.add(o.al.line, o.al.fan, o.alTip, o.alRef, o.lAl);
    J.push(o);
  }
  const ee = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), mat(DR_COL.ee));
  ee.renderOrder = 25;
  root.add(ee);
  const lEE = drLabel(hex(DR_COL.ee));
  lEE.scale.set(0.0445, 0.01, 1);
  root.add(lEE);
  const baseAxes = new THREE.AxesHelper(0.16);
  baseAxes.matrixAutoUpdate = false;
  baseAxes.visible = false;
  sc.world.add(baseAxes);
  function update(frames) {
    const v = DRAW.v,
      L = v.labels,
      rad = Math.PI / 180;
    baseAxes.matrix.copy(frames[0]);
    baseAxes.matrixWorldNeedsUpdate = true;
    J.forEach((o, k) => {
      const j = joints6[k],
        i = k + 1,
        th = j.theta * rad,
        al = j.alpha * rad,
        d = j.d,
        a = j.a;
      o.gA.matrix.copy(frames[k]);
      o.gA.matrixWorldNeedsUpdate = true;
      o.gB.matrix.copy(frames[k + 1]);
      o.gB.matrixWorldNeedsUpdate = true;
      // sumbu sendi i = z(i-1), melewati origin frame i-1
      const z0 = Math.min(0, d) - 0.11,
        z1 = Math.max(0, d) + 0.11;
      setSeg(o.axis, V(0, 0, z0), V(0, 0, z1));
      aim(o.axisTip, V(0, 0, z1 + 0.008), ZP);
      o.axis.visible = o.axisTip.visible = v.axes;
      o.lAxis.visible = v.axes && L;
      o.lAxis.position.set(0, 0, z1 + 0.045);
      o.lAxis.userData.set('z' + k + '  sendi ' + i);
      // modul motor sendi i = bagian link i yang berputar terhadap z(i-1): pusatnya di z = d_i (di tabung bahu, siku, dan
      // pergelangan pada mesh), bukan di origin frame i-1. Sendi 1 dipasang di batang di atas flensa base (z = 0,08 m).
      const zm = k === 0 ? 0.08 : d;
      o.rev.position.set(0, 0, zm);
      o.ring.position.set(0, 0, zm + 0.052);
      aim(o.ringTip, V(0.047 * Math.cos(5.1), 0.047 * Math.sin(5.1), zm + 0.052), V(-Math.sin(5.1), Math.cos(5.1), 0));
      o.rev.visible = v.rev;
      o.ring.visible = o.ringTip.visible = v.rot;
      // d: sepanjang z(i-1) dari origin ke H; a: sepanjang x(i) dari H ke origin frame i
      const H = V(0, 0, d),
        O1 = V(a * Math.cos(th), a * Math.sin(th), d);
      const okD = setSeg(o.dSeg, V(0, 0, 0), H),
        okA = setSeg(o.aSeg, H, O1);
      o.dSeg.visible = okD && (v.d || v.links);
      o.dSeg.material.color.setHex(v.d ? DR_COL.d : DR_COL.link);
      o.aSeg.visible = okA && (v.a || v.links);
      o.aSeg.material.color.setHex(v.a ? DR_COL.a : DR_COL.link);
      o.lD.visible = okD && v.d && L;
      o.lD.position.set(-0.05, -0.05, d / 2);
      o.lD.userData.set('d' + i + ' = ' + d.toFixed(4) + ' m');
      o.lA.visible = okA && v.a && L;
      o.lA.position.set(O1.x / 2, O1.y / 2, d + 0.045);
      o.lA.userData.set('a' + i + ' = ' + a.toFixed(4) + ' m');
      // theta: dari x(i-1) ke x(i), diputar terhadap z(i-1), digambar di H
      const rT = 0.06,
        okT = Math.abs(j.theta) > 0.5;
      o.th.set(H, t => V(rT * Math.cos(th * t), rT * Math.sin(th * t), d));
      aim(
        o.thTip,
        V(rT * Math.cos(th), rT * Math.sin(th), d),
        V(-Math.sin(th), Math.cos(th), 0).multiplyScalar(th < 0 ? -1 : 1)
      );
      o.thRef.userData.set(H, V(rT * 1.6, 0, d), H, V(rT * 1.6 * Math.cos(th), rT * 1.6 * Math.sin(th), d));
      o.th.line.visible = o.th.fan.visible = o.thTip.visible = okT && v.theta;
      o.thRef.visible = v.theta;
      o.lTh.visible = v.theta && L;
      o.lTh.position.set(rT * 2.1 * Math.cos(th / 2), rT * 2.1 * Math.sin(th / 2), d + 0.012);
      o.lTh.userData.set('θ' + i + ' = ' + j.theta.toFixed(1) + '°');
      // alpha: dari z(i-1) ke z(i), diputar terhadap x(i), digambar di origin frame i (z(i-1) di frame i = (0, sin α, cos α))
      const rA = 0.055,
        okAl = Math.abs(j.alpha) > 0.5,
        O = V(0, 0, 0);
      o.al.set(O, t => {
        const p = al * (1 - t);
        return V(0, rA * Math.sin(p), rA * Math.cos(p));
      });
      aim(o.alTip, V(0, 0, rA), V(0, al < 0 ? 1 : -1, 0));
      o.alRef.userData.set(O, V(0, rA * 1.6 * Math.sin(al), rA * 1.6 * Math.cos(al)), O, V(0, 0, rA * 1.6));
      o.al.line.visible = o.al.fan.visible = o.alTip.visible = o.alRef.visible = okAl && v.alpha;
      o.lAl.visible = okAl && v.alpha && L;
      o.lAl.position.set(0.03, rA * 2 * Math.sin(al / 2), rA * 2 * Math.cos(al / 2));
      o.lAl.userData.set('α' + i + ' = ' + j.alpha.toFixed(0) + '°');
    });
    const pe = new THREE.Vector3().setFromMatrixPosition(frames[6]),
      u = toUser(pe);
    ee.position.copy(pe);
    ee.visible = v.ee;
    lEE.visible = v.ee && L;
    lEE.position.copy(pe).add(V(0, 0.06, 0));
    lEE.userData.set('EE  x ' + u.x.toFixed(3) + '  y ' + u.y.toFixed(3) + '  z ' + u.z.toFixed(3));
  }
  return { root, baseAxes, update };
}
const AX = drBuildOverlay(fkScene);

// ---- Overlay parameter IK buku: p, n t b, W (= p*), l1, l2, theta1, segitiga lengan, theta5 ----
// Buku memakai robot 5-R-1-P dengan pergelangan bola. ZU5 tidak punya pergelangan bola, jadi W digambar di origin
// frame 5 (titik yang perannya sama: p* = p - l2 b dengan l2 = -d6), dan d3 prismatik buku diganti segitiga a2, a3.
function drBuildIkOverlay(sc) {
  const root = new THREE.Group();
  root.visible = false;
  root.matrixAutoUpdate = false;
  sc.world.add(root);
  const { V, hex, mat, seg, setSeg, cone, aim, arc, dash } = drKit();
  const C = DR_COLK;
  const lab = c => drLabel(hex(c));
  const arrow = (c, r) => ({ s: seg(c, r || 0.003), tip: cone(c) });
  const setArrow = (o, p, q) => {
    const ok = setSeg(o.s, p, q);
    aim(o.tip, q, new THREE.Vector3().subVectors(q, p));
    return ok;
  };
  const E = {
    p: arrow(C.p, 0.0035),
    n: arrow(C.n),
    t: arrow(C.t),
    b: arrow(C.b),
    l2: seg(C.w, 0.0045),
    rho: seg(C.t1, 0.0025),
    l1: seg(C.t1, 0.0045),
    a2: seg(C.arm, 0.004),
    a3: seg(C.arm, 0.004),
    th1: arc(C.t1),
    th5: arc(C.t5),
    wDrop: dash(C.t1),
    rDash: dash(C.arm),
    z1: dash(C.t5)
  };
  const W = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), mat(C.w));
  W.renderOrder = 25;
  const O4 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), mat(C.arm));
  O4.renderOrder = 25;
  const L = {
    p: lab(C.p),
    n: lab(C.n),
    t: lab(C.t),
    b: lab(C.b),
    W: lab(C.w),
    l2: lab(C.w),
    rho: lab(C.t1),
    l1: lab(C.t1),
    th1: lab(C.t1),
    a2: lab(C.arm),
    a3: lab(C.arm),
    r: lab(C.arm),
    th5: lab(C.t5)
  };
  [E.p, E.n, E.t, E.b].forEach(o => root.add(o.s, o.tip));
  root.add(E.l2, E.rho, E.l1, E.a2, E.a3, E.th1.line, E.th1.fan, E.th5.line, E.th5.fan, E.wDrop, E.rDash, E.z1);
  root.add(W, O4, ...Object.values(L));
  const vis = (on, ...objs) =>
    objs.forEach(o => {
      if (o.s) o.s.visible = o.tip.visible = on;
      else if (o.line) o.line.visible = o.fan.visible = on;
      else o.visible = on;
    });
  const f3 = v => v.toFixed(3);
  function update(frames) {
    const k = DRAW.k,
      showL = DRAW.v.labels;
    root.matrix.copy(frames[0]);
    root.matrixWorldNeedsUpdate = true;
    // semua titik dinyatakan di frame base DH (Z ke atas), sama dengan frame pengguna
    const B = new THREE.Matrix4().copy(frames[0]).invert();
    const F = frames.map(m => new THREE.Matrix4().multiplyMatrices(B, m));
    const P = i => new THREE.Vector3().setFromMatrixPosition(F[i]);
    const ax = (i, c) => new THREE.Vector3().setFromMatrixColumn(F[i], c).normalize();
    const p = P(6),
      n = ax(6, 0),
      t = ax(6, 1),
      b = ax(6, 2),
      z1 = ax(1, 2),
      x1 = ax(1, 0);
    const d6 = joints6[5].d,
      d2 = joints6[1].d,
      D = joints6[1].d + joints6[2].d + joints6[3].d,
      l2 = -d6,
      l1 = -D;
    const w = p.clone().addScaledVector(b, -l2); // p* = p - l2 b (buku persamaan 2-45)
    const O = V(0, 0, 0);

    // 1. vektor posisi p dari origin base ke flange
    setArrow(E.p, O, p);
    vis(k.p, E.p, L.p);
    L.p.position
      .copy(p)
      .multiplyScalar(0.5)
      .add(V(0, 0, 0.03));
    L.p.userData.set('p (posisi flange)');
    L.p.visible = k.p && showL;

    // 2. orientasi T = [n t b p]: n = x6, t = y6, b = z6 (sumbu pendekatan alat)
    const LA = 0.11;
    [
      ['n', n],
      ['t', t],
      ['b', b]
    ].forEach(([key, v]) => {
      const q = p.clone().addScaledVector(v, LA);
      setArrow(E[key], p, q);
      vis(k.ntb, E[key]);
      L[key].position.copy(p).addScaledVector(v, LA + 0.03);
      L[key].userData.set(key);
      L[key].visible = k.ntb && showL;
    });

    // 3. titik W dan ruas l2 b
    W.position.copy(w);
    setSeg(E.l2, p, w);
    vis(k.w, W, E.l2);
    L.W.position.copy(w).add(V(0.0, 0.0, 0.06));
    L.W.userData.set('W = p* (' + f3(w.x) + ', ' + f3(w.y) + ', ' + f3(w.z) + ')');
    L.W.visible = k.w && showL;
    L.l2.position.copy(p).add(w).multiplyScalar(0.5).addScaledVector(n, 0.06);
    L.l2.userData.set('l₂ = -d₆ = ' + f3(l2) + ' m');
    L.l2.visible = k.w && showL;

    // 4. sendi 1: proyeksi W ke lantai, jarak rho, offset l1 tegak lurus bidang lengan, sudut theta1
    const wf = V(w.x, w.y, 0),
      foot = V(z1.x * D, z1.y * D, 0),
      rho = Math.hypot(w.x, w.y),
      th1 = Math.atan2(x1.y, x1.x);
    setSeg(E.rho, O, wf);
    setSeg(E.l1, O, foot);
    E.wDrop.userData.set(w, wf, foot, wf);
    const rT = 0.22;
    E.th1.set(O, s => V(rT * Math.cos(th1 * s), rT * Math.sin(th1 * s), 0));
    vis(k.t1, E.rho, E.l1, E.wDrop, E.th1);
    if (Math.abs(th1) < 0.01) vis(false, E.th1);
    L.rho.position
      .copy(wf)
      .multiplyScalar(0.55)
      .add(V(0, 0, 0.025));
    L.rho.userData.set('ρ = ' + f3(rho) + ' m');
    L.l1.position
      .copy(foot)
      .multiplyScalar(0.5)
      .add(V(0, 0, -0.03));
    L.l1.userData.set('l₁ = -D = ' + f3(l1) + ' m');
    L.th1.position.set(rT * 1.2 * Math.cos(th1 / 2), rT * 1.2 * Math.sin(th1 / 2), -0.04);
    L.th1.userData.set('θ₁ = ' + ((th1 * 180) / Math.PI).toFixed(1) + '°');
    [L.rho, L.l1, L.th1].forEach(l => (l.visible = k.t1 && showL));

    // 5. lengan planar sendi 2-3-4 di bidang z1 = D: bahu S, siku E, ujung O4 (pengganti d3 prismatik di buku)
    const S = P(1).addScaledVector(z1, D),
      El = P(2).addScaledVector(z1, D - d2),
      o4 = P(4),
      r = S.distanceTo(o4);
    setSeg(E.a2, S, El);
    setSeg(E.a3, El, o4);
    E.rDash.userData.set(S, o4, o4, w);
    O4.position.copy(o4);
    vis(k.arm, E.a2, E.a3, E.rDash, O4);
    L.a2.position.copy(S).add(El).multiplyScalar(0.5).addScaledVector(z1, 0.05);
    L.a2.userData.set('a₂ = ' + f3(joints6[1].a) + ' m');
    L.a3.position.copy(El).add(o4).multiplyScalar(0.5).addScaledVector(z1, 0.05);
    L.a3.userData.set('a₃ = ' + f3(joints6[2].a) + ' m');
    L.r.position.copy(S).add(o4).multiplyScalar(0.5).addScaledVector(z1, -0.05);
    L.r.userData.set('r = ' + f3(r) + ' m');
    [L.a2, L.a3, L.r].forEach(l => (l.visible = k.arm && showL));

    // 6. theta5 = sudut antara z1 (sumbu sendi 2, 3, 4) dan b (sumbu alat), digambar di W
    const c5 = Math.max(-1, Math.min(1, z1.dot(b))),
      th5 = Math.acos(c5),
      u = b.clone().addScaledVector(z1, -c5),
      okT5 = u.length() > 1e-4;
    if (okT5) u.normalize();
    const rA = 0.07;
    E.th5.set(w, s =>
      w
        .clone()
        .addScaledVector(z1, rA * Math.cos(th5 * s))
        .addScaledVector(u, rA * Math.sin(th5 * s))
    );
    E.z1.userData.set(w, w.clone().addScaledVector(z1, 0.12), w, w.clone().addScaledVector(z1, -0.05));
    vis(k.t5 && okT5, E.th5);
    vis(k.t5, E.z1);
    L.th5.position
      .copy(w)
      .addScaledVector(z1, rA * 1.7 * Math.cos(th5 / 2))
      .addScaledVector(u, rA * 1.7 * Math.sin(th5 / 2));
    L.th5.userData.set('θ₅ = ' + ((th5 * 180) / Math.PI).toFixed(1) + '°');
    L.th5.visible = k.t5 && showL;
  }
  return { root, update };
}
const IKV = drBuildIkOverlay(fkScene);
const drShowDh = () => DRAW.dh && DRAW.pm !== 'ik';
const drShowIk = () => DRAW.dh && DRAW.pm !== 'dh';
fkScene.onPose = frames => {
  if (!DRAW.active) return;
  if (drShowDh()) AX.update(frames);
  if (drShowIk()) IKV.update(frames);
  if (DRAW.focus !== 'all' || DRAW.cine) drFocus(frames);
};

function drApplyScene() {
  if (!DRAW.active) return;
  const sc = fkScene,
    S = drS(),
    g = gridObjs.sfk,
    show = !DRAW.axis,
    xr = show && DRAW.dh && S.xray;
  g.setMode(S.grid ? (S.gridnum ? 'numbers' : 'grid') : 'off');
  if (!S.grid && S.gridnum) g.numGroup.visible = true;
  sc.rulers.visible = S.ruler;
  sc.ground.visible = S.ground;
  // balok yang disembunyikan dipindah ke layer 1 supaya tidak ikut terkena klik (raycaster hanya layer 0)
  sc.weights.forEach(w => {
    w.group.visible = S.weights;
    w.mark.visible = S.weights;
    w.mesh.layers.set(S.weights ? 0 : 1);
  });
  sc.axesHelpers.forEach(a => {
    a.visible = S.frames;
  });
  AX.baseAxes.visible = S.frames;
  sc.partGroups.forEach(p => {
    p.visible = show;
  });
  sc.mats.forEach(m => {
    m.transparent = xr;
    m.opacity = xr ? 0.26 : 1;
    m.depthWrite = !xr;
    m.needsUpdate = true;
  });
  if (DRAW.cine) sc.ghostLine.visible = false;
  document.body.classList.toggle('dr-hud', S.hud);
  const fr = computeChain6();
  AX.root.visible = drShowDh();
  AX.update(fr);
  IKV.root.visible = drShowIk();
  IKV.update(fr);
  drFocus(fr);
}
function drSyncUi() {
  const S = drS();
  document.querySelectorAll('select[data-dr-focus]').forEach(e => {
    e.value = DRAW.focus;
  });
  document.querySelectorAll('[data-dsw="axis"]').forEach(b => b.setAttribute('aria-checked', String(DRAW.axis)));
  document.querySelectorAll('[data-dsw="dh"]').forEach(b => b.setAttribute('aria-checked', String(DRAW.dh)));
  document.querySelectorAll('input[data-dv]').forEach(c => {
    c.checked = DRAW.v[c.dataset.dv];
  });
  document.querySelectorAll('input[data-ds]').forEach(c => {
    c.checked = S[c.dataset.ds];
  });
  document.querySelectorAll('input[data-dk]').forEach(c => {
    c.checked = DRAW.k[c.dataset.dk];
  });
  document.querySelectorAll('[data-dpm]').forEach(b => {
    const on = b.dataset.dpm === DRAW.pm;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.getElementById('dr-axis-quick').textContent = DRAW.axis ? 'Axis Draw: nyala' : 'Axis Draw: mati';
  const lk = document.getElementById('dr-lock');
  lk.setAttribute('aria-pressed', String(DRAW.lock));
  lk.innerHTML = DRAW.lock
    ? '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Terkunci'
    : '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>Terbuka';
  lk.title = DRAW.lock ? 'Buka kunci untuk mengubah d, a, dan α' : 'Kunci lagi supaya parameter DH tidak berubah';
  document.querySelectorAll('#dr-dh-body input').forEach(i => {
    i.disabled = DRAW.lock;
  });
}
function drAxis(on) {
  DRAW.axis = on;
  if (on) DRAW.dh = true;
  drSyncUi();
  drApplyScene();
}
function drDh(on) {
  DRAW.dh = on;
  if (!on) DRAW.axis = false;
  drSyncUi();
  drApplyScene();
}
function drResizeLoop() {
  const t0 = performance.now();
  (function f() {
    window.dispatchEvent(new Event('resize'));
    if (performance.now() - t0 < 560) requestAnimationFrame(f);
  })();
}
function drCine(on, quiet) {
  if (on === DRAW.cine || (on && !DRAW.active)) return;
  const sc = fkScene;
  if (on) {
    DRAW.ghost = sc.ghostLine.visible;
    window.scrollTo(0, 0);
  }
  DRAW.cine = on;
  document.body.classList.toggle('dr-cine', on);
  if (!on) sc.ghostLine.visible = DRAW.ghost;
  drSyncUi();
  drApplyScene();
  drResizeLoop();
  if (on && !quiet) toast('Cinematic aktif. Tekan Esc untuk keluar.');
}
(function drSpin() {
  requestAnimationFrame(drSpin);
  if (!DRAW.active || !drS().spin) return;
  const v = fkScene.getView();
  fkScene.setView(v[0] + 0.0035, v[1]);
})();

// ---- Tabel DH (terkunci) dan slider sudut absolut ----
function drBuildUi() {
  const body = document.getElementById('dr-dh-body'),
    tw = document.getElementById('theta-draw');
  body.innerHTML = '';
  tw.innerHTML = '';
  joints6.forEach((j, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="jname">' +
      (i + 1) +
      '</td><td class="dr-th" id="dr-thc' +
      i +
      '"></td>' +
      ['d', 'a', 'alpha']
        .map(
          k =>
            '<td><input type="number" step="' +
            (k === 'alpha' ? 1 : 0.001) +
            '" value="' +
            j[k] +
            '" data-i="' +
            i +
            '" data-k="' +
            k +
            '"></td>'
        )
        .join('');
    body.appendChild(tr);
    const row = document.createElement('div');
    row.className = 'theta-slider';
    row.innerHTML =
      '<span class="jl">θ' +
      (i + 1) +
      '</span><input type="range" min="' +
      j.thMin +
      '" max="' +
      j.thMax +
      '" step="1" value="' +
      j.theta +
      '" data-i="' +
      i +
      '" aria-label="Sudut sendi ' +
      (i + 1) +
      '"><span class="jv" id="dr-thv' +
      i +
      '"></span>';
    tw.appendChild(row);
  });
  body.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', () => {
      if (DRAW.lock) return;
      joints6[+inp.dataset.i][inp.dataset.k] = parseFloat(inp.value) || 0;
      updateFK6();
      updateIKScene6();
      refreshGhosts6();
      drRefresh();
    })
  );
  tw.querySelectorAll('input').forEach(sl =>
    sl.addEventListener('input', () => {
      joints6[+sl.dataset.i].theta = parseFloat(sl.value);
      updateFK6();
      drRefresh();
    })
  );
  drSyncUi();
}
function drRefresh() {
  if (!DRAW.active) return;
  joints6.forEach((j, i) => {
    const c = document.getElementById('dr-thc' + i),
      l = document.getElementById('dr-thv' + i),
      sl = document.querySelector('#theta-draw input[data-i="' + i + '"]');
    if (c) c.textContent = j.theta.toFixed(1) + '°';
    if (l) l.textContent = j.theta.toFixed(0) + '°';
    if (sl && document.activeElement !== sl) sl.value = j.theta;
  });
  if (DRAW.dh) {
    const fr = computeChain6();
    if (drShowDh()) AX.update(fr);
    if (drShowIk()) IKV.update(fr);
  }
  clearTimeout(DRAW.mathT);
  DRAW.mathT = setTimeout(drMath, 90);
}
function drMath() {
  if (!DRAW.active || !window.katex) return;
  if (accOpen('acc-dr-mats')) renderDHMatrices6('math-display-draw');
  if (accOpen('acc-dr-ik')) drIkRender();
  if (accOpen('acc-dr-buku')) drBookRender();
}

// ---- Isi akordeon 4: notasi buku Asada & Slotine dipasangkan dengan parameter DH ZU5 (nilai pose sekarang) ----
function drBookRender() {
  const box = document.getElementById('dr-buku-out');
  if (!box || !window.katex) return;
  const R = String.raw,
    f = (v, d) => RPF(v, d === undefined ? 4 : d),
    dg = v => RPF(v, 2) + R`^{\circ}`,
    vec = a => R`\begin{bmatrix}` + a.map(v => f(v)).join(R`\\`) + R`\end{bmatrix}`,
    j = joints6,
    T = rpRows(T60dh()),
    col = c => [T[0][c], T[1][c], T[2][c]],
    n = col(0),
    t = col(1),
    b = col(2),
    p = col(3),
    l0 = j[0].d,
    l2 = -j[5].d,
    D = j[1].d + j[2].d + j[3].d,
    l1 = -D,
    w = p.map((v, i) => v - l2 * b[i]),
    th1 = j[0].theta,
    s1 = Math.sin((th1 * Math.PI) / 180),
    c1 = Math.cos((th1 * Math.PI) / 180),
    disc = w[0] * w[0] + w[1] * w[1] - l1 * l1;
  box.innerHTML = '';
  const par = html => {
    const e = document.createElement('p');
    e.innerHTML = html;
    box.appendChild(e);
  };
  const eq = tex => {
    const d = document.createElement('div');
    d.className = 'dr-eq';
    kx(d, tex);
    box.appendChild(d);
  };
  const tb = document.createElement('table');
  tb.className = 'dr-sol dr-map';
  const rows = [
    ['n, t, b', 'x₆, y₆, z₆ (kolom 1 sampai 3 dari R)', 'orientasi alat; b = arah pendekatan'],
    ['p', 'p₆ (kolom 4 dari T₆⁰)', '(' + p.map(v => f(v, 3)).join('; ') + ') m'],
    ['l₀', 'd₁', f(l0) + ' m'],
    ['l₁', '-(d₂ + d₃ + d₄) = -D', f(l1) + ' m'],
    ['l₂', '-d₆', f(l2) + ' m'],
    ['W, p*', 'origin frame 5 (p₅)', '(' + w.map(v => f(v, 3)).join('; ') + ') m'],
    ['d₃ (prismatik)', 'segitiga planar a₂, a₃ dan θ₃', 'a₂ = ' + f(j[1].a) + ', a₃ = ' + f(j[2].a) + ' m'],
    ['θ₄, θ₅, θ₆ (Euler)', 'θ₅ dan θ₆ dulu, θ₄ = θ₂₃₄ - θ₂ - θ₃', 'pergelangan ZU5 bukan bola']
  ];
  tb.innerHTML =
    '<thead><tr><th>Buku</th><th>Padanan DH ZU5</th><th>Nilai sekarang</th></tr></thead><tbody>' +
    rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') +
    '</tbody>';
  par(
    'Buku menulis pose end-effector sebagai <b>T = [n t b p]</b> lalu memecah IK menjadi dua: posisi titik pergelangan <b>W</b> (tiga sendi pertama) dan orientasi (tiga sendi terakhir). Kolom kiri adalah simbol buku, kolom tengah padanannya di tabel DH ZU5.'
  );
  box.appendChild(tb);
  par('<b>Langkah 1, persamaan (2-45).</b> Mundur dari flange sejauh l₂ sepanjang b untuk mendapat W:');
  eq(R`\mathbf{p}^{*}=\mathbf{p}-l_2\,\mathbf{b}=` + vec(p) + '-' + f(l2) + vec(b) + '=' + vec(w));
  par(
    '<b>Langkah 2, persamaan (2-48).</b> Komponen W yang tegak lurus bidang lengan selalu sama dengan l₁, berapa pun θ₂, θ₃, θ₄:'
  );
  eq(R`-p^{*}_x\sin\theta_1+p^{*}_y\cos\theta_1=l_1`);
  eq(
    R`-(` +
      f(w[0]) +
      R`)(` +
      f(s1) +
      R`)+(` +
      f(w[1]) +
      R`)(` +
      f(c1) +
      R`)=` +
      f(-w[0] * s1 + w[1] * c1) +
      R`\approx l_1=` +
      f(l1)
  );
  par(
    '<b>Langkah 3, persamaan (2-49) sampai (2-52).</b> Substitusi t = tan(θ₁/2) mengubahnya menjadi persamaan kuadrat:'
  );
  eq(R`(l_1+p^{*}_y)\,t^{2}+2p^{*}_x\,t+l_1-p^{*}_y=0`);
  if (disc < 0) {
    par('Akar negatif: W terlalu dekat dengan sumbu sendi 1, tidak ada solusi.');
  } else {
    const sq = Math.sqrt(disc),
      sol = [1, -1].map(sg => (2 * Math.atan2(-w[0] + sg * sq, l1 + w[1]) * 180) / Math.PI).map(igWrap);
    eq(
      R`\theta_1=2\tan^{-1}\frac{-p^{*}_x\pm\sqrt{p^{*2}_x+p^{*2}_y-l_1^{2}}}{l_1+p^{*}_y}=` +
        dg(sol[0]) +
        R`\ \text{atau}\ ` +
        dg(sol[1])
    );
    par(
      'Salah satu hasil sama dengan θ₁ sekarang (' +
        RPF(th1, 2) +
        '°). Dua hasil itu adalah dua konfigurasi bahu pada Gambar 2-16 buku.'
    );
  }
  par(
    '<b>Langkah 4, yang berbeda dari buku.</b> Robot buku (5-R-1-P) punya sendi prismatik d₃ dan pergelangan bola, jadi θ₂ dan d₃ langsung dari W. ZU5 punya tiga sumbu sejajar (2, 3, 4) dan pergelangan tidak bola, jadi θ₅ dan θ₆ dihitung lebih dulu dari b, lalu θ₂, θ₃, θ₄ dari segitiga a₂, a₃ (lihat akordeon 3, langkah 3 sampai 7):'
  );
  eq(
    R`\cos\theta_5=\mathbf{z}_1\cdot\mathbf{b},\qquad \cos\theta_3=\frac{r^{2}-a_2^{2}-a_3^{2}}{2a_2a_3},\qquad r^{2}=x^{2}+y^{2}`
  );
  par(
    'Gagasan buku tetap dipakai: tulis ulang persamaan kinematik dengan memindah matriks yang sudah diketahui ke ruas kiri, seperti persamaan (2-55) sampai (2-57):'
  );
  eq(R`T_4^{1}=\left(A_1^{0}\right)^{-1}\,T\,\left(A_6^{5}\right)^{-1}\left(A_5^{4}\right)^{-1}`);
}

// ---- Isi akordeon 1: aturan DH dan matriks homogen (statis) ----
function drRuleBuild() {
  const el = document.getElementById('dr-rule-body');
  if (!el || el.dataset.done || !window.katex) return;
  el.dataset.done = '1';
  const R = String.raw,
    add = (html, tex) => {
      if (html) {
        const p = document.createElement('p');
        p.innerHTML = html;
        el.appendChild(p);
      }
      if (tex) {
        const d = document.createElement('div');
        d.className = 'dr-eq';
        kx(d, tex);
        el.appendChild(d);
      }
    };
  add(
    'Tiap sendi punya empat parameter DH. Dari frame i-1 ke frame i dilakukan empat gerakan berurutan, dan tiap gerakan digambar di Axis Draw dengan warna yang sama dengan tabel di atas:'
  );
  add(
    '<b style="color:#f0b23e">θ</b> putar terhadap sumbu z frame sebelumnya (sumbu sendi), <b style="color:#4d9bea">d</b> geser sepanjang sumbu z itu, <b style="color:#e0685f">a</b> geser sepanjang sumbu x frame baru, <b style="color:#b98ae6">α</b> putar terhadap sumbu x frame baru (twist).',
    R`T_i^{\,i-1}=\mathrm{Rot}(z,\theta_i)\;\mathrm{Trans}(z,d_i)\;\mathrm{Trans}(x,a_i)\;\mathrm{Rot}(x,\alpha_i)`
  );
  add(
    'Keempat gerakan itu masing-masing punya matriks homogen 4×4 sendiri:',
    R`\begin{bmatrix}c\theta_i&-s\theta_i&0&0\\s\theta_i&c\theta_i&0&0\\0&0&1&0\\0&0&0&1\end{bmatrix}\begin{bmatrix}1&0&0&0\\0&1&0&0\\0&0&1&d_i\\0&0&0&1\end{bmatrix}\begin{bmatrix}1&0&0&a_i\\0&1&0&0\\0&0&1&0\\0&0&0&1\end{bmatrix}\begin{bmatrix}1&0&0&0\\0&c\alpha_i&-s\alpha_i&0\\0&s\alpha_i&c\alpha_i&0\\0&0&0&1\end{bmatrix}`
  );
  add(
    'Hasil perkaliannya adalah matriks transformasi satu sendi (c = cos, s = sin):',
    R`T_i^{\,i-1}=\begin{bmatrix}c\theta_i&-s\theta_i\,c\alpha_i&s\theta_i\,s\alpha_i&a_i\,c\theta_i\\s\theta_i&c\theta_i\,c\alpha_i&-c\theta_i\,s\alpha_i&a_i\,s\theta_i\\0&s\alpha_i&c\alpha_i&d_i\\0&0&0&1\end{bmatrix}=\begin{bmatrix}R&\mathbf{p}\\\mathbf{0}^{T}&1\end{bmatrix}`
  );
  add(
    'Blok R (3×3) adalah orientasi frame i dilihat dari frame i-1, dan kolom p adalah posisi originnya. Karena R ortonormal, inversnya cukup memakai transpos:',
    R`\left(T_i^{\,i-1}\right)^{-1}=\begin{bmatrix}R^{T}&-R^{T}\mathbf{p}\\\mathbf{0}^{T}&1\end{bmatrix}`
  );
  add(
    'Rantai enam sendi memberi pose end-effector terhadap base (forward kinematics):',
    R`T_6^{0}=T_1^{0}\,T_2^{1}\,T_3^{2}\,T_4^{3}\,T_5^{4}\,T_6^{5}=\begin{bmatrix}\mathbf{x}_6&\mathbf{y}_6&\mathbf{z}_6&\mathbf{p}_6\\0&0&0&1\end{bmatrix}`
  );
  add(
    'Di dalam matriks itu hanya θ yang merupakan variabel gerak. Nilai d, a, dan α tidak berubah saat sendi diputar, karena ketiganya mengukur bentuk link, bukan posenya.'
  );
}

// ---- IK geometri (rumus tertutup, sumbu sendi 2-3-4 sejajar): hasil dalam frame base DH (Z ke atas) ----
const igA = (th, d, a, al) => {
  const r = Math.PI / 180,
    ct = Math.cos(th * r),
    st = Math.sin(th * r),
    ca = Math.cos(al * r),
    sa = Math.sin(al * r);
  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1]
  ];
};
const igMul = (X, Y) =>
  X.map((r, i) => r.map((_, j) => X[i][0] * Y[0][j] + X[i][1] * Y[1][j] + X[i][2] * Y[2][j] + X[i][3] * Y[3][j]));
const igInv = T => {
  const Rt = [
      [T[0][0], T[1][0], T[2][0]],
      [T[0][1], T[1][1], T[2][1]],
      [T[0][2], T[1][2], T[2][2]]
    ],
    p = [T[0][3], T[1][3], T[2][3]],
    t = Rt.map(r => -(r[0] * p[0] + r[1] * p[1] + r[2] * p[2]));
  return [
    [...Rt[0], t[0]],
    [...Rt[1], t[1]],
    [...Rt[2], t[2]],
    [0, 0, 0, 1]
  ];
};
const igWrap = v => {
  v = ((((v + 180) % 360) + 360) % 360) - 180;
  return v === -180 ? 180 : v;
};
function igFK(th, dh) {
  let T = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  for (let i = 0; i < 6; i++) T = igMul(T, igA(th[i], dh[i].d, dh[i].a, dh[i].alpha));
  return T;
}
function igStructOk(dh) {
  const e = (x, y) => Math.abs(x - y) < 1e-6;
  return (
    e(dh[0].alpha, 90) &&
    e(dh[1].alpha, 0) &&
    e(dh[2].alpha, 0) &&
    e(dh[3].alpha, 90) &&
    e(dh[4].alpha, 90) &&
    e(Math.abs(dh[5].alpha), 180) &&
    e(dh[0].a, 0) &&
    e(dh[3].a, 0) &&
    e(dh[4].a, 0) &&
    e(dh[5].a, 0) &&
    Math.abs(dh[5].d) > 1e-6 &&
    Math.abs(dh[1].a * dh[2].a) > 1e-9
  );
}
// T: matriks 4x4 (baris) pose target. Mengembalikan daftar solusi beserta nilai antara tiap langkah.
function igSolve(T, dh, th6free) {
  const r = Math.PI / 180,
    a2 = dh[1].a,
    a3 = dh[2].a,
    D = dh[1].d + dh[2].d + dh[3].d,
    d6 = dh[5].d,
    out = [];
  const p6 = [T[0][3], T[1][3], T[2][3]],
    z6 = [T[0][2], T[1][2], T[2][2]],
    p5 = [p6[0] + d6 * z6[0], p6[1] + d6 * z6[1], p6[2] + d6 * z6[2]];
  const rho = Math.hypot(p5[0], p5[1]),
    info = { D, p5, rho };
  if (rho < Math.abs(D) - 1e-9)
    return { sols: out, info, why: 'Titik pergelangan terlalu dekat dengan sumbu sendi 1 (ρ lebih kecil dari |D|).' };
  const phi = Math.atan2(p5[1], p5[0]),
    g = Math.asin(Math.max(-1, Math.min(1, D / rho)));
  let why = '';
  [phi + g, phi + Math.PI - g].forEach((t1, k1) => {
    const s1 = Math.sin(t1),
      c1 = Math.cos(t1);
    let c5 = (D - (p6[0] * s1 - p6[1] * c1)) / d6;
    if (Math.abs(c5) > 1 + 1e-7) {
      why = why || 'cos θ5 di luar rentang -1 sampai 1.';
      return;
    }
    c5 = Math.max(-1, Math.min(1, c5));
    [1, -1].forEach(sg5 => {
      const t5 = sg5 * Math.acos(c5),
        s5 = Math.sin(t5),
        v = [T[0][0] * s1 - T[1][0] * c1, T[0][1] * s1 - T[1][1] * c1, T[0][2] * s1 - T[1][2] * c1];
      const sing = Math.abs(s5) < 1e-7,
        t6 = sing ? (th6free || 0) * r : Math.atan2(v[1] / s5, v[0] / s5);
      const T14 = igMul(
        igMul(
          igMul(igInv(igA(t1 / r, dh[0].d, dh[0].a, dh[0].alpha)), T),
          igInv(igA(t6 / r, dh[5].d, dh[5].a, dh[5].alpha))
        ),
        igInv(igA(t5 / r, dh[4].d, dh[4].a, dh[4].alpha))
      );
      const x = T14[0][3],
        y = T14[1][3],
        t234 = Math.atan2(T14[1][0], T14[0][0]);
      let c3 = (x * x + y * y - a2 * a2 - a3 * a3) / (2 * a2 * a3);
      if (Math.abs(c3) > 1 + 1e-7) {
        why = why || 'Target di luar jangkauan lengan (cos θ3 di luar rentang -1 sampai 1).';
        return;
      }
      c3 = Math.max(-1, Math.min(1, c3));
      [1, -1].forEach(sg3 => {
        const t3 = sg3 * Math.acos(c3),
          t2 = Math.atan2(y, x) - Math.atan2(a3 * Math.sin(t3), a2 + a3 * Math.cos(t3)),
          t4 = t234 - t2 - t3;
        const th = [t1, t2, t3, t4, t5, t6].map(q => igWrap(q / r)),
          F = igFK(th, dh);
        out.push({
          th,
          k1,
          sg5,
          sg3,
          phi: phi / r,
          g: g / r,
          c5,
          v,
          sing,
          x,
          y,
          t234: igWrap(t234 / r),
          c3,
          err: Math.hypot(F[0][3] - p6[0], F[1][3] - p6[1], F[2][3] - p6[2]),
          ok: th.every((q, i) => q >= dh[i].thMin - 1e-6 && q <= dh[i].thMax + 1e-6)
        });
      });
    });
  });
  return { sols: out, info, why };
}
function drTarget() {
  const p = DRAW.tgt,
    M = rpRows(T60dh());
  let Rm;
  if (DRAW.ori === 'down') {
    // sumbu z alat ke -Z base; arah x alat diambil dari pose sekarang yang diproyeksikan ke bidang datar
    let x = [M[0][0], M[1][0]],
      n = Math.hypot(x[0], x[1]);
    if (n < 1e-6) {
      x = [1, 0];
      n = 1;
    }
    x = [x[0] / n, x[1] / n];
    Rm = [
      [x[0], x[1], 0],
      [x[1], -x[0], 0],
      [0, 0, -1]
    ];
  } else Rm = M.slice(0, 3).map(r => r.slice(0, 3));
  return [
    [...Rm[0], p[0]],
    [...Rm[1], p[1]],
    [...Rm[2], p[2]],
    [0, 0, 0, 1]
  ];
}
function drTgtFill(p) {
  DRAW.tgt = p.map(v => +(+v).toFixed(4));
  ['dr-tx', 'dr-ty', 'dr-tz'].forEach((id, k) => {
    document.getElementById(id).value = DRAW.tgt[k];
  });
}
function drIkSolve(keepPick) {
  if (!DRAW.tgt) {
    const e = toUser(eeFromThetas6());
    drTgtFill([e.x, e.y, e.z]);
  }
  const now = joints6.map(j => j.theta),
    T = drTarget();
  DRAW.T = T;
  DRAW.ok = igStructOk(joints6);
  const res = DRAW.ok ? igSolve(T, joints6, now[5]) : { sols: [], info: null, why: '' };
  DRAW.res = res;
  DRAW.sols = res.sols;
  if (!keepPick || DRAW.pick < 0 || DRAW.pick >= DRAW.sols.length) {
    // bawaan: solusi yang paling dekat dengan pose sekarang
    let best = 0,
      bd = 1e9;
    DRAW.sols.forEach((s, k) => {
      const dd = s.th.reduce((a, q, i) => a + Math.abs(igWrap(q - now[i])), 0) + (s.ok ? 0 : 1e4);
      if (dd < bd) {
        bd = dd;
        best = k;
      }
    });
    DRAW.pick = best;
  }
}
function drIkRender(keepPick) {
  const box = document.getElementById('dr-ik-out');
  if (!box || !window.katex) return;
  drIkSolve(keepPick !== false);
  const R = String.raw,
    f = (v, d) => RPF(v, d === undefined ? 4 : d),
    dg = v => RPF(v, 2) + R`^{\circ}`,
    vec = a => R`\begin{bmatrix}` + a.map(v => f(v)).join(R`\\`) + R`\end{bmatrix}`;
  box.innerHTML = '';
  const note = (cls, html) => {
    const d = document.createElement('div');
    d.className = 'status ' + cls;
    d.style.fontSize = '12.5px';
    d.innerHTML = html;
    box.appendChild(d);
  };
  if (!DRAW.ok) {
    note(
      'warn',
      'Rumus tertutup ini hanya berlaku untuk struktur DH bawaan (α = 90°, 0°, 0°, 90°, 90°, 180° dan a₁ = a₄ = a₅ = a₆ = 0). Tabel DH sekarang berbeda dari pola itu. Kembalikan nilainya, atau pakai IK numerik di menu IK.'
    );
    return;
  }
  const S = DRAW.sols[DRAW.pick],
    I = DRAW.res.info,
    T = DRAW.T,
    p6 = [T[0][3], T[1][3], T[2][3]],
    z6 = [T[0][2], T[1][2], T[2][2]],
    j = joints6;
  const step = (n, title, html, texs) => {
    const w = document.createElement('div');
    w.className = 'dr-step';
    w.innerHTML = '<div class="dr-step-h"><i>' + n + '</i>' + title + '</div>' + (html ? '<p>' + html + '</p>' : '');
    texs.forEach(t => {
      const d = document.createElement('div');
      d.className = 'dr-eq';
      kx(d, t);
      w.appendChild(d);
    });
    box.appendChild(w);
  };
  step(
    1,
    'Pose target dan titik pergelangan',
    'Target ditulis sebagai matriks homogen. Titik p₅ (origin frame 5) didapat dengan mundur sejauh d₆ sepanjang sumbu alat, karena α₆ = 180° membuat z₅ berlawanan arah dengan z₆.',
    [
      R`T_6^{0}=` + rpTexMat(T, 3),
      R`\mathbf{p}_5=\mathbf{p}_6+d_6\,\mathbf{z}_6=` + vec(p6) + '+(' + f(j[5].d) + ')' + vec(z6) + '=' + vec(I.p5)
    ]
  );
  if (!S) {
    note(
      'bad',
      '<b>Tidak ada solusi untuk target ini.</b> ' +
        (DRAW.res.why || '') +
        ' Coba target yang lebih dekat ke robot atau ganti arah alat.'
    );
    return;
  }
  const t = S.th,
    s5 = Math.sin((t[4] * Math.PI) / 180);
  step(
    2,
    'Sendi 1',
    'Sumbu sendi 2, 3, dan 4 sejajar, jadi p₅ selalu berjarak D = d₂ + d₃ + d₄ dari bidang tegak yang lewat sumbu sendi 1. Ada dua sudut yang memenuhi (bahu kiri atau kanan).',
    [
      R`p_{5x}\sin\theta_1-p_{5y}\cos\theta_1=D`,
      R`D=d_2+d_3+d_4=` + f(j[1].d) + '+(' + f(j[2].d) + ')+(' + f(j[3].d) + ')=' + f(I.D) + R`\ \text{m}`,
      R`\rho=\sqrt{p_{5x}^{2}+p_{5y}^{2}}=` + f(I.rho) + R`\ \text{m}`,
      R`\theta_1=\operatorname{atan2}(p_{5y},p_{5x})` + (S.k1 ? R`+180^{\circ}-` : '+') + R`\arcsin\dfrac{D}{\rho}`,
      R`\theta_1=` + dg(S.phi) + (S.k1 ? R`+180^{\circ}-(` : '+(') + dg(S.g) + ')=' + dg(t[0])
    ]
  );
  step(3, 'Sendi 5', 'Jarak end-effector dari bidang yang sama berbeda dari D sebesar d₆ cos θ₅.', [
    R`\cos\theta_5=\dfrac{D-\left(p_{6x}\sin\theta_1-p_{6y}\cos\theta_1\right)}{d_6}=` + f(S.c5),
    R`\theta_5=` + (S.sg5 > 0 ? '+' : '-') + R`\arccos(` + f(S.c5) + ')=' + dg(t[4])
  ]);
  step(
    4,
    'Sendi 6',
    S.sing
      ? 'sin θ₅ = 0: sumbu sendi 4 dan 6 segaris (singular pergelangan), jadi θ₆ tidak tertentu dan dipakai nilai pose sekarang.'
      : 'Arah sumbu sendi 2, 3, 4 dilihat dari frame alat hanya bergantung pada θ₅ dan θ₆.',
    [
      R`\mathbf{v}=\left(R_6^{0}\right)^{T}\begin{bmatrix}\sin\theta_1\\-\cos\theta_1\\0\end{bmatrix}=\begin{bmatrix}s_5c_6\\s_5s_6\\c_5\end{bmatrix}`,
      R`\mathbf{v}=` + vec(S.v) + R`,\qquad \sin\theta_5=` + f(s5),
      R`\theta_6=\operatorname{atan2}\!\left(\dfrac{v_y}{\sin\theta_5},\dfrac{v_x}{\sin\theta_5}\right)=` + dg(t[5])
    ]
  );
  step(
    5,
    'Lepas sendi 1, 5, dan 6 dari rantai',
    'Tiga matriks yang sudah diketahui dipindah ke ruas kanan. Sisanya adalah lengan planar tiga sendi (2, 3, 4) di frame 1.',
    [
      R`T_4^{1}=\left(T_1^{0}\right)^{-1}T_6^{0}\left(T_6^{5}\right)^{-1}\left(T_5^{4}\right)^{-1}`,
      R`x=` + f(S.x) + R`\ \text{m},\qquad y=` + f(S.y) + R`\ \text{m}`,
      R`\theta_{234}=\operatorname{atan2}(r_{21},r_{11})=` + dg(S.t234)
    ]
  );
  step(6, 'Sendi 3', 'Aturan kosinus pada segitiga yang sisinya a₂ dan a₃ (siku ke atas atau ke bawah).', [
    R`x=a_2c_2+a_3c_{23},\qquad y=a_2s_2+a_3s_{23}`,
    R`\cos\theta_3=\dfrac{x^{2}+y^{2}-a_2^{2}-a_3^{2}}{2\,a_2\,a_3}=` + f(S.c3),
    R`\theta_3=` + (S.sg3 > 0 ? '+' : '-') + R`\arccos(` + f(S.c3) + ')=' + dg(t[2])
  ]);
  step(7, 'Sendi 2 dan 4', '', [
    R`\theta_2=\operatorname{atan2}(y,x)-\operatorname{atan2}\!\left(a_3\sin\theta_3,\ a_2+a_3\cos\theta_3\right)=` +
      dg(t[1]),
    R`\theta_4=\theta_{234}-\theta_2-\theta_3=` + dg(t[3])
  ]);
  step(
    8,
    'Periksa dengan FK',
    'Sudut hasil dimasukkan lagi ke rantai transformasi. Posisinya harus kembali ke target.',
    [R`\left\lVert\mathbf{p}_6(\boldsymbol\theta)-\mathbf{p}^{*}\right\rVert=` + RPF(S.err * 1000, 4) + R`\ \text{mm}`]
  );
  const tb = document.createElement('table');
  tb.className = 'dr-sol';
  tb.innerHTML =
    '<thead><tr><th>solusi</th>' +
    [1, 2, 3, 4, 5, 6].map(i => '<th>θ' + i + '</th>').join('') +
    '</tr></thead><tbody>' +
    DRAW.sols
      .map(
        (s, k) =>
          '<tr data-sol="' +
          k +
          '" class="' +
          (k === DRAW.pick ? 'on' : '') +
          (s.ok ? '' : ' off') +
          '" title="' +
          (s.ok ? 'Klik untuk memilih solusi ini' : 'Di luar batas sudut sendi') +
          '"><td>' +
          (k + 1) +
          (s.ok ? '' : ' (di luar batas)') +
          '</td>' +
          s.th.map(q => '<td>' + RPF(q, 1) + '°</td>').join('') +
          '</tr>'
      )
      .join('') +
    '</tbody>';
  const cap = document.createElement('p');
  cap.innerHTML =
    '<b>' +
    DRAW.sols.length +
    ' solusi</b> untuk target ini. Baris yang disorot adalah yang langkahnya ditampilkan di atas (bawaan: paling dekat dengan pose sekarang). Klik baris lain untuk melihat langkahnya.';
  box.appendChild(cap);
  box.appendChild(tb);
}
function drApply(toIk) {
  if (TRAJ.playing) {
    toast('Hentikan gerak robot dulu');
    return;
  }
  drIkSolve(true);
  const S = DRAW.sols[DRAW.pick];
  if (!S) {
    toast('Belum ada solusi untuk diterapkan');
    return;
  }
  if (!S.ok) {
    toast('Solusi ini di luar batas sudut sendi');
    return;
  }
  applyPose(S.th.slice(), true);
  if (!ZZ.locked) renderZeroZone();
  if (toIk) {
    ['tx', 'ty', 'tz'].forEach((id, k) => {
      const el = document.getElementById(id);
      el.value = DRAW.tgt[k];
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    nav('#jaka-ik');
    const st = document.getElementById('ikStatus');
    st.className = 'status ok';
    st.textContent =
      'Sudut dari IK geometri (menu Draw) diterapkan: solusi ' +
      (DRAW.pick + 1) +
      ' dari ' +
      DRAW.sols.length +
      ', galat ' +
      (S.err * 1000).toFixed(3) +
      ' mm.';
  } else {
    drRefresh();
    toast('Solusi ' + (DRAW.pick + 1) + ' diterapkan ke robot');
  }
}

// ---- Masuk dan keluar halaman Draw ----
function drEnter() {
  if (TRAJ.playing) trajPause();
  DRAW.active = true;
  drBuildUi();
  drRuleBuild();
  updateFK6();
  drApplyScene();
  drRefresh();
}
function drLeave() {
  if (!DRAW.active) return;
  drCine(false, true);
  DRAW.active = false;
  const sc = fkScene,
    gb = document.querySelector('#view-v7 .grid-btn.active'),
    rt = document.querySelector('.ruler-toggle'),
    ax = document.querySelector('.showAxes[data-t="fk"]');
  gridObjs.sfk.setMode(gb ? gb.dataset.mode : 'grid');
  sc.rulers.visible = rt ? rt.checked : true;
  sc.ground.visible = true;
  sc.weights.forEach(w => {
    w.group.visible = true;
    w.mark.visible = true;
    w.mesh.layers.set(0);
  });
  sc.axesHelpers.forEach(a => {
    a.visible = ax ? ax.checked : true;
  });
  AX.baseAxes.visible = false;
  AX.root.visible = false;
  IKV.root.visible = false;
  sc.partGroups.forEach(p => {
    p.visible = true;
  });
  sc.mats.forEach(m => {
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
    m.needsUpdate = true;
  });
  document.body.classList.remove('dr-hud');
  sc.setTarget(new THREE.Vector3(1.5, 0.7, 0), 2);
  if (!ZZ.locked) renderZeroZone();
}
(function () {
  const mk = (list, attr) =>
    list
      .map(
        ([k, label, col]) =>
          '<label><input type="checkbox" data-' +
          attr +
          '="' +
          k +
          '">' +
          (col ? '<i style="background:' + col + '"></i>' : '') +
          label +
          '</label>'
      )
      .join('');
  document.querySelector('#dr-mode [data-dr-list="v"]').innerHTML = mk(DR_V, 'dv');
  document.querySelector('#dr-mode [data-dr-list="s"]').innerHTML = mk(DR_S, 'ds');
  document.querySelector('#dr-mode [data-dr-list="k"]').innerHTML = mk(DR_K, 'dk');
  const pmSeg =
    '<div class="seg dr-pm" role="group" aria-label="Parameter yang digambar">' +
    '<button type="button" data-dpm="dh">DH</button><button type="button" data-dpm="ik">IK buku</button><button type="button" data-dpm="both">Gabungan</button></div>';
  document.getElementById('dr-cine-panel').innerHTML =
    '<div class="dr-row" style="padding-top:0"><div><b>Axis Draw</b></div><button type="button" class="dr-sw" role="switch" aria-checked="false" data-dsw="axis" aria-label="Axis Draw"></button></div>' +
    '<div class="dr-row"><div><b>Visual DH</b></div><button type="button" class="dr-sw" role="switch" aria-checked="false" data-dsw="dh" aria-label="Visual DH"></button></div>' +
    '<h4>Parameter digambar</h4>' +
    pmSeg +
    '<h4>Fokus kamera</h4><select class="dr-sel" data-dr-focus aria-label="Fokus kamera"></select>' +
    '<h4>Adegan 3D</h4><div class="dr-checks">' +
    mk(DR_S, 'ds') +
    '</div><h4>Visual DH</h4><div class="dr-checks">' +
    mk(DR_V, 'dv') +
    '</div><h4>Visual IK buku</h4><div class="dr-checks">' +
    mk(DR_K, 'dk') +
    '</div>';
  document.getElementById('dr-pm-slot').innerHTML = pmSeg;
  document.querySelectorAll('select[data-dr-focus]').forEach(e => {
    e.innerHTML = DR_FOCUS.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('');
  });
  const view = document.getElementById('view-draw');
  view.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.dv) {
      DRAW.v[t.dataset.dv] = t.checked;
      if (t.checked && !DRAW.dh) DRAW.dh = true;
      drSyncUi();
      drApplyScene();
    } else if (t.dataset.dk) {
      DRAW.k[t.dataset.dk] = t.checked;
      if (t.checked) {
        DRAW.dh = true;
        if (DRAW.pm === 'dh') DRAW.pm = 'both';
      }
      drSyncUi();
      drApplyScene();
    } else if (t.dataset.ds) {
      drS()[t.dataset.ds] = t.checked;
      drSyncUi();
      drApplyScene();
    } else if (t.id === 'dr-ori') {
      DRAW.ori = t.value;
      drIkRender(false);
    } else if (t.hasAttribute('data-dr-focus')) {
      DRAW.focus = t.value;
      drSyncUi();
      drFocus(computeChain6(), true);
    }
  });
  view.addEventListener('input', e => {
    if (!['dr-tx', 'dr-ty', 'dr-tz'].includes(e.target.id)) return;
    DRAW.tgt = ['dr-tx', 'dr-ty', 'dr-tz'].map(id => parseFloat(document.getElementById(id).value) || 0);
    drIkRender(false);
  });
  view.addEventListener('click', e => {
    const sw = e.target.closest('[data-dsw]');
    if (sw) {
      (sw.dataset.dsw === 'axis' ? drAxis : drDh)(sw.getAttribute('aria-checked') !== 'true');
      return;
    }
    const pm = e.target.closest('[data-dpm]');
    if (pm) {
      DRAW.pm = pm.dataset.dpm;
      DRAW.dh = true;
      drSyncUi();
      drApplyScene();
      if (accOpen('acc-dr-buku')) drBookRender();
      return;
    }
    const row = e.target.closest('tr[data-sol]');
    if (row) {
      DRAW.pick = +row.dataset.sol;
      drIkRender(true);
      return;
    }
    const b = e.target.closest('[data-dr-act]');
    if (!b) return;
    const all = on => {
      Object.keys(DRAW.v).forEach(k => {
        DRAW.v[k] = on;
      });
      if (on) DRAW.dh = true;
      drSyncUi();
      drApplyScene();
    };
    ({
      axis: () => drAxis(!DRAW.axis),
      'cine-on': () => drCine(true),
      'cine-off': () => drCine(false),
      'cine-panel': () => {
        const p = document.getElementById('dr-cine-panel');
        p.hidden = !p.hidden;
        b.setAttribute('aria-expanded', String(!p.hidden));
      },
      ready: () => {
        zzSetPose(READY_POSE);
        drRefresh();
      },
      zero: () => {
        zzSetPose([0, 0, 0, 0, 0, 0]);
        drRefresh();
      },
      'v-all': () => all(true),
      'v-none': () => all(false),
      'tgt-now': () => {
        const p = toUser(eeFromThetas6());
        drTgtFill([p.x, p.y, p.z]);
        drIkRender(false);
      },
      'tgt-ik': () => {
        const p = userTargetInputs();
        drTgtFill([p.x, p.y, p.z]);
        drIkRender(false);
      },
      apply: () => drApply(false),
      'apply-ik': () => drApply(true),
      ruj: () => gotoReference('pd-geo')
    })[b.dataset.drAct]();
  });
  document.getElementById('dr-lock').addEventListener('click', () => {
    DRAW.lock = !DRAW.lock;
    drSyncUi();
    toast(DRAW.lock ? 'Parameter DH dikunci' : 'Parameter DH dibuka: d, a, dan α bisa diubah');
  });
  // akordeon yang baru dibuka langsung diisi
  ['dr-mats', 'dr-ik', 'dr-buku'].forEach(k =>
    document
      .querySelector('.accordion-header[data-target="' + k + '"]')
      .addEventListener('click', () => setTimeout(drMath, 0))
  );
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && DRAW.cine) drCine(false);
  });
})();
