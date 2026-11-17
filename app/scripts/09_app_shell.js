/* 09_app_shell.js
   App shell: settings, router, assistant panel, Reference pages, Vector Simulation navigation.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ SESI 13: APP SHELL (Dashboard, Settings, Ambabot, konfirmasi Exit) ============ */
// Rute: #start dan #dash (v2.0, blok JAKA REMAKE), #home (halaman Simulation, dulu Dashboard), #jaka (pilihan mode JAKA), #settings, #control.
// Pengaturan disimpan di localStorage (dibungkus try/catch); modul sesi berikutnya membaca lewat appSettings.
const SETTINGS_KEY = 'jakaSimSettings';
const appSettings = { lang: 'en', reference: true, report: false, observer: false };
const LEGACY_SETTING_KEYS = { rujukan: 'reference', laporan: 'report', pengamat: 'observer' };
try {
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  Object.entries(LEGACY_SETTING_KEYS).forEach(([oldKey, newKey]) => {
    if (oldKey in s && !(newKey in s)) s[newKey] = s[oldKey];
  });
  ['lang', 'reference', 'observer', 'report'].forEach(k => {
    if (k in s) appSettings[k] = s[k];
  });
} catch (e) {}
if (appSettings.lang !== 'id') appSettings.lang = 'en'; // English first, Indonesian is a setting
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
  } catch (e) {}
}
// Rujukan efektif: dimatikan otomatis selama Mode Pengamat aktif (UserInterface.md bagian 8)
const referenceEnabled = () => appSettings.reference && !appSettings.observer;

