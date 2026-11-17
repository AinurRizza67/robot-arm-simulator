/* 00_icons.js
   Icon system: every feature button is shown as an icon (Phosphor, regular weight, data in 00_icon_data.js).
   The original label becomes the accessible name (aria-label) and the hover tooltip, and the Tutorial page lists
   every icon with its meaning. Buttons whose label changes at runtime (Play/Pause, language switch) are re-iconized
   by a MutationObserver, so feature code can keep setting textContent as before.
   Classic script: all files share one global scope and are loaded in order by index.html. */

// group ids are used by the icon guide in the Tutorial page
const ICON_GROUPS = [
  { id: 'nav', name: { id: 'Navigasi', en: 'Navigation' } },
  { id: 'motion', name: { id: 'Simulasi dan gerak', en: 'Simulation and motion' } },
  { id: 'view', name: { id: 'Tampilan dan kamera', en: 'View and camera' } },
  { id: 'kin', name: { id: 'Kinematika', en: 'Kinematics' } },
  { id: 'data', name: { id: 'Data, kode, dan laporan', en: 'Data, code and report' } },
  { id: 'robot', name: { id: 'Robot nyata (Start Control)', en: 'Real robot (Start Control)' } },
  { id: 'config', name: { id: 'Konfigurasi', en: 'Configuration' } }
];

