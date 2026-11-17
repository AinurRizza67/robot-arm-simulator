/* 03a_model_library.js
   Robot model library: built-in arms (JAKA ZU5 with its STEP meshes, Universal Robots UR3e, UR5e, UR10e) and
   user models added in the Add Model page. A model is a 6-joint Standard DH table (a [m], alpha [deg], d [m],
   joint limits [deg]), a ready pose, a total mass, and optional meshes per link.
   The active model is chosen before the scenes are built, so every simulation page uses it. Models without
   meshes get a body generated from their DH parameters; uploaded meshes (STL or OBJ, one file per link, expressed
   in that link's DH frame) are kept in IndexedDB and swapped in as soon as they are loaded.
   Classic script: all files share one global scope and are loaded in order by index.html. */

const MODEL_STORE_KEY = 'rasModels';
const MODEL_ACTIVE_KEY = 'rasActiveModel';
const MODEL_DB = 'ras-model-meshes';

const dhRows = (rows, lim) =>
  rows.map(([a, alpha, d], i) => ({ a, alpha, d, theta: 0, thMin: lim[i][0], thMax: lim[i][1] }));
const LIM_360 = Array(6).fill([-360, 360]);

const BUILTIN_MODELS = [
  {
    id: 'jaka-zu5',
    name: 'JAKA ZU5',
    maker: 'JAKA Robotics',
    builtin: true,
    mesh: 'zu5',
    totalMass: 23,
    ready: [0, 90, -90, 90, 90, 0],
    // measured on the official STEP model, matches the official JAKA URDF
    dh: dhRows(
      [
        [0, 90, 0.1201],
        [0.43, 0, -0.1441],
        [0.3685, 0, 0.1436],
        [0, 90, -0.1135],
        [0, 90, 0.1135],
        [0, 180, -0.107]
      ],
      Array(6).fill([-180, 180])
    ),
    realRobot: true
  },
  {
    id: 'ur3e',
    name: 'UR3e',
    maker: 'Universal Robots',
    builtin: true,
    mesh: 'generated',
    totalMass: 11.2,
    ready: [0, -90, 90, -90, -90, 0],
    dh: dhRows(
      [
        [0, 90, 0.15185],
        [-0.24355, 0, 0],
        [-0.2132, 0, 0],
        [0, 90, 0.13105],
        [0, -90, 0.08535],
        [0, 0, 0.0921]
      ],
      LIM_360
    )
  },
  {
    id: 'ur5e',
    name: 'UR5e',
    maker: 'Universal Robots',
    builtin: true,
    mesh: 'generated',
    totalMass: 20.6,
    ready: [0, -90, 90, -90, -90, 0],
    dh: dhRows(
      [
        [0, 90, 0.1625],
        [-0.425, 0, 0],
        [-0.3922, 0, 0],
        [0, 90, 0.1333],
        [0, -90, 0.0997],
        [0, 0, 0.0996]
      ],
      LIM_360
    )
  },
  {
    id: 'ur10e',
    name: 'UR10e',
    maker: 'Universal Robots',
    builtin: true,
    mesh: 'generated',
    totalMass: 33.5,
    ready: [0, -90, 90, -90, -90, 0],
    dh: dhRows(
      [
        [0, 90, 0.1807],
        [-0.6127, 0, 0],
        [-0.57155, 0, 0],
        [0, 90, 0.17415],
        [0, -90, 0.11985],
        [0, 0, 0.11655]
      ],
      LIM_360
    )
  }
];

function loadUserModels() {
  try {
    const list = JSON.parse(localStorage.getItem(MODEL_STORE_KEY) || '[]');
    return Array.isArray(list) ? list.filter(m => m && m.id && Array.isArray(m.dh) && m.dh.length === 6) : [];
  } catch (e) {
    return [];
  }
}
function saveUserModels(list) {
  localStorage.setItem(MODEL_STORE_KEY, JSON.stringify(list));
}
function allModels() {
  return BUILTIN_MODELS.concat(loadUserModels());
}
function findModel(id) {
  return allModels().find(m => m.id === id) || null;
}
function activeModelId() {
  try {
    return localStorage.getItem(MODEL_ACTIVE_KEY) || BUILTIN_MODELS[0].id;
  } catch (e) {
    return BUILTIN_MODELS[0].id;
  }
}
const ACTIVE_MODEL = findModel(activeModelId()) || BUILTIN_MODELS[0];
const ACTIVE_IS_ZU5 = ACTIVE_MODEL.mesh === 'zu5';

// rough reach of a model, used to size generated bodies and to label the model cards
function modelReach(m) {
  return m.dh.reduce((s, j) => s + Math.abs(j.a) + Math.abs(j.d), 0);
}

