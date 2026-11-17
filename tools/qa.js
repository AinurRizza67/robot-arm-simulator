const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const katexLib = require('katex');
const { loadHtml } = require('./load_html');
const { raw: raw0, root } = loadHtml();
let raw = raw0;
const three = fs.readFileSync(require('path').join(__dirname, 'node_modules/three/build/three.js'), 'utf8'),
  katexJs = fs.readFileSync(require('path').join(__dirname, 'node_modules/katex/dist/katex.min.js'), 'utf8'),
  mesh = fs.readFileSync(root + 'app/models/zu5_meshes.js', 'utf8');
const html = raw
  .replace(/<link[^>]*>/g, '')
  .replace(/<script src="https:[^>]*><\/script>/g, '')
  .replace('<script src="models/zu5_meshes.js"></script>', '');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e =>
  errors.push(String(e.detail && e.detail.stack ? e.detail.stack.split('\n').slice(0, 3).join(' | ') : e.message))
);
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
Object.defineProperty(w, 'localStorage', {
  configurable: true,
  value: {
    _d: {},
    getItem(k) {
      return k in this._d ? this._d[k] : null;
    },
    setItem(k, v) {
      this._d[k] = String(v);
    },
    removeItem(k) {
      delete this._d[k];
    }
  }
});
w.Element.prototype.scrollIntoView = function () {};
w.scrollTo = () => {};
w.confirm = () => true;
w.prompt = () => 'Preset QA';
w.alert = () => {};
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const results = [];
const T = (name, ok, info) => {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' | ' + info : ''));
};
const guard = (name, fn) => {
  try {
    const r = fn();
    if (r !== undefined) T(name, !!r);
  } catch (e) {
    T(name, false, e.message);
  }
};
let loadOk = true;
try {
  w.eval(scripts[0]);
} catch (e) {
  loadOk = false;
  console.log('script0', e.message);
}
try {
  w.eval(
    scripts[1] +
      ';window.__A={renderJacobian,renderTorque,renderIKLive,jacobian6,eeFromThetas6,setTheme,currentTheme,openDash,closeDash,dashRender,getMode:()=>torqueMode,totalTau,onWeightClick,attachedKg,J:()=>joints6,fkScene,ikScene,updateFK6,dashParams,motorParams,liveState,exportDashCSV,clearDash,resetEnergy,warnList,TRAJ,planPickPlace,trajApply,trajPlay,trajReset,activePayloadKg,robotMeta,placedWeights,ikAnimate,defaultDH,appSettings,nav,referenceEnabled,gotoReference,REFERENCE_MAP,VS,JK,ZZ,zzLock,zzUnlock,moveWeightHome,BD,bdValidate,bdConnect,bdResetFlow,bdSwapIkFk,bdSetpoint,toUser,BDLOOP,bdPlay,bdStop,bdCycleDone,BDU,bdUp,TUT,TUT_STEPS,tutFrame,tutNext,tutPrev,tutSkipSection,REP,rpSave,rpReset,rpAnswer,rpSnapshot,rpFK,rpTauG,rpSolveDLS3,rpCapture,rpTimeline,rpBuild,rpDoc,rpReport,rpShowDoc,planPickPlace,gravityTorque,solveIK6,zzLock,setPayloadMode,bdSwapIkFk,rpCodeGen,rpCodeCfg,rpCodeOpen,rpCodeClose,DRAW,AX,IKV,drBookRender,drAxis,drDh,drCine,drLeave,drMath,drIkRender,drApply,igSolve,igFK,igStructOk,igWrap,bdPop,bdPopOpen,gridObjs,READY_POSE,applyPose,CTL,CTL_TPL,CTL_LIM,ctlEnter,ctlState,ctlIkSolve,ctlEqOpen,ctlEqRender,ctlLoadTemplate,ctlTab,ctlFK,ctlIK,ctlPose,dashRefresh,ctlConnect,ctlJogUp,ctlFkPreview,ctlRun};' +
      // the app defaults to English; most checks read Indonesian texts, so the harness switches to Indonesian
      ";appSettings.lang='id';applyLang();"
  );
} catch (e) {
  loadOk = false;
  console.log('script1', e.message);
}
T('halaman dimuat tanpa exception', loadOk && errors.length === 0, errors.slice(0, 2).join(' ; '));
if (!loadOk) {
  process.exit(1);
}
const A = w.__A,
  tick = w.__ticks.find(f => String(f).includes('dashPush'));

// struktur
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
T('tidak ada id ganda', dup.length === 0, dup.slice(0, 4).join(','));
T(
  'v3.0: mode awal layar judul, dashboard utama 4 fitur (termasuk Model Robot), halaman Simulation 3 menu tanpa Settings, Beranda lama dihapus',
  d.body.dataset.mode === 'start' &&
    d.querySelectorAll('#dash-menu .dh-card').length === 4 &&
    d.querySelectorAll('#main-menu .app-card').length === 3 &&
    !d.querySelector('#main-menu [data-nav="#settings"]') &&
    !d.getElementById('view-v0')
);
T(
  'mode halaman lama sudah dihapus seluruhnya (tidak ada .wrap, tab, atau view lama)',
  !d.querySelector('.wrap') && !d.querySelector('.tab-btn') && !d.querySelector('.view')
);
T('tidak ada em dash di HTML', !raw.includes('\u2014'));
T('no em dash in README.md', !fs.readFileSync(root + 'README.md', 'utf8').includes('\u2014'));

// tema
guard('toggle tema dua arah tanpa error', () => {
  A.setTheme('light');
  const a = d.documentElement.getAttribute('data-theme') === 'light';
  A.setTheme('dark');
  return a && d.documentElement.getAttribute('data-theme') === 'dark';
});
guard('tema dari Settings: tombol Terang/Gelap mengganti tema dan tersimpan', () => {
  d.querySelector('#set-theme [data-v="light"]').click();
  const a =
    A.currentTheme() === 'light' &&
    w.localStorage.getItem('jakaSimTheme') === 'light' &&
    d.querySelector('#set-theme [data-v="light"]').classList.contains('on');
  d.querySelector('#set-theme [data-v="dark"]').click();
  return a && A.currentTheme() === 'dark';
});

// FK / konfigurasi
guard('scene FK dan IK punya 7 grup mesh, 3 balok, meteran, marka target', () =>
  [A.fkScene, A.ikScene].every(
    s => s.partGroups.length === 7 && s.weights.length === 3 && s.rulers.children.length > 0 && s.targetMarker
  )
);
guard('ubah DH di tab 09 mengubah posisi end-effector FK', () => {
  const before = d.querySelector('#view-v7 .ex').textContent;
  const inp = d.querySelector('#cfg-dh-body input[data-i="1"][data-k="a"]');
  inp.value = '0.5';
  inp.dispatchEvent(new w.Event('input'));
  A.updateFK6();
  const after = d.querySelector('#view-v7 .ex').textContent;
  d.getElementById('cfg-reset-btn').click();
  return before !== after && A.J()[1].a === A.defaultDH[1].a;
});
guard('reset konfigurasi mengembalikan DH default', () =>
  A.J().every((j, i) => j.a === A.defaultDH[i].a && j.d === A.defaultDH[i].d)
);
guard('simpan preset lewat modal nama (pengganti prompt, jalan di Electron)', () => {
  d.getElementById('cfg-save-preset-btn').click();
  const m = d.getElementById('lp-modal'),
    inp = d.getElementById('lp-in');
  const open = m.classList.contains('open') && !inp.hidden && inp.value.startsWith('JAKA');
  inp.value = 'Preset QA';
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const saved =
    !m.classList.contains('open') && 'Preset QA' in JSON.parse(w.localStorage.getItem('jakaZu5Presets') || '{}');
  return open && saved;
});
guard('tabel DH panduan sinkron (6 baris)', () => d.getElementById('pd-dh-body').children.length === 6);

// payload dan balok
guard('dropdown payload 3 kg memasang balok 3 kg', () => {
  const sel = d.getElementById('cfg-payload-select');
  sel.value = '3';
  sel.dispatchEvent(new w.Event('change'));
  return A.attachedKg() === 3 && A.activePayloadKg() === 3;
});
guard('klik balok 5 kg mengganti, klik lagi melepas', () => {
  A.onWeightClick(5);
  const a = A.attachedKg() === 5 && d.getElementById('cfg-payload-select').value === '5';
  A.onWeightClick(5);
  return a && A.attachedKg() === null && A.activePayloadKg() === 0;
});

// mode torsi dan energi
guard('mode torsi: gravitasi berbeda dari arus input', () => {
  const g = A.totalTau()
    .map(x => x.toFixed(2))
    .join();
  const s = d.getElementById('torque-mode');
  s.value = 'input';
  s.dispatchEvent(new w.Event('change'));
  const i = A.totalTau()
    .map(x => x.toFixed(2))
    .join();
  const modeOk = A.getMode() === 'input' && d.getElementById('torque-mode-ik').value === 'input';
  s.value = 'gravity';
  s.dispatchEvent(new w.Event('change'));
  return g !== i && modeOk && A.getMode() === 'gravity';
});
guard('sampling 10 Hz mengisi buffer dan dashboard', () => {
  A.clearDash();
  for (let k = 1; k <= 5; k++) {
    clock = k * 100;
    A.J()[1].theta = k * 5;
    tick();
  }
  A.openDash();
  A.dashRender();
  const ok =
    d.getElementById('dashModal').classList.contains('open') && d.getElementById('gv1').textContent !== '0.000';
  A.closeDash();
  return ok && !d.getElementById('dashModal').classList.contains('open');
});
guard('Esc menutup dashboard', () => {
  A.openDash();
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  return !d.getElementById('dashModal').classList.contains('open');
});
guard('export CSV tidak melempar error', () => {
  w.URL.createObjectURL = () => 'blob:x';
  w.URL.revokeObjectURL = () => {};
  A.exportDashCSV();
  return true;
});

