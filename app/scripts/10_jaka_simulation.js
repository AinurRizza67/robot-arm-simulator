/* 10_jaka_simulation.js
   JAKA Simulation pages: FK, IK, Block Diagram, Zero Zone (initial pose lock).
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ SESI 16b: JAKA SIMULATION FK/IK (navigasi atas, screenshot, preset kamera) ============ */
const JK = {
  cur: 'fk',
  titles: {
    fk: 'Forward Kinematics (FK)',
    ik: 'Inverse Kinematics (IK)',
    bd: 'Konfigurasi Blok Diagram',
    draw: 'Draw: Sumbu dan Parameter DH'
  },
  reference: { fk: 'pd-fk', ik: 'pd-ik', bd: 'pd-step1', draw: 'pd-geo' }
};
function jkShow(m) {
  m = ['ik', 'bd', 'draw'].includes(m) ? m : 'fk';
  JK.cur = m;
  document.querySelectorAll('#app-jaka .jk-page').forEach(p => p.classList.toggle('active', p.dataset.jk === m));
  document.querySelectorAll('.jk-mode button').forEach(b => {
    b.classList.toggle('on', b.dataset.jk === m);
    b.setAttribute('aria-selected', String(b.dataset.jk === m));
  });
  document.getElementById('jk-title').textContent = JK.titles[m];
  try {
    if (location.hash !== '#jaka-' + m) history.replaceState(null, '', '#jaka-' + m);
  } catch (e) {}
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event('resize'));
  // FK dan IK berbagi pose yang sama: slider mode yang dibuka dibangun ulang dari pose terkini
  // Kanvas robot FK dipinjam halaman Blok Diagram (satu renderer tidak bisa tampil di dua tempat)
  const holder = document.getElementById('ch-fk'),
    home = document.querySelector('#view-v7 .stage'),
    slot = document.getElementById('bd-robot-slot'),
    dst = document.getElementById('dr-stage');
  if (m === 'bd') {
    if (holder.parentElement !== slot) slot.appendChild(holder);
  } else if (m === 'draw') {
    if (holder.parentElement !== dst) dst.insertBefore(holder, dst.firstChild);
  } else if (holder.parentElement !== home) home.insertBefore(holder, home.firstChild);
  if (m !== 'draw') drLeave();
  if (m !== 'bd') bdPop(false);
  if (m === 'fk') {
    buildFKUi();
    updateFK6();
  } else if (m === 'ik') {
    buildIKTheta();
    updateIKReadout();
  } else if (m === 'bd') {
    updateFK6();
    bdRender(true);
  } else drEnter();
  window.dispatchEvent(new Event('resize'));
}
document.querySelectorAll('.jk-mode button').forEach(b =>
  b.addEventListener('click', () => {
    nav('#jaka-' + b.dataset.jk);
  })
);
document.getElementById('jk-exit').addEventListener('click', () => confirmExit(() => nav('#home')));
document.getElementById('jk-reference').addEventListener('click', () => gotoReference(JK.reference[JK.cur]));
const JK_VIEWS = { iso: [0.9, 0.55], front: [0, 0.08], side: [Math.PI / 2, 0.08], top: [0.0001, 1.4] };
document.querySelectorAll('.jk-views button').forEach(b =>
  b.addEventListener('click', () => {
    const sc = b.dataset.t === 'ik' ? ikScene : fkScene,
      v = JK_VIEWS[b.dataset.view];
    sc.setView(v[0], v[1]);
  })
);
document.querySelectorAll('.jk-shot').forEach(b =>
  b.addEventListener('click', () => {
    const sc = b.dataset.t === 'ik' ? ikScene : fkScene;
    sc.renderer.render(sc.scene, sc.camera); // gambar ulang tepat sebelum dibaca agar kanvas tidak kosong
    const a = document.createElement('a');
    a.href = sc.renderer.domElement.toDataURL('image/png');
    a.download = 'jaka_' + b.dataset.t + '_' + joints6.map(j => Math.round(j.theta)).join('_') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Gambar pose disimpan');
  })
);
// Tabel posisi titik pindah ke kolom kanan supaya kanvas yang dibekukan tetap lega
document.querySelectorAll('#app-jaka .jk-page').forEach(p => {
  const jx = p.querySelector('.stage .joint-xyz'),
    rd = p.querySelector('.side .readout');
  if (jx && rd) rd.after(jx);
});

