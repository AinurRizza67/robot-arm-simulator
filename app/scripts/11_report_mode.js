/* 11_report_mode.js
   Report mode: save configuration, reset, capture timeline data.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ SESI 20: MODE LAPORAN ============ */
// Hanya di JAKA FK, IK, dan Blok Diagram. Alur: atur parameter, Simpan Konfigurasi, jalankan gerak, Save Report,
// lalu unduh PDF atau Docx dari daftar laporan (tidak ada unduhan otomatis).
const RP_KEY = 'jakaSimLaporan',
  RP_PAGES = ['fk', 'ik', 'bd'];
const REP = {
  cfg: { fk: null, ik: null, bd: null },
  rec: { fk: null, ik: null, bd: null },
  ik: null,
  reports: [],
  robotTouched: false
};
try {
  const s = JSON.parse(localStorage.getItem(RP_KEY) || '{}');
  if (s.cfg)
    RP_PAGES.forEach(p => {
      if (s.cfg[p]) REP.cfg[p] = s.cfg[p];
    });
  if (Array.isArray(s.reports)) REP.reports = s.reports;
} catch (e) {}
function rpPersist() {
  try {
    localStorage.setItem(RP_KEY, JSON.stringify({ cfg: REP.cfg, reports: REP.reports }));
  } catch (e) {
    toast(tr('lp.full'));
  }
}
const rpClone = o => JSON.parse(JSON.stringify(o));
function rpTime(iso) {
  const d = new Date(iso),
    z = n => String(n).padStart(2, '0');
  return (
    z(d.getDate()) +
    '/' +
    z(d.getMonth() + 1) +
    '/' +
    d.getFullYear() +
    ' ' +
    z(d.getHours()) +
    '.' +
    z(d.getMinutes()) +
    '.' +
    z(d.getSeconds())
  );
}

// Parameter Robot dianggap sudah diatur begitu pengguna mengubah isian atau memuat/mereset preset di panel itu
['input', 'change'].forEach(ev =>
  document.getElementById('view-v9').addEventListener(ev, () => {
    REP.robotTouched = true;
  })
);
['cfg-load-preset-btn', 'cfg-reset-btn'].forEach(id =>
  document.getElementById(id).addEventListener('click', () => {
    REP.robotTouched = true;
  })
);

// Potret konfigurasi halaman: semua nilai yang memengaruhi hitungan dan gerak
function rpSnapshot(page) {
  const s = {
    page,
    savedAt: new Date().toISOString(),
    robotTouched: REP.robotTouched,
    dh: joints6.map(j => ({ a: j.a, alpha: j.alpha, d: j.d, thMin: j.thMin, thMax: j.thMax })),
    theta: joints6.map(j => +j.theta.toFixed(4)),
    robotMeta: rpClone(robotMeta),
    payloadKg: activePayloadKg(),
    motor: rpClone(motorParams),
    dash: {
      V: dashParams.V,
      b: dashParams.b.slice(),
      c: dashParams.c.slice(),
      linkMass: dashParams.linkMass.slice(),
      rated: dashParams.rated.slice()
    },
    torqueMode,
    traj: { kg: TRAJ.kg, speed: TRAJ.speed, wmax: TRAJ.wmax, vmax: TRAJ.vmax },
    zz: { locked: ZZ.locked, q0: ZZ.q0.slice() }
  };
  if (page === 'ik') {
    const r = document.querySelector('input[name="ikStart"]:checked');
    s.ik = {
      target: userTargetInputs(),
      start: r ? r.value : 'current',
      animate: document.getElementById('ik-animate').checked
    };
  }
  if (page === 'bd') {
    const v = bdValidate();
    s.bd = {
      edges: rpClone(BD.edges),
      pos: Object.fromEntries(Object.keys(BD_BLOCKS).map(id => [id, [BD_BLOCKS[id].x, BD_BLOCKS[id].y]])),
      kg: +document.getElementById('bd-kg').value,
      valid: v.valid,
      errors: v.errors,
      warns: v.warns
    };
  }
  return s;
}

// Modal pilihan (callback sinkron supaya mudah diuji)
const RPM = { cb: null };
function rpAsk(msg, buttons, cb) {
  const m = document.getElementById('lp-modal'),
    box = document.getElementById('lp-btns');
  document.getElementById('lp-q').textContent = msg;
  box.innerHTML = '';
  RPM.cb = cb || null;
  document.getElementById('lp-in').hidden = true;
  buttons.forEach(b => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'app-btn' + (b.primary ? ' primary' : '');
    el.dataset.k = b.k;
    el.textContent = b.label;
    el.addEventListener('click', () => rpAnswer(b.k));
    box.appendChild(el);
  });
  m.classList.add('open');
  if (box.firstChild) box.firstChild.focus();
}
function rpAnswer(k) {
  const cb = RPM.cb,
    inp = document.getElementById('lp-in'),
    v = inp.hidden ? undefined : inp.value.trim();
  RPM.cb = null;
  inp.hidden = true;
  document.getElementById('lp-modal').classList.remove('open');
  if (cb) cb(k, v);
}
// Pengganti prompt() (tidak didukung Electron): modal dengan kolom teks, cb(teks) atau cb(null) bila batal
function appPrompt(msg, def, cb) {
  rpAsk(
    msg,
    [
      { k: 'ok', label: 'OK', primary: true },
      { k: 'cancel', label: tr('lp.b.cancel') }
    ],
    (k, v) => cb(k === 'ok' ? v : null)
  );
  const inp = document.getElementById('lp-in');
  inp.hidden = false;
  inp.value = def || '';
  inp.focus();
  inp.select();
}
document.getElementById('lp-in').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    rpAnswer('ok');
  }
});
document.getElementById('lp-modal').addEventListener('click', e => {
  if (e.target.id === 'lp-modal') rpAnswer('cancel');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('lp-modal').classList.contains('open')) rpAnswer('cancel');
});