const I18N = {
  id: {
    'home.sub':
      'Alat bantu belajar kinematika robot 6-DOF: dari vektor dan rotasi sampai forward/inverse kinematics, torsi, dan energi.',
    'home.back': '← Kembali ke menu',
    'start.sub': 'Learn Mathematics Inside Robotic Arm',
    'start.tag': 'Simple, fully visualized',
    'start.ver': 'Versi',
    'start.enter': 'tekan Enter untuk mulai',
    'models.title': 'Model Robot',
    'models.note':
      'Pilih model yang dipakai di Robot Arm Simulation, atau tambahkan model sendiri dari tabel DH. Mesh STL atau OBJ diunggah per link dan harus dinyatakan dalam frame DH link tersebut. Tanpa mesh, tubuh robot dibangkitkan dari parameter DH. Start Control tetap khusus robot JAKA ZU5 sungguhan.',
    'models.name': 'Nama model',
    'models.maker': 'Pembuat',
    'models.mass': 'Massa total (kg)',
    'models.ready': 'pose siap (°)',
    'models.mesh': 'Mesh per link (opsional)',
    'models.unit': 'Satuan berkas',
    'tutp.title': 'Tutorial',
    'tutp.sub':
      'Semua fitur ditampilkan sebagai ikon. Mulai tur interaktif untuk dipandu langkah demi langkah, atau lihat arti setiap ikon di kamus di bawah. Arahkan kursor ke ikon mana pun untuk melihat namanya.',
    'tutp.start': 'Mulai tur interaktif',
    'menu.vec': 'Vektor, rotasi, matriks homogen, DH, dan FK N-DOF.',
    'menu.jaka': 'Robot JAKA ZU5: FK, IK, blok diagram, dan Draw.',
    'menu.tut': 'Tur interaktif yang menunjukkan fungsi tiap menu.',
    'menu.set': 'Bahasa, tema, dan mode Rujukan, Laporan, Pengamat.',
    'jaka.fk': 'Atur sudut tiap sendi, lihat posisi end-effector.',
    'jaka.ik': 'Tentukan target x, y, z, sendi dihitung otomatis.',
    'jaka.bd': 'Alur sistem, parameter, rumus live, energi dan torsi.',
    'jaka.draw': 'Kerangka sumbu, visual parameter DH, dan penurunan IK.',
    'set.back': '← Kembali ke Dashboard',
    'set.title': 'Pengaturan',
    'set.lang': 'Bahasa',
    'set.lang.d': 'Bahasa tampilan aplikasi.',
    'set.theme': 'Tema',
    'set.theme.d': 'Mode gelap atau terang.',
    'set.dark': 'Gelap',
    'set.light': 'Terang',
    'set.ruj': 'Aktifkan Rujukan',
    'set.ruj.d':
      'Tampilkan tombol Rujukan di Vector Simulation dan JAKA Simulation untuk melompat ke materi terkait di Glossary.',
    'set.ruj.off': 'Dimatikan otomatis selama Mode Pengamat aktif.',
    'set.lap': 'Aktifkan Mode Laporan',
    'set.lap.d':
      'Tambahkan Simpan Konfigurasi, Reset, dan Save Report di JAKA FK, IK, dan Blok Diagram. Laporan berisi konfigurasi, penurunan rumus, data tiap 0,2 detik, dan grafik, lalu bisa diunduh sebagai PDF atau Docx.',
    'lp.badge': 'Mode Laporan aktif',
    'lp.title': 'Mode Laporan',
    'lp.save': 'Simpan Konfigurasi',
    'lp.reset': 'Reset',
    'lp.report': 'Save Report',
    'lp.flow':
      '1. Atur parameter, lalu Simpan Konfigurasi. 2. Jalankan gerak robot. 3. Save Report, lalu unduh PDF atau Docx dari daftar di bawah.',
    'lp.q.robot': 'Anda belum mengatur konfigurasi pada Parameter Robot, apakah Anda tetap ingin simpan?',
    'lp.b.keep': 'Tetap simpan',
    'lp.b.robot': 'Atur Parameter Robot',
    'lp.b.cancel': 'Batal',
    'lp.b.yes': 'Ya, reset',
    'lp.q.reset':
      'Kembalikan halaman ini ke nilai awal? Gerak robot dihentikan, pose kembali ke 0 Zone, konfigurasi tersimpan dan rekaman gerak halaman ini dihapus. Parameter Robot dan laporan yang sudah dibuat tidak ikut direset.',
    'lp.saved': 'Konfigurasi disimpan',
    'lp.reseted': 'Halaman direset',
    'lp.full': 'Penyimpanan penuh: hapus beberapa laporan lama',
    'lp.q.nocfg': 'Konfigurasi halaman ini belum disimpan. Simpan sekarang lalu buat laporan?',
    'lp.b.savego': 'Simpan dan lanjutkan',
    'lp.q.norec':
      'Belum ada rekaman gerak di halaman ini (jalankan Play atau animasi sampai selesai dulu). Tetap buat laporan tanpa data timeline?',
    'lp.b.norec': 'Tetap buat laporan',
    'lp.made': 'Laporan disimpan (belum diunduh). Pilih PDF atau Docx di daftar bar laporan.',
    'lp.fail': 'Laporan gagal disusun: ',
    'lp.made.t': 'dibuat',
    'lp.none': 'tanpa rekaman gerak',
    'lp.view': 'Pratinjau',
    'lp.del': 'Hapus',
    'lp.q.del': 'Hapus laporan ini dari daftar?',
    'lp.b.del': 'Ya, hapus',
    'lp.dl.pdf': 'Unduh PDF',
    'lp.dl.docx': 'Unduh Docx',
    'lp.close': 'Tutup',
    'lp.code': 'Lihat Kode',
    'lp.code.title': 'Kode program',
    'lp.code.copy': 'Salin kode',
    'lp.code.copied': 'Kode disalin ke papan klip',
    'lp.x.busy': 'Laporan lain sedang disiapkan, tunggu sebentar',
    'lp.x.prep': 'Menyiapkan berkas laporan...',
    'lp.x.img': 'Menggambar rumus dan grafik',
    'lp.x.done': 'Berkas diunduh:',
    'lp.x.fail': 'Gagal membuat berkas: ',
    'lp.st.cfg0': 'Konfigurasi: belum disimpan',
    'lp.st.cfg': 'Konfigurasi tersimpan:',
    'lp.st.rec0': 'Rekaman gerak: belum ada',
    'lp.st.rec': 'Rekaman gerak:',
    wip: 'Dalam pengerjaan',
    'pg.badge': 'Mode Pengamat aktif',
    'pg.blocked': 'Tidak tersedia selama Mode Pengamat aktif. Matikan di Settings.',
    'set.pen': 'Aktifkan Mode Pengamat',
    'set.pen.d':
      'Sederhanakan semua halaman simulasi: hanya input parameter dan animasi gerak robot, tanpa rumus. Rujukan ikut dimatikan selama mode ini aktif.',
    'amba.sub': 'Asisten belajar dan panduan simulator',
    'amba.soon':
      'Halo, aku Ambabot. Fitur percakapan sedang disiapkan. Nanti aku bisa membantu menjelaskan teori, cara memakai simulator, dan menyarankan nilai parameter supaya robot bergerak tanpa error.',
    'amba.ph': 'Segera hadir',
    'amba.send': 'Kirim',
    'rj.back': '← Kembali ke halaman',
    'rj.title': 'Rujukan: Materi dan Glosarium',
    'rj.exit': 'Exit',
    'legacy.ruj': 'Rujukan',
    'vs.s1': 'Vektor',
    'vs.s2': 'Rotasi',
    'vs.s3': 'Komposit',
    'vs.s4': 'Homogen',
    'vs.s5': 'FK N-DOF',
    'exit.q': 'Apakah kamu mau keluar?',
    'exit.yes': 'YA',
    'exit.no': 'TIDAK',
    'legacy.exit': 'Keluar ke Dashboard',
    'tut.skip': 'Skip',
    'tut.skipch': 'Lewati bagian',
    'tut.back': 'Kembali',
    'tut.next': 'Lanjut',
    'tut.pause': 'Jeda',
    'tut.resume': 'Teruskan',
    'tut.done': 'Tutorial selesai. Ulangi kapan saja dari menu Tutorial.',
    'tut.skipped': 'Tutorial dilewati. Ulangi kapan saja dari menu Tutorial.'
  },
  en: {
    'home.sub':
      'A learning tool for 6-DOF robot kinematics: from vectors and rotations to forward/inverse kinematics, torque, and energy.',
    'home.back': '← Back to menu',
    'start.sub': 'Learn Mathematics Inside Robotic Arm',
    'start.tag': 'Simple, fully visualized',
    'start.ver': 'Version',
    'start.enter': 'press Enter to start',
    'models.title': 'Robot Models',
    'models.note':
      "Choose the model used by Robot Arm Simulation, or add your own from a DH table. STL or OBJ meshes are uploaded per link and must be expressed in that link's DH frame. Without meshes the body is generated from the DH parameters. Start Control stays dedicated to the real JAKA ZU5.",
    'models.name': 'Model name',
    'models.maker': 'Maker',
    'models.mass': 'Total mass (kg)',
    'models.ready': 'ready pose (°)',
    'models.mesh': 'Meshes per link (optional)',
    'models.unit': 'File unit',
    'menu.jaka': 'FK, IK, block diagram and Draw for the active model.',
    'tutp.title': 'Tutorial',
    'tutp.sub':
      'Every feature is shown as an icon. Start the guided tour for a step-by-step walkthrough, or look up any icon in the guide below. Hover over an icon to see its name.',
    'tutp.start': 'Start the guided tour',
    'menu.vec': 'Vectors, rotations, homogeneous matrices, DH, and N-DOF FK.',
    'menu.jaka': 'JAKA ZU5 robot: FK, IK, block diagram, and Draw.',
    'menu.tut': 'An interactive tour of what each menu does.',
    'menu.set': 'Language, theme, and Reference, Report, Observer modes.',
    'jaka.fk': 'Set each joint angle, see the end-effector position.',
    'jaka.ik': 'Pick a target x, y, z, joints are solved automatically.',
    'jaka.bd': 'System flow, parameters, live formulas, energy and torque.',
    'jaka.draw': 'Axis skeleton, DH parameter visuals, and the IK derivation.',
    'set.back': '← Back to Dashboard',
    'set.title': 'Settings',
    'set.lang': 'Language',
    'set.lang.d': 'Display language of the app.',
    'set.theme': 'Theme',
    'set.theme.d': 'Dark or light mode.',
    'set.dark': 'Dark',
    'set.light': 'Light',
    'set.ruj': 'Enable References',
    'set.ruj.d':
      'Show a Reference button in Vector Simulation and JAKA Simulation that jumps to the related material in the Glossary.',
    'set.ruj.off': 'Turned off automatically while Observer Mode is on.',
    'set.lap': 'Enable Report Mode',
    'set.lap.d':
      'Adds Save Configuration, Reset, and Save Report to JAKA FK, IK, and Block Diagram. Reports contain the configuration, equation derivations, data every 0.2 s, and charts, and can be downloaded as PDF or Docx.',
    'lp.badge': 'Report Mode on',
    'lp.title': 'Report Mode',
    'lp.save': 'Save Configuration',
    'lp.reset': 'Reset',
    'lp.report': 'Save Report',
    'lp.flow':
      '1. Set the parameters, then Save Configuration. 2. Run the robot motion. 3. Save Report, then download PDF or Docx from the list below.',
    'lp.q.robot': 'You have not set the Robot Parameters yet. Save anyway?',
    'lp.b.keep': 'Save anyway',
    'lp.b.robot': 'Set Robot Parameters',
    'lp.b.cancel': 'Cancel',
    'lp.b.yes': 'Yes, reset',
    'lp.q.reset':
      "Return this page to its initial values? Motion stops, the pose returns to the 0 Zone, and this page's saved configuration and motion recording are cleared. Robot Parameters and existing reports are kept.",
    'lp.saved': 'Configuration saved',
    'lp.reseted': 'Page reset',
    'lp.full': 'Storage full: delete some old reports',
    'lp.q.nocfg': "This page's configuration has not been saved. Save it now and build the report?",
    'lp.b.savego': 'Save and continue',
    'lp.q.norec':
      'There is no motion recording on this page yet (run Play or the animation to the end first). Build the report without timeline data anyway?',
    'lp.b.norec': 'Build report anyway',
    'lp.made': 'Report saved (not downloaded). Choose PDF or Docx in the report bar list.',
    'lp.fail': 'Report could not be built: ',
    'lp.made.t': 'created',
    'lp.none': 'no motion recording',
    'lp.view': 'Preview',
    'lp.del': 'Delete',
    'lp.q.del': 'Delete this report from the list?',
    'lp.b.del': 'Yes, delete',
    'lp.dl.pdf': 'Download PDF',
    'lp.dl.docx': 'Download Docx',
    'lp.close': 'Close',
    'lp.code': 'View Code',
    'lp.code.title': 'Generated code',
    'lp.code.copy': 'Copy code',
    'lp.code.copied': 'Code copied to clipboard',
    'lp.x.busy': 'Another report is being prepared, please wait',
    'lp.x.prep': 'Preparing the report file...',
    'lp.x.img': 'Drawing equations and charts',
    'lp.x.done': 'File downloaded:',
    'lp.x.fail': 'Could not create the file: ',
    'lp.st.cfg0': 'Configuration: not saved',
    'lp.st.cfg': 'Configuration saved:',
    'lp.st.rec0': 'Motion recording: none',
    'lp.st.rec': 'Motion recording:',
    wip: 'In progress',
    'pg.badge': 'Observer Mode on',
    'pg.blocked': 'Not available while Observer Mode is on. Turn it off in Settings.',
    'set.pen': 'Enable Observer Mode',
    'set.pen.d':
      'Simplify every simulation page: only parameter inputs and the robot motion, no formulas. References are turned off while this mode is on.',
    'amba.sub': 'Learning assistant and simulator guide',
    'amba.soon':
      'Hi, I am Ambabot. Chat is being prepared. Soon I can explain the theory, show how to use the simulator, and suggest parameter values so the robot moves without errors.',
    'amba.ph': 'Coming soon',
    'amba.send': 'Send',
    'rj.back': '← Back to page',
    'rj.title': 'References: Material and Glossary',
    'rj.exit': 'Exit',
    'legacy.ruj': 'References',
    'vs.s1': 'Vectors',
    'vs.s2': 'Rotation',
    'vs.s3': 'Composite',
    'vs.s4': 'Homogeneous',
    'vs.s5': 'N-DOF FK',
    'exit.q': 'Do you want to leave?',
    'exit.yes': 'YES',
    'exit.no': 'NO',
    'legacy.exit': 'Exit to Dashboard',
    'tut.skip': 'Skip',
    'tut.skipch': 'Skip section',
    'tut.back': 'Back',
    'tut.next': 'Next',
    'tut.pause': 'Pause',
    'tut.resume': 'Resume',
    'tut.done': 'Tutorial finished. Replay it anytime from the Tutorial menu.',
    'tut.skipped': 'Tutorial skipped. Replay it anytime from the Tutorial menu.'
  }
};
const tr = k => (I18N[appSettings.lang] || I18N.id)[k] || I18N.id[k] || k;
function applyLang() {
  document.documentElement.lang = appSettings.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = tr(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = tr(el.dataset.i18nPh);
  });
  renderSettings();
}

