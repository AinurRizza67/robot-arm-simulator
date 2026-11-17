/* 01_core.js
   Core: theme tokens for Three.js, shared math helpers, tabs, accordions, number formatting.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ UTILS ============ */
const fmt = (n, d = 2) => Number(n).toFixed(d);
const katexR = (el, str, opts) => {
  try {
    katex.render(str, el, Object.assign({ throwOnError: false, displayMode: true }, opts || {}));
  } catch (e) {
    el.textContent = str;
  }
};
// Renders each string in `lines` as its own KaTeX display block, stacked vertically.
// Avoids bare "\\[Npt]" line breaks, which are invalid outside array/aligned environments
// and were causing KaTeX to fall back to raw-text output (the literal "\cdot" bug).
// Tiap butir boleh string LaTeX atau {label, tex, note}: label dan note ditulis sebagai teks biasa, bukan \text di rumus.
const katexRLines = (el, lines) => {
  el.innerHTML = '';
  lines.forEach((item, idx) => {
    const it = typeof item === 'string' ? { tex: item } : item;
    if (it.label) {
      const lb = document.createElement('div');
      lb.className = 'eq-label';
      lb.textContent = it.label;
      el.appendChild(lb);
    }
    const div = document.createElement('div');
    if (idx > 0 && !it.label) div.style.marginTop = '10px';
    el.appendChild(div);
    try {
      katex.render(it.tex, div, { throwOnError: false, displayMode: true });
    } catch (e) {
      div.textContent = it.tex;
    }
    if (it.note) {
      const n = document.createElement('div');
      n.className = 'eq-note';
      n.textContent = it.note;
      el.appendChild(n);
    }
  });
};
function matToTex(m, p = 2) {
  let rows = m.map(r => r.map(v => fmt(v, p)).join(' & ')).join(' \\\\ ');
  return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}
function mat4ToTex(m4, d = 2) {
  const e = m4.elements;
  let rows = [];
  for (let r = 0; r < 4; r++) {
    let row = [];
    for (let c = 0; c < 4; c++) row.push(e[c * 4 + r].toFixed(d));
    rows.push(row.join(' & '));
  }
  return '\\begin{bmatrix} ' + rows.join(' \\\\ ') + ' \\end{bmatrix}';
}

/* ============ THEME (light/dark) ============ */
const THEME_KEY = 'jakaSimTheme';
const THEME_JS = {
  dark: {
    scene: 0x0b1220,
    vec: 0x0b1220,
    gridA: 0x26344d,
    gridB: 0x172235,
    ground: 0x0f172a,
    tick: '#6b7a94',
    grid: 'rgba(79,143,247,0.12)'
  },
  light: {
    scene: 0xeef2f7,
    vec: 0xeef2f7,
    gridA: 0xb4c0d3,
    gridB: 0xdbe2ec,
    ground: 0xe3e9f1,
    tick: '#64748b',
    grid: 'rgba(29,78,216,0.14)'
  }
};
const themeHooks = [];
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
const CT = () => THEME_JS[currentTheme()];
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (e) {}
  themeHooks.forEach(fn => fn(t));
  const b = document.getElementById('theme-toggle');
  if (b) b.textContent = t === 'dark' ? 'Mode Terang' : 'Mode Gelap';
}

/* ============ TABS ============ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    window.dispatchEvent(new Event('resize'));
  });
});

/* ============ TEXT SPRITE (for grid numbers) ============ */
function makeTextSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = color || '#93a2bc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 16);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(0.45, 0.22, 1);
  return s;
}