// Buka tab Parameter robot di upside bar halaman Blok Diagram
function rpOpenRobot() {
  if (!(document.body.dataset.mode === 'jaka' && JK.cur === 'bd')) nav('#jaka-bd');
  bdUp(true, 'robot');
}

// Simpan Konfigurasi (dengan peringatan bila Parameter Robot belum diatur)
function rpSaveNow(page) {
  REP.cfg[page] = rpSnapshot(page);
  rpPersist();
  rpRender();
  toast(tr('lp.saved'));
}
function rpSave(page, after) {
  if (REP.robotTouched) {
    rpSaveNow(page);
    if (after) after(true);
    return;
  }
  rpAsk(
    tr('lp.q.robot'),
    [
      { k: 'save', label: tr('lp.b.keep'), primary: true },
      { k: 'robot', label: tr('lp.b.robot') },
      { k: 'cancel', label: tr('lp.b.cancel') }
    ],
    k => {
      if (k === 'save') {
        rpSaveNow(page);
        if (after) after(true);
      } else {
        if (k === 'robot') rpOpenRobot();
        if (after) after(false);
      }
    }
  );
}

// Reset halaman: hentikan gerak, pose ke 0 Zone (atau pose siap), nilai halaman ke bawaan, hapus konfigurasi dan rekaman halaman
function rpResetNow(page) {
  if (BDLOOP.on) bdStop();
  else trajReset(true);
  applyPose((ZZ.locked ? ZZ.q0 : READY_POSE).slice(), true);
  zzSync();
  TRAJ.kg = 3;
  TRAJ.speed = 1;
  TRAJ.wmax = 90;
  torqueMode = 'gravity';
  syncVal('traj-kg', 3);
  syncVal('traj-speed', 1);
  syncVal('traj-wmax', 90);
  syncVal('torque-mode', 'gravity');
  trajStatus('Siap');
  if (page === 'ik') {
    [
      ['tx', 0.6],
      ['ty', -0.2],
      ['tz', 0.35]
    ].forEach(([id, v]) => {
      document.getElementById(id).value = v;
    });
    document.querySelector('input[name="ikStart"][value="current"]').checked = true;
    document.getElementById('ik-animate').checked = true;
    const st = document.getElementById('ikStatus');
    st.className = 'status ok';
    st.textContent = 'Masukkan target, lalu klik "Selesaikan IK".';
    REP.ik = null;
    updateTargetViz();
  }
  if (page === 'bd') {
    bdResetFlow();
    document.getElementById('bd-kg').value = 3;
    bdRunStatus('Siap');
  }
  resetEnergy();
  REP.cfg[page] = null;
  REP.rec[page] = null;
  rpPersist();
  rpRender();
  toast(tr('lp.reseted'));
}
function rpReset(page) {
  rpAsk(
    tr('lp.q.reset'),
    [
      { k: 'yes', label: tr('lp.b.yes'), primary: true },
      { k: 'cancel', label: tr('lp.b.cancel') }
    ],
    k => {
      if (k === 'yes') rpResetNow(page);
    }
  );
}

// Status dan daftar laporan tiap bar
function rpRender() {
  document.querySelectorAll('.lp-bar').forEach(bar => {
    const p = bar.dataset.lp,
      c = REP.cfg[p],
      r = REP.rec[p];
    bar.querySelector('[data-lp-st]').innerHTML =
      (c ? tr('lp.st.cfg') + ' <b>' + rpTime(c.savedAt) + '</b>' : tr('lp.st.cfg0')) +
      '<br>' +
      (r ? tr('lp.st.rec') + ' <b>' + r.label + ', ' + r.D.toFixed(1) + ' s</b>' : tr('lp.st.rec0'));
    bar.classList.toggle('has-cfg', !!c);
    if (typeof rpRenderList === 'function') rpRenderList(bar, p);
  });
}
document.querySelectorAll('.lp-bar').forEach(bar => {
  const p = bar.dataset.lp;
  bar.querySelector('[data-lp-act="save"]').addEventListener('click', () => rpSave(p));
  bar.querySelector('[data-lp-act="reset"]').addEventListener('click', () => rpReset(p));
  bar.querySelector('[data-lp-act="report"]').addEventListener('click', () => rpReport(p));
  bar.querySelector('[data-lp-act="code"]').addEventListener('click', () => rpCodeOpen(p));
});
