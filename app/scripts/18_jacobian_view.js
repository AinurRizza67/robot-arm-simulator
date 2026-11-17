/* 18_jacobian_view.js
   Jacobian view for the JAKA FK page. Visualises the geometric Jacobian J(q) of the current pose:
   - one arrow per joint at the tool point: column Jv,i = z(i-1) x (pe - o(i-1)), the tool velocity when only
     joint i turns at 1 rad/s (same formula as jacobian() in sim_total.py and jacobian6() in 06_config_energy.js);
   - the joint axes Jw,i = z(i-1) as thin arrows at each joint origin;
   - the velocity manipulability ellipsoid of Jv Jv^T at the tool point (long axis = easy direction);
   - a HUD with |det J|, linear manipulability, condition number, a singularity bar and the |det J| history.
   Everything is computed from the frames drawn in the scene, so it follows sliders, IK and trajectory playback.
   Classic script: all files share one global scope and are loaded in order by index.html. */

const JAC_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'];
const JAC_ARROW_SCALE = 0.6; // scene metres per (m/rad) of tool speed
const JAC_ELLIPSE_SCALE = 0.16; // scene metres per sqrt(eigenvalue) of Jv Jv^T
const JAC_DET_REF = 0.08; // |det J| that fills the bar (ready pose is about 0.076)
const JAC_HISTORY = 160;
const JAC_VIEW = { on: false, col: 0, hist: [], group: null, colArrows: [], axisArrows: [], ellipsoid: null };

// Jacobian from scene frames T0..T6 (metres). |det J| and the norms do not depend on the base orientation,
// so the scene frame (Y up) gives the same numbers as the DH base frame (Z up).
function jacobianFromFrames(frames) {
  const pe = new THREE.Vector3().setFromMatrixPosition(frames[6]);
  const Jv = [],
    Jw = [],
    origins = [];
  for (let i = 0; i < 6; i++) {
    const z = new THREE.Vector3().setFromMatrixColumn(frames[i], 2).normalize();
    const o = new THREE.Vector3().setFromMatrixPosition(frames[i]);
    Jv.push(new THREE.Vector3().crossVectors(z, pe.clone().sub(o)));
    Jw.push(z);
    origins.push(o);
  }
  const J = [0, 1, 2]
    .map(r => Jv.map(v => v.getComponent(r)))
    .concat([0, 1, 2].map(r => Jw.map(v => v.getComponent(r))));
  return { J, Jv, Jw, origins, pe };
}

// Eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi). Returns eigenvalues and unit eigenvectors.
function eigenSymmetric3(m) {
  const a = m.map(r => r.slice());
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
  for (let sweep = 0; sweep < 24; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-14) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2]
    ]) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      const c = Math.cos(th),
        s = Math.sin(th);
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p],
          akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k],
          aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p],
          vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return {
    values: [a[0][0], a[1][1], a[2][2]],
    vectors: [0, 1, 2].map(k => new THREE.Vector3(v[0][k], v[1][k], v[2][k]).normalize())
  };
}

// Jv Jv^T (3x3) from the six linear columns
function linearGram(Jv) {
  const g = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  Jv.forEach(c => {
    const a = [c.x, c.y, c.z];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) g[r][k] += a[r] * a[k];
  });
  return g;
}

// Solid arrow (shaft + head): WebGL lines are always 1 px wide, so a mesh arrow reads better on screen.
function makeSolidArrow(color, radius, opacity) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, 1, 14), mat);
  const g = new THREE.Group();
  g.add(shaft, head);
  g.renderOrder = 10;
  shaft.renderOrder = head.renderOrder = 10;
  g.userData = { shaft, head, mat, radius };
  return g;
}
function setSolidArrow(g, origin, vec, length, emphasis) {
  const dir = vec.clone().normalize();
  const headLen = Math.min(length * 0.35, g.userData.radius * 9);
  const shaftLen = Math.max(1e-4, length - headLen);
  g.position.copy(origin);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.userData.shaft.scale.set(emphasis, shaftLen, emphasis);
  g.userData.shaft.position.set(0, shaftLen / 2, 0);
  g.userData.head.scale.set(emphasis, headLen, emphasis);
  g.userData.head.position.set(0, shaftLen + headLen / 2, 0);
}