/* ============ SESI 16c: 0 ZONE (titik awal yang bisa dikunci dan dibuka lagi) ============ */
// joints6[i].theta tetap sudut absolut untuk semua perhitungan. Saat terkunci, slider menampilkan q = θ - θ₀
// dan Trajectory serta IK baru aktif; buka kunci untuk kalibrasi ulang.
// ZZ, zzOff, READY_POSE dideklarasikan di dekat homePose (dipakai buildFKUi saat halaman dimuat)
function zzSync() {
  buildFKUi();
  buildIKTheta();
  updateFK6();
  updateIKReadout();
  refreshGhosts6();
  renderZeroZone();
  renderLive();
}
function zzLock() {
  ZZ.q0 = joints6.map(j => +j.theta.toFixed(3));
  ZZ.locked = true;
  homePose = ZZ.q0.slice();
  zzSync();
  toast('0 Zone dikunci');
}
function zzUnlock() {
  ZZ.locked = false;
  homePose = READY_POSE.slice();
  zzSync();
  toast('0 Zone dibuka, atur ulang pose awal');
}
function zzSetPose(q) {
  if (TRAJ.playing) return;
  applyPose(q.slice(), true);
  zzSync();
}
function renderZeroZone() {
  const L = ZZ.locked,
    q = (L ? ZZ.q0 : joints6.map(j => j.theta)).map(v => (+v).toFixed(0) + '°').join(', ');
  const html =
    '<div class="zz-head"><b>0 Zone (titik awal)</b><span class="zz-chip">' +
    (L ? 'Terkunci' : 'Belum dikunci') +
    '</span></div>' +
    '<ol class="zz-steps"><li class="' +
    (L ? 'done' : 'on') +
    '"><i>1</i>Atur pose awal</li><li class="' +
    (L ? 'done' : '') +
    '"><i>2</i>Kunci 0 Zone</li><li class="' +
    (L ? 'on' : '') +
    '"><i>3</i>Gerakkan robot</li></ol>' +
    '<p class="zz-desc">' +
    (L
      ? 'Pose awal terkunci. Slider sendi kini relatif terhadap 0 Zone (q = θ - θ₀); trajectory dan IK aktif. Buka kunci untuk kalibrasi ulang.'
      : 'Geser slider sendi untuk menentukan pose awal robot, lalu kunci. Trajectory dan IK aktif setelah 0 Zone dikunci.') +
    '</p>' +
    '<div class="zz-q">' +
    (L ? 'θ₀ = ' : 'Pose sekarang: ') +
    '(' +
    q +
    ')</div>' +
    '<div class="zz-btns">' +
    (L
      ? '<button type="button" class="btn primary" data-zz="return">Kembali ke 0 Zone</button><button type="button" class="btn" data-zz="unlock">Buka kunci</button>'
      : '<button type="button" class="btn primary" data-zz="lock">Kunci 0 Zone</button><button type="button" class="btn" data-zz="ready">Pose siap (0, 90, -90, 90, 90, 0)</button><button type="button" class="btn" data-zz="zero">Pose nol STEP</button>') +
    '</div>' +
    '<label><input type="checkbox" class="zz-ghost"' +
    (fkScene.ghostLine.visible ? ' checked' : '') +
    '> tampilkan bayangan ' +
    (L ? '0 Zone' : 'pose siap') +
    '</label>';
  document.querySelectorAll('.zz-card').forEach(c => {
    c.classList.toggle('locked', L);
    c.innerHTML = html;
  });
  document.querySelectorAll('.zz-rel').forEach(e => {
    e.style.display = L ? '' : 'none';
  });
  const blocked = !L;
  document.querySelectorAll('#solveBtn,[id^="traj-play"]').forEach(b => {
    b.disabled = blocked;
    b.title = blocked ? 'Kunci 0 Zone dulu' : '';
  });
}
document.querySelectorAll('.zz-card').forEach(c =>
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-zz]');
    if (!b) return;
    ({
      lock: zzLock,
      unlock: zzUnlock,
      return: () => zzSetPose(ZZ.q0),
      ready: () => zzSetPose(READY_POSE),
      zero: () => zzSetPose([0, 0, 0, 0, 0, 0])
    })[b.dataset.zz]();
  })
);
document.querySelectorAll('.zz-card').forEach(c =>
  c.addEventListener('change', e => {
    if (!e.target.classList.contains('zz-ghost')) return;
    [fkScene, ikScene].forEach(sc => {
      sc.ghostLine.visible = e.target.checked;
    });
    renderZeroZone();
  })
);
renderZeroZone();

