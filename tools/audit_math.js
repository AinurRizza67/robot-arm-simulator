// Audit numerik rumus simulator: tiap cek membandingkan angka yang DITAMPILKAN/DIHITUNG halaman
// dengan perhitungan independen. Jalankan dari folder ini: node audit_math.js
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadHtml } = require('./load_html');
const { raw, root } = loadHtml();
const three = fs.readFileSync(require('path').join(__dirname, 'node_modules/three/build/three.js'), 'utf8'),
  katexJs = fs.readFileSync(require('path').join(__dirname, 'node_modules/katex/dist/katex.min.js'), 'utf8'),
  mesh = fs.readFileSync(root + 'app/models/zu5_meshes.js', 'utf8');
const html = raw
  .replace(/<link[^>]*>/g, '')
  .replace(/<script src="https:[^>]*><\/script>/g, '')
  .replace('<script src="models/zu5_meshes.js"></script>', '');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(String(e.message)));
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'file:///x/'
});
const w = dom.window,
  d = w.document;
w.eval(three);
w.THREE.WebGLRenderer = function () {
  this.domElement = d.createElement('canvas');
  this.shadowMap = {};
  this.setSize = () => {};
  this.setPixelRatio = () => {};
  this.setClearColor = () => {};
  this.render = () => {};
};
w.THREE.PMREMGenerator = function () {
  this.fromScene = () => ({ texture: {} });
  this.dispose = () => {};
};
w.eval(katexJs);
w.Chart = function () {
  this.options = {
    plugins: { legend: { labels: {} } },
    scales: { x: { ticks: {}, grid: {} }, y: { ticks: {}, grid: {} } }
  };
  this.data = { labels: [], datasets: [] };
  this.update = () => {};
  this.resize = () => {};
};
w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
w.eval(mesh);
let clock = 0;
w.performance.now = () => clock;
w.requestAnimationFrame = () => 0;
w.__ticks = [];
w.setInterval = f => {
  w.__ticks.push(f);
  return 0;
};
w.setTimeout = () => 0;
w.Element.prototype.scrollIntoView = function () {};
w.scrollTo = () => {};
w.confirm = () => true;
w.prompt = () => 'x';
w.alert = () => {};
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
w.eval(scripts[0]);
w.eval(
  scripts[1] +
    ';window.__A={zzLock,J:()=>joints6,computeChain6,dhMatrix,eeFromThetas6,jacobian6,gravityTorque,potentialEnergy,dashParams,robotMeta,activePayloadKg,renderDHMatrices6,updateFK6,solveIK6,ik6d,quintic,jointSeg,renderIKLive};'
);
const A = w.__A,
  THREE = w.THREE;
const out = [];
const R = (name, ok, info) => {
  out.push(ok);
  console.log((ok ? 'OK   ' : 'BUG  ') + name + (info ? '\n       ' + info : ''));
};
const texOf = id => [...d.querySelectorAll('#' + id + ' annotation')].map(a => a.textContent);
const setIn = (id, v) => {
  const el = d.getElementById(id);
  el.value = String(v);
  el.dispatchEvent(new w.Event('input'));
};

// ---- A. T60 yang ditampilkan = perkalian T_i^{i-1} yang ditampilkan? ----
{
  const q = [20, -35, 50, 10, -25, 40];
  A.J().forEach((j, i) => (j.theta = q[i]));
  A.renderDHMatrices6('math-display-fk');
  const tex = texOf('math-display-fk');
  const parse = s => {
    const b = s.slice(s.indexOf('\\begin{bmatrix}') + 15, s.indexOf('\\end{bmatrix}'));
    return b.split('\\\\').map(r => r.split('&').map(Number));
  };
  const Ms = tex.map(parse);
  let P = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  const mul = (X, Y) => X.map((r, i) => Y[0].map((_, j) => r.reduce((s, _, k) => s + X[i][k] * Y[k][j], 0)));
  for (let i = 0; i < 6; i++) P = mul(P, Ms[i]);
  const shown = Ms[6];
  let md = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) md = Math.max(md, Math.abs(P[r][c] - shown[r][c]));
  R(
    'A. T60 yang ditampilkan sama dengan T10*T21*...*T65 yang ditampilkan',
    md < 0.01,
    'selisih maks ' +
      md.toFixed(3) +
      '; baris posisi hasil kali = [' +
      P.slice(0, 3).map(r => r[3].toFixed(3)) +
      '], yang ditampilkan = [' +
      shown.slice(0, 3).map(r => r[3].toFixed(3)) +
      ']'
  );
  A.updateFK6();
  const shownXYZ = ['.ex', '.ey', '.ez'].map(c => +d.querySelector('#view-v7 ' + c).textContent);
  R(
    'A1. Angka x,y,z end-effector di layar = kolom posisi T60 (frame base, Z ke atas)',
    shownXYZ.every((v, k) => Math.abs(v - P[k][3]) < 0.002),
    'layar [' + shownXYZ + '] vs T60 [' + P.slice(0, 3).map(r => r[3].toFixed(3)) + ']'
  );
  A.updateFK6();
  const box2 = d.querySelector('#view-v7 .matrixOut').textContent.split('\n')[1];
  const ee = A.eeFromThetas6();
  R(
    'A2. Kotak T(0->6) tab 07 memakai frame base DH (Z ke atas)',
    Math.abs(parseFloat(box2.split(/\s+/).filter(Boolean)[4]) - P[0][3]) < 0.002 &&
      Math.abs(
        parseFloat(d.querySelector('#view-v7 .matrixOut').textContent.split('\n')[3].split(/\s+/).filter(Boolean)[4]) -
          P[2][3]
      ) < 0.002,
    'z_DH (tinggi) hasil kali = ' +
      P[2][3].toFixed(3) +
      ', kolom posisi kotak baris 3 = ' +
      d.querySelector('#view-v7 .matrixOut').textContent.split('\n')[3].trim()
  );
}

