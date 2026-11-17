/* 20_model_manager.js
   Robot Models page (#models): list of built-in and user models, switch the active model, duplicate, export,
   delete, and a form to add a model from its DH table with optional STL/OBJ meshes per link.
   Switching the active model reloads the app, because the scenes are built from the active model at start.
   Classic script: all files share one global scope and are loaded in order by index.html. */

const MODEL_UI = { editing: null };

function mmT(id, en) {
  return iconLang() === 'en' ? en : id;
}
function modelMeshLabel(m) {
  return m.mesh === 'zu5'
    ? 'STEP mesh'
    : m.mesh === 'uploaded'
      ? mmT('Mesh unggahan', 'Uploaded mesh')
      : mmT('Tubuh dari DH', 'Body from DH');
}

function renderModelList() {
  const list = document.getElementById('model-list');
  if (!list) return;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  list.innerHTML =
    allModels()
      .map(m => {
        const active = m.id === ACTIVE_MODEL.id;
        return (
          '<article class="model-card' +
          (active ? ' active' : '') +
          '" data-id="' +
          esc(m.id) +
          '"><div class="mc-head"><span class="mc-ico">' +
          iconSvg(m.mesh === 'zu5' ? 'robot' : 'cube') +
          '</span><div><b>' +
          esc(m.name) +
          '</b><span>' +
          esc(m.maker || mmT('Model pengguna', 'User model')) +
          '</span></div>' +
          (active ? '<em class="mc-badge">' + mmT('Aktif', 'Active') + '</em>' : '') +
          '</div><dl class="mc-facts"><div><dt>DOF</dt><dd>6</dd></div><div><dt>' +
          mmT('Jangkauan', 'Reach') +
          '</dt><dd>' +
          modelReach(m).toFixed(2) +
          ' m</dd></div><div><dt>' +
          mmT('Massa', 'Mass') +
          '</dt><dd>' +
          (+m.totalMass || 0).toFixed(1) +
          ' kg</dd></div><div><dt>Mesh</dt><dd>' +
          modelMeshLabel(m) +
          '</dd></div></dl><div class="mc-actions">' +
          (active
            ? ''
            : '<button type="button" data-act="use">' + mmT('Gunakan model ini', 'Use this model') + '</button>') +
          '<button type="button" data-act="dup">' +
          mmT('Duplikat untuk diedit', 'Duplicate to edit') +
          '</button><button type="button" data-act="export">' +
          mmT('Ekspor JSON', 'Export JSON') +
          '</button>' +
          (m.builtin
            ? ''
            : '<button type="button" data-act="edit">' +
              mmT('Edit model', 'Edit model') +
              '</button><button type="button" data-act="del">' +
              mmT('Hapus model', 'Delete model') +
              '</button>') +
          '</div></article>'
        );
      })
      .join('') +
    '<button type="button" class="model-add" id="model-add">' +
    mmT('Tambah model', 'Add model') +
    '</button>';
}

function modelAction(id, act) {
  const m = findModel(id);
  if (!m) return;
  if (act === 'use') {
    localStorage.setItem(MODEL_ACTIVE_KEY, id);
    location.hash = '#jaka-fk';
    location.reload();
  } else if (act === 'dup') {
    openModelForm(
      Object.assign(JSON.parse(JSON.stringify(m)), {
        id: null,
        builtin: false,
        name: m.name + ' (copy)',
        mesh: m.mesh === 'zu5' ? 'generated' : m.mesh
      })
    );
  } else if (act === 'edit') {
    openModelForm(JSON.parse(JSON.stringify(m)));
  } else if (act === 'export') {
    const data = { name: m.name, maker: m.maker, totalMass: m.totalMass, ready: m.ready, dh: m.dh };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = m.name.replace(/[^\w.-]+/g, '_') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } else if (act === 'del') {
    if (!window.confirm(mmT('Hapus model ', 'Delete model ') + m.name + '?')) return;
    saveUserModels(loadUserModels().filter(x => x.id !== id));
    meshDeleteModel(id).catch(() => {});
    if (id === ACTIVE_MODEL.id) {
      localStorage.removeItem(MODEL_ACTIVE_KEY);
      location.reload();
    } else renderModelList();
  }
}

/* ---------- add / edit form ---------- */
const LINK_NAMES = ['Base', 'Link 1', 'Link 2', 'Link 3', 'Link 4', 'Link 5', 'Link 6'];