// match: normalized button labels (Indonesian and English) that map to this icon
const ICON_RULES = [
  // navigation
  {
    icon: 'arrow-left',
    group: 'nav',
    match: [
      'kembali ke dashboard',
      'kembali ke menu',
      'kembali ke halaman',
      'dashboard',
      'kembali',
      'back to dashboard',
      'back to menu',
      'back to page',
      'back'
    ],
    desc: { id: 'Kembali ke halaman sebelumnya', en: 'Go back to the previous page' }
  },
  {
    icon: 'arrow-left',
    group: 'nav',
    match: ['exit', 'keluar', 'exit to dashboard'],
    desc: { id: 'Kembali ke menu (dengan konfirmasi)', en: 'Back to the menu (asks for confirmation)' }
  },
  {
    icon: 'x',
    group: 'nav',
    match: ['tutup', 'close', '×', 'x tutup', 'batal', 'cancel'],
    desc: { id: 'Tutup panel atau batalkan', en: 'Close the panel or cancel' }
  },
  {
    icon: 'check',
    group: 'nav',
    match: ['ya, lanjutkan', 'ya', 'yes', 'yes, continue'],
    desc: { id: 'Setuju dan lanjutkan', en: 'Confirm and continue' }
  },
  { icon: 'x-circle', group: 'nav', match: ['tidak', 'no'], desc: { id: 'Tidak jadi', en: 'Do not continue' } },
  { icon: 'arrow-right', group: 'nav', match: ['lanjut', 'next'], desc: { id: 'Langkah berikutnya', en: 'Next step' } },
  {
    icon: 'skip-forward',
    group: 'nav',
    match: ['skip', 'lewati'],
    desc: { id: 'Lewati tutorial', en: 'Skip the tutorial' }
  },
  {
    icon: 'fast-forward',
    group: 'nav',
    match: ['lewati bagian', 'skip section'],
    desc: { id: 'Lewati satu bagian tutorial', en: 'Skip one tutorial section' }
  },
  {
    icon: 'play-circle',
    group: 'nav',
    match: ['mulai', 'start'],
    desc: { id: 'Masuk ke dashboard', en: 'Enter the dashboard' }
  },
  {
    icon: 'arrow-left',
    group: 'nav',
    match: ['layar judul', 'title screen'],
    desc: { id: 'Kembali ke layar judul', en: 'Back to the title screen' }
  },
  {
    icon: 'book-open',
    group: 'nav',
    match: ['rujukan', 'reference', 'references'],
    desc: { id: 'Buka materi Rujukan untuk halaman ini', en: 'Open the Reference material for this page' }
  },
  {
    icon: 'book-open-text',
    group: 'nav',
    match: ['buka di rujukan', 'open in reference'],
    desc: { id: 'Buka penjelasan lengkap di Rujukan', en: 'Open the full explanation in Reference' }
  },
  {
    icon: 'paper-plane-right',
    group: 'nav',
    match: ['kirim', 'send'],
    desc: { id: 'Kirim pesan', en: 'Send message' }
  },
  {
    icon: 'lock-simple',
    group: 'motion',
    match: ['kunci 0 zone', 'lock 0 zone', 'kunci', 'lock'],
    desc: { id: 'Kunci pose awal (0 Zone)', en: 'Lock the initial pose (0 Zone)' }
  },
  {
    icon: 'lock-simple-open',
    group: 'motion',
    match: ['buka kunci', 'buka kunci 0 zone', 'unlock', 'unlock 0 zone'],
    desc: { id: 'Buka kunci pose awal', en: 'Unlock the initial pose' }
  },
  {
    icon: 'camera',
    group: 'view',
    match: ['simpan gambar pose (png)', 'save pose image (png)'],
    desc: { id: 'Simpan gambar pose (PNG)', en: 'Save a pose image (PNG)' }
  },
  // motion
  {
    icon: 'play',
    group: 'motion',
    match: ['play', 'jalankan', 'run'],
    desc: { id: 'Jalankan gerak atau program', en: 'Run the motion or program' }
  },
  {
    icon: 'pause',
    group: 'motion',
    match: ['pause', 'jeda', 'resume', 'lanjutkan'],
    desc: { id: 'Jeda atau lanjutkan', en: 'Pause or resume' }
  },
  { icon: 'stop', group: 'motion', match: ['stop', 'berhenti'], desc: { id: 'Hentikan gerak', en: 'Stop the motion' } },
  {
    icon: 'repeat',
    group: 'motion',
    match: ['jalankan berulang', 'run repeatedly', 'loop'],
    desc: { id: 'Jalankan alur berulang-ulang', en: 'Run the flow repeatedly' }
  },
  {
    icon: 'arrow-counter-clockwise',
    group: 'motion',
    match: [
      'reset',
      'reset ke nilai default (step)',
      'reset ke alur baku',
      'reset to default (step)',
      'reset to default flow'
    ],
    desc: { id: 'Kembalikan ke nilai awal', en: 'Restore the initial values' }
  },
  {
    icon: 'battery-empty',
    group: 'motion',
    match: ['reset energi', 'reset energy'],
    desc: { id: 'Nolkan akumulasi energi', en: 'Reset the accumulated energy' }
  },
  {
    icon: 'crosshair',
    group: 'motion',
    match: ['ke 0 zone', 'to 0 zone'],
    desc: { id: 'Kembali ke pose 0 Zone (titik awal)', en: 'Go to the 0 Zone pose (initial pose)' }
  },
  {
    icon: 'house-line',
    group: 'motion',
    match: ['pose siap', 'pose siap (0, 90, -90, 90, 90, 0)', 'ready pose'],
    desc: { id: 'Pose siap (0, 90, -90, 90, 90, 0)°', en: 'Ready pose (0, 90, -90, 90, 90, 0)°' }
  },
  {
    icon: 'circle-dashed',
    group: 'motion',
    match: ['pose nol', 'pose nol step', 'zero pose', 'step zero pose'],
    desc: { id: 'Semua sudut sendi nol', en: 'All joint angles at zero' }
  },
  {
    icon: 'arrows-clockwise',
    group: 'motion',
    match: ['animasi sapuan sendi 1', 'sweep joint 1'],
    desc: { id: 'Animasi sapuan sendi 1', en: 'Animate a sweep of joint 1' }
  },
  {
    icon: 'eraser',
    group: 'motion',
    match: ['hapus jejak', 'clear trace', 'clear'],
    desc: { id: 'Hapus jejak atau grafik', en: 'Clear the trace or plot' }
  },
  // view
  { icon: 'cube', group: 'view', match: ['iso'], desc: { id: 'Kamera isometrik', en: 'Isometric camera' } },
  {
    icon: 'arrow-line-up',
    group: 'view',
    match: ['depan', 'front'],
    desc: { id: 'Kamera dari depan', en: 'Front camera' }
  },
  {
    icon: 'arrow-line-right',
    group: 'view',
    match: ['samping', 'side'],
    desc: { id: 'Kamera dari samping', en: 'Side camera' }
  },
  {
    icon: 'arrow-line-down',
    group: 'view',
    match: ['atas', 'top'],
    desc: { id: 'Kamera dari atas', en: 'Top camera' }
  },
  {
    icon: 'eye-slash',
    group: 'view',
    match: ['off', 'semua mati', 'all off'],
    desc: { id: 'Sembunyikan grid atau semua elemen', en: 'Hide the grid or all elements' }
  },
  { icon: 'grid-four', group: 'view', match: ['lines'], desc: { id: 'Grid garis', en: 'Line grid' } },
  { icon: 'hash', group: 'view', match: ['numbers'], desc: { id: 'Grid dengan angka', en: 'Grid with numbers' } },
  {
    icon: 'eye',
    group: 'view',
    match: ['semua nyala', 'all on', 'toggle tampilan', 'toggle view'],
    desc: { id: 'Tampilkan semua elemen', en: 'Show all elements' }
  },
  {
    icon: 'target',
    group: 'view',
    match: ['target: tampil', 'target: sembunyi', 'target: shown', 'target: hidden'],
    desc: { id: 'Tampilkan atau sembunyikan target', en: 'Show or hide the target' }
  },
  {
    icon: 'film-slate',
    group: 'view',
    match: ['cinematic', 'masuk cinematic', 'enter cinematic'],
    desc: { id: 'Mode Cinematic layar penuh', en: 'Full-screen cinematic mode' }
  },
  {
    icon: 'arrows-in-simple',
    group: 'view',
    match: ['keluar cinematic (esc)', 'exit cinematic (esc)'],
    desc: { id: 'Keluar dari Cinematic', en: 'Leave cinematic mode' }
  },
  {
    icon: 'vector-three',
    group: 'view',
    match: ['axis draw'],
    desc: { id: 'Gambar kerangka sumbu DH', en: 'Draw the DH axis skeleton' }
  },
  { icon: 'moon', group: 'view', match: ['gelap', 'dark'], desc: { id: 'Tema gelap', en: 'Dark theme' } },
  { icon: 'sun', group: 'view', match: ['terang', 'light'], desc: { id: 'Tema terang', en: 'Light theme' } },
  // kinematics and pages
  {
    icon: 'angle',
    group: 'kin',
    match: ['fk'],
    desc: { id: 'Forward kinematics: sudut sendi ke pose', en: 'Forward kinematics: joint angles to pose' }
  },
  {
    icon: 'target',
    group: 'kin',
    match: ['ik'],
    desc: { id: 'Inverse kinematics: pose ke sudut sendi', en: 'Inverse kinematics: pose to joint angles' }
  },
  {
    icon: 'flow-arrow',
    group: 'kin',
    match: ['blok diagram', 'block diagram', 'buka blok diagram', 'open block diagram', 'aliran data', 'data flow'],
    desc: { id: 'Blok diagram sistem', en: 'System block diagram' }
  },
  {
    icon: 'pencil-ruler',
    group: 'kin',
    match: ['draw'],
    desc: { id: 'Draw: visual parameter DH', en: 'Draw: DH parameter visuals' }
  },
  {
    icon: 'calculator',
    group: 'kin',
    match: ['hitung ik', 'selesaikan ik (numerik)', 'solve ik', 'solve ik (numeric)'],
    desc: { id: 'Hitung inverse kinematics', en: 'Solve inverse kinematics' }
  },
  {
    icon: 'arrow-square-out',
    group: 'kin',
    match: ['terapkan ke menu ik', 'apply to ik page'],
    desc: { id: 'Kirim solusi ke halaman IK', en: 'Send the solution to the IK page' }
  },
  {
    icon: 'map-pin',
    group: 'kin',
    match: ['isi dari posisi sekarang', 'fill from current pose', 'ambil tcp sekarang', 'use current tcp'],
    desc: { id: 'Isi dari posisi sekarang', en: 'Fill from the current pose' }
  },
  {
    icon: 'arrow-square-in',
    group: 'kin',
    match: ['isi dari target menu ik', 'fill from ik target'],
    desc: { id: 'Isi dari target halaman IK', en: 'Fill from the IK page target' }
  },
  {
    icon: 'swap',
    group: 'kin',
    match: ['contoh: tukar ik dan fk', 'example: swap ik and fk'],
    desc: { id: 'Contoh salah: tukar blok IK dan FK', en: 'Wrong example: swap the IK and FK blocks' }
  },
  {
    icon: 'function',
    group: 'kin',
    match: ['perhitungan blok', 'block math', 'persamaan', 'equations'],
    desc: { id: 'Perhitungan dan persamaan', en: 'Calculations and equations' }
  },
  {
    icon: 'sliders',
    group: 'kin',
    match: ['parameter robot', 'robot parameters'],
    desc: { id: 'Parameter robot', en: 'Robot parameters' }
  },
  {
    icon: 'lightning',
    group: 'kin',
    match: ['energi & torsi', 'energy & torque'],
    desc: { id: 'Energi dan torsi', en: 'Energy and torque' }
  },
  {
    icon: 'infinity',
    group: 'kin',
    match: ['kontinu', 'continuous'],
    desc: { id: 'Jog kontinu selama ditahan', en: 'Continuous jog while held' }
  },
  // data, code and report
  { icon: 'file-csv', group: 'data', match: ['export csv'], desc: { id: 'Unduh data CSV', en: 'Download CSV data' } },
  {
    icon: 'code',
    group: 'data',
    match: ['lihat kode', 'view code'],
    desc: { id: 'Bangkitkan kode Python, MATLAB, Simulink', en: 'Generate Python, MATLAB and Simulink code' }
  },
  {
    icon: 'floppy-disk',
    group: 'data',
    match: ['simpan konfigurasi', 'save configuration', 'simpan .py', 'save .py'],
    desc: { id: 'Simpan', en: 'Save' }
  },
  {
    icon: 'file-text',
    group: 'data',
    match: ['save report', 'simpan laporan'],
    desc: { id: 'Buat laporan dari halaman ini', en: 'Build a report from this page' }
  },
  {
    icon: 'file-pdf',
    group: 'data',
    match: ['unduh pdf', 'download pdf'],
    desc: { id: 'Unduh laporan PDF', en: 'Download the PDF report' }
  },
  {
    icon: 'file-doc',
    group: 'data',
    match: ['unduh docx', 'download docx'],
    desc: { id: 'Unduh laporan Docx', en: 'Download the Docx report' }
  },
  { icon: 'copy', group: 'data', match: ['salin kode', 'copy code'], desc: { id: 'Salin kode', en: 'Copy the code' } },
  {
    icon: 'folder-open',
    group: 'data',
    match: ['buka .py', 'open .py', 'muat preset', 'load preset'],
    desc: { id: 'Buka berkas atau preset', en: 'Open a file or preset' }
  },
  {
    icon: 'stack',
    group: 'data',
    match: ['code template', 'code template ▾'],
    desc: { id: 'Pilih template kode', en: 'Choose a code template' }
  },
  {
    icon: 'bookmark-simple',
    group: 'data',
    match: ['simpan sebagai preset', 'save as preset'],
    desc: { id: 'Simpan sebagai preset', en: 'Save as preset' }
  },
  {
    icon: 'trash',
    group: 'data',
    match: ['hapus preset', 'delete preset'],
    desc: { id: 'Hapus preset', en: 'Delete preset' }
  },
  // real robot
  { icon: 'gauge', group: 'robot', match: ['monitoring'], desc: { id: 'Monitoring robot', en: 'Robot monitoring' } },
  {
    icon: 'game-controller',
    group: 'robot',
    match: ['teach pendant'],
    desc: { id: 'Teach pendant (jog)', en: 'Teach pendant (jog)' }
  },
  {
    icon: 'crosshair-simple',
    group: 'robot',
    match: ['set posisi', 'set position'],
    desc: { id: 'Atur posisi dengan FK atau IK', en: 'Set position with FK or IK' }
  },
  {
    icon: 'file-py',
    group: 'robot',
    match: ['program python', 'python program'],
    desc: { id: 'Editor program Python', en: 'Python program editor' }
  },
  {
    icon: 'cube-transparent',
    group: 'robot',
    match: ['virtual'],
    desc: { id: 'Robot virtual (tanpa perangkat)', en: 'Virtual robot (no hardware)' }
  },
  {
    icon: 'robot',
    group: 'robot',
    match: ['robot nyata', 'real robot'],
    desc: { id: 'Robot JAKA sungguhan', en: 'Real JAKA robot' }
  },
  {
    icon: 'plugs-connected',
    group: 'robot',
    match: ['sambungkan', 'connect', 'putuskan', 'disconnect'],
    desc: { id: 'Sambungkan ke robot', en: 'Connect to the robot' }
  },
  {
    icon: 'wifi-high',
    group: 'robot',
    match: ['ping'],
    desc: { id: 'Cek jaringan ke robot', en: 'Check the network to the robot' }
  },
  {
    icon: 'power',
    group: 'robot',
    match: ['power on', 'power off'],
    desc: { id: 'Nyalakan daya robot', en: 'Power the robot on' }
  },
  {
    icon: 'lightning',
    group: 'robot',
    match: ['enable', 'disable'],
    desc: { id: 'Aktifkan servo', en: 'Enable the servos' }
  },
  {
    icon: 'path',
    group: 'robot',
    match: ['gerak movej', 'gerak movej ke solusi', 'move movej', 'movej to solution'],
    desc: { id: 'Gerak MoveJ (ruang sendi)', en: 'MoveJ (joint space)' }
  },
  {
    icon: 'line-segment',
    group: 'robot',
    match: ['gerak movel (lurus)', 'movel (straight)'],
    desc: { id: 'Gerak MoveL (garis lurus)', en: 'MoveL (straight line)' }
  },
  {
    icon: 'download-simple',
    group: 'robot',
    match: ['ambil dari robot', 'read from robot'],
    desc: { id: 'Ambil nilai dari robot', en: 'Read values from the robot' }
  },
  {
    icon: 'upload-simple',
    group: 'robot',
    match: ['terapkan ke robot', 'apply to robot'],
    desc: { id: 'Terapkan ke robot', en: 'Apply to the robot' }
  },
  // configuration
  {
    icon: 'swap',
    group: 'config',
    match: ['ganti model', 'change model'],
    desc: { id: 'Buka halaman Model Robot untuk ganti model', en: 'Open Robot Models to change the model' }
  },
  {
    icon: 'check-circle',
    group: 'config',
    match: ['gunakan model ini', 'use this model'],
    desc: { id: 'Pakai model ini di Robot Arm Simulation', en: 'Use this model in Robot Arm Simulation' }
  },
  {
    icon: 'copy-simple',
    group: 'config',
    match: ['duplikat untuk diedit', 'duplicate to edit'],
    desc: { id: 'Salin model sebagai model baru', en: 'Copy the model as a new model' }
  },
  {
    icon: 'download-simple',
    group: 'config',
    match: ['ekspor json', 'export json'],
    desc: { id: 'Unduh DH model sebagai JSON', en: 'Download the model DH as JSON' }
  },
  {
    icon: 'pencil-simple',
    group: 'config',
    match: ['edit model'],
    desc: { id: 'Ubah model pengguna', en: 'Edit a user model' }
  },
  {
    icon: 'trash',
    group: 'config',
    match: ['hapus model', 'delete model'],
    desc: { id: 'Hapus model pengguna', en: 'Delete a user model' }
  },
  {
    icon: 'plus',
    group: 'config',
    match: ['tambah model', 'add model'],
    desc: { id: 'Tambah model dari tabel DH', en: 'Add a model from a DH table' }
  },
  {
    icon: 'upload-simple',
    group: 'config',
    match: ['impor json', 'import json'],
    desc: { id: 'Isi formulir dari JSON model', en: 'Fill the form from a model JSON' }
  },
  {
    icon: 'floppy-disk',
    group: 'config',
    match: ['simpan model', 'save model'],
    desc: { id: 'Simpan model', en: 'Save the model' }
  },
  {
    icon: 'scales',
    group: 'config',
    match: ['hitung ulang massa link dari massa total', 'recompute link mass from total mass'],
    desc: { id: 'Hitung ulang massa link', en: 'Recompute the link masses' }
  }
];

