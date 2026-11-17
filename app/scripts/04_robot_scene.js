/* 04_robot_scene.js
   Robot scene factory (Three.js): lights, grid, rulers, payload blocks, FK/IK views and their wiring.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ ROBOT SCENE FACTORY ============ */
function makeRobotScene(holderId, gridKey, opts) {
  // opts.noWeights: tanpa balok payload (Start Control)
  const holder = document.getElementById(holderId);
  let W = holder.clientWidth,
    H = holder.clientHeight;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CT().scene);
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  holder.appendChild(renderer.domElement);

  // Environment map procedural (gradient studio + softbox) untuk reflection logam
  (function () {
    const envScene = new THREE.Scene();
    const sg = new THREE.SphereGeometry(20, 32, 16);
    const cols = [],
      pos = sg.attributes.position,
      top = new THREE.Color(0x8fb3e0),
      mid = new THREE.Color(0x2a3550),
      bot = new THREE.Color(0x0a0f1a),
      c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) / 20 + 1) / 2;
      if (t > 0.5) c.copy(mid).lerp(top, (t - 0.5) * 2);
      else c.copy(bot).lerp(mid, t * 2);
      cols.push(c.r, c.g, c.b);
    }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    envScene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    [
      [8, 10, 6, 4],
      [-10, 5, -4, 1.5]
    ].forEach(([x, y, z, k]) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k) });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), m);
      p.position.set(x, y, z);
      p.lookAt(0, 0, 0);
      envScene.add(p);
    });
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    pm.dispose();
  })();

  // Lighting rig 3 titik: key (bayangan), fill, rim
  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x0a0f1a, 0.25));
  const key = new THREE.DirectionalLight(0xfff2dd, 1.1);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0005;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fb3ff, 0.35);
  fill.position.set(-6, 3, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.8);
  rim.position.set(-2, 4, -7);
  scene.add(rim);

  // Ground plane penerima bayangan
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({
      color: CT().ground,
      metalness: 0.2,
      roughness: 0.7,
      transparent: true,
      opacity: 0.85
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
  themeHooks.push(t => {
    scene.background.setHex(THEME_JS[t].scene);
    ground.material.color.setHex(THEME_JS[t].ground);
  });

  const grid = createNumberedGrid(scene, 10, 20);
  if (gridKey) gridObjs[gridKey] = grid;

  let radius = 6.5,
    azimuth = 0.9,
    elevation = 0.55,
    dragging = false,
    lastX = 0,
    lastY = 0,
    rMin = 2;
  const camT = new THREE.Vector3(1.5, 0.7, 0); // titik yang dilihat kamera (satuan scene)
  function updateCam() {
    const x = radius * Math.cos(elevation) * Math.sin(azimuth),
      y = radius * Math.sin(elevation),
      z = radius * Math.cos(elevation) * Math.cos(azimuth);
    camera.position.set(x + camT.x, y + camT.y, z + camT.z);
    camera.lookAt(camT);
  }
  updateCam();
  const dom = renderer.domElement;
  dom.addEventListener('mousedown', e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', e => {
    if (!dragging || wDrag) return;
    azimuth -= (e.clientX - lastX) * 0.006;
    elevation = Math.max(-1.4, Math.min(1.4, elevation + (e.clientY - lastY) * 0.006));
    lastX = e.clientX;
    lastY = e.clientY;
    updateCam();
  });
  dom.addEventListener('touchstart', e => {
    dragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  });
  window.addEventListener('touchend', () => (dragging = false));
  window.addEventListener(
    'touchmove',
    e => {
      if (!dragging || wDrag) return;
      azimuth -= (e.touches[0].clientX - lastX) * 0.006;
      elevation = Math.max(-1.4, Math.min(1.4, elevation + (e.touches[0].clientY - lastY) * 0.006));
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      updateCam();
    },
    { passive: true }
  );
  dom.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      radius = Math.max(rMin, Math.min(20, radius + e.deltaY * 0.003));
      updateCam();
    },
    { passive: false }
  );
  window.addEventListener('resize', () => {
    W = holder.clientWidth;
    H = holder.clientHeight;
    if (W < 1 || H < 1) return;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  });

  // Semua objek robot (satuan meter) hidup di `world`, diskalakan VIS agar pas dengan grid/kamera.
  const world = new THREE.Group();
  world.scale.setScalar(ROBOT_VIS);
  scene.add(world);
  const matLight = new THREE.MeshPhysicalMaterial({
    color: 0xe4e8ee,
    metalness: 0.35,
    roughness: 0.38,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide
  });
  const matDark = new THREE.MeshPhysicalMaterial({
    color: 0x23272f,
    metalness: 0.5,
    roughness: 0.45,
    side: THREE.DoubleSide
  });

  // partGroups[i] = mesh link i, di-set matrix = frames[i] tiap pose (mesh sudah dalam frame lokal link)
  const fillPart = (g, p) => {
    while (g.children.length) g.remove(g.children[0]);
    p.solids.forEach(s => {
      const m = new THREE.Mesh(zu5Geometry(s), s.dark ? matDark : matLight);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    });
  };
  const partGroups = ((opts && opts.parts) || ROBOT_PARTS).map(p => {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    fillPart(g, p);
    world.add(g);
    return g;
  });
  const axesHelpers = [];
  for (let i = 0; i < 6; i++) {
    const ax = new THREE.AxesHelper(0.1);
    ax.matrixAutoUpdate = false;
    world.add(ax);
    axesHelpers.push(ax);
  }
  (function anim() {
    requestAnimationFrame(anim);
    renderer.render(scene, camera);
  })();

  const ghostMat = new THREE.LineBasicMaterial({ color: 0x7fb0a3, transparent: true, opacity: 0.6 });
  const ghostPts = new Array(7).fill(0).map(() => new THREE.Vector3());
  const ghostLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ghostPts), ghostMat);
  ghostLine.visible = false;
  world.add(ghostLine);

  const weights =
    opts && opts.noWeights
      ? []
      : [
          { kg: 1, size: 0.06, color: 0x6fa3d8, home: [0.517, 0.188] },
          { kg: 3, size: 0.08, color: 0xe8a23d, home: [0.389, 0.389] },
          { kg: 5, size: 0.1, color: 0xc9605a, home: [0.188, 0.517] }
        ].map(w => {
          const g = new THREE.Group();
          g.matrixAutoUpdate = false;
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w.size, w.size, w.size),
            new THREE.MeshStandardMaterial({ color: w.color, metalness: 0.3, roughness: 0.5 })
          );
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.kg = w.kg;
          g.add(mesh);
          const sp = makeCoordLabel();
          sp.position.set(0, w.size / 2 + 0.09, 0);
          g.add(sp);
          const home = new THREE.Matrix4().makeTranslation(w.home[0], w.size / 2, w.home[1]);
          g.matrix.copy(home);
          g.matrixWorldNeedsUpdate = true;
          world.add(g);
          const mk = new THREE.Mesh(
            new THREE.PlaneGeometry(w.size, w.size),
            new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
          );
          mk.rotation.x = -Math.PI / 2;
          mk.position.set(w.home[0], 0.004, -w.home[1]);
          world.add(mk);
          return { kg: w.kg, size: w.size, group: g, mesh, home, label: sp, mark: mk };
        });
  const raycaster = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  let downPos = null;
  dom.addEventListener('pointerdown', e => {
    downPos = [e.clientX, e.clientY];
  });
  dom.addEventListener('click', e => {
    if (!downPos || Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(
      weights.map(w => w.mesh),
      false
    )[0];
    if (hit) onWeightClick(hit.object.userData.kg);
  });
  // Seret balok di lantai (Sesi 16d): klik tanpa geser tetap memasang balok, geser >= 5 px memindahkan balok
  let wDrag = null;
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hitP = new THREE.Vector3();
  const rayAt = e => {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  dom.addEventListener('pointerdown', e => {
    if (TRAJ.playing) return;
    rayAt(e);
    const hit = raycaster.intersectObjects(
      weights.map(w => w.mesh),
      false
    )[0];
    if (!hit) return;
    const kg = hit.object.userData.kg;
    if (attachedKg() === kg || placedWeights[kg]) return; // hanya balok yang ada di lantai
    wDrag = { kg, sx: e.clientX, sy: e.clientY, moved: false };
  });
  dom.addEventListener('pointermove', e => {
    if (!wDrag) return;
    if (!wDrag.moved && Math.hypot(e.clientX - wDrag.sx, e.clientY - wDrag.sy) < 5) return;
    wDrag.moved = true;
    dom.style.cursor = 'grabbing';
    rayAt(e);
    if (!raycaster.ray.intersectPlane(floorPlane, hitP)) return;
    const p = world.worldToLocal(hitP.clone());
    moveWeightHome(wDrag.kg, p.x, p.z);
  });
  const endDrag = () => {
    if (wDrag && wDrag.moved) dom.style.cursor = '';
    wDrag = null;
  };
  window.addEventListener('pointerup', endDrag);
  dom.addEventListener('pointercancel', endDrag);

  // Meteran metrik (meter) pada lantai dan vertikal
  const rulers = new THREE.Group();
  world.add(rulers);
  const tickLabel = (text, color, pos) => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const x = c.getContext('2d');
    x.font = 'bold 26px Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = color;
    x.fillText(text, 64, 26);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
    );
    sp.scale.set(0.11, 0.041, 1);
    sp.position.copy(pos);
    sp.renderOrder = 9;
    rulers.add(sp);
  };
  const addRuler = (o, dir, tick, t0, t1, css, hex, off) => {
    const P = t => o.clone().addScaledVector(dir, t),
      pts = [P(t0), P(t1)];
    for (let k = Math.ceil(t0 * 10 - 1e-6); k <= Math.floor(t1 * 10 + 1e-6); k++) {
      const t = k / 10,
        len = k % 5 === 0 ? 0.02 : 0.01,
        a = P(t);
      pts.push(a.clone().addScaledVector(tick, -len), a.clone().addScaledVector(tick, len));
      if (k % 2 === 0 && k !== 0) tickLabel(t.toFixed(1) + ' m', css, P(t).add(off));
    }
    rulers.add(
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: hex }))
    );
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  addRuler(V(0, 0.002, 0), V(1, 0, 0), V(0, 0, 1), 0, 1.0, '#e07a6c', 0xc9605a, V(0, 0, 0.06));
  addRuler(V(0, 0.002, 0), V(0, 0, -1), V(1, 0, 0), -0.8, 0.8, '#7fc47a', 0x6fae6a, V(-0.07, 0, 0)); // sumbu y base
  addRuler(V(-0.25, 0, 0), V(0, 1, 0), V(1, 0, 0), 0, 0.8, '#6aa5e8', 0x4d8fd1, V(-0.08, 0, 0)); // sumbu z base (tinggi)

  const targetMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff4d4d })
  );
  targetMarker.visible = false;
  world.add(targetMarker);
  const targetLabel = makeCoordLabel();
  targetLabel.visible = false;
  world.add(targetLabel);
  const pathLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.001, 0)]),
    new THREE.LineDashedMaterial({ color: 0xff4d4d, dashSize: 0.02, gapSize: 0.015 })
  );
  pathLine.visible = false;
  world.add(pathLine);

  function setView(az, el, r) {
    azimuth = az;
    elevation = el;
    if (r) radius = r;
    updateCam();
  }
  function setTarget(v, rm, r) {
    camT.copy(v);
    rMin = rm || 2;
    radius = Math.max(rMin, r || radius);
    updateCam();
  }
  const inst = {
    setPart: (i, p) => partGroups[i] && fillPart(partGroups[i], p),
    scene,
    world,
    camera,
    renderer,
    setView,
    setTarget,
    getView: () => [azimuth, elevation, radius],
    ground,
    mats: [matLight, matDark],
    partGroups,
    axesHelpers,
    gridHelper: grid.gridHelper,
    ghostLine,
    weights,
    rulers,
    targetMarker,
    targetLabel,
    pathLine
  };
  if (!(opts && opts.parts)) ROBOT_SCENES.push(inst);
  return inst;
}