// 0 Zone
guard('0 Zone: awalnya belum dikunci, Play dan Selesaikan IK nonaktif dan menolak jalan', () => {
  const off =
    !A.ZZ.locked &&
    d.getElementById('solveBtn').disabled &&
    d.getElementById('traj-play').disabled &&
    d.getElementById('traj-play-ik').disabled;
  A.TRAJ.plan = null;
  A.trajPlay();
  const noTraj = !A.TRAJ.playing && d.getElementById('traj-status').textContent.includes('0 Zone');
  return (
    off &&
    noTraj &&
    d.querySelectorAll('.zz-card').length === 3 &&
    d.querySelector('#zz-fk .zz-chip').textContent === 'Belum dikunci'
  );
});
guard('0 Zone: kunci menyimpan θ₀, slider jadi relatif (q = θ - θ₀), buka kunci kembali absolut', () => {
  A.J().forEach((j, i) => (j.theta = [10, 40, -70, 20, 15, 5][i]));
  A.zzLock();
  const q0ok = A.ZZ.locked && A.ZZ.q0.join() === '10,40,-70,20,15,5' && !d.getElementById('solveBtn').disabled;
  const sl = d.querySelector('#theta-fk input[data-i="1"]');
  const rel0 = +sl.value === 0;
  sl.value = '15';
  sl.dispatchEvent(new w.Event('input'));
  const abs = A.J()[1].theta === 55;
  A.nav('#jaka-ik');
  const ik = d.querySelector('#theta-ik input[data-i="1"]');
  const relIk = +ik.value === 15;
  A.nav('#jaka-fk');
  d.querySelector('#zz-ik [data-zz="return"]').click();
  const back = A.J()[1].theta === 40;
  d.querySelector('#zz-fk [data-zz="unlock"]').click();
  const absAgain =
    !A.ZZ.locked &&
    +d.querySelector('#theta-fk input[data-i="1"]').value === 40 &&
    d.getElementById('solveBtn').disabled;
  return q0ok && rel0 && abs && relIk && back && absAgain;
});
guard('0 Zone: trajectory berakhir di 0 Zone, matriks DH menulis θ = θ₀ + q', () => {
  A.J().forEach((j, i) => (j.theta = [0, 30, -60, 30, 0, 0][i]));
  A.zzLock();
  A.J().forEach((j, i) => (j.theta = [15, 35, -65, 30, 0, 0][i]));
  const p = A.planPickPlace(3),
    last = p.segs[p.segs.length - 1];
  const endOk = last.label === 'Kembali ke 0 Zone' && last.q1.every((v, i) => Math.abs(v - A.ZZ.q0[i]) < 1e-9);
  w.renderDHMatrices6('math-display-fk');
  const lbl = d.querySelector('#math-display-fk .matrix-label').textContent;
  return endOk && lbl.includes('θ₀') && lbl.includes('+ q');
});
A.J().forEach(j => (j.theta = 0));
A.zzLock(); // tes berikutnya menjalankan trajectory dan IK
// trajectory + IK
A.J().forEach(j => (j.theta = 0));
A.robotMeta.payloadMode = '0';
guard('trajectory pick and place 1/3/5 kg terencana dan aman', () =>
  [1, 3, 5].every(kg => {
    A.J().forEach(j => (j.theta = 0));
    A.TRAJ.kg = kg;
    const p = A.planPickPlace(kg);
    return p.segs.length === 9 && p.D > 5 && p.D < 30;
  })
);
guard('Play memulai dan Reset mengembalikan', () => {
  A.J().forEach(j => (j.theta = 0));
  A.TRAJ.plan = null;
  A.TRAJ.kg = 3;
  A.trajPlay();
  const started = A.TRAJ.playing && A.TRAJ.plan;
  A.trajReset(false);
  return started && !A.TRAJ.playing && A.J().every(j => Math.abs(j.theta) < 1e-9);
});
guard('IK animasi: tombol menjalankan rencana IK', () => {
  A.J().forEach(j => (j.theta = 0));
  d.getElementById('tx').value = '0.6';
  d.getElementById('ty').value = '-0.2';
  d.getElementById('tz').value = '0.35';
  A.TRAJ.plan = null;
  d.getElementById('solveBtn').click();
  return A.TRAJ.plan && A.TRAJ.plan.ik && A.TRAJ.playing;
});
guard('IK tanpa animasi (centang dimatikan) tetap menyelesaikan instan', () => {
  A.TRAJ.playing = false;
  A.TRAJ.plan = null;
  A.J().forEach(j => (j.theta = 0));
  d.getElementById('ik-animate').checked = false;
  d.getElementById('solveBtn').click();
  const moved = A.J().some(j => Math.abs(j.theta) > 1);
  d.getElementById('ik-animate').checked = true;
  return moved;
});

// peringatan
guard('peringatan: singularity di pose nol, bersih di pose ambil', () => {
  A.J().forEach(j => (j.theta = 0));
  const a = A.warnList().some(x => x.includes('singularity'));
  A.J().forEach((j, i) => (j.theta = [0, 47, -60, -77, -90, 0][i]));
  return a && A.warnList().length === 0;
});

// panduan
guard('semua data-goto di panduan punya target dan klik tidak error', () => {
  const gs = [...d.querySelectorAll('[data-goto]')];
  gs.forEach(a => a.click());
  return gs.length > 15 && gs.every(a => d.getElementById(a.dataset.goto));
});
let bad = 0,
  n = 0;
const seg = html.slice(html.indexOf('id="app-reference"'), html.indexOf('<div id="exit-modal"'));
for (const m of seg.matchAll(/\\\[([\s\S]*?)\\\]/g)) {
  n++;
  try {
    katexLib.renderToString(m[1].replace(/&amp;/g, '&'), { displayMode: true, throwOnError: true });
  } catch (e) {
    bad++;
  }
}
for (const m of seg.matchAll(/\\\(([\s\S]*?)\\\)/g)) {
  n++;
  try {
    katexLib.renderToString(m[1].replace(/&amp;/g, '&'), { throwOnError: true });
  } catch (e) {
    bad++;
  }
}
T('rumus halaman Rujukan valid (KaTeX ketat)', bad === 0 && n > 40, n + ' rumus');