/* ============ SESI 17a: UPSIDE BAR HALAMAN BLOK DIAGRAM ============ */
const BDU = { open: false, tab: 'rumus' };
const PG_UP_HIDDEN = ['rumus', 'energi', 'stream']; // tab upside bar yang disembunyikan Mode Pengamat
function bdUp(open, tab) {
  if (tab) BDU.tab = tab;
  BDU.open = open;
  if (appSettings.observer && PG_UP_HIDDEN.includes(BDU.tab)) BDU.tab = 'robot';
  const up = document.getElementById('bd-up');
  up.hidden = !open;
  document.getElementById('bd-upbar').setAttribute('aria-expanded', String(open));
  document.querySelectorAll('.bd-up-tabs button').forEach(b => b.classList.toggle('on', b.dataset.up === BDU.tab));
  document.querySelectorAll('.bd-up-panel').forEach(p => {
    p.hidden = p.dataset.panel !== BDU.tab;
  });
  const dm = document.getElementById('dashModal');
  dm.classList.toggle('open', open && BDU.tab === 'energi');
  if (open && BDU.tab === 'energi')
    setTimeout(() => {
      dashInitCharts();
      dashCharts.tau.resize();
      dashCharts.en.resize();
      dashRender();
    }, 60);
  if (open && BDU.tab === 'rumus') bdRender(true);
}
document.getElementById('bd-upbar').addEventListener('click', () => bdUp(!BDU.open));
document
  .querySelectorAll('.bd-up-tabs button')
  .forEach(b => b.addEventListener('click', () => bdUp(true, b.dataset.up)));
// klik blok membuka upside bar pada tab perhitungan
document.getElementById('bd-svg').addEventListener('click', e => {
  const g = e.target.closest('.bd-block');
  if (!g || BD.justDragged) {
    BD.justDragged = false;
    return;
  }
  BD.sel = g.dataset.id;
  if (!appSettings.observer && !bdPopOpen()) bdUp(true, 'rumus');
  bdRender(true);
});
document.getElementById('bd-svg').addEventListener('keydown', e => {
  const g = e.target.closest('.bd-block');
  if (g && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    BD.sel = g.dataset.id;
    if (!appSettings.observer && !bdPopOpen()) bdUp(true, 'rumus');
    bdRender(true);
  }
});
document.getElementById('bd-reset-flow').addEventListener('click', bdResetFlow);
document.getElementById('bd-swap').addEventListener('click', bdSwapIkFk);

/* ============ SESI 18: MODE PENGAMAT ============ */
// Murni visibilitas: elemen diberi kelas pg-hide dan disembunyikan CSS saat body.mode-observer.
// Perhitungan di baliknya (FK, IK, torsi, energi, KaTeX) tetap berjalan, jadi mematikan mode ini langsung menampilkan nilai terkini.
// Yang tersisa: input parameter, status singkat (pose valid, status trajectory/IK), dan animasi gerak.
const OBSERVER_HIDE = {
  // .block induk dari elemen ini disembunyikan (persamaan, output numerik, diagram kuadran di Vector Simulation)
  block: [
    '#v1-eq',
    '#v1-magA',
    '#v1-quad-wrap',
    '#v2-eq',
    '#v2-px',
    '#v2-quad-wrap',
    '#v3-eq',
    '#v3-diff',
    '#v4-eq',
    '#v4-px',
    '#v5-eq',
    '#v5-x'
  ],
  // label induk dari input ini disembunyikan (input yang hanya memengaruhi hitungan torsi yang tersembunyi)
  label: ['#torque-mode', '#torque-mode-ik'],
  // elemen ini sendiri disembunyikan (JAKA FK, IK, Blok Diagram)
  self: [
    '#view-v7 .side > h3:first-of-type',
    '#view-v7 .side > table.dh',
    '#view-v7 .readout',
    '#view-v8 .readout',
    '#view-v7 .accordion-section',
    '#view-v8 .accordion-section',
    '#view-v7 .joint-xyz',
    '#view-v8 .joint-xyz',
    '#view-v7 .traj-bar .motor-note',
    '#view-v8 .traj-bar .motor-note',
    '#bd-last',
    '#view-draw .dr-math'
  ]
};
function observerTag() {
  const add = el => el && el.classList.add('pg-hide');
  OBSERVER_HIDE.block.forEach(q => {
    const e = document.querySelector(q);
    add(e && e.closest('.block'));
  });
  OBSERVER_HIDE.label.forEach(q => {
    const e = document.querySelector(q);
    add(e && e.closest('label'));
  });
  OBSERVER_HIDE.self.forEach(q => document.querySelectorAll(q).forEach(add));
}
observerTag();
// Saat mode berubah: upside bar yang sedang terbuka di tab tersembunyi dialihkan ke Parameter robot,
// modal grafik yang terbuka ditutup, dan halaman Rujukan yang sedang dibuka dikembalikan.
document.addEventListener('observerchange', () => {
  if (!appSettings.observer) return;
  if (BDU.open && PG_UP_HIDDEN.includes(BDU.tab)) bdUp(true);
  ['fk', 'ik'].forEach(t => {
    const m = document.getElementById('plotsModal-' + t);
    if (m && m.classList.contains('open')) closePlotsModal(t);
  });
});