function openModelForm(m) {
  const blank = {
    id: null,
    name: '',
    maker: '',
    totalMass: 20,
    ready: [0, 0, 0, 0, 0, 0],
    dh: Array.from({ length: 6 }, () => ({ a: 0, alpha: 0, d: 0, theta: 0, thMin: -360, thMax: 360 })),
    mesh: 'generated'
  };
  m = m || blank;
  MODEL_UI.editing = m;
  const f = document.getElementById('model-form');
  f.hidden = false;
  f.querySelector('[name=name]').value = m.name;
  f.querySelector('[name=maker]').value = m.maker || '';
  f.querySelector('[name=mass]').value = m.totalMass;
  const body = f.querySelector('#mf-dh tbody');
  body.innerHTML = m.dh
    .map(
      (j, i) =>
        '<tr><td>' +
        (i + 1) +
        '</td>' +
        ['a', 'alpha', 'd', 'thMin', 'thMax']
          .map(
            k =>
              '<td><input type="number" step="any" data-i="' + i + '" data-k="' + k + '" value="' + j[k] + '" /></td>'
          )
          .join('') +
        '<td><input type="number" step="any" data-i="' +
        i +
        '" data-k="ready" value="' +
        (m.ready[i] || 0) +
        '" /></td></tr>'
    )
    .join('');
  f.querySelector('#mf-mesh').innerHTML = LINK_NAMES.map(
    (n, i) =>
      '<label class="mf-file"><span>' +
      n +
      '</span><input type="file" accept=".stl,.obj" data-link="' +
      i +
      '" /></label>'
  ).join('');
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function readModelForm() {
  const f = document.getElementById('model-form');
  const num = el => {
    const v = parseFloat(el.value);
    if (!isFinite(v)) throw new Error(mmT('Isi semua angka pada tabel DH', 'Fill every number in the DH table'));
    return v;
  };
  const name = f.querySelector('[name=name]').value.trim();
  if (!name) throw new Error(mmT('Nama model belum diisi', 'The model name is empty'));
  const dh = Array.from({ length: 6 }, () => ({ theta: 0 }));
  const ready = [0, 0, 0, 0, 0, 0];
  f.querySelectorAll('#mf-dh input').forEach(inp => {
    const i = +inp.dataset.i,
      k = inp.dataset.k;
    if (k === 'ready') ready[i] = num(inp);
    else dh[i][k] = num(inp);
  });
  dh.forEach((j, i) => {
    if (j.thMin >= j.thMax)
      throw new Error(mmT('Batas sendi ' + (i + 1) + ' tidak valid', 'Joint ' + (i + 1) + ' limits are not valid'));
  });
  return {
    name,
    maker: f.querySelector('[name=maker]').value.trim(),
    totalMass: num(f.querySelector('[name=mass]')),
    dh,
    ready
  };
}

async function saveModelForm() {
  let data;
  try {
    data = readModelForm();
  } catch (e) {
    toast(e.message);
    return;
  }
  const f = document.getElementById('model-form');
  const old = MODEL_UI.editing || {};
  const id = old.id || 'user-' + Date.now().toString(36);
  const scale = parseFloat(f.querySelector('[name=unit]').value) || 1;
  const files = [...f.querySelectorAll('#mf-mesh input[type=file]')].filter(inp => inp.files && inp.files[0]);
  let mesh = old.mesh === 'uploaded' ? 'uploaded' : 'generated';
  try {
    for (const inp of files) {
      const file = inp.files[0];
      const buffer = await file.arrayBuffer();
      parseMeshFile(file.name, buffer, scale); // validate before storing
      await meshPut(id + ':' + inp.dataset.link, { name: file.name, buffer, scale });
      mesh = 'uploaded';
    }
  } catch (e) {
    toast(e.message);
    return;
  }
  const list = loadUserModels().filter(x => x.id !== id);
  list.push(Object.assign({ id, mesh, builtin: false }, data));
  saveUserModels(list);
  f.hidden = true;
  MODEL_UI.editing = null;
  renderModelList();
  toast(mmT('Model tersimpan: ', 'Model saved: ') + data.name);
}

function importModelJson(file) {
  file.text().then(t => {
    try {
      const m = JSON.parse(t);
      if (!Array.isArray(m.dh) || m.dh.length !== 6) throw new Error('dh');
      openModelForm({
        id: null,
        name: m.name || file.name.replace(/\.json$/i, ''),
        maker: m.maker || '',
        totalMass: +m.totalMass || 20,
        ready: Array.isArray(m.ready) ? m.ready : [0, 0, 0, 0, 0, 0],
        dh: m.dh.map(j => ({
          a: +j.a || 0,
          alpha: +j.alpha || 0,
          d: +j.d || 0,
          theta: 0,
          thMin: j.thMin ?? -360,
          thMax: j.thMax ?? 360
        })),
        mesh: 'generated'
      });
    } catch (e) {
      toast(mmT('Berkas JSON model tidak valid', 'The model JSON file is not valid'));
    }
  });
}

function modelManagerInit() {
  const page = document.getElementById('app-models');
  page.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const card = b.closest('.model-card');
    if (card && b.dataset.act) modelAction(card.dataset.id, b.dataset.act);
    else if (b.id === 'model-add') openModelForm(null);
    else if (b.id === 'mf-save') saveModelForm();
    else if (b.id === 'mf-cancel') {
      document.getElementById('model-form').hidden = true;
      MODEL_UI.editing = null;
    } else if (b.id === 'mf-import') document.getElementById('mf-import-file').click();
  });
  document.getElementById('mf-import-file').addEventListener('change', e => {
    if (e.target.files[0]) importModelJson(e.target.files[0]);
    e.target.value = '';
  });
  // active model card under the Simulation title
  const title = document.querySelector('#app-home .app-title');
  if (title && !document.getElementById('home-model')) {
    const m = ACTIVE_MODEL;
    const card = document.createElement('div');
    card.className = 'home-model';
    card.id = 'home-model';
    card.innerHTML =
      '<span class="hm-ico">' +
      iconSvg(m.mesh === 'zu5' ? 'robot' : 'cube') +
      '</span><div class="hm-name"><b>' +
      m.name +
      '</b><span>' +
      (m.maker || '') +
      '</span></div><dl><div><dt>DOF</dt><dd>6</dd></div><div><dt>Reach</dt><dd>' +
      modelReach(m).toFixed(2) +
      ' m</dd></div><div><dt>Mass</dt><dd>' +
      (+m.totalMass || 0).toFixed(1) +
      ' kg</dd></div></dl><button type="button" data-nav="#models">Ganti model</button>';
    title.insertAdjacentElement('afterend', card);
    card.querySelector('button').addEventListener('click', () => nav('#models'));
  }
  // the active model's name next to the Robot Arm Simulation page title
  const k = document.querySelector('#app-jaka .vs-kicker');
  if (k) k.textContent = 'Robot Arm Simulation · ' + ACTIVE_MODEL.name;
}