/* ---------- generated body from DH (frame i holds the link that follows joint i) ---------- */
function capsuleBetween(p, q, r) {
  const len = p.distanceTo(q);
  if (len < 1e-5) return null;
  const g = new THREE.CylinderGeometry(r, r, len, 24, 1, false);
  g.translate(0, len / 2, 0);
  const m = new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize())
  );
  m.setPosition(p);
  g.applyMatrix4(m);
  return g;
}
function housingAlongZ(r, h, z0) {
  const g = new THREE.CylinderGeometry(r, r, h, 32);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0 || 0);
  return g;
}
function generatedParts(dh) {
  const reach = Math.max(
    0.3,
    dh.reduce((s, j) => s + Math.abs(j.a) + Math.abs(j.d), 0)
  );
  const r = Math.min(0.065, Math.max(0.028, reach * 0.045));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const parts = [];
  for (let i = 0; i <= 6; i++) {
    const geos = [],
      dark = [];
    const rr = i >= 4 ? r * 0.8 : r;
    if (i === 0) {
      geos.push(capsuleBetween(V(0, 0, 0), V(0, 0, Math.max(0.02, dh[0].d - rr)), r * 1.25));
    } else {
      // the a offset of joint i lies along -x of frame i, ending at the frame origin
      if (Math.abs(dh[i - 1].a) > 1e-6) geos.push(capsuleBetween(V(-dh[i - 1].a, 0, 0), V(0, 0, 0), rr * 0.9));
    }
    if (i < 6) {
      // housing of the next joint axis (z of frame i) and the d offset of the next joint along it
      dark.push(housingAlongZ(rr * 1.18, rr * 2.4, 0));
      if (i > 0 && Math.abs(dh[i].d) > 1e-6) geos.push(capsuleBetween(V(0, 0, 0), V(0, 0, dh[i].d), rr * 0.9));
    } else {
      dark.push(housingAlongZ(rr * 1.05, 0.016, -0.008));
    }
    const solids = [];
    geos.filter(Boolean).forEach(g => solids.push({ dark: false, geometry: g.toNonIndexed() }));
    dark.filter(Boolean).forEach(g => solids.push({ dark: true, geometry: g.toNonIndexed() }));
    parts.push({ link: i, solids });
  }
  return parts;
}

// Parts used by the robot scenes: STEP meshes for the ZU5, generated bodies otherwise.
// Uploaded meshes replace the generated parts once IndexedDB has returned them (modelMeshesReady).
const ROBOT_PARTS = ACTIVE_IS_ZU5 ? ZU5_MESH.parts : generatedParts(ACTIVE_MODEL.dh);
const ROBOT_SCENES = [];

/* ---------- uploaded meshes (IndexedDB) ---------- */
function meshDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(MODEL_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('meshes');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function meshPut(key, value) {
  const db = await meshDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meshes', 'readwrite');
    tx.objectStore('meshes').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function meshGet(key) {
  const db = await meshDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('meshes').objectStore('meshes').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function meshDeleteModel(id) {
  const db = await meshDb();
  return new Promise(resolve => {
    const tx = db.transaction('meshes', 'readwrite');
    for (let i = 0; i <= 6; i++) tx.objectStore('meshes').delete(id + ':' + i);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

// STL (binary or ASCII) and OBJ (vertices and faces) to a non-indexed BufferGeometry in metres
function parseMeshFile(name, buffer, scale) {
  const lower = name.toLowerCase();
  let pos = [];
  if (lower.endsWith('.stl')) {
    const dv = new DataView(buffer);
    const n = buffer.byteLength >= 84 ? dv.getUint32(80, true) : 0;
    if (buffer.byteLength === 84 + n * 50) {
      for (let t = 0; t < n; t++) {
        const o = 84 + t * 50 + 12;
        for (let k = 0; k < 9; k++) pos.push(dv.getFloat32(o + k * 4, true));
      }
    } else {
      const text = new TextDecoder().decode(buffer);
      const re = /vertex\s+([-+.\deE]+)\s+([-+.\deE]+)\s+([-+.\deE]+)/g;
      let m;
      while ((m = re.exec(text))) pos.push(+m[1], +m[2], +m[3]);
    }
  } else if (lower.endsWith('.obj')) {
    const v = [];
    new TextDecoder()
      .decode(buffer)
      .split(/\r?\n/)
      .forEach(line => {
        const p = line.trim().split(/\s+/);
        if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
        else if (p[0] === 'f') {
          const idx = p.slice(1).map(s => {
            const k = parseInt(s.split('/')[0], 10);
            return k < 0 ? v.length + k : k - 1;
          });
          for (let k = 1; k + 1 < idx.length; k++) [idx[0], idx[k], idx[k + 1]].forEach(j => pos.push(...v[j]));
        }
      });
  } else throw new Error('unsupported mesh format: ' + name);
  if (!pos.length) throw new Error('no triangles found in ' + name);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      pos.map(x => x * scale),
      3
    )
  );
  g.computeVertexNormals();
  return g;
}

// Load the active model's uploaded meshes and swap them into every robot scene.
async function modelMeshesReady() {
  if (ACTIVE_MODEL.mesh !== 'uploaded') return;
  for (let i = 0; i <= 6; i++) {
    let rec = null;
    try {
      rec = await meshGet(ACTIVE_MODEL.id + ':' + i);
    } catch (e) {
      return;
    }
    if (!rec) continue;
    try {
      const geo = parseMeshFile(rec.name, rec.buffer, rec.scale || 1);
      ROBOT_PARTS[i] = { link: i, solids: [{ dark: false, geometry: geo }] };
      ROBOT_SCENES.forEach(inst => inst.setPart && inst.setPart(i, ROBOT_PARTS[i]));
    } catch (e) {
      if (typeof toast === 'function') toast(e.message);
    }
  }
}