// rumus live: validasi LaTeX ketat pada semua blok, dua mode torsi
w.katex.render = (tex, el, opts) => {
  katexLib.renderToString(tex, Object.assign({}, opts, { throwOnError: true }));
};
d.getElementById('acc-jac-fk').classList.add('open');
d.getElementById('acc-tau-fk').classList.add('open');
d.getElementById('acc-math-ik').classList.add('open');
guard('blok rumus Jacobian valid untuk kolom J1 sampai J6', () => {
  A.J().forEach((j, i) => (j.theta = [20, -35, 50, 10, -25, 40][i]));
  for (let c = 0; c < 6; c++) {
    d.getElementById('jac-col').value = String(c);
    A.renderJacobian();
  }
  return true;
});
guard('blok rumus torsi dan energi valid (mode gravitasi dan input)', () => {
  const s = d.getElementById('torque-mode');
  for (const m of ['gravity', 'input']) {
    s.value = m;
    s.dispatchEvent(new w.Event('change'));
    A.renderTorque();
  }
  s.value = 'gravity';
  s.dispatchEvent(new w.Event('change'));
  return true;
});
guard('blok rumus error IK valid', () => {
  A.renderIKLive();
  return true;
});
guard('navigasi: Vector Simulation ke halaman baru, JAKA ke pilihan 4 mode (FK/IK/Blok Diagram/Draw)', () => {
  const card = sel => d.querySelector('#main-menu [data-nav="' + sel + '"]');
  card('#vector').click();
  const v = d.body.dataset.mode === 'vector' && d.getElementById('view-v1').classList.contains('active');
  A.nav('#home');
  card('#jaka').click();
  const ch =
    d.getElementById('app-home').classList.contains('jaka') &&
    d.querySelectorAll('#jaka-choice .app-card').length === 4;
  const ok = [
    ['#jaka-fk', 'jaka', 'v7'],
    ['#jaka-ik', 'jaka', 'v8'],
    ['#jaka-bd', 'jaka', 'bd'],
    ['#jaka-draw', 'jaka', 'draw']
  ].every(([h, m, v]) => {
    A.nav('#jaka');
    d.querySelector('#jaka-choice [data-nav="' + h + '"]').click();
    return d.body.dataset.mode === m && d.getElementById('view-' + v).classList.contains('active');
  });
  A.nav('#home');
  return v && ch && ok && d.body.dataset.mode === 'home' && !d.getElementById('app-home').classList.contains('jaka');
});
guard('parameter robot (isi tab 09 lama) dan tabel K/N/i motor ada di upside bar Blok Diagram', () => {
  A.nav('#jaka-bd');
  d.querySelector('.bd-up-tabs [data-up="robot"]').click();
  const robot =
    !d.querySelector('.bd-up-panel[data-panel="robot"]').hidden &&
    d.querySelector('.bd-up-panel[data-panel="robot"] #cfg-dh-body');
  d.querySelector('.bd-up-tabs [data-up="energi"]').click();
  const motor = d.querySelector('.bd-up-panel[data-panel="energi"] #motor-body').children.length === 6;
  A.nav('#tab-v9');
  const redirect = d.body.dataset.mode === 'home';
  return robot && motor && redirect;
});
guard('Settings: Rujukan, Pengamat, dan Laporan tersimpan; Pengamat mematikan Rujukan', () => {
  A.nav('#settings');
  if (d.body.dataset.mode !== 'settings') return false;
  const sw = id => d.getElementById(id),
    st = () => JSON.parse(w.localStorage.getItem('jakaSimSettings') || '{}');
  sw('set-reference').click();
  const off = !A.appSettings.reference && st().reference === false;
  sw('set-reference').click();
  sw('set-observer').click();
  const pen =
    A.appSettings.observer &&
    st().observer === true &&
    !A.referenceEnabled() &&
    sw('set-reference').disabled &&
    sw('set-reference').getAttribute('aria-checked') === 'false' &&
    d.body.classList.contains('mode-observer');
  sw('set-observer').click();
  const back = A.referenceEnabled() && !sw('set-reference').disabled;
  sw('set-report').click();
  const lap1 = A.appSettings.report && st().report === true && d.body.classList.contains('mode-report');
  sw('set-report').click();
  const lap = lap1 && !A.appSettings.report && !d.body.classList.contains('mode-report');
  A.nav('#home');
  return off && pen && back && lap;
});
guard(
  'Mode Pengamat: rumus dan detail teknis tersembunyi di Vector dan JAKA, input tetap, hitungan tetap jalan',
  () => {
    const shown = el => !!el && !el.closest('.pg-hide');
    const eqs = [
      '#v1-eq',
      '#v2-eq',
      '#v3-eq',
      '#v4-eq',
      '#v5-eq',
      '#v1-quad-wrap',
      '#v1-magA',
      '#math-display-fk',
      '#jac-display-fk',
      '#math-display-ik',
      '#ik-live-display',
      '#jxyz-fk',
      '#jxyz-ik',
      '#dh-body-fk',
      '#bd-last'
    ].map(q => d.querySelector(q));
    const inputs = [
      '#v1-ax',
      '#v2-ang',
      '#v3-a',
      '#v4-th',
      '#dof-select',
      '#theta-fk',
      '#theta-ik',
      '#tx',
      '#solveBtn',
      '#traj-play',
      '#traj-play-ik',
      '#bd-play',
      '#zz-fk',
      '#zz-ik',
      '#zz-bd',
      '#bd-svg',
      '#ikStatus'
    ].map(q => d.querySelector(q));
    A.nav('#settings');
    d.getElementById('set-observer').click();
    const tagged =
      eqs.every(e => e && e.closest('.pg-hide')) &&
      eqs.every(e => w.getComputedStyle(e.closest('.pg-hide')).display === 'none');
    const keep = inputs.every(shown);
    const badge = w.getComputedStyle(d.querySelector('#app-vector .pg-badge')).display !== 'none';
    // hitungan tetap berjalan di balik layar
    A.nav('#vector-1');
    const ax = d.getElementById('v1-ax');
    ax.value = 0;
    ax.dispatchEvent(new w.Event('input'));
    const mag0 = d.getElementById('v1-magA').textContent;
    ax.value = 4;
    ax.dispatchEvent(new w.Event('input'));
    const calc = d.getElementById('v1-magA').textContent !== mag0;
    // Rujukan tertutup: tombol hilang, gotoReference dan rute #reference ditolak
    const refBtn = w.getComputedStyle(d.getElementById('vs-reference')).display === 'none';
    A.gotoReference('pd-ik');
    const noRj =
      d.body.dataset.mode === 'vector' && d.getElementById('app-toast').textContent.includes('Mode Pengamat');
    A.nav('#reference');
    const noRoute = d.body.dataset.mode === 'home';
    // Blok Diagram: hanya tab Parameter robot, dashboard energi tidak dibuka
    A.nav('#jaka-bd');
    A.bdUp(true, 'rumus');
    const up1 = A.BDU.tab === 'robot';
    A.bdUp(true, 'energi');
    const up2 = A.BDU.tab === 'robot' && !d.getElementById('dashModal').classList.contains('open');
    A.openDash();
    const dash = !d.getElementById('dashModal').classList.contains('open');
    d.querySelector('#bd-svg .bd-block[data-id="b3"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const blk = A.BD.sel === 'b3' && A.BDU.tab === 'robot';
    const tabs = ['rumus', 'energi', 'stream'].every(
      t => w.getComputedStyle(d.querySelector('.bd-up-tabs [data-up="' + t + '"]')).display === 'none'
    );
    A.bdUp(false);
    // mati lagi: semua kembali
    A.nav('#settings');
    d.getElementById('set-observer').click();
    const back =
      eqs.every(e => w.getComputedStyle(e.closest('.pg-hide')).display !== 'none') &&
      w.getComputedStyle(d.querySelector('#app-vector .pg-badge')).display === 'none';
    A.nav('#jaka-bd');
    A.bdUp(true, 'rumus');
    const up3 = A.BDU.tab === 'rumus';
    A.bdUp(false);
    A.nav('#home');
    console.log(
      '   tagged ' +
        tagged +
        ' keep ' +
        keep +
        ' badge ' +
        badge +
        ' calc ' +
        calc +
        ' rj ' +
        refBtn +
        noRj +
        noRoute +
        ' bd ' +
        up1 +
        up2 +
        dash +
        blk +
        tabs +
        ' back ' +
        back +
        up3
    );
    return (
      tagged && keep && badge && calc && refBtn && noRj && noRoute && up1 && up2 && dash && blk && tabs && back && up3
    );
  }
);
guard('tutorial: mulai dari Dashboard, pindah sendiri tiap 5 detik, tertahan saat hover, mencakup semua fungsi', () => {
  A.nav('#jaka-fk');
  A.nav('#home');
  d.getElementById('menu-tutorial').click();
  d.getElementById('tut-start-tour').click();
  const tut = d.getElementById('tut'),
    title = () => d.getElementById('tut-title').textContent;
  const start =
    A.TUT.on && !tut.hidden && d.body.dataset.mode === 'home' && A.TUT.i === 0 && title() === 'Vector Simulation';
  // 4,9 detik belum pindah; lewat 5 detik pindah ke langkah 2
  let t = 1000;
  A.tutFrame(t);
  for (let k = 0; k < 49; k++) {
    t += 100;
    A.tutFrame(t);
  }
  const still = A.TUT.i === 0;
  for (let k = 0; k < 3; k++) {
    t += 100;
    A.tutFrame(t);
  }
  const moved = A.TUT.i === 1;
  A.TUT.hover = true;
  for (let k = 0; k < 80; k++) {
    t += 100;
    A.tutFrame(t);
  }
  const held = A.TUT.i === 1;
  A.TUT.hover = false;
  d.getElementById('tut-pause').click();
  for (let k = 0; k < 80; k++) {
    t += 100;
    A.tutFrame(t);
  }
  const paused = A.TUT.i === 1 && d.getElementById('tut-pause').textContent === 'Teruskan';
  d.getElementById('tut-pause').click();
  d.getElementById('tut-prev').click();
  const prev = A.TUT.i === 0;
  // jalani semua langkah: bab, halaman, dan mode JAKA yang dikunjungi
  const ch = new Set(),
    modes = new Set();
  let amba = false,
    up = false,
    n = 0;
  while (A.TUT.on && n < 60) {
    n++;
    const st = A.TUT_STEPS[A.TUT.i];
    ch.add(st.ch);
    modes.add(d.body.dataset.mode + (d.body.dataset.mode === 'jaka' ? '-' + A.JK.cur : ''));
    if (st.t === '#assistant-panel') amba = d.getElementById('assistant-panel').classList.contains('open');
    if (st.t === '#bd-up') up = !d.getElementById('bd-up').hidden;
    d.getElementById('tut-next').click();
  }
  const all =
    ['dash', 'amba', 'set', 'vec', 'jaka', 'fk', 'ik', 'bd', 'rj'].every(c => ch.has(c)) &&
    ['home', 'settings', 'vector', 'jaka-fk', 'jaka-ik', 'jaka-bd', 'reference'].every(m => modes.has(m));
  const end =
    !A.TUT.on &&
    tut.hidden &&
    d.body.dataset.mode === 'home' &&
    !d.getElementById('assistant-panel').classList.contains('open') &&
    d.getElementById('bd-up').hidden &&
    n === A.TUT_STEPS.filter(st => !st.cond || st.cond()).length;
  console.log('   langkah ' + n + ' | bab ' + [...ch].join(',') + ' | halaman ' + [...modes].join(','));
  return start && still && moved && held && paused && prev && all && amba && up && end;
});
guard('tutorial: Skip, Escape, Lewati bagian, dan Mode Pengamat melewati langkah rumus serta Rujukan', () => {
  d.getElementById('menu-tutorial').click();
  d.getElementById('tut-start-tour').click();
  d.getElementById('tut-skip').click();
  const skip = !A.TUT.on && d.getElementById('app-toast').textContent.includes('dilewati');
  d.getElementById('menu-tutorial').click();
  d.getElementById('tut-start-tour').click();
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const esc = !A.TUT.on && d.body.dataset.mode === 'home';
  d.getElementById('menu-tutorial').click();
  d.getElementById('tut-start-tour').click();
  A.tutSkipSection();
  const sec = A.TUT_STEPS[A.TUT.i].ch === 'amba';
  d.getElementById('tut-skip').click();
  A.nav('#settings');
  d.getElementById('set-observer').click();
  A.nav('#home');
  d.getElementById('menu-tutorial').click();
  d.getElementById('tut-start-tour').click();
  const seen = [];
  let n = 0;
  while (A.TUT.on && n < 60) {
    n++;
    seen.push(A.TUT_STEPS[A.TUT.i]);
    A.tutNext();
  }
  const pg =
    !seen.some(
      st =>
        st.ch === 'rj' ||
        st.t === '#vs-reference' ||
        (typeof st.t === 'function' && String(st.t).includes('v1-eq')) ||
        st.t === '#view-v7 .accordion-section'
    ) && seen.some(st => st.ch === 'bd');
  A.nav('#settings');
  d.getElementById('set-observer').click();
  // bahasa Inggris
  d.querySelector('#set-lang [data-v="en"]').click();
  A.nav('#home');
  d.getElementById('menu-tutorial').click();
  d.getElementById('tut-start-tour').click();
  const en =
    d.getElementById('tut-title').textContent === 'Vector Simulation' &&
    [d.getElementById('tut-next').textContent, d.getElementById('tut-next').getAttribute('aria-label')].includes(
      'Next'
    ) &&
    d.getElementById('tut-text').textContent.startsWith('Start learning');
  d.getElementById('tut-skip').click();
  d.querySelector('#set-lang [data-v="id"]').click();
  A.nav('#home');
  console.log(
    '   skip ' + skip + ' esc ' + esc + ' bagian ' + sec + ' pengamat ' + pg + ' (' + n + ' langkah) en ' + en
  );
  return skip && esc && sec && pg && en;
});
guard(
  'Mode Laporan: bar muncul di FK, IK, Blok Diagram; Simpan Konfigurasi dengan peringatan Parameter Robot; Reset',
  () => {
    A.nav('#settings');
    d.getElementById('set-report').click();
    const vis = q => w.getComputedStyle(d.querySelector(q)).display !== 'none';
    const bars =
      vis('#view-v7 .lp-bar') && vis('#view-v8 .lp-bar') && vis('#view-bd .lp-bar') && vis('#app-jaka .lp-badge');
    A.nav('#jaka-fk');
    A.REP.robotTouched = false;
    A.REP.cfg.fk = null;
    d.querySelector('#view-v7 [data-lp-act="save"]').click();
    const m = d.getElementById('lp-modal');
    const warn =
      m.classList.contains('open') &&
      d.getElementById('lp-q').textContent.startsWith('Anda belum mengatur konfigurasi pada Parameter Robot');
    d.querySelector('#lp-btns [data-k="robot"]').click();
    const toRobot =
      !m.classList.contains('open') &&
      A.JK.cur === 'bd' &&
      A.BDU.open &&
      A.BDU.tab === 'robot' &&
      A.REP.cfg.fk === null;
    A.bdUp(false);
    A.nav('#jaka-fk');
    d.querySelector('#view-v7 [data-lp-act="save"]').click();
    d.querySelector('#lp-btns [data-k="save"]').click();
    const c = A.REP.cfg.fk,
      saved =
        c &&
        c.theta.length === 6 &&
        c.dh.length === 6 &&
        JSON.parse(w.localStorage.getItem('jakaSimLaporan')).cfg.fk.savedAt === c.savedAt &&
        d.querySelector('#view-v7 [data-lp-st]').textContent.includes('Konfigurasi tersimpan');
    const inp = d.getElementById('cfg-total-mass');
    inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    A.nav('#jaka-bd');
    d.querySelector('#view-bd [data-lp-act="save"]').click();
    const noWarn =
      !m.classList.contains('open') &&
      A.REP.cfg.bd &&
      A.REP.cfg.bd.bd.edges.length === 8 &&
      A.REP.cfg.bd.robotTouched === true;
    A.nav('#jaka-ik');
    d.getElementById('tx').value = '0.4';
    d.querySelector('#view-v8 [data-lp-act="save"]').click();
    const ikc = A.REP.cfg.ik && A.REP.cfg.ik.ik.target.x === 0.4;
    d.querySelector('#view-v8 [data-lp-act="reset"]').click();
    d.querySelector('#lp-btns [data-k="yes"]').click();
    const reset = d.getElementById('tx').value === '0.6' && A.REP.cfg.ik === null && A.REP.cfg.fk !== null;
    A.nav('#settings');
    d.getElementById('set-report').click();
    const off = !vis('#view-v7 .lp-bar');
    A.nav('#home');
    console.log(
      '   bar ' +
        bars +
        ' warn ' +
        warn +
        ' robot ' +
        toRobot +
        ' saved ' +
        !!saved +
        ' noWarn ' +
        !!noWarn +
        ' ik ' +
        !!ikc +
        ' reset ' +
        reset +
        ' off ' +
        off
    );
    return bars && warn && toRobot && saved && noWarn && ikc && reset && off;
  }
);
guard('Mode Laporan: fisika laporan sama dengan simulator (FK, torsi gravitasi, solver IK)', () => {
  const th = [15, 70, -80, 40, 95, -20];
  A.J().forEach((j, i) => (j.theta = th[i]));
  A.setPayloadMode('3');
  const cfg = A.rpSnapshot('fk'),
    u = A.toUser(A.eeFromThetas6()),
    p = A.rpFK(cfg, th);
  const fk = Math.hypot(p[0] - u.x, p[1] - u.y, p[2] - u.z) < 1e-9;
  const g1 = A.gravityTorque(),
    g2 = A.rpTauG(cfg, th, 3),
    tq = g1.every((v, i) => Math.abs(v - g2[i]) < 1e-6);
  A.setPayloadMode('0');
  const start = [0, 90, -90, 90, 90, 0],
    tgU = { x: 0.5, y: -0.15, z: 0.3 },
    ref = A.solveIK6(new w.THREE.Vector3(tgU.x, tgU.z, -tgU.y), start),
    mine = A.rpSolveDLS3(cfg, [tgU.x, tgU.y, tgU.z], start);
  const ik =
    ref.thetas.every((v, i) => Math.abs(v - mine.th[i]) < 1e-6) &&
    mine.err < 0.001 &&
    mine.first &&
    mine.first.J.length === 3;
  console.log(
    '   FK ' +
      fk +
      ' | selisih torsi maks ' +
      Math.max(...g1.map((v, i) => Math.abs(v - g2[i]))).toExponential(1) +
      ' | IK ' +
      ik +
      ' (' +
      mine.iters +
      ' iterasi, galat ' +
      (mine.err * 1000).toFixed(3) +
      ' mm)'
  );
  return fk && tq && ik;
});
guard('Mode Laporan: timeline 0,2 s dari rencana gerak, satu siklus, energi naik monoton, payload sesuai fase', () => {
  A.J().forEach((j, i) => (j.theta = [0, 90, -90, 90, 90, 0][i]));
  A.zzLock();
  A.TRAJ.kg = 3;
  const P = A.planPickPlace(3);
  P.src = 'bd';
  A.rpCapture(P);
  const rec = A.REP.rec.bd;
  const tl = A.rpTimeline(rec),
    R = tl.rows,
    D = rec.D;
  const grid =
    R.slice(0, -1).every((r, i) => Math.abs(r.t - i * 0.2) < 1e-9) &&
    Math.abs(R[R.length - 1].t - +D.toFixed(2)) < 1e-9 &&
    R.length === Math.floor(D / 0.2 + 1e-9) + 1 + (Math.abs(D / 0.2 - Math.round(D / 0.2)) > 1e-9 ? 1 : 0);
  const mono = R.every((r, i) => i === 0 || (r.Ea >= R[i - 1].Ea - 1e-9 && r.Ee >= R[i - 1].Ee - 1e-9));
  const pay = R.every(r => r.pay === (r.t >= rec.tGrasp && r.t < rec.tRelease ? 3 : 0));
  const start = R[0].th.every((v, i) => Math.abs(v - A.ZZ.q0[i]) < 1e-6),
    end = R[R.length - 1].th.every((v, i) => Math.abs(v - A.ZZ.q0[i]) < 1e-3);
  const P2 = A.planPickPlace(3);
  P2.src = 'bd';
  A.rpCapture(P2);
  const again = A.REP.rec.bd.D === P2.D && A.rpTimeline(A.REP.rec.bd).rows.length === R.length;
  console.log(
    '   D ' +
      D.toFixed(2) +
      ' s, ' +
      R.length +
      ' baris | Ee ' +
      tl.sum.Ee.toFixed(0) +
      ' J, Eabs ' +
      tl.sum.Ea.toFixed(1) +
      ' J, τ maks J2 ' +
      tl.sum.tmax[1].toFixed(1) +
      ' N·m | titik contoh t* ' +
      tl.star.t.toFixed(2) +
      ' s'
  );
  return grid && mono && pay && start && end && again;
});
guard('Mode Laporan: Save Report tanpa unduh otomatis, daftar, pratinjau, hapus; template FK, IK, Blok Diagram', () => {
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AA==';
  const bd = A.REP.rec.bd;
  A.REP.reports = [];
  A.REP.robotTouched = true;
  A.nav('#jaka-bd');
  let dl = 0;
  const oc = w.URL.createObjectURL;
  w.URL.createObjectURL = () => {
    dl++;
    return 'blob:x';
  };
  A.REP.cfg.bd = null;
  d.querySelector('#view-bd [data-lp-act="report"]').click();
  const askCfg = d.getElementById('lp-q').textContent.includes('belum disimpan');
  d.querySelector('#lp-btns [data-k="save"]').click();
  const R = A.REP.reports[0],
    made = R && R.page === 'bd' && A.REP.cfg.bd && R.rec && R.rec.rows.length > 10 && dl === 0;
  const item = d.querySelector('#view-bd .lp-item');
  const list =
    item &&
    item.querySelectorAll('[data-a]').length === 4 &&
    JSON.parse(w.localStorage.getItem('jakaSimLaporan')).reports.length === 1;
  const B = A.rpDoc(R),
    h = B.filter(b => b.t === 'h2').map(b => b.text),
    order = [
      'Setpoint',
      'Trajectory',
      'Inverse Kinematics',
      'Eksekusi 6 joint',
      'Forward Kinematics',
      'Arus motor i',
      'Torsi τ = K·N·i',
      'Energi dan daya'
    ];
  const inOrder = order.every((n, i) => h.indexOf('3.' + (i + 1) + ' ' + n) >= 0);
  const tables = B.filter(b => b.t === 'table').length,
    charts = B.filter(b => b.t === 'chart').length,
    svg = B.some(b => b.t === 'svg' && b.svg.includes('Setpoint'));
  const kbad = bl =>
    bl
      .filter(b => b.t === 'eq')
      .filter(b => {
        try {
          katexLib.renderToString(b.tex, { displayMode: true, throwOnError: true });
          return false;
        } catch (e) {
          console.log('   KATEX', e.message.slice(0, 120));
          return true;
        }
      }).length;
  const div = d.createElement('div');
  A.rpShowDoc(div, B);
  const eqs = B.filter(b => b.t === 'eq').length,
    errs = kbad(B);
  // alur diubah: IK dan FK ditukar -> urutan penurunan ikut sambungan
  A.bdSwapIkFk();
  A.rpSave('bd');
  const R2 = A.rpBuild('bd');
  const ord2 = R2.bd.order.join(',');
  A.REP.cfg.bd = null;
  d.getElementById('bd-reset-flow').click();
  // FK tanpa rekaman: tanya dulu, lalu laporan statis
  A.nav('#jaka-fk');
  A.REP.rec.fk = null;
  A.rpSave('fk');
  d.querySelector('#view-v7 [data-lp-act="report"]').click();
  const askRec = d.getElementById('lp-q').textContent.includes('Belum ada rekaman');
  d.querySelector('#lp-btns [data-k="go"]').click();
  const F = A.REP.reports.find(r => r.page === 'fk'),
    FB = A.rpDoc(F);
  const fkOk =
    F &&
    !F.rec &&
    FB.filter(b => b.t === 'eq' && /^Sendi \d: /.test(b.label || '')).length === 6 &&
    FB.some(b => b.t === 'eq' && b.tex.includes(A.rpFK(F.cfg, F.cfg.theta)[0].toFixed(4)));
  const fdiv = d.createElement('div');
  A.rpShowDoc(fdiv, FB);
  const ferr = kbad(FB);
  // IK
  A.nav('#jaka-ik');
  d.getElementById('tx').value = '0.5';
  A.rpSave('ik');
  A.REP.rec.ik = null;
  const I = A.rpBuild('ik'),
    IB = A.rpDoc(I);
  const idiv = d.createElement('div');
  A.rpShowDoc(idiv, IB);
  const ikOk =
    I.ik.sol.err < 0.003 &&
    IB.some(b => b.t === 'h2' && b.text === '3.1 Iterasi pertama, disubstitusi lengkap') &&
    kbad(IB) === 0;
  d.getElementById('tx').value = '0.6';
  // pratinjau dan hapus
  const del = d.querySelector('#view-v7 .lp-item [data-a="del"]');
  del.click();
  d.querySelector('#lp-btns [data-k="yes"]').click();
  const gone = !A.REP.reports.some(r => r.page === 'fk');
  w.URL.createObjectURL = oc;
  A.nav('#home');
  console.log(
    '   tanya konfigurasi ' +
      askCfg +
      ' | dibuat ' +
      !!made +
      ' | daftar ' +
      list +
      ' | urutan blok ' +
      inOrder +
      ' | tabel ' +
      tables +
      ', grafik ' +
      charts +
      ', svg ' +
      svg +
      ' | rumus KaTeX ' +
      eqs +
      ', error ' +
      errs +
      ' | urutan setelah tukar ' +
      ord2 +
      ' | FK ' +
      fkOk +
      ' (error ' +
      ferr +
      ') tanya rekaman ' +
      askRec +
      ' | IK ' +
      ikOk +
      ' | hapus ' +
      gone
  );
  return (
    askCfg &&
    made &&
    list &&
    inOrder &&
    tables >= 12 &&
    charts === 5 &&
    svg &&
    eqs >= 25 &&
    errs === 0 &&
    ord2 === 'b1,b2,b5,b4,b3,b6,b7,b8' &&
    fkOk &&
    ferr === 0 &&
    askRec &&
    ikOk &&
    gone
  );
});
guard(
  'Sesi 22: kode Python/MATLAB/Simulink (FK, IK, Blok Diagram) tombol Lihat Kode dan isi konsisten dengan perhitungan simulator',
  () => {
    A.nav('#jaka-fk');
    A.J().forEach((j, i) => (j.theta = [8, 30, -40, 15, -10, 5][i]));
    A.zzLock();
    d.querySelector('#view-v7 [data-lp-act="code"]').click();
    const modalOpen = d.getElementById('lp-code').classList.contains('open');
    const fkPy = d.getElementById('lp-code-pre').textContent;
    const fkCfg = A.rpCodeCfg('fk');
    const tmp = path.join(os.tmpdir(), 'jaka_qa_codegen');
    fs.mkdirSync(tmp, { recursive: true });
    const runPy = (code, file) => {
      fs.writeFileSync(path.join(tmp, file), code);
      return execSync('python "' + path.join(tmp, file) + '"', { encoding: 'utf8' });
    };
    const fkOkStatic =
      fkPy.includes('import numpy') && fkPy.includes('theta = [8.0000, 30.0000, -40.0000, 15.0000, -10.0000, 5.0000]');
    const fkPos = A.rpFK(
      { dh: A.J().map(j => ({ a: j.a, alpha: j.alpha, d: j.d })) },
      A.J().map(j => j.theta)
    );
    const fkOut = runPy(fkPy, 'fk.py');
    const fkX = parseFloat((fkOut.match(/x = ([\-0-9.]+)/) || [])[1]);
    const fkOkPy = fkOkStatic && Math.abs(fkX - fkPos[0]) < 1e-5;
    d.querySelector('[data-code-lang="mat"]').click();
    const fkMat = d.getElementById('lp-code-pre').textContent;
    const fkOkMat =
      fkMat.includes('function T = dh_transform') &&
      fkMat.includes('theta = [8.0000 30.0000 -40.0000 15.0000 -10.0000 5.0000];');
    A.rpCodeClose();
    const closedOk = !d.getElementById('lp-code').classList.contains('open');
    A.nav('#jaka-ik');
    d.getElementById('tx').value = '0.5';
    d.getElementById('tx').dispatchEvent(new w.Event('input'));
    d.querySelector('#view-v8 [data-lp-act="code"]').click();
    const ikCfg = A.rpCodeCfg('ik'),
      ikPy = A.rpCodeGen('ik', 'py');
    const ikSim = A.rpSolveDLS3(
      { dh: A.J().map(j => ({ a: j.a, alpha: j.alpha, d: j.d, thMin: j.thMin, thMax: j.thMax })) },
      ikCfg.target,
      ikCfg.startTheta
    );
    const ikOut = runPy(ikPy, 'ik.py');
    const ikTheta1 = parseFloat((ikOut.match(/theta1 = ([\-0-9.]+)/) || [])[1]);
    const ikOkStatic = ikPy.includes('def solve_ik(') && ikPy.includes(ikCfg.target[0].toFixed(6));
    const ikOk = ikOkStatic && Math.abs(ikTheta1 - ikSim.th[0]) < 1e-3;
    A.rpCodeClose();
    A.nav('#jaka-bd');
    d.querySelector('#view-bd [data-lp-act="code"]').click();
    const bdTabs = [...d.querySelectorAll('#lp-code-tabs button')].map(b => b.dataset.codeLang).join(',');
    d.querySelector('[data-code-lang="sim"]').click();
    const bdSim = d.getElementById('lp-code-pre').textContent;
    const simOk =
      bdSim.includes('new_system(modelName)') &&
      bdSim.includes("add_block('simulink/User-Defined Functions/MATLAB Function'") &&
      !bdSim.includes("'DH = [\\n");
    A.rpCodeClose();
    console.log(
      '   fk py ' +
        fkOkPy +
        ' | fk mat ' +
        fkOkMat +
        ' | modal buka/tutup ' +
        modalOpen +
        '/' +
        closedOk +
        ' | ik ' +
        ikOk +
        ' | bd tabs ' +
        bdTabs +
        ' | simulink ' +
        simOk
    );
    return fkOkPy && fkOkMat && modalOpen && closedOk && ikOk && bdTabs === 'py,mat,sim' && simOk;
  }
);
guard(
  'dashboard live: energi diintegrasi terhadap waktu simulasi saat trajectory berjalan (tidak bergantung kecepatan animasi)',
  () => {
    A.J().forEach((j, i) => (j.theta = [0, 90, -90, 90, 90, 0][i]));
    A.setPayloadMode('3');
    A.resetEnergy();
    A.liveState.prevTheta = null;
    const run = sp => {
      A.TRAJ.playing = true;
      A.TRAJ.speed = sp;
      clock += 100;
      tick();
      clock += 100;
      tick();
      const e0 = A.liveState.Ee;
      clock += 100;
      tick();
      const de = A.liveState.Ee - e0;
      A.TRAJ.playing = false;
      A.TRAJ.speed = 1;
      return de / A.liveState.Pe;
    };
    const k1 = run(1),
      k4 = run(4);
    A.setPayloadMode('0');
    console.log('   ΔEe/Pe per tick: 1x ' + k1.toFixed(3) + ' s, 4x ' + k4.toFixed(3) + ' s');
    return Math.abs(k1 - 0.1) < 1e-6 && Math.abs(k4 - 0.4) < 1e-6;
  }
);
guard('Mode Laporan: semua huruf teks laporan (FK, IK, Blok Diagram) tersedia di font PDF Liberation Sans', () => {
  const ot = require('opentype.js'),
    src = fs.readFileSync(root + 'app/vendor/report-fonts.js', 'utf8');
  const fontOf = k => {
    const b64 = src.match(new RegExp(k + ":'([^']+)'"))[1],
      buf = Buffer.from(b64, 'base64');
    return ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  };
  const reg = fontOf('regular'),
    bold = fontOf('bold');
  A.REP.robotTouched = true;
  A.J().forEach((j, i) => (j.theta = [0, 90, -90, 90, 90, 0][i]));
  A.zzLock();
  const docs = ['fk', 'ik', 'bd'].map(pg => {
    A.nav('#jaka-' + pg);
    A.rpSave(pg);
    const P = A.planPickPlace(3);
    P.src = pg;
    A.rpCapture(P);
    return A.rpDoc(A.rpBuild(pg));
  });
  const chars = new Set();
  docs.flat().forEach(b => {
    const add = t => [...String(t)].forEach(c => chars.add(c));
    if (b.t === 'table') {
      (b.head || []).forEach(add);
      b.rows.forEach(r => r.forEach(add));
      if (b.caption) add(b.caption);
    } else if (b.text !== undefined) {
      add(b.text);
      if (b.sub) add(b.sub);
    }
    if (b.label) add(b.label);
    if (b.caption) add(b.caption);
  });
  const miss = [...chars].filter(c => c.trim() && (reg.charToGlyphIndex(c) === 0 || bold.charToGlyphIndex(c) === 0));
  const comb = [...chars].filter(c => /[\u0300-\u036f]/.test(c));
  A.nav('#home');
  console.log(
    '   ' +
      chars.size +
      ' huruf unik diperiksa; tidak ada di font: ' +
      (miss.join(' ') || '-') +
      '; huruf gabungan: ' +
      (comb.length ? comb.map(c => 'U+' + c.charCodeAt(0).toString(16)).join(' ') : '-')
  );
  return miss.length === 0 && comb.length === 0;
});
guard('bahasa: English mengganti teks shell dan tersimpan, kembali ke Indonesia', () => {
  A.nav('#settings');
  d.querySelector('#set-lang [data-v="en"]').click();
  const en =
    d.querySelector('[data-i18n="set.title"]').textContent === 'Settings' &&
    d.getElementById('exit-q').textContent === 'Do you want to leave?' &&
    JSON.parse(w.localStorage.getItem('jakaSimSettings')).lang === 'en';
  d.querySelector('#set-lang [data-v="id"]').click();
  const id = d.querySelector('[data-i18n="set.title"]').textContent === 'Pengaturan';
  A.nav('#home');
  return en && id;
});
guard('Ambabot: ikon membuka panel, ikon lagi menutup, tombol X menutup', () => {
  const btn = d.getElementById('assistant-btn'),
    pn = d.getElementById('assistant-panel');
  btn.click();
  const o1 = pn.classList.contains('open') && btn.getAttribute('aria-expanded') === 'true';
  btn.click();
  const c1 = !pn.classList.contains('open');
  btn.click();
  d.getElementById('assistant-close').click();
  return o1 && c1 && !pn.classList.contains('open');
});
guard('rujukan: tab 06 dan 10 lama pindah ke halaman Rujukan, semua link daftar isi punya target', () => {
  const toc = [...d.querySelectorAll('.rj-toc a')];
  return (
    !d.getElementById('view-v6') &&
    !d.getElementById('view-v10') &&
    d.querySelector('#app-reference #materi-content') &&
    d.querySelector('#app-reference #guide-content') &&
    toc.length > 20 &&
    toc.every(a => d.getElementById(a.dataset.goto)) &&
    Object.values(A.REFERENCE_MAP).every(id => d.getElementById(id))
  );
});
guard('rujukan: dari Vector Simulation 3 melompat ke rotasi komposit, Kembali ke sub-halaman 3', () => {
  A.nav('#vector-3');
  d.getElementById('vs-reference').click();
  const t = d.getElementById('rj-rotasi-komposit');
  const jumped =
    d.body.dataset.mode === 'reference' &&
    t.classList.contains('pd-hl') &&
    d.querySelector('.rj-toc a.on').dataset.goto === 'rj-rotasi-komposit' &&
    d.getElementById('rj-back').style.display !== 'none';
  d.getElementById('rj-back').click();
  return jumped && d.body.dataset.mode === 'vector' && d.getElementById('view-v3').classList.contains('active');
});
guard('rujukan: tombol hanya aktif saat Rujukan nyala dan Pengamat mati; Exit Rujukan minta konfirmasi', () => {
  const on = () => d.body.classList.contains('reference-on');
  A.nav('#settings');
  const a = on();
  d.getElementById('set-observer').click();
  const b = !on();
  d.getElementById('set-observer').click();
  d.getElementById('set-reference').click();
  const c = !on();
  d.getElementById('set-reference').click();
  A.gotoReference('pd-ik');
  d.getElementById('rj-exit').click();
  const asked = d.getElementById('exit-modal').classList.contains('open');
  d.getElementById('exit-no').click();
  const stay = d.body.dataset.mode === 'reference';
  d.getElementById('rj-exit').click();
  d.getElementById('exit-yes').click();
  return a && b && c && on() && asked && stay && d.body.dataset.mode === 'home';
});
guard('vector simulation: tab 01-05 pindah ke satu halaman, bar tab lama tanpa 01-05, bola pindah sub-halaman', () => {
  const pages = [...d.querySelectorAll('#app-vector .vs-page')];
  if (pages.length !== 5 || d.querySelector('.tab-btn[data-view="v1"]') || d.querySelector('.wrap #view-v1'))
    return false;
  A.nav('#vector');
  const ok = [1, 2, 3, 4, 5].every(n => {
    d.querySelector('.vs-ball[data-vs="' + n + '"]').click();
    const act = [...d.querySelectorAll('#app-vector .vs-page.active')];
    return (
      act.length === 1 &&
      act[0].id === 'view-v' + n &&
      d.querySelector('.vs-ball.on').dataset.vs === String(n) &&
      d.getElementById('vs-title').textContent.startsWith(n + '.')
    );
  });
  A.nav('#vector-2');
  const deep = d.getElementById('view-v2').classList.contains('active') && A.VS.cur === 2;
  return ok && deep;
});
guard('vector simulation: kanvas dibekukan (sticky), kolom persamaan tidak punya scroll sendiri', () => {
  const st = w.getComputedStyle(d.querySelector('#view-v1 .stage')),
    sd = w.getComputedStyle(d.querySelector('#view-v1 .side'));
  return st.position === 'sticky' && sd.overflowY !== 'auto' && sd.maxHeight === 'none';
});
guard('vector simulation: Exit minta konfirmasi, Rujukan tiap sub-halaman ke materi yang benar', () => {
  A.nav('#vector-4');
  d.getElementById('vs-exit').click();
  const asked = d.getElementById('exit-modal').classList.contains('open');
  d.getElementById('exit-no').click();
  const stay = d.body.dataset.mode === 'vector' && A.VS.cur === 4;
  const want = { 1: 'rj-vektor', 2: 'rj-rotasi', 3: 'rj-rotasi-komposit', 4: 'rj-homogen', 5: 'rj-fk' };
  const ruj = [1, 2, 3, 4, 5].every(n => {
    A.nav('#vector-' + n);
    d.getElementById('vs-reference').click();
    const on = d.querySelector('.rj-toc a.on');
    const r = d.body.dataset.mode === 'reference' && on && on.dataset.goto === want[n];
    d.getElementById('rj-back').click();
    return r && A.VS.cur === n;
  });
  d.getElementById('vs-exit').click();
  d.getElementById('exit-yes').click();
  return asked && stay && ruj && d.body.dataset.mode === 'home';
});
guard(
  'jaka: tab 07/08/11 pindah ke halaman JAKA, toggle FK/IK/Blok Diagram, kanvas robot dipinjam Blok Diagram',
  () => {
    if (
      d.querySelector('.tab-btn[data-view="v7"]') ||
      d.querySelector('.tab-btn[data-view="v8"]') ||
      d.querySelector('.wrap #view-v7')
    )
      return false;
    A.nav('#jaka-fk');
    const fk =
      d.body.dataset.mode === 'jaka' &&
      d.getElementById('view-v7').classList.contains('active') &&
      !d.getElementById('view-v8').classList.contains('active');
    d.querySelector('.jk-mode [data-jk="ik"]').click();
    const ik =
      A.JK.cur === 'ik' &&
      d.getElementById('view-v8').classList.contains('active') &&
      d.getElementById('jk-title').textContent.includes('Inverse');
    const sticky = w.getComputedStyle(d.querySelector('#view-v8 .stage')).position === 'sticky';
    d.querySelector('.jk-mode [data-jk="bd"]').click();
    const bd =
      A.JK.cur === 'bd' &&
      d.getElementById('view-bd').classList.contains('active') &&
      d.getElementById('ch-fk').parentElement.id === 'bd-robot-slot' &&
      !d.querySelector('.tab-btn[data-view="v11"]');
    d.querySelector('.jk-mode [data-jk="fk"]').click();
    const backHolder = d.getElementById('ch-fk').closest('#view-v7') !== null;
    return fk && ik && sticky && bd && backHolder;
  }
);
guard(
  'jaka: Exit minta konfirmasi, Rujukan FK/IK, preset kamera dan screenshot tidak error, energi disembunyikan',
  () => {
    A.nav('#jaka-ik');
    d.getElementById('jk-exit').click();
    const asked = d.getElementById('exit-modal').classList.contains('open');
    d.getElementById('exit-no').click();
    const stay = d.body.dataset.mode === 'jaka' && A.JK.cur === 'ik';
    d.getElementById('jk-reference').click();
    const r1 = d.querySelector('.rj-toc a.on').dataset.goto === 'pd-ik';
    d.getElementById('rj-back').click();
    const back = d.body.dataset.mode === 'jaka' && A.JK.cur === 'ik';
    d.querySelectorAll('.jk-views button').forEach(b => b.click());
    A.ikScene.renderer.domElement.toDataURL = () => 'data:image/png;base64,';
    d.querySelector('.jk-shot[data-t="ik"]').click();
    const noEnergy =
      !d.getElementById('sec-tau-fk').closest('#view-v7,#view-v8') &&
      !!d.getElementById('sec-tau-fk').closest('#view-bd');
    A.nav('#jaka-fk');
    tick();
    const hud = d.getElementById('traj-hud').textContent;
    return asked && stay && r1 && back && noEnergy && !hud.includes('E elektrik') && hud.includes('Payload');
  }
);
guard(
  'balok: dipindah di kedua adegan, marka tujuan di seberang, jarak dibatasi, rencana pick memakai posisi baru',
  () => {
    A.moveWeightHome(3, 0.3, -0.4);
    const pos = sc => new w.THREE.Vector3().setFromMatrixPosition(sc.weights.find(x => x.kg === 3).home);
    const a = pos(A.fkScene),
      b = pos(A.ikScene),
      mk = A.fkScene.weights.find(x => x.kg === 3).mark.position;
    const same =
      Math.abs(a.x - 0.3) < 1e-9 &&
      Math.abs(a.z + 0.4) < 1e-9 &&
      a.distanceTo(b) < 1e-9 &&
      Math.abs(mk.x - 0.3) < 1e-9 &&
      Math.abs(mk.z - 0.4) < 1e-9;
    A.moveWeightHome(3, 2, 0);
    const far = Math.abs(pos(A.fkScene).x - 0.75) < 1e-9;
    A.moveWeightHome(3, 0.05, 0);
    const near = Math.abs(pos(A.fkScene).x - 0.22) < 1e-9;
    A.moveWeightHome(3, 0.35, -0.35);
    A.J().forEach((j, i) => (j.theta = [0, 90, -90, 90, 90, 0][i]));
    const p = A.planPickPlace(3);
    const grasp = p.segs.find(sg => sg.mark === 'grasp');
    const F = w.computeChain6(grasp.q0)[6],
      ee = new w.THREE.Vector3().setFromMatrixPosition(F);
    const ok = Math.hypot(ee.x - 0.35, ee.z + 0.35) < 0.004;
    A.moveWeightHome(3, 0.389, 0.389);
    return same && far && near && ok;
  }
);
guard(
  'diagram blok pop-up: 8 blok di dalam pop-up, klik blok menampilkan rumus di pop-up (bukan upside bar), rumus valid tanpa galat KaTeX',
  () => {
    A.nav('#jaka-bd');
    w.__ticks.forEach(f => f());
    const pop = d.getElementById('bd-pop'),
      calc = d.getElementById('bd-calc');
    // tertutup: diagram tidak bersebelahan dengan robot, kartu rumus ada di upside bar
    const closed =
      !A.bdPopOpen() &&
      w.getComputedStyle(pop).display === 'none' &&
      !!d.getElementById('bd-svg').closest('#bd-pop') &&
      !d.querySelector('.bd-main #bd-svg') &&
      !!calc.closest('.bd-up-panel[data-panel="rumus"]') &&
      !!d.querySelector('.bd-main #bd-robot-slot #ch-fk');
    d.getElementById('bd-open').click();
    const opened = A.bdPopOpen() && w.getComputedStyle(pop).display !== 'none' && !!calc.closest('#bd-pop-calc');
    const blocks = [...d.querySelectorAll('#bd-svg .bd-block')];
    if (blocks.length !== 8) return false;
    for (const g of blocks) {
      g.dispatchEvent(new w.Event('click', { bubbles: true }));
      w.__ticks.forEach(f => f());
      if (!d.getElementById('bd-eqs').children.length) return false;
      if (d.querySelector('#bd-eqs .katex-error')) return false;
      if (d.getElementById('bd-title').textContent !== g.querySelector('.bd-title').textContent) return false;
      if (!d.getElementById('bd-up').hidden) return false;
    }
    const mirror =
      d.getElementById('bd-valid-pop').textContent === d.getElementById('bd-valid').textContent &&
      d.getElementById('bd-valid-pop').textContent.includes('Alur valid');
    d.getElementById('bd-pop-x').click();
    const back = !A.bdPopOpen() && !!calc.closest('.bd-up-panel[data-panel="rumus"]');
    // pindah halaman menutup pop-up
    A.bdPop(true);
    A.nav('#jaka-fk');
    const navClose = !A.bdPopOpen() && !!calc.closest('.bd-up-panel[data-panel="rumus"]');
    console.log(
      '   tertutup ' + closed + ' terbuka ' + opened + ' cermin ' + mirror + ' kembali ' + back + ' nav ' + navClose
    );
    return closed && opened && mirror && back && navClose;
  }
);
guard('menu Draw: kanvas FK dipinjam, DH terkunci dan bisa dibuka, hanya θ yang berubah saat slider digeser', () => {
  A.nav('#jaka-draw');
  const page =
    d.body.dataset.mode === 'jaka' &&
    A.JK.cur === 'draw' &&
    d.getElementById('view-draw').classList.contains('active') &&
    d.getElementById('ch-fk').parentElement.id === 'dr-stage' &&
    A.DRAW.active &&
    d.getElementById('jk-title').textContent.includes('Draw');
  const inp = [...d.querySelectorAll('#dr-dh-body input')];
  const locked =
    inp.length === 18 &&
    inp.every(i => i.disabled) &&
    d.getElementById('dr-lock').getAttribute('aria-pressed') === 'true';
  const dh0 = JSON.stringify(A.J().map(j => [j.d, j.a, j.alpha]));
  inp[0].value = 0.5;
  inp[0].dispatchEvent(new w.Event('input', { bubbles: true }));
  const noEdit = JSON.stringify(A.J().map(j => [j.d, j.a, j.alpha])) === dh0;
  const sl = d.querySelector('#theta-draw input[data-i="1"]');
  sl.value = 40;
  sl.dispatchEvent(new w.Event('input', { bubbles: true }));
  const moved =
    A.J()[1].theta === 40 &&
    d.getElementById('dr-thc1').textContent === '40.0°' &&
    JSON.stringify(A.J().map(j => [j.d, j.a, j.alpha])) === dh0;
  d.getElementById('dr-lock').click();
  const open = inp.every(i => !i.disabled);
  const i2 = d.querySelector('#dr-dh-body input[data-i="1"][data-k="a"]');
  i2.value = 0.5;
  i2.dispatchEvent(new w.Event('input', { bubbles: true }));
  const edit = A.J()[1].a === 0.5;
  i2.value = 0.43;
  i2.dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('dr-lock').click();
  const relock = inp.every(i => i.disabled) && A.J()[1].a === 0.43;
  d.querySelector('.jk-mode [data-jk="fk"]').click();
  const left = !A.DRAW.active && d.getElementById('ch-fk').closest('#view-v7') !== null;
  console.log(
    '   halaman ' +
      page +
      ' terkunci ' +
      locked +
      noEdit +
      ' theta ' +
      moved +
      ' buka ' +
      open +
      edit +
      ' kunci lagi ' +
      relock +
      ' keluar ' +
      left
  );
  return page && locked && noEdit && moved && open && edit && relock && left;
});
guard(
  'Axis Draw dan visual DH: badan robot hilang, overlay tampil, tiap toggle bekerja juga di atas badan robot, keluar memulihkan adegan',
  () => {
    A.nav('#jaka-draw');
    const sc = A.fkScene,
      g = A.gridObjs.sfk;
    const start = sc.partGroups.every(p => p.visible) && !A.AX.root.visible;
    d.querySelector('#dr-mode [data-dsw="axis"]').click();
    const axis =
      A.DRAW.axis &&
      A.DRAW.dh &&
      sc.partGroups.every(p => !p.visible) &&
      A.AX.root.visible &&
      d.querySelector('#dr-mode [data-dsw="dh"]').getAttribute('aria-checked') === 'true';
    const cb = k => d.querySelector('#dr-mode input[data-dv="' + k + '"]');
    cb('theta').click();
    const tOff = !A.DRAW.v.theta;
    cb('theta').click();
    const tOn = A.DRAW.v.theta;
    d.querySelector('#dr-mode [data-dsw="axis"]').click();
    const onRobot =
      !A.DRAW.axis &&
      A.DRAW.dh &&
      sc.partGroups.every(p => p.visible) &&
      A.AX.root.visible &&
      sc.mats.every(m => m.transparent && m.opacity < 1);
    d.querySelector('#dr-mode [data-dsw="dh"]').click();
    const dhOff = !A.DRAW.dh && !A.AX.root.visible && sc.mats.every(m => !m.transparent && m.opacity === 1);
    d.querySelector('[data-dr-act="v-none"]').click();
    const none = Object.values(A.DRAW.v).every(v => !v);
    d.querySelector('[data-dr-act="v-all"]').click();
    const all = Object.values(A.DRAW.v).every(v => v) && A.DRAW.dh;
    d.querySelector('#dr-mode [data-dsw="axis"]').click();
    A.nav('#jaka-fk');
    const restored =
      sc.partGroups.every(p => p.visible) &&
      !A.AX.root.visible &&
      sc.mats.every(m => m.opacity === 1) &&
      sc.weights.every(x => x.group.visible) &&
      g.gridHelper.visible &&
      sc.rulers.visible;
    A.nav('#jaka-draw');
    const kept = A.DRAW.axis && sc.partGroups.every(p => !p.visible);
    d.querySelector('#dr-mode [data-dsw="dh"]').click();
    A.nav('#home');
    console.log(
      '   awal ' +
        start +
        ' axis ' +
        axis +
        ' toggle ' +
        tOff +
        tOn +
        ' di robot ' +
        onRobot +
        ' dh mati ' +
        dhOff +
        ' semua ' +
        none +
        all +
        ' pulih ' +
        restored +
        ' diingat ' +
        kept
    );
    return start && axis && tOff && tOn && onRobot && dhOff && none && all && restored && kept;
  }
);
guard(
  'Draw parameter IK buku: mode DH, IK buku, Gabungan; W = p - l2 b; theta1 rumus buku sama dengan theta1 pose',
  () => {
    A.nav('#jaka-draw');
    A.applyPose([20, 60, -50, 110, 95, 50], true);
    const btn = k => d.querySelector('#dr-pm-slot [data-dpm="' + k + '"]');
    btn('ik').click();
    const ik = A.DRAW.dh && A.IKV.root.visible && !A.AX.root.visible && btn('ik').classList.contains('on');
    btn('both').click();
    const both = A.IKV.root.visible && A.AX.root.visible;
    const cb = d.querySelector('#dr-mode input[data-dk="w"]');
    cb.click();
    const kOff = !A.DRAW.k.w;
    cb.click();
    const kOn = A.DRAW.k.w;
    A.drBookRender();
    const txt = d.getElementById('dr-buku-out').textContent;
    const buku = txt.includes('(0.596; 0.338; 0.613)') && txt.includes('0.1140') && txt.includes('(20.00°)');
    btn('dh').click();
    const dh = !A.IKV.root.visible && A.AX.root.visible;
    A.drLeave();
    const left = !A.IKV.root.visible;
    d.querySelector('#dr-mode [data-dsw="dh"]').click();
    A.nav('#home');
    console.log(
      '   ik ' +
        ik +
        ' gabungan ' +
        both +
        ' toggle ' +
        kOff +
        kOn +
        ' angka buku ' +
        buku +
        ' dh ' +
        dh +
        ' keluar ' +
        left
    );
    return ik && both && kOff && kOn && buku && dh && left;
  }
);
guard(
  'Cinematic: panel samping keluar, balok payload dan garis bantu hilang, toggle sendiri, Esc keluar dan memulihkan',
  () => {
    A.nav('#jaka-draw');
    const sc = A.fkScene,
      g = A.gridObjs.sfk;
    const before = sc.weights.every(x => x.group.visible) && g.gridHelper.visible && sc.rulers.visible;
    d.querySelector('#dr-mode [data-dr-act="cine-on"]').click();
    const on =
      A.DRAW.cine &&
      d.body.classList.contains('dr-cine') &&
      sc.weights.every(x => !x.group.visible && !x.mark.visible) &&
      !g.gridHelper.visible &&
      !g.numGroup.visible &&
      !sc.rulers.visible &&
      sc.axesHelpers.every(a => !a.visible) &&
      w.getComputedStyle(d.getElementById('dr-cine-bar')).display !== 'none' &&
      w.getComputedStyle(d.querySelector('.dr-stagectl')).display === 'none';
    const cg = d.querySelector('#dr-cine-panel input[data-ds="grid"]');
    cg.click();
    const tog = A.DRAW.c.grid && g.gridHelper.visible && A.DRAW.s.grid;
    cg.click();
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const off =
      !A.DRAW.cine &&
      !d.body.classList.contains('dr-cine') &&
      sc.weights.every(x => x.group.visible) &&
      g.gridHelper.visible &&
      sc.rulers.visible;
    A.drCine(true, true);
    A.nav('#home');
    const leave = !A.DRAW.cine && !d.body.classList.contains('dr-cine') && !A.DRAW.active;
    console.log('   sebelum ' + before + ' nyala ' + on + ' toggle ' + tog + ' esc ' + off + ' keluar ' + leave);
    return before && on && tog && off && leave;
  }
);
guard(
  'IK geometri (menu Draw): rumus tertutup cocok dengan FK, 8 solusi di pose siap, langkah KaTeX valid, Terapkan ke menu IK',
  () => {
    const dh = A.J();
    let worst = 0,
      found = 0,
      N = 300;
    for (let n = 0; n < N; n++) {
      const th = [0, 1, 2, 3, 4, 5].map(k => (((n * 37 + k * 61) * 7.3) % 360) - 180),
        T = A.igFK(th, dh),
        R = A.igSolve(T, dh, th[5]);
      for (const s of R.sols) {
        const F = A.igFK(s.th, dh);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) worst = Math.max(worst, Math.abs(F[i][j] - T[i][j]));
      }
      if (R.sols.some(s => s.th.every((v, i) => Math.abs(A.igWrap(v - th[i])) < 1e-4))) found++;
    }
    const math = worst < 1e-6 && found === N; // dekat singular pergelangan (sin θ5 hampir 0) arccos kehilangan beberapa digit, jadi toleransi 1e-6
    A.nav('#jaka-draw');
    A.applyPose(A.READY_POSE.slice(), true);
    w.toggleAccordion('dr-ik');
    A.DRAW.tgt = null;
    A.drIkRender(false);
    const n8 =
      A.DRAW.sols.length === 8 &&
      A.DRAW.sols[A.DRAW.pick].th.every((v, i) => Math.abs(A.igWrap(v - A.READY_POSE[i])) < 1e-6);
    // katex.render di QA diganti pemeriksa ketat: rumus valid meninggalkan elemen kosong, rumus salah menyisakan teks LaTeX
    const eqs = q => [...d.querySelectorAll(q + ' .dr-eq')],
      bad = q => eqs(q).filter(e => e.textContent !== '').length;
    const steps =
      d.querySelectorAll('#dr-ik-out .dr-step').length === 8 &&
      eqs('#dr-ik-out').length === 21 &&
      bad('#dr-ik-out') === 0 &&
      d.querySelectorAll('#dr-ik-out tr[data-sol]').length === 8 &&
      eqs('#dr-rule-body').length === 5 &&
      bad('#dr-rule-body') === 0;
    console.log(
      '   langkah ' +
        d.querySelectorAll('#dr-ik-out .dr-step').length +
        ', rumus IK ' +
        eqs('#dr-ik-out').length +
        ' (salah ' +
        bad('#dr-ik-out') +
        '), rumus aturan DH ' +
        eqs('#dr-rule-body').length +
        ' (salah ' +
        bad('#dr-rule-body') +
        ')'
    );
    // target di luar jangkauan: tidak ada solusi, ada penjelasan
    const tx = d.getElementById('dr-tx');
    tx.value = 3;
    tx.dispatchEvent(new w.Event('input', { bubbles: true }));
    const far = A.DRAW.sols.length === 0 && d.getElementById('dr-ik-out').textContent.includes('Tidak ada solusi');
    // target baru yang terjangkau, pilih solusi lain, terapkan ke menu IK
    [
      ['dr-tx', 0.35],
      ['dr-ty', 0.2],
      ['dr-tz', 0.3]
    ].forEach(([id, v]) => {
      const e = d.getElementById(id);
      e.value = v;
      e.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    const k = A.DRAW.sols.findIndex((s, i) => s.ok && i !== A.DRAW.pick);
    d.querySelector('#dr-ik-out tr[data-sol="' + k + '"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const picked = A.DRAW.pick === k,
      want = A.DRAW.sols[k].th.slice();
    d.querySelector('[data-dr-act="apply-ik"]').click();
    const e = A.toUser(A.eeFromThetas6());
    const applied =
      A.JK.cur === 'ik' &&
      A.J().every((j, i) => Math.abs(j.theta - want[i]) < 1e-9) &&
      Math.hypot(e.x - 0.35, e.y - 0.2, e.z - 0.3) < 1e-6 &&
      +d.getElementById('tx').value === 0.35 &&
      d.getElementById('ikStatus').textContent.includes('IK geometri');
    // struktur DH di luar pola: rumus tertutup ditolak
    dh[0].alpha = 80;
    const badStruct = !A.igStructOk(dh);
    dh[0].alpha = 90;
    A.applyPose([0, 0, 0, 0, 0, 0], true);
    A.nav('#home');
    console.log(
      '   galat FK maks ' +
        worst.toExponential(1) +
        ', asli ditemukan ' +
        found +
        '/' +
        N +
        ' | 8 solusi ' +
        n8 +
        ' langkah ' +
        steps +
        ' jauh ' +
        far +
        ' pilih ' +
        picked +
        ' terap ' +
        applied +
        ' struktur ' +
        badStruct
    );
    return math && n8 && steps && far && picked && applied && badStruct;
  }
);
guard('dashboard energi: tombol lama membuka halaman Blok Diagram dengan upside bar tab Energi', () => {
  A.nav('#home');
  A.openDash();
  const ok =
    d.body.dataset.mode === 'jaka' &&
    A.JK.cur === 'bd' &&
    !d.getElementById('bd-up').hidden &&
    d.getElementById('dashModal').classList.contains('open') &&
    !d.querySelector('.bd-up-panel[data-panel="energi"]').hidden;
  A.closeDash();
  return ok && d.getElementById('bd-up').hidden && !d.getElementById('dashModal').classList.contains('open');
});
guard('blok diagram: alur baku valid; tukar IK dan FK jadi tidak valid dengan pesan tipe; blok tidak menyala', () => {
  A.nav('#jaka-bd');
  A.bdResetFlow();
  const v0 = A.bdValidate();
  A.bdSwapIkFk();
  const v1 = A.bdValidate();
  const msg = v1.errors.join(' ');
  A.TRAJ.playing = true;
  w.__ticks.forEach(f => f());
  const lit = d.querySelectorAll('#bd-svg .bd-on').length;
  A.TRAJ.playing = false;
  const st = d.getElementById('bd-valid');
  const ok =
    v0.valid &&
    v0.errors.length === 0 &&
    !v1.valid &&
    msg.includes('Forward Kinematics butuh masukan sudut sendi') &&
    lit === 0 &&
    st.className.includes('bad') &&
    d.querySelectorAll('#bd-svg .bd-bad').length > 0;
  A.bdResetFlow();
  return ok && A.bdValidate().valid;
});
guard('blok diagram: sambung ulang dan hapus sambungan; satu masukan per blok', () => {
  A.bdResetFlow();
  const n0 = A.BD.edges.length;
  A.bdConnect('b2', 'b5');
  const e1 = A.BD.edges.filter(e => e[1] === 'b5');
  const bad = !A.bdValidate().valid;
  A.bdResetFlow();
  d.querySelector('#bd-svg [data-edge="7"]').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  const del = A.BD.edges.length === n0 - 1 && A.bdValidate().warns.some(t => t.includes('Jalur arus'));
  A.bdResetFlow();
  return e1.length === 1 && e1[0][0] === 'b2' && bad && del;
});
guard('blok Setpoint: p, ṗ, p̈ dari 0 Zone (p0 = FK(θ0), kecepatan dan percepatan nol)', () => {
  A.zzUnlock();
  const none = A.bdSetpoint() === null;
  A.J().forEach((j, i) => (j.theta = [0, 90, -90, 90, 90, 0][i]));
  A.zzLock();
  const sp = A.bdSetpoint();
  const e = A.toUser(A.eeFromThetas6(A.ZZ.q0));
  const ok =
    sp &&
    Math.abs(sp.p[0] - e.x) < 1e-9 &&
    Math.abs(sp.p[2] - e.z) < 1e-9 &&
    sp.v.every(x => x === 0) &&
    sp.a.every(x => x === 0);
  A.nav('#jaka-bd');
  w.__ticks.forEach(f => f());
  const live = d.getElementById('bd-live-b1').textContent;
  return (
    none &&
    ok &&
    live.startsWith('p₀ = ') &&
    d.querySelector('#bd-svg .bd-block[data-id="b1"] .bd-title').textContent === 'Setpoint'
  );
});
guard(
  'Play berulang: ditolak tanpa 0 Zone dan saat alur tidak valid; berjalan dari 0 Zone; siklus tercatat; aliran data terisi',
  () => {
    A.nav('#jaka-bd');
    A.bdResetFlow();
    A.TRAJ.plan = null;
    A.TRAJ.playing = false;
    A.zzUnlock();
    A.bdPlay();
    const noZz = !A.TRAJ.playing && d.getElementById('bd-run-st').textContent.includes('0 Zone');
    A.J().forEach((j, i) => (j.theta = [0, 90, -90, 90, 90, 0][i]));
    A.zzLock();
    A.bdSwapIkFk();
    A.bdPlay();
    const noFlow = !A.TRAJ.playing && d.getElementById('bd-run-st').textContent.includes('tidak valid');
    A.bdResetFlow();
    A.bdPlay();
    const run = A.TRAJ.playing && A.BDLOOP.on && A.TRAJ.plan.segs[8].label === 'Kembali ke 0 Zone';
    const tickS = w.__ticks.find(f => String(f).includes('bdStreamTick') || f.name === 'bdStreamTick');
    A.TRAJ.t = 1.0;
    w.bdStreamTick();
    const row = d.getElementById('bd-last').textContent.includes('τ maks');
    A.TRAJ.t = A.TRAJ.plan.D;
    A.bdCycleDone();
    const cyc = A.BDLOOP.cycle === 1 && d.getElementById('bd-cycles').textContent.includes('3 kg');
    A.bdStop();
    return noZz && noFlow && run && row && cyc && !A.BDLOOP.on && !A.TRAJ.playing;
  }
);
guard('diagram blok menyala saat trajectory berjalan', () => {
  A.nav('#jaka-bd');
  A.TRAJ.playing = true;
  w.__ticks.forEach(f => f());
  const on = d.querySelectorAll('#bd-svg .bd-on').length;
  A.TRAJ.playing = false;
  w.__ticks.forEach(f => f());
  return on === 8 && d.querySelectorAll('#bd-svg .bd-on').length === 0;
});
guard('Jacobian linear cocok dengan turunan numerik FK', () => {
  const th0 = [20, -35, 50, 10, -25, 40],
    h = 0.01,
    toDh = v => [v.x, -v.z, v.y];
  th0.forEach((v, i) => (A.J()[i].theta = v));
  const J = A.jacobian6().J,
    p0 = toDh(A.eeFromThetas6());
  let me = 0; // J dihitung SETELAH pose uji dipasang
  for (let i = 0; i < 6; i++) {
    const t = th0.slice();
    t[i] += h;
    A.J().forEach((j, k) => (j.theta = t[k]));
    const p1 = toDh(A.eeFromThetas6());
    for (let k = 0; k < 3; k++) me = Math.max(me, Math.abs((p1[k] - p0[k]) / ((h * Math.PI) / 180) - J[k][i]));
  }
  A.J().forEach((j, k) => (j.theta = th0[k]));
  console.log('   selisih maks Jacobian vs beda hingga: ' + me.toExponential(1) + ' m/rad');
  return me < 1e-3;
});

// kinerja kasar (Node, tanpa GPU): waktu per operasi
guard('kinerja: applyPose cepat dan tick 10 Hz murah', () => {
  const t0 = Date.now();
  for (let k = 0; k < 200; k++) {
    clock += 100;
    A.J()[1].theta = k % 60;
    A.updateFK6();
  }
  const fk = (Date.now() - t0) / 200;
  const t1 = Date.now();
  for (let k = 0; k < 200; k++) {
    clock += 100;
    tick();
  }
  const tk = (Date.now() - t1) / 200;
  console.log(
    '   updateFK6 penuh: ' + fk.toFixed(2) + ' ms | tick 10 Hz: ' + tk.toFixed(2) + ' ms (dalam Node, tanpa render GPU)'
  );
  // tk longgar (60 ms): gravityTorque per tick cukup berat di Node tanpa JIT warmup panjang, bukan regresi kode
  return fk < 25 && tk < 60;
});
guard('audit matematika (audit_math.js): semua rumus cocok dengan perhitungan independen', () => {
  const o = require('child_process').execSync('node audit_math.js', { cwd: __dirname, encoding: 'utf8' });
  const m = o.match(/RINGKASAN AUDIT: (\d+)\/(\d+)/);
  if (m) console.log('   audit ' + m[1] + '/' + m[2]);
  return m && m[1] === m[2];
});

// ---- v2.0: layar judul, dashboard utama, Settings koneksi, Start Control ----
guard(
  'v2.0: alur layar judul ke Dashboard (Enter atau tombol Mulai), kartu menuju Simulation, Settings, Start Control',
  () => {
    A.nav('#start');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' }));
    const a = d.body.dataset.mode === 'dash';
    const go = h => {
      A.nav('#dash');
      d.querySelector('#dash-menu [data-nav="' + h + '"]').click();
      return d.body.dataset.mode;
    };
    const m = [go('#home'), go('#settings'), go('#control')];
    A.nav('#start');
    d.getElementById('st-go').click();
    const b = d.body.dataset.mode === 'dash';
    A.nav('#home');
    d.querySelector('#sim-back button').click();
    const back = d.body.dataset.mode === 'dash';
    A.nav('#settings');
    d.querySelector('#app-settings [data-nav="#dash"]').click();
    const sb = d.body.dataset.mode === 'dash';
    return a && b && back && sb && m.join() === 'home,settings,control';
  }
);
guard('v2.0: Settings koneksi robot tersimpan (IP, Python, batas kecepatan, pemetaan sendi)', () => {
  A.nav('#settings');
  const ip = d.getElementById('set-ctl-ip'),
    cap = d.getElementById('set-ctl-cap');
  ip.value = '192.168.1.50';
  ip.dispatchEvent(new w.Event('change'));
  cap.value = '250';
  cap.dispatchEvent(new w.Event('change'));
  const sg = d.querySelector('#set-ctl-map input[data-k="sign"][data-i="2"]');
  sg.value = '-5';
  sg.dispatchEvent(new w.Event('change'));
  const st = JSON.parse(w.localStorage.getItem('jakaSimSettings')).ctl;
  const ok =
    st.ip === '192.168.1.50' &&
    st.cap === 100 &&
    cap.value === '100' &&
    st.sign[2] === -1 &&
    sg.value === '-1' &&
    d.querySelectorAll('#set-ctl-map input').length === 12;
  sg.value = '1';
  sg.dispatchEvent(new w.Event('change'));
  cap.value = '30';
  cap.dispatchEvent(new w.Event('change'));
  A.nav('#dash');
  return ok;
});
guard(
  'v2.0: Start Control di browser (tanpa jembatan): mode lihat saja, model 3D tanpa balok, tombol gerak nonaktif',
  () => {
    A.nav('#control');
    const C = A.CTL;
    return (
      d.body.dataset.mode === 'control' &&
      !d.getElementById('ctl-nobridge').hidden &&
      d.getElementById('ctl-conn').disabled &&
      C.scene &&
      C.scene.partGroups.length === 7 &&
      C.scene.weights.length === 0 &&
      C.ghost.length === 7 &&
      d.querySelectorAll('#ctl-jog-j .ctl-jb').length === 12 &&
      d.querySelectorAll('#ctl-jog-c .ctl-jb').length === 12 &&
      [...d.querySelectorAll('.ctl-jb')].every(b => b.disabled)
    );
  }
);
guard('v2.0: Set Posisi FK memberi posisi model yang sama dengan simulator dan bayangan target', () => {
  A.ctlTab('pos');
  const ins = [...d.querySelectorAll('#ctl-fk-in input')];
  [20, 60, -50, 110, 95, 50].forEach((v, i) => (ins[i].value = v));
  A.ctlFkPreview();
  const out = d.getElementById('ctl-fk-out').textContent;
  return out.includes('643.3, 365.4, 520.9') && A.CTL.ghost.every(g => g.visible);
});
guard('v2.0: Set Posisi IK geometri: sampai 8 solusi, solusi bawaan layak dan kembali ke target lewat FK', () => {
  const ins = [...d.querySelectorAll('#ctl-ik-in input')];
  [450, 120, 300, 0, 0, 0].forEach((v, i) => (ins[i].value = v));
  d.getElementById('ctl-ik-keep').checked = true;
  A.ctlIkSolve();
  const I = A.CTL.ik,
    S = I.sols[A.CTL.pick],
    p = A.ctlPose(A.ctlFK(S.th));
  const near = Math.hypot(p[0] - 450, p[1] - 120, p[2] - 300);
  return (
    I.sols.length === 8 &&
    S.ok &&
    near < 0.01 &&
    d.querySelectorAll('#ctl-ik-sols .ctl-sol').length === 8 &&
    S.th.every((v, i) => v >= A.CTL_LIM[i][0] && v <= A.CTL_LIM[i][1])
  );
});
guard('v2.0: sidebar persamaan: DH, matriks, FK, Jacobian, langkah IK dirender KaTeX tanpa galat', () => {
  A.ctlEqOpen(true);
  const eqs = [...d.querySelectorAll('#ctl-eq-body > div')],
    n = eqs.length,
    err = eqs.filter(e => e.textContent !== '').length; // validator ketat: rumus valid = elemen kosong
  const ik = [...d.querySelectorAll('#ctl-eq-body h3')].some(h => h.textContent.includes('Inverse kinematics'));
  const open = d.getElementById('ctl-eq').classList.contains('open');
  A.ctlEqOpen(false);
  console.log('   rumus di sidebar: ' + n + ', galat ' + err);
  return open && n >= 15 && err === 0 && ik;
});
guard('v2.0: status robot (event jembatan) menggerakkan model, HUD, lampu, dan cek model vs controller', () => {
  const C = A.CTL;
  const q = [10, 80, -70, 80, 90, 20],
    p = A.ctlPose(A.ctlFK(q));
  C.conn = true;
  C.mode = 'virtual';
  A.ctlState({
    connected: true,
    mode: 'virtual',
    ip: 'virtual',
    power: true,
    enabled: true,
    estop: false,
    moving: false,
    q,
    tcp: p,
    t: 1
  });
  const lamp = d.getElementById('ctl-lamp').dataset.s === 'green',
    hud = d.getElementById('ctl-tz').textContent === p[2].toFixed(1) + ' mm';
  const chk = d.getElementById('ctl-check').textContent.includes('selisih 0.00 mm');
  const jb = [...d.querySelectorAll('.ctl-jb')].every(b => !b.disabled);
  A.ctlState({
    connected: true,
    mode: 'virtual',
    power: true,
    enabled: true,
    estop: false,
    q,
    tcp: [p[0] + 30, p[1], p[2], 0, 0, 0],
    t: 2
  });
  const bad = d.getElementById('ctl-check').classList.contains('bad');
  A.ctlState({ connected: true, power: true, enabled: false, estop: true, q, tcp: p, t: 3 });
  const red =
    d.getElementById('ctl-lamp').dataset.s === 'red' && [...d.querySelectorAll('.ctl-jb')].every(b => b.disabled);
  A.ctlState({ connected: false });
  return lamp && hud && chk && jb && bad && red && !C.conn && d.getElementById('ctl-lamp').dataset.s === 'off';
});
guard(
  'v2.0: jog lewat jembatan tiruan: tahan = jog kontinu + sinyal hidup, lepas = jog_stop; mode langkah = satu perintah',
  () => {
    const C = A.CTL,
      calls = [];
    w.jakaBridge = {
      start: async () => ({ python: '3.11', py: 'py -3', arch: '64bit', sdk: true }),
      call: (c, a) => {
        calls.push([c, a]);
        return Promise.resolve(0);
      },
      send: c => calls.push([c]),
      onEvent: () => () => {}
    };
    C.bridge = { python: '3.11', py: 'py -3', arch: '64bit', sdk: true };
    C.conn = true;
    A.ctlState({
      connected: true,
      power: true,
      enabled: true,
      estop: false,
      q: [0, 90, -90, 90, 90, 0],
      tcp: [482, 114, 443, 180, 0, -90],
      t: 4
    });
    const b = d.querySelector('#ctl-jog-j .ctl-jb[data-axis="1"][data-dir="1"]');
    b.dispatchEvent(new w.Event('pointerdown'));
    const keep = w.__ticks[w.__ticks.length - 1];
    keep();
    keep();
    const act = b.classList.contains('act');
    b.dispatchEvent(new w.Event('pointerup'));
    d.querySelector('#ctl-step [data-v="5"]').click();
    d.querySelector('#ctl-jog-c .ctl-jb[data-axis="2"][data-dir="-1"]').dispatchEvent(new w.Event('pointerdown'));
    d.querySelector('#ctl-step [data-v="0"]').click();
    global.__jog = { calls, act, released: !b.classList.contains('act') };
    return act && !b.classList.contains('act');
  }
);
guard('v2.0: Code Template: 8 template, memuat ke editor, nomor baris ikut, kode tersimpan', () => {
  A.ctlTab('prog');
  A.ctlLoadTemplate('payload');
  const ta = d.getElementById('ctl-code');
  const lines = ta.value.split('\n').length,
    g = d.getElementById('ctl-gutter').textContent.split('\n').length;
  const saved = w.localStorage.getItem('jakaRemakeCode') === ta.value;
  return (
    A.CTL_TPL.length === 8 &&
    ta.value.includes('robot.rec_start()') &&
    lines === g &&
    saved &&
    d.querySelectorAll('#ctl-tpl-menu button').length === 8
  );
});
const errSync = errors.slice(); // galat unduhan jsdom yang selesai asinkron (uji lama) tidak dihitung
// perintah jog dikirim setelah microtask (ctlCall async): diperiksa setelah antrean kosong
setTimeout(() => {
  const c = (global.__jog || { calls: [] }).calls.map(
    x => x[0] + (x[1] && x[1].step ? ':' + x[1].step : '') + (x[1] && x[1].kind ? ':' + x[1].kind : '')
  );
  const i1 = c.indexOf('jog:joint'),
    ia = c.indexOf('jog_alive'),
    is = c.indexOf('jog_stop'),
    i2 = c.indexOf('jog:5:cart');
  T(
    'v2.0: urutan jog: jog kontinu, sinyal hidup, jog_stop saat dilepas, lalu jog langkah 5 mm',
    i1 >= 0 && ia > i1 && is > ia && i2 > is,
    c.join(',')
  );
  T('tidak ada error tertunda selama QA', errSync.length === 0, errSync.slice(0, 2).join(' ; '));
  const fails = results.filter(r => !r.ok);
  console.log(
    '\nRINGKASAN: ' +
      (results.length - fails.length) +
      '/' +
      results.length +
      ' lulus' +
      (fails.length ? ' | gagal: ' + fails.map(f => f.name).join('; ') : '')
  );
  process.exit(0);
}, 200);