function toast(msg) {
  const t = document.getElementById('app-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---- Konfirmasi Exit (dipakai semua tombol Exit di halaman Simulation) ----
let exitYes = null;
function confirmExit(onYes) {
  exitYes = onYes || (() => nav('#home'));
  document.getElementById('exit-modal').classList.add('open');
  document.getElementById('exit-no').focus();
}
function closeExit() {
  document.getElementById('exit-modal').classList.remove('open');
  exitYes = null;
}
document.getElementById('exit-yes').addEventListener('click', () => {
  const f = exitYes;
  closeExit();
  if (f) f();
});
document.getElementById('exit-no').addEventListener('click', closeExit);
document.getElementById('exit-modal').addEventListener('click', e => {
  if (e.target.id === 'exit-modal') closeExit();
});

// ---- Router ----
function route(h) {
  h = h || '#start';
  if (h !== '#jaka-draw') drLeave();
  if (h !== '#jaka-bd') bdPop(false);
  if (h !== '#control' && typeof ctlLeave === 'function') ctlLeave();
  const home = document.getElementById('app-home');
  if (h.startsWith('#tab-')) {
    const btn = document.querySelector('.tab-btn[data-view="' + h.slice(5) + '"]');
    if (btn) {
      document.body.dataset.mode = 'legacy';
      btn.click();
      window.scrollTo(0, 0);
      return;
    }
    h = '#home';
  }
  if (h === '#start') {
    document.body.dataset.mode = 'start';
  } else if (h === '#dash') {
    document.body.dataset.mode = 'dash';
    dashRefresh();
  } else if (h === '#control') {
    document.body.dataset.mode = 'control';
    ctlEnter();
    window.scrollTo(0, 0);
    return;
  } else if (h === '#settings') {
    document.body.dataset.mode = 'settings';
    renderSettings();
    ctlSettingsBuild();
  } else if (h === '#vector' || /^#vector-[1-5]$/.test(h)) {
    document.body.dataset.mode = 'vector';
    vsShow(h === '#vector' ? VS.cur : +h.slice(8));
    return;
  } else if (h === '#jaka-fk' || h === '#jaka-ik' || h === '#jaka-bd' || h === '#jaka-draw') {
    document.body.dataset.mode = 'jaka';
    jkShow(h.slice(6));
    return;
  } else if (h === '#models') {
    document.body.dataset.mode = 'models';
    renderModelList();
  } else if (h === '#tutorial') {
    document.body.dataset.mode = 'tutorial';
    renderIconGuide(document.getElementById('icon-guide'));
    renderPageNotes(document.getElementById('page-notes'));
  } else if (h === '#reference' && referenceEnabled()) {
    document.body.dataset.mode = 'reference';
    document.getElementById('rj-back').style.display = REF_STATE.from ? '' : 'none';
  } else {
    document.body.dataset.mode = 'home';
    home.classList.toggle('jaka', h === '#jaka');
  }
  window.scrollTo(0, 0);
}
function nav(h) {
  try {
    if (location.hash !== h) history.pushState(null, '', h);
  } catch (e) {}
  route(h);
}
window.addEventListener('popstate', () => route(location.hash));
document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => nav(el.dataset.nav)));
document.getElementById('menu-tutorial').addEventListener('click', () => nav('#tutorial'));
document.getElementById('tut-start-tour').addEventListener('click', () => tutorialStart());
// Tombol Exit di halaman lama (selama migrasi): selalu lewat konfirmasi