/* ============ NUMBERED GRID ============ */
// zUp: grid di bidang XY (lantai) dan sumbu Z vertikal, dipakai scene Vector Simulation (frame matematika Z ke atas)
function createNumberedGrid(scene, size, divisions, zUp) {
  const group = new THREE.Group();
  const mkGrid = (a, b) => {
    const g = new THREE.GridHelper(size, divisions, a, b);
    if (zUp) g.rotation.x = Math.PI / 2;
    return g;
  };
  let gridHelper = mkGrid(CT().gridA, CT().gridB);
  group.add(gridHelper);
  let curMode = 'grid';

  const numGroup = new THREE.Group();
  const half = size / 2;
  const step = size / divisions;
  for (let i = -half; i <= half; i += step) {
    if (Math.abs(i) < 0.01) continue;
    const val = Math.round(i);
    const xs = makeTextSprite(val.toString(), '#c9605a');
    if (zUp) xs.position.set(i, -half - 0.35, 0.05);
    else xs.position.set(i, 0.05, half + 0.35);
    numGroup.add(xs);
    const zs = makeTextSprite(val.toString(), zUp ? '#6fae6a' : '#4d8fd1');
    if (zUp) zs.position.set(-half - 0.35, i, 0.05);
    else zs.position.set(-half - 0.35, 0.05, i);
    numGroup.add(zs);
  }
  for (let i = step; i <= half; i += step) {
    const vc = zUp ? '#4d8fd1' : '#6fae6a';
    const ys = makeTextSprite(Math.round(i).toString(), vc);
    if (zUp) ys.position.set(-0.3, 0, i);
    else ys.position.set(-0.3, i, 0);
    numGroup.add(ys);
    const yn = makeTextSprite((-Math.round(i)).toString(), vc);
    if (zUp) yn.position.set(-0.3, 0, -i);
    else yn.position.set(-0.3, -i, 0);
    numGroup.add(yn);
  }
  const xlbl = makeTextSprite('X', '#c9605a');
  xlbl.position.set(half + 0.7, 0.1, 0);
  xlbl.scale.set(0.5, 0.25, 1);
  numGroup.add(xlbl);
  const ylbl = makeTextSprite('Y', '#6fae6a');
  if (zUp) ylbl.position.set(0, half + 0.7, 0.1);
  else ylbl.position.set(0, half + 0.5, 0);
  ylbl.scale.set(0.5, 0.25, 1);
  numGroup.add(ylbl);
  const zlbl = makeTextSprite('Z', '#4d8fd1');
  if (zUp) zlbl.position.set(0, 0, half + 0.5);
  else zlbl.position.set(0, 0.1, half + 0.7);
  zlbl.scale.set(0.5, 0.25, 1);
  numGroup.add(zlbl);
  numGroup.visible = false;
  group.add(numGroup);
  scene.add(group);

  themeHooks.push(t => {
    group.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper = mkGrid(THEME_JS[t].gridA, THEME_JS[t].gridB);
    gridHelper.visible = curMode !== 'off';
    group.add(gridHelper);
  });
  return {
    get gridHelper() {
      return gridHelper;
    },
    numGroup,
    setMode(mode) {
      curMode = mode;
      if (mode === 'off') {
        gridHelper.visible = false;
        numGroup.visible = false;
      } else if (mode === 'grid') {
        gridHelper.visible = true;
        numGroup.visible = false;
      } else {
        gridHelper.visible = true;
        numGroup.visible = true;
      }
    }
  };
}