function jacBuildScene() {
  const world = fkScene.world;
  const group = new THREE.Group();
  group.visible = false;
  world.add(group);
  JAC_COLORS.forEach(c => {
    const col = new THREE.Color(c);
    const a = makeSolidArrow(col, 0.0035, 0.9);
    const b = makeSolidArrow(col, 0.002, 0.6);
    group.add(a, b);
    JAC_VIEW.colArrows.push(a);
    JAC_VIEW.axisArrows.push(b);
  });
  const sphere = new THREE.SphereGeometry(1, 40, 20);
  const fill = new THREE.Mesh(
    sphere,
    new THREE.MeshBasicMaterial({ color: 0x4f8ff7, transparent: true, opacity: 0.08, depthWrite: false })
  );
  const wire = new THREE.Mesh(
    sphere,
    new THREE.MeshBasicMaterial({
      color: 0x4f8ff7,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false
    })
  );
  const ell = new THREE.Group();
  ell.add(fill, wire);
  ell.matrixAutoUpdate = false;
  group.add(ell);
  JAC_VIEW.ellipsoid = ell;
  JAC_VIEW.group = group;
}

function jacBuildHud() {
  const holder = document.getElementById('ch-fk');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'jk-round jk-jac';
  btn.id = 'jac-toggle';
  btn.dataset.iconSkip = '';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = iconSvg('arrows-out-cardinal');
  holder.appendChild(btn);
  const hud = document.createElement('div');
  hud.className = 'jac-hud';
  hud.id = 'jac-hud';
  hud.hidden = true;
  hud.innerHTML =
    '<div class="jh-row jh-big"><span>|det J|</span><b id="jh-det">0</b></div>' +
    '<div class="jh-bar"><i id="jh-bar"></i></div>' +
    '<div class="jh-row"><span id="jh-wv-l">w<sub>v</sub> = &radic;det(J<sub>v</sub>J<sub>v</sub><sup>T</sup>)</span><b id="jh-wv">0</b></div>' +
    '<div class="jh-row"><span>&kappa;(J<sub>v</sub>)</span><b id="jh-k">0</b></div>' +
    '<div class="jh-row"><span id="jh-col-l">|J<sub>v,1</sub>| m/rad</span><b id="jh-col">0</b></div>' +
    '<canvas id="jh-spark" width="420" height="76"></canvas>' +
    '<div class="jh-cols">' +
    JAC_COLORS.map(
      (c, i) =>
        '<button type="button" data-icon-skip data-col="' + i + '" style="--jc:' + c + '">J' + (i + 1) + '</button>'
    ).join('') +
    '</div>';
  holder.appendChild(hud);
  btn.addEventListener('click', () => jacSetVisible(!JAC_VIEW.on));
  hud.querySelectorAll('.jh-cols button').forEach(b =>
    b.addEventListener('click', () => {
      jacSelectColumn(+b.dataset.col);
      const sel = document.getElementById('jac-col');
      if (sel) {
        sel.value = String(JAC_VIEW.col);
        sel.dispatchEvent(new Event('change'));
      }
    })
  );
  const sel = document.getElementById('jac-col');
  if (sel) sel.addEventListener('change', () => jacSelectColumn(+sel.value));
  jacLabels();
}

function jacLabels() {
  const L = typeof appSettings !== 'undefined' && appSettings.lang === 'en' ? 'en' : 'id';
  const t =
    L === 'en'
      ? 'Jacobian view: tool velocity per joint, manipulability ellipsoid, |det J|'
      : 'Visual Jacobian: kecepatan ujung per sendi, elipsoid manipulabilitas, |det J|';
  const b = document.getElementById('jac-toggle');
  if (b) {
    b.dataset.tip = t;
    b.setAttribute('aria-label', t);
  }
}

function jacSetVisible(on) {
  JAC_VIEW.on = on;
  JAC_VIEW.group.visible = on;
  document.getElementById('jac-hud').hidden = !on;
  const b = document.getElementById('jac-toggle');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  if (on) jacUpdate(computeChain6());
}

function jacSelectColumn(c) {
  JAC_VIEW.col = Math.max(0, Math.min(5, c | 0));
  document
    .querySelectorAll('#jac-hud .jh-cols button')
    .forEach(b => b.classList.toggle('on', +b.dataset.col === JAC_VIEW.col));
  if (JAC_VIEW.on) jacUpdate(computeChain6());
}