// dashboard and menu tiles, matched by data-nav or id
const TILE_RULES = {
  '#home': {
    icon: 'cube-focus',
    label: { id: 'Simulation', en: 'Simulation' },
    desc: { id: 'Semua simulator tanpa perlu robot', en: 'All simulators, no robot needed' }
  },
  '#settings': {
    icon: 'gear-six',
    label: { id: 'Settings', en: 'Settings' },
    desc: { id: 'Bahasa, tema, mode, dan koneksi robot', en: 'Language, theme, modes and robot connection' }
  },
  '#control': {
    icon: 'robot',
    label: { id: 'Start Control', en: 'Start Control' },
    desc: { id: 'Model 3D tersambung ke robot nyata', en: '3D model connected to the real robot' }
  },
  '#vector': {
    icon: 'vector-three',
    label: { id: 'Vector Simulation', en: 'Vector Simulation' },
    desc: {
      id: 'Vektor, rotasi, homogen, DH, FK N-DOF',
      en: 'Vectors, rotations, homogeneous transforms, DH, N-DOF FK'
    }
  },
  '#jaka': {
    icon: 'robot',
    label: { id: 'Robot Arm Simulation', en: 'Robot Arm Simulation' },
    desc: {
      id: 'FK, IK, blok diagram, Draw untuk model aktif',
      en: 'FK, IK, block diagram and Draw for the active model'
    }
  },
  '#models': {
    icon: 'stack-plus',
    label: { id: 'Model Robot', en: 'Robot Models' },
    desc: { id: 'Pilih JAKA, UR, atau tambah model sendiri', en: 'Pick JAKA, UR, or add your own model' }
  },
  'menu-tutorial': {
    icon: 'graduation-cap',
    label: { id: 'Tutorial', en: 'Tutorial' },
    desc: { id: 'Tur interaktif dan kamus ikon', en: 'Guided tour and icon guide' }
  },
  '#jaka-fk': {
    icon: 'angle',
    label: { id: 'Forward Kinematics', en: 'Forward Kinematics' },
    desc: {
      id: 'Atur sudut sendi, lihat pose ujung dan Jacobian',
      en: 'Set joint angles, see the tool pose and Jacobian'
    }
  },
  '#jaka-ik': {
    icon: 'target',
    label: { id: 'Inverse Kinematics', en: 'Inverse Kinematics' },
    desc: { id: 'Tentukan target, sendi dihitung otomatis', en: 'Pick a target, joints are solved automatically' }
  },
  '#jaka-bd': {
    icon: 'flow-arrow',
    label: { id: 'Blok Diagram', en: 'Block Diagram' },
    desc: { id: 'Alur sistem, parameter, energi, torsi', en: 'System flow, parameters, energy, torque' }
  },
  '#jaka-draw': {
    icon: 'pencil-ruler',
    label: { id: 'Draw', en: 'Draw' },
    desc: { id: 'Kerangka sumbu dan visual DH', en: 'Axis skeleton and DH visuals' }
  }
};