/* ============ GRID MODE BUTTONS ============ */
const gridObjs = {};
document.querySelectorAll('.grid-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sc = btn.dataset.scene;
    btn.parentElement.querySelectorAll(`.grid-btn[data-scene="${sc}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (gridObjs[sc]) gridObjs[sc].setMode(btn.dataset.mode);
  });
});

/* ============ ORBIT CONTROL ============ */
function attachOrbit(dom, camera, target) {
  let dragging = false,
    lastX = 0,
    lastY = 0;
  let radius = camera.position.distanceTo(target);
  let theta = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
  let phi = Math.acos(THREE.MathUtils.clamp((camera.position.y - target.y) / radius, -1, 1));
  function update() {
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.lookAt(target);
  }
  dom.addEventListener('mousedown', e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.006;
    phi -= (e.clientY - lastY) * 0.006;
    phi = THREE.MathUtils.clamp(phi, 0.15, Math.PI - 0.15);
    lastX = e.clientX;
    lastY = e.clientY;
    update();
  });
  dom.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      radius *= 1 + e.deltaY * 0.001;
      radius = THREE.MathUtils.clamp(radius, 2, 40);
      update();
    },
    { passive: false }
  );
  let tl = null;
  dom.addEventListener('touchstart', e => {
    if (e.touches.length === 1) tl = [e.touches[0].clientX, e.touches[0].clientY];
  });
  dom.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length === 1 && tl) {
        theta -= (e.touches[0].clientX - tl[0]) * 0.006;
        phi -= (e.touches[0].clientY - tl[1]) * 0.006;
        phi = THREE.MathUtils.clamp(phi, 0.15, Math.PI - 0.15);
        tl = [e.touches[0].clientX, e.touches[0].clientY];
        update();
      }
    },
    { passive: true }
  );
  update();
  return { update };
}

/* ============ VECTOR SCENE FACTORY (for tabs 1-5) ============ */
function makeVectorScene(holderId, camPos, gridKey) {
  const holder = document.getElementById(holderId);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(...camPos);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(CT().vec);
  themeHooks.push(t => renderer.setClearColor(THEME_JS[t].vec));
  holder.appendChild(renderer.domElement);

  // Semua isi modul hidup di `root` (frame matematika, Z ke atas); root diputar -90° terhadap X karena layar Three.js Y ke atas
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  scene.add(root);
  root.updateMatrixWorld(true);
  camera.userData.root = root;
  const grid = createNumberedGrid(root, 10, 10, true);
  if (gridKey) gridObjs[gridKey] = grid;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 0.6);
  dl.position.set(5, 8, 5);
  scene.add(dl);

  const target = new THREE.Vector3(0, 0.5, 0);
  attachOrbit(renderer.domElement, camera, target);

  function resize() {
    const w = holder.clientWidth,
      h = holder.clientHeight;
    if (w < 1 || h < 1) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  (function anim() {
    requestAnimationFrame(anim);
    renderer.render(scene, camera);
  })();

  // World axes
  root.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 3, 0xc9605a, 0.2, 0.1));
  root.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 3, 0x6fae6a, 0.2, 0.1));
  root.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 3, 0x4d8fd1, 0.2, 0.1));

  return { scene: root, world: scene, camera, renderer, resize };
}

/* ============ ANGLE ARC HELPER ============ */
function refForAxis(axis) {
  if (axis === 'x') return new THREE.Vector3(0, 1, 0);
  if (axis === 'y') return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(1, 0, 0);
}
function arcPoints(d0, d1, radius, segs = 28) {
  d0 = d0.clone().normalize();
  d1 = d1.clone().normalize();
  const dot = THREE.MathUtils.clamp(d0.dot(d1), -1, 1);
  const omega = Math.acos(dot);
  const pts = [];
  if (omega < 1e-4) {
    pts.push(d0.clone().multiplyScalar(radius));
    return pts;
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const s0 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s1 = Math.sin(t * omega) / Math.sin(omega);
    pts.push(d0.clone().multiplyScalar(s0).add(d1.clone().multiplyScalar(s1)).multiplyScalar(radius));
  }
  return pts;
}
function makeAngleArc(d0, d1, radius, origin, color) {
  const pts = arcPoints(d0, d1, radius).map(p => (origin ? p.add(origin.clone()) : p));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color: color || 0x6fbf8b, dashSize: 0.08, gapSize: 0.06 });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return { line, mid: pts[Math.floor(pts.length / 2)] };
}

/* ============ COORD LABEL OVERLAY ============ */
function makeLabelManager(holderId, camera) {
  const num = holderId.replace(/\D/g, '') || holderId.replace('ch-', '');
  const layer = document.getElementById('labels' + num);
  if (!layer) return { place() {}, hide() {} };
  const pool = new Map();
  function get(key, color) {
    let el = pool.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'coord-label';
      layer.appendChild(el);
      pool.set(key, el);
    }
    el.style.color = color || '#eef1f6';
    el.style.borderColor = color ? color + '55' : '';
    return el;
  }
  function place(key, wpos, text, color) {
    const el = get(key, color);
    const v = wpos.clone();
    if (camera.userData.root) v.applyMatrix4(camera.userData.root.matrixWorld);
    v.project(camera);
    const w = layer.clientWidth,
      h = layer.clientHeight;
    const x = (v.x * 0.5 + 0.5) * w,
      y = (-v.y * 0.5 + 0.5) * h;
    if (v.z > 1 || x < -50 || x > w + 50 || y < -50 || y > h + 50) {
      el.style.display = 'none';
    } else {
      el.style.display = 'block';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.textContent = text;
    }
  }
  function hide(key) {
    const el = pool.get(key);
    if (el) el.style.display = 'none';
  }
  return { place, hide };
}