// ---- Settings ----
function renderSettings() {
  document
    .querySelectorAll('#set-lang button')
    .forEach(b => b.classList.toggle('on', b.dataset.v === appSettings.lang));
  document.querySelectorAll('#set-theme button').forEach(b => b.classList.toggle('on', b.dataset.v === currentTheme()));
  const r = document.getElementById('set-reference');
  r.setAttribute('aria-checked', String(referenceEnabled()));
  r.disabled = appSettings.observer;
  document.getElementById('set-ruj-d').textContent = appSettings.observer ? tr('set.ruj.off') : tr('set.ruj.d');
  document.getElementById('set-observer').setAttribute('aria-checked', String(appSettings.observer));
  document.getElementById('set-report').setAttribute('aria-checked', String(appSettings.report));
  document.body.classList.toggle('mode-report', appSettings.report);
  document.body.classList.toggle('mode-observer', appSettings.observer);
  document.body.classList.toggle('reference-on', referenceEnabled());
  document.dispatchEvent(new Event('observerchange'));
}
document.querySelectorAll('#set-lang button').forEach(b =>
  b.addEventListener('click', () => {
    appSettings.lang = b.dataset.v;
    saveSettings();
    applyLang();
  })
);
document.querySelectorAll('#set-theme button').forEach(b =>
  b.addEventListener('click', () => {
    setTheme(b.dataset.v);
    renderSettings();
  })
);
document.getElementById('set-reference').addEventListener('click', () => {
  if (appSettings.observer) return;
  appSettings.reference = !appSettings.reference;
  saveSettings();
  renderSettings();
});
document.getElementById('set-observer').addEventListener('click', () => {
  appSettings.observer = !appSettings.observer;
  saveSettings();
  renderSettings();
});
document.getElementById('set-report').addEventListener('click', () => {
  appSettings.report = !appSettings.report;
  saveSettings();
  renderSettings();
});
themeHooks.push(() => renderSettings());