const ICON_INDEX = new Map();
ICON_RULES.forEach(r => r.match.forEach(m => ICON_INDEX.set(m, r)));

function iconLang() {
  return typeof appSettings !== 'undefined' && appSettings.lang === 'en' ? 'en' : 'id';
}
function iconSvg(name, cls) {
  const body = ICON_SVG[name];
  if (!body) return '';
  return (
    '<svg class="ico' +
    (cls ? ' ' + cls : '') +
    '" viewBox="0 0 256 256" aria-hidden="true" focusable="false">' +
    body +
    '</svg>'
  );
}
function normalizeLabel(t) {
  return String(t || '')
    .replace(/[←→▶■✕▾‹›]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Replace a button's text by its icon; returns true when the button was handled.
function iconizeButton(btn) {
  if (btn.dataset.iconSkip !== undefined) return false;
  const tile = TILE_RULES[btn.dataset.nav] || TILE_RULES[btn.id];
  if (tile && (btn.classList.contains('app-card') || btn.classList.contains('dh-card'))) return iconizeTile(btn, tile);
  if (btn.querySelector('svg.ico') && !btn.textContent.trim()) return true; // already an icon
  const text = btn.textContent;
  const rule = ICON_INDEX.get(normalizeLabel(text));
  if (!rule) return false;
  btn.dataset.iconRule = String(ICON_RULES.indexOf(rule));
  btn.classList.add('icon-btn');
  btn.innerHTML = iconSvg(rule.icon);
  iconTip(btn);
  return true;
}
// tooltip and accessible name of an icon button, in the current language
function iconTip(btn) {
  const rule = ICON_RULES[+btn.dataset.iconRule];
  if (!rule) return;
  const label = rule.desc[iconLang()];
  btn.setAttribute('aria-label', label);
  btn.dataset.tip = label;
}
function iconTipsRefresh() {
  document.querySelectorAll('button.icon-btn[data-icon-rule]').forEach(iconTip);
  document.querySelectorAll('[data-tile-done]').forEach(b => {
    delete b.dataset.tileDone;
    iconizeButton(b);
  });
}
const TILE_COLORS = {
  '#home': '#4f8ff7',
  '#settings': '#94a3b8',
  '#models': '#a78bfa',
  '#control': '#34d399',
  '#vector': '#22d3ee',
  '#jaka': '#4f8ff7',
  'menu-tutorial': '#fbbf24',
  '#jaka-fk': '#4f8ff7',
  '#jaka-ik': '#f472b6',
  '#jaka-bd': '#34d399',
  '#jaka-draw': '#fb923c'
};
function iconizeTile(btn, tile) {
  if (btn.dataset.tileDone === iconLang()) return true;
  const color = TILE_COLORS[btn.dataset.nav] || TILE_COLORS[btn.id];
  if (color) btn.style.setProperty('--tc', color);
  const L = iconLang();
  const label = tile.label[L] + ': ' + tile.desc[L];
  btn.setAttribute('aria-label', label);
  btn.dataset.tip = label;
  btn.classList.add('icon-tile');
  let ic = btn.querySelector(':scope > .tile-ico');
  if (!ic) {
    ic = document.createElement('span');
    ic.className = 'tile-ico';
    btn.prepend(ic);
  }
  ic.innerHTML = iconSvg(tile.icon);
  let bg = btn.querySelector(':scope > .tile-bg');
  if (!bg) {
    bg = document.createElement('span');
    bg.className = 'tile-bg';
    bg.setAttribute('aria-hidden', 'true');
    btn.appendChild(bg);
  }
  bg.innerHTML = iconSvg(tile.icon);
  btn.dataset.tileDone = L;
  return true;
}
function iconizeAll(root) {
  (root || document).querySelectorAll('button').forEach(iconizeButton);
}

// Runtime label changes (textContent = 'Pause', language switch) replace the svg with text again: re-iconize.
const iconObserver = new MutationObserver(muts => {
  const todo = new Set();
  muts.forEach(m => {
    const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
    const b = el && el.closest && el.closest('button');
    if (b) todo.add(b);
    m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'BUTTON') todo.add(n);
      else n.querySelectorAll && n.querySelectorAll('button').forEach(x => todo.add(x));
    });
  });
  todo.forEach(iconizeButton);
});