const fkScene = makeRobotScene('ch-fk', 'sfk');
const ikScene = makeRobotScene('ch-ik', 'sik');

function poseScene6(inst, thOvr) {
  const frames = computeChain6(thOvr);
  const positions = frames.map(f => new THREE.Vector3(0, 0, 0).applyMatrix4(f));
  inst.partGroups.forEach((g, i) => {
    g.matrix.copy(frames[i]);
    g.matrixWorldNeedsUpdate = true;
  });
  inst.axesHelpers.forEach((a, i) => {
    a.matrix.copy(frames[i + 1]);
    a.matrixWorldNeedsUpdate = true;
  });
  updateWeights(inst, frames);
  if (inst.onPose) inst.onPose(frames); // menu Draw: overlay Axis Draw ikut pose
  return { frames, positions };
}

// m = T60 frame base DH (Z ke atas); baris terakhir menjelaskan hubungannya dengan angka x,y,z di layar
function formatMatrix6(m) {
  const e = m.elements;
  const rows = [];
  for (let r = 0; r < 4; r++) {
    let row = [];
    for (let c = 0; c < 4; c++) row.push(e[c * 4 + r].toFixed(3).padStart(7, ' '));
    rows.push('[ ' + row.join(' ') + ' ]');
  }
  return 'T60, frame base (Z ke atas) =\n' + rows.join('\n') + '\nkolom terakhir = posisi end-effector x, y, z';
}
function updateGhost6(inst) {
  const f = computeChain6(homePose);
  const pts = f.map(fr => new THREE.Vector3(0, 0, 0).applyMatrix4(fr));
  inst.ghostLine.geometry.setFromPoints(pts);
  inst.ghostLine.geometry.attributes.position.needsUpdate = true;
}
function refreshGhosts6() {
  updateGhost6(fkScene);
  updateGhost6(ikScene);
}
function fillJointXyz(tbodyId, positions) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  const labels = ['base', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6 (EE)'];
  positions.map(toUser).forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="jn">${labels[i]}</td><td>${p.x.toFixed(3)}</td><td>${p.y.toFixed(3)}</td><td>${p.z.toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ============ FK VIEW WIRING ============ */
const fkView = document.getElementById('view-v7');

function buildFKUi() {
  const dhBody = document.getElementById('dh-body-fk');
  dhBody.innerHTML = '';
  const thetaW = document.getElementById('theta-fk');
  thetaW.innerHTML = '';
  joints6.forEach((j, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="jname">q${i + 1}</td><td><input type="number" step="0.001" value="${j.a}" data-i="${i}" data-k="a"></td><td><input type="number" step="1" value="${j.alpha}" data-i="${i}" data-k="alpha"></td><td><input type="number" step="0.001" value="${j.d}" data-i="${i}" data-k="d"></td>`;
    dhBody.appendChild(tr);
    const row = document.createElement('div');
    row.className = 'theta-slider';
    const o = zzOff(i);
    row.innerHTML = `<span class="jl">q${i + 1}</span><input type="range" min="${j.thMin - o}" max="${j.thMax - o}" step="1" value="${j.theta - o}" data-i="${i}"><span class="jv" id="fkthv${i}">${(j.theta - o).toFixed(0)}°</span>`;
    thetaW.appendChild(row);
  });
  dhBody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      joints6[+inp.dataset.i][inp.dataset.k] = parseFloat(inp.value) || 0;
      updateFK6();
      updateIKScene6();
      refreshGhosts6();
    });
  });
  thetaW.querySelectorAll('input[type=range]').forEach(sl => {
    sl.addEventListener('input', () => {
      const i = +sl.dataset.i;
      joints6[i].theta = parseFloat(sl.value) + zzOff(i);
      document.getElementById('fkthv' + i).textContent = sl.value + '°';
      updateFK6();
      if (!ZZ.locked) renderZeroZone();
    });
  });
}

function updateFK6() {
  const { positions } = poseScene6(fkScene);
  const ee = positions[positions.length - 1];
  const u = toUser(ee);
  fkView.querySelector('.ex').textContent = u.x.toFixed(3);
  fkView.querySelector('.ey').textContent = u.y.toFixed(3);
  fkView.querySelector('.ez').textContent = u.z.toFixed(3);
  fkView.querySelector('.matrixOut').textContent = formatMatrix6(T60dh());
  fillJointXyz('jxyz-fk', positions);
}
function updateIKScene6() {
  const { positions } = poseScene6(ikScene);
  fillJointXyz('jxyz-ik', positions);
}
buildFKUi();
updateFK6();
refreshGhosts6();

fkView.querySelector('.resetBtn[data-t="fk"]').addEventListener('click', () => {
  joints6 = JSON.parse(JSON.stringify(defaultDH));
  buildFKUi();
  updateFK6();
  buildIKTheta();
  updateIKScene6();
});
fkView
  .querySelector('.homeBtn[data-t="fk"]')
  .addEventListener('click', () => zzSetPose(ZZ.locked ? ZZ.q0 : [0, 0, 0, 0, 0, 0]));
fkView.querySelector('.showAxes[data-t="fk"]').addEventListener('change', e => {
  fkScene.axesHelpers.forEach(a => (a.visible = e.target.checked));
});

/* ============ IK VIEW WIRING ============ */
const ikView = document.getElementById('view-v8');
function buildIKTheta() {
  const tw = document.getElementById('theta-ik');
  tw.innerHTML = '';
  joints6.forEach((j, i) => {
    const row = document.createElement('div');
    row.className = 'theta-slider';
    const o = zzOff(i);
    row.innerHTML = `<span class="jl">q${i + 1}</span><input type="range" min="${j.thMin - o}" max="${j.thMax - o}" step="1" value="${j.theta - o}" data-i="${i}"><span class="jv" id="ikthv${i}">${(j.theta - o).toFixed(0)}°</span>`;
    tw.appendChild(row);
  });
  tw.querySelectorAll('input[type=range]').forEach(sl => {
    sl.addEventListener('input', () => {
      const i = +sl.dataset.i;
      joints6[i].theta = parseFloat(sl.value) + zzOff(i);
      document.getElementById('ikthv' + i).textContent = sl.value + '°';
      updateIKReadout();
      if (!ZZ.locked) renderZeroZone();
    });
  });
}
function updateIKReadout() {
  const { positions } = poseScene6(ikScene);
  const ee = positions[positions.length - 1];
  const u = toUser(ee);
  ikView.querySelector('.ex').textContent = u.x.toFixed(3);
  ikView.querySelector('.ey').textContent = u.y.toFixed(3);
  ikView.querySelector('.ez').textContent = u.z.toFixed(3);
  fillJointXyz('jxyz-ik', positions);
}
buildIKTheta();
updateIKReadout();
refreshGhosts6();

ikView.querySelector('.resetBtn[data-t="ik"]').addEventListener('click', () => {
  joints6 = JSON.parse(JSON.stringify(defaultDH));
  buildFKUi();
  updateFK6();
  buildIKTheta();
  updateIKReadout();
});
ikView
  .querySelector('.homeBtn[data-t="ik"]')
  .addEventListener('click', () => zzSetPose(ZZ.locked ? ZZ.q0 : [0, 0, 0, 0, 0, 0]));
ikView.querySelector('.showAxes[data-t="ik"]').addEventListener('change', e => {
  ikScene.axesHelpers.forEach(a => (a.visible = e.target.checked));
});

/* ============ IK SOLVER ============ */
function invert3x3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h,
    B = -(d * i - f * g),
    C = d * h - e * g,
    D = -(b * i - c * h),
    E = a * i - c * g,
    F = -(a * h - b * g),
    G = b * f - c * e,
    H = -(a * f - c * d),
    I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-24) return null;
  const inv = 1 / det;
  return [
    [A * inv, D * inv, G * inv],
    [B * inv, E * inv, H * inv],
    [C * inv, F * inv, I * inv]
  ];
}
function mat3VecMul(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
  ];
}
const IK_LAMBDA = 0.015;
function solveIK6(target, startThetas) {
  let thetas = (startThetas || joints6.map(j => j.theta)).slice();
  const lambda = IK_LAMBDA;
  let finalErr = 999;
  for (let iter = 0; iter < 300; iter++) {
    const ee = eeFromThetas6(thetas);
    const err = [target.x - ee.x, target.y - ee.y, target.z - ee.z];
    finalErr = Math.hypot(err[0], err[1], err[2]);
    if (finalErr < 0.001) break;
    const dtheta = 0.5;
    const J = [];
    for (let i = 0; i < 6; i++) {
      const t2 = thetas.slice();
      t2[i] += dtheta;
      const ee2 = eeFromThetas6(t2);
      J.push([(ee2.x - ee.x) / dtheta, (ee2.y - ee.y) / dtheta, (ee2.z - ee.z) / dtheta]);
    }
    const JJt = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 6; i++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) JJt[r][c] += J[i][r] * J[i][c];
    for (let r = 0; r < 3; r++) JJt[r][r] += lambda * lambda;
    const inv = invert3x3(JJt);
    if (!inv) break;
    const y = mat3VecMul(inv, err);
    for (let i = 0; i < 6; i++) {
      thetas[i] += J[i][0] * y[0] + J[i][1] * y[1] + J[i][2] * y[2];
      thetas[i] = Math.max(joints6[i].thMin, Math.min(joints6[i].thMax, thetas[i]));
    }
  }
  return { thetas, err: finalErr };
}

document.getElementById('solveBtn').addEventListener('click', () => {
  if (!ZZ.locked) {
    const st = document.getElementById('ikStatus');
    st.className = 'status warn';
    st.textContent = 'Kunci 0 Zone dulu: tentukan pose awal robot, lalu tekan Kunci 0 Zone.';
    return;
  }
  const target = targetFromInputs();
  if (document.getElementById('ik-animate').checked) {
    ikAnimate(target);
    return;
  }
  const maxReach = joints6.reduce((s, j) => s + Math.abs(j.d) + Math.abs(j.a), 0.05);
  const startFromHome = document.querySelector('input[name="ikStart"]:checked').value === 'home';
  const startThetas = startFromHome ? homePose.slice() : joints6.map(j => j.theta);
  const result = solveIK6(target, startThetas);
  REP.ik = { method: 'dls3', at: new Date().toISOString(), start: startThetas.slice(), target: userTargetInputs() }; // untuk laporan IK
  joints6.forEach((j, i) => (j.theta = result.thetas[i]));
  buildIKTheta();
  updateIKReadout();
  buildFKUi();
  updateFK6();
  const statusEl = document.getElementById('ikStatus');
  if (result.err < 0.003) {
    statusEl.className = 'status ok';
    statusEl.textContent = `Konvergen, error ${(result.err * 1000).toFixed(2)} mm.`;
  } else if (Math.hypot(target.x, target.y, target.z) > maxReach) {
    statusEl.className = 'status warn';
    statusEl.textContent = `Mungkin di luar jangkauan (reach maks ~${maxReach.toFixed(2)} m). Error ${(result.err * 1000).toFixed(1)} mm.`;
  } else {
    statusEl.className = 'status warn';
    statusEl.textContent = `Belum konvergen, error ${(result.err * 1000).toFixed(1)} mm. Coba klik lagi atau ubah target.`;
  }
});