function jacUpdate(frames) {
  if (!JAC_VIEW.on || !frames) return;
  const { J, Jv, Jw, origins, pe } = jacobianFromFrames(frames);
  // column arrows at the tool point, joint axes at their origins
  Jv.forEach((v, i) => {
    const a = JAC_VIEW.colArrows[i],
      len = v.length() * JAC_ARROW_SCALE,
      hi = i === JAC_VIEW.col;
    a.visible = len > 1e-4;
    if (a.visible) setSolidArrow(a, pe, v, len, hi ? 1.8 : 1);
    a.userData.mat.opacity = hi ? 1 : 0.55;
    a.userData.mat.transparent = !hi;
    setSolidArrow(JAC_VIEW.axisArrows[i], origins[i], Jw[i], 0.09, hi ? 1.8 : 1);
  });
  // manipulability ellipsoid of Jv Jv^T
  const eig = eigenSymmetric3(linearGram(Jv));
  const radii = eig.values.map(l => Math.max(1e-4, Math.sqrt(Math.max(0, l)) * JAC_ELLIPSE_SCALE));
  const [e1, e2, e3] = eig.vectors;
  const m = new THREE.Matrix4().makeBasis(
    e1.clone().multiplyScalar(radii[0]),
    e2.clone().multiplyScalar(radii[1]),
    e3.clone().multiplyScalar(radii[2])
  );
  m.setPosition(pe);
  JAC_VIEW.ellipsoid.matrix.copy(m);
  JAC_VIEW.ellipsoid.matrixWorldNeedsUpdate = true;
  // numbers
  const detJ = Math.abs(det6(J));
  const lam = eig.values.map(l => Math.max(0, l)).sort((x, y) => y - x);
  const wv = Math.sqrt(lam[0] * lam[1] * lam[2]);
  const kappa = lam[2] > 1e-16 ? Math.sqrt(lam[0] / lam[2]) : Infinity;
  document.getElementById('jh-det').textContent = detJ.toFixed(4);
  document.getElementById('jh-wv').textContent = wv.toFixed(4);
  document.getElementById('jh-k').textContent = isFinite(kappa) ? kappa.toFixed(1) : '∞';
  document.getElementById('jh-col').textContent = Jv[JAC_VIEW.col].length().toFixed(3);
  document.getElementById('jh-col-l').innerHTML = '|J<sub>v,' + (JAC_VIEW.col + 1) + '</sub>| m/rad';
  const bar = document.getElementById('jh-bar');
  bar.style.width = Math.min(100, (detJ / JAC_DET_REF) * 100).toFixed(1) + '%';
  bar.className = detJ < SING_DET_MIN * 5 ? 'bad' : detJ < 0.02 ? 'warn' : '';
  JAC_VIEW.hist.push(detJ);
  if (JAC_VIEW.hist.length > JAC_HISTORY) JAC_VIEW.hist.shift();
  jacDrawHistory();
}

function jacDrawHistory() {
  const c = document.getElementById('jh-spark');
  if (!c) return;
  const g = c.getContext('2d'),
    W = c.width,
    H = c.height,
    h = JAC_VIEW.hist;
  const css = getComputedStyle(document.documentElement);
  g.clearRect(0, 0, W, H);
  const max = Math.max(JAC_DET_REF, ...h);
  const y = v => H - 4 - (v / max) * (H - 8);
  g.strokeStyle = css.getPropertyValue('--panel-line').trim() || '#334';
  g.lineWidth = 1;
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(0, y(SING_DET_MIN * 5));
  g.lineTo(W, y(SING_DET_MIN * 5));
  g.stroke();
  g.setLineDash([]);
  if (h.length < 2) return;
  g.strokeStyle = css.getPropertyValue('--gold').trim() || '#4f8ff7';
  g.lineWidth = 3;
  g.beginPath();
  h.forEach((v, i) => {
    const x = (i / (JAC_HISTORY - 1)) * W;
    i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v));
  });
  g.stroke();
}

jacBuildScene();
jacBuildHud();
jacSelectColumn(0);
{
  const previous = fkScene.onPose;
  fkScene.onPose = frames => {
    if (previous) previous(frames);
    jacUpdate(frames);
  };
}
