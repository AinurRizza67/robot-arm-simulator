/* 14_tutorial.js
   Guided tutorial: steps, highlight frame, auto-advance cards.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ SESI 19: TUTORIAL INTERAKTIF ============ */
// Tur berpemandu dari Dashboard ke seluruh fungsi. Tiap langkah menyorot satu elemen; kartu arahan
// pindah sendiri setelah 5 detik (tertahan selama kursor di atas kartu atau saat Jeda), ada Skip.
// Langkah yang elemennya tersembunyi (Mode Pengamat, Rujukan mati, layar sempit) dilewati otomatis.
// Tur hanya berpindah halaman dan membuka panel sementara; nilai simulasi tidak diubah.
const TUT_MS = 5000;
const TUT_CH = {
  dash: ['Dashboard', 'Dashboard'],
  amba: ['Ambabot', 'Ambabot'],
  set: ['Settings', 'Settings'],
  vec: ['Vector Simulation', 'Vector Simulation'],
  jaka: ['JAKA Simulation', 'JAKA Simulation'],
  fk: ['JAKA Simulation: FK', 'JAKA Simulation: FK'],
  ik: ['JAKA Simulation: IK', 'JAKA Simulation: IK'],
  bd: ['JAKA Simulation: Blok Diagram', 'JAKA Simulation: Block Diagram'],
  draw: ['JAKA Simulation: Draw', 'JAKA Simulation: Draw'],
  rj: ['Rujukan', 'References']
};
const TUT_STEPS = [
  {
    ch: 'dash',
    h: '#home',
    t: '#main-menu [data-nav="#vector"]',
    id: [
      'Vector Simulation',
      'Mulai belajar di sini: vektor dan dot product, rotasi dasar, rotasi komposit, matriks homogen dan DH, sampai FK N-DOF. Tiap topik punya animasi 3D dan slider.'
    ],
    en: [
      'Vector Simulation',
      'Start learning here: vectors and dot product, basic rotation, composite rotation, homogeneous matrices and DH, up to N-DOF FK. Each topic has a 3D animation and sliders.'
    ]
  },
  {
    ch: 'dash',
    h: '#home',
    t: '#main-menu [data-nav="#jaka"]',
    id: [
      'JAKA Simulation',
      'Robot JAKA ZU5 dalam tiga mode: Forward Kinematics, Inverse Kinematics, dan Blok Diagram dengan analisis energi dan torsi.'
    ],
    en: [
      'JAKA Simulation',
      'The JAKA ZU5 robot in three modes: Forward Kinematics, Inverse Kinematics, and Block Diagram with energy and torque analysis.'
    ]
  },
  {
    ch: 'dash',
    h: '#home',
    t: '#menu-tutorial',
    id: [
      'Tutorial',
      'Tur ini bisa diulang kapan saja dari kartu ini. Tiap arahan pindah sendiri setelah 5 detik; arahkan kursor ke kartu arahan untuk menahannya, atau tekan Jeda.'
    ],
    en: [
      'Tutorial',
      'Replay this tour anytime from this card. Each hint moves on after 5 seconds; hover over the hint card to hold it, or press Pause.'
    ]
  },
  {
    ch: 'dash',
    h: '#dash',
    t: '#dash-menu [data-nav="#settings"]',
    id: [
      'Settings',
      'Settings kini ada di Dashboard utama: bahasa, tema, Rujukan, Mode Pengamat, dan koneksi robot (IP, Python, batas kecepatan).'
    ],
    en: [
      'Settings',
      'Settings now live on the main Dashboard: language, theme, References, Observer Mode, and the robot connection (IP, Python, speed limit).'
    ]
  },
  {
    ch: 'dash',
    h: '#dash',
    t: '#dash-menu [data-nav="#control"]',
    id: [
      'Start Control',
      'Sambungkan model 3D ZU5 ke robot asli (atau robot virtual): monitoring, teach pendant, set posisi dengan IK dan FK, dan program Python.'
    ],
    en: [
      'Start Control',
      'Connect the 3D ZU5 model to the real robot (or a virtual one): monitoring, teach pendant, IK and FK positioning, and Python programs.'
    ]
  },
  {
    ch: 'amba',
    h: '#home',
    t: '#assistant-btn',
    id: ['Ambabot', 'Asisten belajar ada di kiri bawah di semua halaman. Sentuh ikon ini untuk membuka panel chat.'],
    en: [
      'Ambabot',
      'The learning assistant sits at the bottom left on every page. Tap this icon to open the chat panel.'
    ]
  },
  {
    ch: 'amba',
    h: '#home',
    t: '#assistant-panel',
    before: () => setAssistant(true),
    after: () => setAssistant(false),
    id: [
      'Panel Ambabot',
      'Panel muncul dari kiri; tutup dengan ikon bot atau tombol X. Fitur percakapan masih dalam pengerjaan: nanti Ambabot membantu seputar teori, cara memakai simulator, dan saran nilai parameter.'
    ],
    en: [
      'Ambabot panel',
      'The panel slides in from the left; close it with the bot icon or the X button. Chat is still in progress: later Ambabot will help with theory, how to use the simulator, and parameter value suggestions.'
    ]
  },
  {
    ch: 'set',
    h: '#settings',
    t: '#set-lang',
    id: ['Bahasa', 'Pilih Indonesia atau English.'],
    en: ['Language', 'Choose Indonesian or English.']
  },
  {
    ch: 'set',
    h: '#settings',
    t: '#set-theme',
    id: ['Tema', 'Gelap atau terang, tersimpan untuk kunjungan berikutnya.'],
    en: ['Theme', 'Dark or light, remembered for your next visit.']
  },
  {
    ch: 'set',
    h: '#settings',
    t: '#row-reference',
    id: ['Rujukan', 'Kalau nyala, halaman simulasi punya tombol Rujukan yang melompat ke materi terkait.'],
    en: ['References', 'When on, simulation pages get a References button that jumps to the related material.']
  },
  {
    ch: 'set',
    h: '#settings',
    t: '#row-report',
    id: [
      'Mode Laporan',
      'Menambahkan Simpan Konfigurasi, Reset, dan Save Report di halaman JAKA. Laporan berisi konfigurasi, penurunan rumus, data tiap 0,2 detik, dan grafik, lalu diunduh sebagai PDF atau Docx.'
    ],
    en: [
      'Report Mode',
      'Adds Save Configuration, Reset, and Save Report to the JAKA pages. Reports contain the configuration, equation derivations, data every 0.2 s, and charts, downloadable as PDF or Docx.'
    ]
  },
  {
    ch: 'set',
    h: '#settings',
    t: () => document.getElementById('set-observer').closest('.set-row'),
    id: [
      'Mode Pengamat',
      'Menyembunyikan semua rumus dan rincian perhitungan; yang tersisa hanya input dan animasi. Cocok untuk presentasi. Rujukan ikut mati selama mode ini aktif.'
    ],
    en: [
      'Observer Mode',
      'Hides all equations and calculation details, leaving only inputs and animation. Good for presentations. References are turned off while it is on.'
    ]
  },
  {
    ch: 'vec',
    h: '#vector-1',
    t: '#view-v1 .stage',
    id: [
      'Kanvas 3D',
      'Seret untuk memutar, scroll untuk zoom. Kanvas tetap di tempat saat panel kanan digulir. Tombol Grid mengganti tampilan lantai.'
    ],
    en: [
      '3D canvas',
      'Drag to rotate, scroll to zoom. The canvas stays in place while the right panel scrolls. The Grid buttons change the floor display.'
    ]
  },
  {
    ch: 'vec',
    h: '#vector-1',
    t: '#view-v1 .side .block',
    id: ['Input parameter', 'Geser slider; gambar dan hasil hitung berubah langsung.'],
    en: ['Parameter input', 'Move a slider; the drawing and the results update immediately.']
  },
  {
    ch: 'vec',
    h: '#vector-1',
    t: () => {
      const e = document.getElementById('v1-eq');
      return e && e.closest('.block');
    },
    id: ['Persamaan live', 'Rumus ditulis ulang dengan angka terkini, jadi tiap langkah hitungnya terlihat.'],
    en: ['Live equations', 'Equations are rewritten with the current numbers, so every calculation step is visible.']
  },
  {
    ch: 'vec',
    h: '#vector-1',
    t: '.vs-balls',
    id: [
      'Navigasi bola',
      'Bola 1 sampai 5 berpindah topik. Exit kembali ke Dashboard setelah konfirmasi YA atau TIDAK.'
    ],
    en: ['Ball navigation', 'Balls 1 to 5 switch topics. Exit returns to the Dashboard after a YES or NO confirmation.']
  },
  {
    ch: 'vec',
    h: '#vector-1',
    t: '#vs-reference',
    id: ['Tombol Rujukan', 'Membuka materi yang sesuai dengan topik halaman ini, lalu Kembali ke posisi semula.'],
    en: ['References button', 'Opens the material that matches this page, then Back returns you to where you were.']
  },
  {
    ch: 'jaka',
    h: '#jaka',
    t: '#jaka-choice',
    id: [
      'Tiga mode JAKA',
      'FK: atur sudut sendi. IK: tentukan target x, y, z. Blok Diagram: alur sistem, energi, dan torsi.'
    ],
    en: [
      'Three JAKA modes',
      'FK: set joint angles. IK: choose an x, y, z target. Block Diagram: system flow, energy, and torque.'
    ]
  },
  {
    ch: 'jaka',
    h: '#jaka-fk',
    t: '#app-jaka .jk-mode',
    id: [
      'Pindah mode',
      'Berpindah antara FK, IK, Blok Diagram, dan Draw tanpa kembali ke Dashboard. Keempatnya memakai pose robot yang sama.'
    ],
    en: [
      'Switch mode',
      'Move between FK, IK, Block Diagram, and Draw without going back to the Dashboard. All four share the same robot pose.'
    ]
  },
  {
    ch: 'fk',
    h: '#jaka-fk',
    t: '#view-v7 .lp-bar',
    cond: () => appSettings.report,
    id: [
      'Bar Mode Laporan',
      'Muncul saat Mode Laporan aktif. Simpan Konfigurasi dulu, jalankan gerak, lalu Save Report. Laporan tidak terunduh otomatis: pilih PDF atau Docx dari daftarnya.'
    ],
    en: [
      'Report Mode bar',
      'Shown while Report Mode is on. Save Configuration first, run the motion, then Save Report. Nothing downloads automatically: choose PDF or Docx from the list.'
    ]
  },
  {
    ch: 'fk',
    h: '#jaka-fk',
    t: '#zz-fk',
    id: [
      '0 Zone',
      'Titik awal gerak. Atur pose (atau pakai Pose siap), lalu Kunci. Play dan IK baru aktif setelah dikunci; kunci bisa dibuka lagi.'
    ],
    en: [
      '0 Zone',
      'The starting point of motion. Set a pose (or use the ready pose), then Lock. Play and IK only work once it is locked; you can unlock it again.'
    ]
  },
  {
    ch: 'fk',
    h: '#jaka-fk',
    t: '#theta-fk',
    id: ['Sudut sendi', 'Slider q1 sampai q6. Saat 0 Zone terkunci, nilainya relatif terhadap 0 Zone: q = θ - θ₀.'],
    en: ['Joint angles', 'Sliders q1 to q6. While the 0 Zone is locked, values are relative to it: q = θ - θ₀.']
  },
  {
    ch: 'fk',
    h: '#jaka-fk',
    t: '#ch-fk',
    id: [
      'Robot 3D',
      'Klik balok untuk memasangnya di end-effector, seret balok untuk memindah. Iso, Depan, Samping, Atas mengganti sudut kamera; ikon kamera menyimpan gambar PNG.'
    ],
    en: [
      '3D robot',
      'Click a block to attach it to the end-effector, drag it to move it. Iso, Front, Side, Top change the camera; the camera icon saves a PNG image.'
    ]
  },
  {
    ch: 'fk',
    h: '#jaka-fk',
    t: '#view-v7 .traj-bar',
    id: [
      'Trajectory pick and place',
      'Pilih balok lalu Play: robot mengambil balok, memindahkannya, lalu kembali ke 0 Zone. Kecepatan dan ω maks sendi diatur di sini.'
    ],
    en: [
      'Pick and place trajectory',
      'Choose a block and press Play: the robot picks it up, moves it, then returns to the 0 Zone. Speed and maximum joint ω are set here.'
    ]
  },
  {
    ch: 'fk',
    h: '#jaka-fk',
    t: '#view-v7 .accordion-section',
    id: ['Rumus dan Jacobian', 'Buka akordeon untuk melihat matriks DH tiap sendi dan Jacobian yang dihitung live.'],
    en: ['Equations and Jacobian', "Open the accordions to see each joint's DH matrix and the live Jacobian."]
  },
  {
    ch: 'ik',
    h: '#jaka-ik',
    t: '#view-v8 .target-input',
    id: ['Target IK', 'Isi posisi x, y, z (meter, frame base, Z ke atas) atau pakai tombol isi target di atas balok.'],
    en: [
      'IK target',
      'Enter x, y, z (meters, base frame, Z up) or use the buttons that place the target above a block.'
    ]
  },
  {
    ch: 'ik',
    h: '#jaka-ik',
    t: '#solveBtn',
    id: [
      'Selesaikan IK',
      'Solver numerik mencari sudut sendi untuk target itu. Dengan animasi, end-effector bergerak lurus ke target.'
    ],
    en: [
      'Solve IK',
      'A numerical solver finds the joint angles for that target. With animation on, the end-effector moves in a straight line to it.'
    ]
  },
  {
    ch: 'bd',
    h: '#jaka-bd',
    t: '#bd-svg',
    before: () => bdPop(true),
    after: () => bdPop(false),
    id: [
      'Diagram blok',
      'Dibuka sebagai pop-up lewat tombol Buka Blok Diagram. Seret blok untuk memindah. Sambungan dibuat dari titik keluaran (kanan blok) ke titik masukan (kiri blok); klik garis untuk menghapus.'
    ],
    en: [
      'Block diagram',
      'Opens as a pop-up from the Open Block Diagram button. Drag blocks to move them. Connect an output port (right side) to an input port (left side); click a line to delete it.'
    ]
  },
  {
    ch: 'bd',
    h: '#jaka-bd',
    t: '#bd-valid',
    id: [
      'Validasi alur',
      'Tiap sambungan dicek tipe sinyalnya. Alur yang tidak valid ditandai merah dan robot tidak dijalankan.'
    ],
    en: [
      'Flow check',
      'Every connection is checked for its signal type. An invalid flow is marked red and the robot will not run.'
    ]
  },
  {
    ch: 'bd',
    h: '#jaka-bd',
    t: '#view-bd .bd-run',
    id: [
      'Jalankan berulang',
      'Robot mengulang pick and place dari 0 Zone. Data mengalir tiap 0,25 detik dan tiap siklus diringkas.'
    ],
    en: [
      'Repeat run',
      'The robot repeats pick and place from the 0 Zone. Data streams every 0.25 s and each cycle is summarized.'
    ]
  },
  {
    ch: 'bd',
    h: '#jaka-bd',
    t: '#bd-up',
    before: () => bdUp(true),
    after: () => bdUp(false),
    id: [
      'Upside bar',
      'Dibuka dari bar di atas diagram: perhitungan tiap blok, grafik energi dan torsi, aliran data, dan parameter robot.'
    ],
    en: [
      'Upside bar',
      'Opened from the bar above the diagram: per-block calculations, energy and torque charts, data stream, and robot parameters.'
    ]
  },
  {
    ch: 'draw',
    h: '#jaka-draw',
    t: '#dr-mode',
    id: [
      'Menu Draw',
      'Axis Draw menyembunyikan badan robot dan menyisakan kerangka sumbu serta parameter DH. Tiap elemen bisa dinyalakan atau dimatikan, juga di atas badan robot. Cinematic membuat tampilan 3D memenuhi layar.'
    ],
    en: [
      'Draw menu',
      'Axis Draw hides the robot body and leaves the axis skeleton and DH parameters. Each element can be switched on or off, also on top of the robot body. Cinematic makes the 3D view fill the screen.'
    ]
  },
  {
    ch: 'draw',
    h: '#jaka-draw',
    t: '#dr-lock',
    id: [
      'Kunci parameter DH',
      'Nilai d, a, dan α terkunci supaya tidak berubah tanpa sengaja. Geser slider θ: hanya kolom θ yang berubah.'
    ],
    en: [
      'DH parameter lock',
      'The d, a, and α values are locked so they cannot change by accident. Move a θ slider: only the θ column changes.'
    ]
  },
  {
    ch: 'rj',
    h: '#reference',
    cond: () => referenceEnabled(),
    t: '.rj-toc',
    id: [
      'Daftar isi Rujukan',
      'Materi dasar, alur proyek JAKA ZU5, dan glosarium. Klik judul untuk melompat ke bagiannya.'
    ],
    en: [
      'References contents',
      'Basic material, the JAKA ZU5 project workflow, and a glossary. Click a heading to jump to it.'
    ]
  },
  {
    ch: 'rj',
    h: '#reference',
    cond: () => referenceEnabled(),
    t: '.rj-top',
    id: [
      'Kembali dan Exit',
      'Kalau Rujukan dibuka dari halaman simulasi, Kembali membawa ke posisi semula. Exit ke Dashboard setelah konfirmasi.'
    ],
    en: [
      'Back and Exit',
      'When References are opened from a simulation page, Back returns you to where you were. Exit goes to the Dashboard after confirmation.'
    ]
  }
];
const TUT = { on: false, i: 0, h: null, el: null, left: TUT_MS, last: 0, paused: false, hover: false, cleanup: null };
function tutShown(el) {
  if (!el) return false;
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    if (e.hidden || getComputedStyle(e).display === 'none') return false;
  }
  return true;
}
function tutGo(h) {
  try {
    if (location.hash !== h) history.replaceState(null, '', h);
  } catch (e) {}
  route(h);
}
function tutShow(i, dir) {
  if (TUT.cleanup) {
    try {
      TUT.cleanup();
    } catch (e) {}
    TUT.cleanup = null;
  }
  if (i < 0) {
    i = 0;
    dir = 1;
  }
  for (; i >= 0 && i < TUT_STEPS.length; i += dir) {
    const st = TUT_STEPS[i];
    if (st.cond && !st.cond()) continue;
    if (st.h !== TUT.h) {
      TUT.h = st.h;
      tutGo(st.h);
    }
    if (st.before) st.before();
    const el = typeof st.t === 'function' ? st.t() : document.querySelector(st.t);
    if (tutShown(el)) {
      TUT.i = i;
      TUT.el = el;
      TUT.cleanup = st.after || null;
      TUT.left = TUT_MS;
      tutRender(st);
      return;
    }
    if (st.after) st.after();
  }
  if (i < 0) return tutShow(0, 1);
  tutEnd(true);
}
function tutRender(st) {
  const L = appSettings.lang === 'en' ? 'en' : 'id',
    txt = st[L] || st.id,
    ch = TUT_CH[st.ch];
  document.getElementById('tut-kick').textContent =
    (L === 'en' ? ch[1] : ch[0]) + ' · ' + (TUT.i + 1) + '/' + TUT_STEPS.length;
  document.getElementById('tut-title').textContent = txt[0];
  document.getElementById('tut-text').textContent = txt[1];
  document.getElementById('tut-prev').disabled = TUT.i === 0;
  tutPauseLabel();
  const r = TUT.el.getBoundingClientRect();
  // gulir hanya bila awal elemen di luar layar; elemen tinggi yang awalnya terlihat tidak digeser
  if ((r.top < 56 || r.top > window.innerHeight * 0.7) && TUT.el.scrollIntoView)
    TUT.el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center' });
  tutPlace();
}
function tutPauseLabel() {
  document.getElementById('tut-pause').textContent = tr(TUT.paused ? 'tut.resume' : 'tut.pause');
  document.getElementById('tut').classList.toggle('paused', TUT.paused);
}
function tutPlace() {
  if (!TUT.on || !TUT.el) return;
  const vw = window.innerWidth,
    vh = window.innerHeight,
    r = TUT.el.getBoundingClientRect(),
    p = 6;
  const L = Math.max(4, r.left - p),
    T = Math.max(4, r.top - p),
    R = Math.min(vw - 4, r.right + p),
    B = Math.min(vh - 4, r.bottom + p);
  const sp = document.getElementById('tut-spot');
  sp.style.left = L + 'px';
  sp.style.top = T + 'px';
  sp.style.width = Math.max(0, R - L) + 'px';
  sp.style.height = Math.max(0, B - T) + 'px';
  if (vw <= 600) return; // layar sempit: kartu menempel di bawah (CSS)
  const c = document.getElementById('tut-card'),
    cw = c.offsetWidth || 360,
    chh = c.offsetHeight || 190,
    g = 12;
  let x, y;
  if (B + g + chh <= vh - 8) {
    x = L;
    y = B + g;
  } else if (T - g - chh >= 8) {
    x = L;
    y = T - g - chh;
  } else if (R + g + cw <= vw - 8) {
    x = R + g;
    y = T;
  } else if (L - g - cw >= 8) {
    x = L - g - cw;
    y = T;
  } else {
    x = (vw - cw) / 2;
    y = vh - chh - 16;
  }
  c.style.left = Math.max(8, Math.min(vw - cw - 8, x)) + 'px';
  c.style.top = Math.max(8, Math.min(vh - chh - 8, y)) + 'px';
}
function tutFrame(now) {
  if (!TUT.on) return;
  const dt = TUT.last ? Math.max(0, Math.min(200, now - TUT.last)) : 0;
  TUT.last = now;
  if (!TUT.paused && !TUT.hover) TUT.left -= dt;
  document.getElementById('tut-bar').style.width = Math.max(0, (TUT.left / TUT_MS) * 100) + '%';
  if (TUT.left <= 0) tutNext();
  if (!TUT.on) return;
  tutPlace();
  requestAnimationFrame(tutFrame);
}
function tutNext() {
  tutShow(TUT.i + 1, 1);
}
function tutPrev() {
  tutShow(TUT.i - 1, -1);
}
function tutSkipSection() {
  const ch = TUT_STEPS[TUT.i].ch;
  let j = TUT.i + 1;
  while (j < TUT_STEPS.length && TUT_STEPS[j].ch === ch) j++;
  tutShow(j, 1);
}
function tutorialStart() {
  if (TUT.on) return;
  setAssistant(false);
  closeExit();
  Object.assign(TUT, { on: true, h: null, el: null, last: 0, paused: false, hover: false, cleanup: null });
  document.getElementById('tut').hidden = false;
  tutShow(0, 1);
  requestAnimationFrame(tutFrame);
}
function tutEnd(done) {
  if (!TUT.on) return;
  if (TUT.cleanup) {
    try {
      TUT.cleanup();
    } catch (e) {}
    TUT.cleanup = null;
  }
  TUT.on = false;
  TUT.el = null;
  document.getElementById('tut').hidden = true;
  TUT.h = null;
  tutGo('#home');
  toast(tr(done ? 'tut.done' : 'tut.skipped'));
}
document.getElementById('tut-next').addEventListener('click', tutNext);
document.getElementById('tut-prev').addEventListener('click', tutPrev);
document.getElementById('tut-skip').addEventListener('click', () => tutEnd(false));
document.getElementById('tut-skipch').addEventListener('click', tutSkipSection);
document.getElementById('tut-pause').addEventListener('click', () => {
  TUT.paused = !TUT.paused;
  tutPauseLabel();
});
document.getElementById('tut-card').addEventListener('mouseenter', () => {
  TUT.hover = true;
});
document.getElementById('tut-card').addEventListener('mouseleave', () => {
  TUT.hover = false;
});
document.addEventListener(
  'keydown',
  e => {
    if (!TUT.on) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      tutEnd(false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      tutNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      tutPrev();
    }
  },
  true
);