// ---- Ambabot (kerangka; logika chat di Sesi 20) ----
function setAssistant(open) {
  document.getElementById('assistant-panel').classList.toggle('open', open);
  document.getElementById('assistant-panel').setAttribute('aria-hidden', String(!open));
  document.getElementById('assistant-btn').setAttribute('aria-expanded', String(open));
}
document
  .getElementById('assistant-btn')
  .addEventListener('click', () =>
    setAssistant(!document.getElementById('assistant-panel').classList.contains('open'))
  );
document.getElementById('assistant-close').addEventListener('click', () => setAssistant(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeExit();
    setAssistant(false);
  }
});

/* ============ SESI 14: RUJUKAN (lompat ke titik materi, kembali ke halaman asal) ============ */
// Peta halaman lama ke titik materi. Halaman baru (Sesi 15-17) memanggil gotoReference(id) langsung.
const REFERENCE_MAP = {
  v1: 'rj-vektor',
  v2: 'rj-rotasi',
  v3: 'rj-rotasi-komposit',
  v4: 'rj-homogen',
  v5: 'rj-fk',
  v7: 'pd-fk',
  v8: 'pd-ik',
  v9: 'pd-dh'
};
const REF_STATE = { from: null };
function currentRouteHash() {
  if (document.body.dataset.mode === 'legacy') {
    const b = document.querySelector('.tab-btn.active');
    return b ? '#tab-' + b.dataset.view : '#home';
  }
  if (document.body.dataset.mode === 'settings') return '#settings';
  if (document.body.dataset.mode === 'vector') return '#vector-' + VS.cur;
  if (document.body.dataset.mode === 'jaka') return '#jaka-' + JK.cur;
  return document.getElementById('app-home').classList.contains('jaka') ? '#jaka' : '#home';
}
function refFlash(t) {
  t.classList.remove('pd-hl');
  void t.offsetWidth;
  t.classList.add('pd-hl');
}
function gotoReference(id) {
  if (!referenceEnabled()) {
    toast(tr(appSettings.observer ? 'pg.blocked' : 'set.ruj.d'));
    return;
  }
  if (document.body.dataset.mode !== 'reference') REF_STATE.from = { hash: currentRouteHash(), y: window.scrollY || 0 };
  nav('#reference');
  const t = document.getElementById(id);
  if (t) {
    t.scrollIntoView({ block: 'start' });
    refFlash(t);
    refMarkToc(id);
  }
}
function refMarkToc(id) {
  document.querySelectorAll('.rj-toc a').forEach(a => a.classList.toggle('on', a.dataset.goto === id));
}
function refBack() {
  const f = REF_STATE.from || { hash: '#home', y: 0 };
  REF_STATE.from = null;
  nav(f.hash);
  window.scrollTo(0, f.y);
}
document.getElementById('rj-back').addEventListener('click', refBack);
document.getElementById('rj-exit').addEventListener('click', () =>
  confirmExit(() => {
    REF_STATE.from = null;
    nav('#home');
  })
);