// One floating tooltip for every element with data-tip (icons have no visible text).
const tipEl = document.createElement('div');
tipEl.className = 'ui-tip';
tipEl.setAttribute('role', 'tooltip');
function tipShow(el) {
  const t = el.dataset.tip;
  if (!t) return;
  tipEl.textContent = t;
  tipEl.classList.add('on');
  const r = el.getBoundingClientRect(),
    w = tipEl.offsetWidth,
    h = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2,
    y = r.top - h - 8;
  if (y < 4) y = r.bottom + 8;
  x = Math.max(6, Math.min(window.innerWidth - w - 6, x));
  tipEl.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
}
function tipHide() {
  tipEl.classList.remove('on');
}
document.addEventListener('mouseover', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el) tipShow(el);
  else tipHide();
});
document.addEventListener('focusin', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el && el.matches(':focus-visible')) tipShow(el);
});
document.addEventListener('focusout', tipHide);
document.addEventListener('scroll', tipHide, true);

function iconsInit() {
  document.body.appendChild(tipEl);
  iconizeAll();
  iconObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
}

// Icon guide for the Tutorial page: one card per icon, grouped, in the current language.
function renderIconGuide(el) {
  if (!el) return;
  const L = iconLang();
  const seen = new Set();
  let html = '';
  const tiles = Object.values(TILE_RULES);
  html +=
    '<section class="ig-group"><h3>' +
    (L === 'en' ? 'Menus' : 'Menu') +
    '</h3><div class="ig-grid">' +
    tiles
      .map(
        t =>
          '<div class="ig-item"><span class="ig-ico">' +
          iconSvg(t.icon) +
          '</span><div><b>' +
          t.label[L] +
          '</b><span>' +
          t.desc[L] +
          '</span></div></div>'
      )
      .join('') +
    '</div></section>';
  ICON_GROUPS.forEach(g => {
    const items = ICON_RULES.filter(
      r => r.group === g.id && !seen.has(r.icon + r.desc.en) && seen.add(r.icon + r.desc.en)
    );
    if (!items.length) return;
    html +=
      '<section class="ig-group"><h3>' +
      g.name[L] +
      '</h3><div class="ig-grid">' +
      items
        .map(
          r =>
            '<div class="ig-item"><span class="ig-ico">' +
            iconSvg(r.icon) +
            '</span><div><b>' +
            r.desc[L] +
            '</b></div></div>'
        )
        .join('') +
      '</div></section>';
  });
  el.innerHTML = html;
}