// ---- B. Tab 01: kuadrat komponen negatif ditulis (-2.0)^2, bukan -2.0^2 ----
{
  setIn('v1-ax', -2);
  const t = texOf('v1-eq').join(' ');
  const num = (t.match(/\\sqrt\{[-(\d][^}]*\}/g) || []).join('  ');
  R(
    'B. Tab 01 menulis kuadrat bilangan negatif dengan kurung',
    !/(^|[{+])-\d+(\.\d+)?\^2/.test(num.replace(/\\sqrt\{/g, '{')),
    'bagian angka: ' + num
  );
  setIn('v1-ax', 2);
}

// ---- C. Tab 01: sudut dengan vektor nol ----
{
  const keep = ['v1-ax', 'v1-ay', 'v1-az'].map(id => d.getElementById(id).value);
  ['v1-ax', 'v1-ay', 'v1-az'].forEach(id => setIn(id, 0));
  const th = d.getElementById('v1-theta').textContent;
  R('C. Tab 01 tidak mengklaim sudut 90° saat salah satu vektor nol', !/^90/.test(th), 'ditampilkan: ' + th);
  ['v1-ax', 'v1-ay', 'v1-az'].forEach((id, i) => setIn(id, keep[i]));
}

// ---- D. Tab 03: klaim R_AB != R_BA saat sebenarnya identik ----
{
  d.querySelector('#view-v3 [data-r1="z"]').click();
  d.querySelector('#view-v3 [data-r2="z"]').click();
  const t = texOf('v3-eq').join(' ');
  const diff = d.getElementById('v3-diff').textContent;
  R(
    'D. Tab 03 tidak menulis R_AB ≠ R_BA ketika selisihnya 0',
    !(parseFloat(diff) < 1e-6 && t.includes('\\neq')),
    'selisih = ' + diff + ', rumus berisi \\neq: ' + t.includes('\\neq')
  );
  d.querySelector('#view-v3 [data-r1="x"]').click();
}

// ---- E. Tab 02/03/04: nilai numerik vs rumus buku ----
{
  setIn('v2-ang', 37);
  setIn('v2-pu', 1.2);
  setIn('v2-pv', -0.7);
  setIn('v2-pw', 0.4);
  d.querySelector('#view-v2 [data-axis="y"]').click();
  const a = (37 * Math.PI) / 180,
    px = Math.cos(a) * 1.2 + Math.sin(a) * 0.4,
    pz = -Math.sin(a) * 1.2 + Math.cos(a) * 0.4;
  const ok =
    Math.abs(+d.getElementById('v2-px').textContent - px) < 0.006 &&
    Math.abs(+d.getElementById('v2-pz').textContent - pz) < 0.006;
  R(
    'E1. Tab 02 Ry(37°)·P cocok dengan rumus buku',
    ok,
    'px ' +
      d.getElementById('v2-px').textContent +
      ' vs ' +
      px.toFixed(3) +
      ', pz ' +
      d.getElementById('v2-pz').textContent +
      ' vs ' +
      pz.toFixed(3)
  );
  setIn('v4-th', 30);
  setIn('v4-d', 1);
  setIn('v4-a', 2);
  setIn('v4-al', 45);
  const t = (30 * Math.PI) / 180,
    al = (45 * Math.PI) / 180;
  const ex = [Math.cos(t) + 2 * Math.cos(t), Math.sin(t) + 2 * Math.sin(t), 1];
  const got = ['v4-px', 'v4-py', 'v4-pz'].map(id => +d.getElementById(id).textContent);
  R(
    'E2. Tab 04 T·[1 0 0 1] cocok dengan DH buku',
    got.every((v, k) => Math.abs(v - ex[k]) < 0.006),
    'dapat [' + got + '] harapan [' + ex.map(v => v.toFixed(2)) + ']'
  );
}

// ---- F. Tab 08: rumus IK yang ditampilkan = solver yang benar-benar dipakai ----
{
  const cb = d.getElementById('ik-animate');
  const res = [];
  for (const on of [true, false]) {
    cb.checked = on;
    A.renderIKLive();
    const t = texOf('ik-live-display').join(' ');
    res.push(on ? t.includes('0.003') && !t.includes('0.015') : t.includes('0.015') && !t.includes('0.003'));
  }
  cb.checked = true;
  R(
    'F. Tab 08 menampilkan parameter solver yang aktif (animasi: ik6d λ=0.003; tanpa animasi: solveIK6 λ=0.015)',
    res.every(Boolean),
    'animasi aktif cocok: ' + res[0] + ', animasi mati cocok: ' + res[1]
  );
}

// ---- G. Torsi gravitasi vs J^T (jalur independen, hanya payload) ----
{
  const q = [15, 40, -70, 25, -30, 10];
  A.J().forEach((j, i) => (j.theta = q[i]));
  const m0 = A.dashParams.linkMass.slice();
  A.dashParams.linkMass = [0, 0, 0, 0, 0, 0];
  A.robotMeta.payloadMode = '5';
  const tg = A.gravityTorque();
  const { J } = A.jacobian6();
  const exp = [0, 1, 2, 3, 4, 5].map(i => 5 * 9.81 * J[2][i]); // U = m g z_DH -> tau = m g dz/dq
  const md = Math.max(...tg.map((v, i) => Math.abs(v - exp[i])));
  R(
    'G. τ gravitasi (beda hingga U) = m g J_v,z (Jacobian geometris)',
    md < 0.05,
    'selisih maks ' + md.toFixed(4) + ' N·m; τ=[' + tg.map(v => v.toFixed(2)) + ']'
  );
  A.dashParams.linkMass = m0;
  A.robotMeta.payloadMode = '0';
}

// ---- H. Quintic: kecepatan puncak = 1.875 Δq / T ----
{
  let mx = 0;
  for (let k = 0; k <= 1000; k++) {
    const u = k / 1000,
      h = 1e-5;
    mx = Math.max(mx, (A.quintic(u + h) - A.quintic(u - h)) / (2 * h));
  }
  const sg = A.jointSeg('x', [0, 0, 0, 0, 0, 0], [90, 0, 0, 0, 0, 0], 90);
  R(
    'H. Quintic: ds/du maks = 1.875 dan ω puncak = ω_maks',
    Math.abs(mx - 1.875) < 1e-3 && Math.abs((90 / sg.T) * mx - 90) < 0.5,
    'ds/du maks ' + mx.toFixed(4) + ', T ' + sg.T.toFixed(3) + ' s, ω puncak ' + ((90 / sg.T) * mx).toFixed(2) + ' °/s'
  );
}

// ---- I. Label tabel posisi sendi: frame i ada di sumbu sendi i+1 ----
{
  const lbl = [...d.querySelectorAll('#jxyz-fk td.jn')].map(t => t.textContent);
  R('I. Label tabel posisi titik (info)', true, 'label sekarang: ' + lbl.join(', '));
}
// ---- K. Target IK diketik dalam frame base (Z ke atas) muncul kembali sama di layar; z = tinggi ----
{
  A.J().forEach(j => (j.theta = [0, 30, -60, 30, 0, 0][A.J().indexOf(j)]));
  A.zzLock();
  const tgt = [0.55, -0.25, 0.3];
  ['tx', 'ty', 'tz'].forEach((id, k) => {
    d.getElementById(id).value = String(tgt[k]);
  });
  const cb = d.getElementById('ik-animate');
  cb.checked = false;
  d.getElementById('solveBtn').click();
  cb.checked = true;
  const got = ['.ex', '.ey', '.ez'].map(c => +d.querySelector('#view-v8 ' + c).textContent);
  const eeScene = A.eeFromThetas6();
  R(
    'K. IK frame base: target (0.55, -0.25, 0.30) tercapai dan z = ketinggian di layar 3D',
    got.every((v, k) => Math.abs(v - tgt[k]) < 0.004) && Math.abs(eeScene.y - 0.3) < 0.004,
    'layar [' + got + '], tinggi di scene 3D ' + eeScene.y.toFixed(3) + ' m'
  );
}

// ---- J. Rumus time-scaling di halaman Rujukan memuat faktor 1,875 (profil quintic) ----
{
  const q = d.getElementById('pd-quintic').parentElement.innerHTML;
  R(
    'J. Rumus durasi quintic di Rujukan: T = max(1,875 Δθ/θ̇maks), bukan Δθ/θ̇maks',
    /\\max_\{i=1\\ldots6\}\\left\(\\frac\{1\{,\}875/.test(q),
    'rumus di halaman Rujukan'
  );
}
console.log(
  '\nRINGKASAN AUDIT: ' +
    out.filter(Boolean).length +
    '/' +
    out.length +
    ' OK' +
    (errors.length ? ' | error DOM: ' + errors[0] : '')
);