document.querySelectorAll('.rj-toc a').forEach(a => a.addEventListener('click', () => refMarkToc(a.dataset.goto)));
// Di mode lama, klik tab ikut memperbarui alamat supaya muat ulang dan tombol Back browser tetap di halaman yang sama
document.querySelectorAll('.tab-btn').forEach(b =>
  b.addEventListener('click', () => {
    if (document.body.dataset.mode === 'legacy') {
      try {
        history.replaceState(null, '', '#tab-' + b.dataset.view);
      } catch (e) {}
    }
  })
);
// Sorot bagian yang sedang dibaca di daftar isi
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    es => {
      es.forEach(e => {
        if (e.isIntersecting && document.body.dataset.mode === 'reference') refMarkToc(e.target.id);
      });
    },
    { rootMargin: '-90px 0px -70% 0px' }
  );
  document.querySelectorAll('.rj-toc a').forEach(a => {
    const t = document.getElementById(a.dataset.goto);
    if (t) io.observe(t);
  });
}

/* ============ SESI 15: VECTOR SIMULATION (5 sub-halaman, navigasi bola, Exit, Rujukan) ============ */
const VS = {
  cur: 1,
  titles: ['Vektor & Dot Product', 'Rotasi Dasar', 'Rotasi Komposit', 'Matriks Homogen & DH', 'FK N-DOF (3D)'],
  reference: { 1: 'rj-vektor', 2: 'rj-rotasi', 3: 'rj-rotasi-komposit', 4: 'rj-homogen', 5: 'rj-fk' }
};
function vsShow(n) {
  n = Math.min(5, Math.max(1, n | 0 || 1));
  VS.cur = n;
  document.querySelectorAll('#app-vector .vs-page').forEach(p => p.classList.toggle('active', +p.dataset.vs === n));
  document.querySelectorAll('.vs-ball[data-vs]').forEach(b => {
    const on = +b.dataset.vs === n;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  document.getElementById('vs-title').textContent = n + '. ' + VS.titles[n - 1];
  try {
    if (location.hash !== '#vector-' + n) history.replaceState(null, '', '#vector-' + n);
  } catch (e) {}
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event('resize')); // kanvas yang baru tampil mengukur ulang ukurannya
}
document.querySelectorAll('.vs-ball[data-vs]').forEach(b => b.addEventListener('click', () => vsShow(+b.dataset.vs)));
document.getElementById('vs-exit').addEventListener('click', () => confirmExit(() => nav('#home')));
document.getElementById('vs-reference').addEventListener('click', () => gotoReference(VS.reference[VS.cur]));