/* ============ SESI 17c: PLAY BERULANG DAN ALIRAN DATA DI HALAMAN BLOK DIAGRAM ============ */
const BDLOOP = { on: false, cycle: 0, cycles: [] },
  BDS = { rows: [], cols: { tau: true, cur: true, pm: true, en: true, pos: false } };
function bdRunStatus(t) {
  document.getElementById('bd-run-st').textContent = t;
  document.getElementById('bd-pop-st').textContent = t;
}
function bdPlay() {
  if (!ZZ.locked) {
    bdRunStatus('Kunci 0 Zone dulu (kartu 0 Zone di kanan).');
    return;
  }
  if (!BD.valid) {
    bdRunStatus('Alur diagram tidak valid; perbaiki sambungan atau tekan Reset ke alur baku.');
    return;
  }
  if (TRAJ.plan && !TRAJ.plan.ik && !TRAJ.playing && TRAJ.t < TRAJ.plan.D && BDLOOP.on) {
    TRAJ.playing = true;
    TRAJ.last = performance.now();
    requestAnimationFrame(trajFrame);
    bdRunStatus('Berjalan, siklus ' + (BDLOOP.cycle + 1));
    return;
  }
  BDLOOP.on = true;
  TRAJ.kg = +document.getElementById('bd-kg').value;
  syncVal('traj-kg', TRAJ.kg);
  if (TRAJ.plan && TRAJ.playing) return;
  zzSetPose(ZZ.q0);
  TRAJ.plan = null;
  trajPlay();
  bdRunStatus(
    TRAJ.playing
      ? 'Berjalan, siklus ' + (BDLOOP.cycle + 1)
      : 'Gagal: ' + document.getElementById('traj-status').textContent
  );
}
function bdPause() {
  trajPause();
  bdRunStatus('Jeda (tekan Jalankan berulang untuk melanjutkan)');
}
function bdStop() {
  BDLOOP.on = false;
  trajReset(false);
  bdRunStatus('Berhenti');
}
// dipanggil trajFrame saat satu siklus pick and place selesai
function bdCycleDone() {
  if (!BDLOOP.on) return;
  BDLOOP.cycle++;
  const c = {
    n: BDLOOP.cycle,
    kg: TRAJ.plan.kg,
    D: TRAJ.plan.D,
    Ee: liveState.Ee,
    Ea: liveState.Eabs,
    taumax: Math.max(0, ...BDS.rows.filter(r => r.cyc === BDLOOP.cycle).map(r => r.tmax))
  };
  BDLOOP.cycles.unshift(c);
  BDLOOP.cycles.length = Math.min(BDLOOP.cycles.length, 20);
  bdRenderCycles();
  bdRunStatus('Siklus ' + c.n + ' selesai, mengulang...');
  setTimeout(() => {
    if (BDLOOP.on && !TRAJ.playing) {
      TRAJ.plan = null;
      trajPlay();
      bdRunStatus('Berjalan, siklus ' + (BDLOOP.cycle + 1));
    }
  }, 600);
}
function bdRenderCycles() {
  document.getElementById('bd-cycles').innerHTML =
    '<tr><th>siklus</th><th>payload</th><th>durasi (s)</th><th>E elektrik (J)</th><th>E absolut (J)</th><th>τ maks (N·m)</th></tr>' +
    BDLOOP.cycles
      .map(
        c =>
          '<tr><td>' +
          c.n +
          '</td><td>' +
          c.kg +
          ' kg</td><td>' +
          c.D.toFixed(1) +
          '</td><td>' +
          c.Ee.toFixed(0) +
          '</td><td>' +
          c.Ea.toFixed(1) +
          '</td><td>' +
          c.taumax.toFixed(1) +
          '</td></tr>'
      )
      .join('');
}
function bdStreamTick() {
  if (!TRAJ.playing || !TRAJ.plan || TRAJ.plan.ik) return;
  const tau = totalTau(),
    cur = currentI(tau),
    abs = tau.map(Math.abs),
    mx = Math.max(...abs),
    k = abs.indexOf(mx),
    ci = cur.map(Math.abs),
    ic = Math.max(...ci),
    u = toUser(eeFromThetas6());
  BDS.rows.unshift({
    cyc: BDLOOP.cycle + 1,
    t: TRAJ.t,
    fase: TRAJ.phase || '',
    tmax: mx,
    tj: k + 1,
    imax: ic,
    ij: ci.indexOf(ic) + 1,
    pm: liveState.P,
    ee: liveState.Ee,
    ea: liveState.Eabs,
    p: [u.x, u.y, u.z]
  });
  if (BDS.rows.length > 400) BDS.rows.length = 400;
  document.getElementById('bd-last').textContent =
    't = ' +
    TRAJ.t.toFixed(2) +
    ' s · ' +
    TRAJ.phase +
    ' · τ maks ' +
    mx.toFixed(1) +
    ' N·m (J' +
    (k + 1) +
    ') · P ' +
    liveState.P.toFixed(1) +
    ' W';
  if (BDU.open && BDU.tab === 'stream') bdRenderStream();
}
function bdRenderStream() {
  const C = BDS.cols,
    h = ['<th>siklus</th><th>t (s) · fase</th>'];
  if (C.tau) h.push('<th>τ maks (N·m)</th>');
  if (C.cur) h.push('<th>i maks (A)</th>');
  if (C.pm) h.push('<th>P mekanik (W)</th>');
  if (C.en) h.push('<th>E elektrik (J)</th><th>E absolut (J)</th>');
  if (C.pos) h.push('<th>p (m)</th>');
  const rows = BDS.rows.slice(0, 60).map(r => {
    const c = ['<td>' + r.cyc + '</td><td>' + r.t.toFixed(2) + ' · ' + r.fase + '</td>'];
    if (C.tau) c.push('<td>' + r.tmax.toFixed(1) + ' (J' + r.tj + ')</td>');
    if (C.cur) c.push('<td>' + r.imax.toFixed(2) + ' (J' + r.ij + ')</td>');
    if (C.pm) c.push('<td>' + r.pm.toFixed(1) + '</td>');
    if (C.en) c.push('<td>' + r.ee.toFixed(0) + '</td><td>' + r.ea.toFixed(1) + '</td>');
    if (C.pos) c.push('<td>' + r.p.map(v => v.toFixed(2)).join(', ') + '</td>');
    return '<tr>' + c.join('') + '</tr>';
  });
  document.getElementById('bd-stream').innerHTML = '<tr>' + h.join('') + '</tr>' + rows.join('');
}
document.getElementById('bd-play').addEventListener('click', bdPlay);
document.getElementById('bd-pause').addEventListener('click', bdPause);
document.getElementById('bd-stop').addEventListener('click', bdStop);
document.querySelectorAll('#bd-filter input').forEach(cb =>
  cb.addEventListener('change', () => {
    BDS.cols[cb.dataset.col] = cb.checked;
    bdRenderStream();
  })
);
document.querySelectorAll('.bd-up-tabs button').forEach(b =>
  b.addEventListener('click', () => {
    if (b.dataset.up === 'stream') {
      bdRenderStream();
      bdRenderCycles();
    }
  })
);
setInterval(bdStreamTick, 250);
