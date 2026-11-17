/* 13_report.js
   Report builder: frozen report template, PDF (jsPDF) and DOCX export, formula images.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ---- Sesi 20b: rekaman gerak dan perhitungan laporan ---- */
// Rekaman = salinan rencana gerak (TRAJ.plan) terakhir yang SELESAI di halaman itu. Play berulang = satu siklus
// (siklus berikutnya menimpa, waktu tidak diteruskan). Timeline dihitung ulang dari rencana terhadap waktu simulasi
// dengan langkah integrasi 0,01 s lalu dilaporkan tiap 0,2 s, jadi tidak bergantung kecepatan animasi atau laju frame.
const RP_DT = 0.2,
  RP_H = 0.01;
const RP_DEF = {
  motor: rpClone(motorParams),
  dash: { V: dashParams.V, b: dashParams.b.slice(), c: dashParams.c.slice(), rated: dashParams.rated.slice() },
  mass: defaultRobotMeta.totalMass
};
function rpRecLabel(P) {
  if (P.ik) return 'animasi IK ke target';
  return (P.src === 'bd' ? 'siklus ' + (BDLOOP.cycle + 1) + ', ' : '') + 'pick and place ' + P.kg + ' kg';
}
function rpCapture(P) {
  if (!P || !P.src) return;
  REP.rec[P.src] = {
    src: P.src,
    at: new Date().toISOString(),
    label: rpRecLabel(P),
    D: P.D,
    kg: P.kg,
    ik: !!P.ik,
    tGrasp: isFinite(P.tGrasp) ? P.tGrasp : null,
    tRelease: isFinite(P.tRelease) ? P.tRelease : null,
    payload0: P.payload0 || 0,
    segs: P.segs.map(sg => ({
      type: sg.type,
      label: sg.label,
      t0: sg.t0,
      T: sg.T,
      q0: sg.q0 || null,
      q1: sg.q1 || null,
      q: sg.q || null
    })),
    target: P.target ? toUser(P.target) : null,
    mode: P.mode || '',
    frac: P.frac === undefined ? 1 : P.frac,
    reachedAll: P.reachedAll !== false,
    cfg: rpSnapshot(P.src)
  };
  rpRender();
}

// Fisika murni dari potret konfigurasi (frame base DH, Z ke atas); rumus sama dengan dashboard
function rpChain(cfg, th) {
  let cum = new THREE.Matrix4();
  const F = [cum.clone()];
  for (let i = 0; i < 6; i++) {
    const j = cfg.dh[i];
    cum = cum.clone().multiply(dhMatrix(th[i], j.d, j.a, j.alpha));
    F.push(cum.clone());
  }
  return F;
}
const rpPos = M => {
  const e = M.elements;
  return [e[12], e[13], e[14]];
};
const rpRows = M => {
  const e = M.elements;
  return [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => e[c * 4 + r]));
};
function rpFK(cfg, th) {
  return rpPos(rpChain(cfg, th)[6]);
}
function rpPE(cfg, th, pay) {
  const F = rpChain(cfg, th);
  let links = 0;
  for (let i = 1; i <= 6; i++) {
    const c = linkProps[i - 1].com.clone().applyMatrix4(F[i]);
    links += cfg.dash.linkMass[i - 1] * G_ACC * c.z;
  }
  const pl = pay * G_ACC * F[6].elements[14];
  return { links, payload: pl, total: links + pl };
}
function rpTauG(cfg, th, pay) {
  const d = 0.25,
    out = [];
  for (let i = 0; i < 6; i++) {
    const a = th.slice(),
      b = th.slice();
    a[i] += d;
    b[i] -= d;
    out.push((rpPE(cfg, a, pay).total - rpPE(cfg, b, pay).total) / ((2 * d * Math.PI) / 180));
  }
  return out;
}
function rpTau(cfg, th, pay) {
  return cfg.torqueMode === 'gravity'
    ? rpTauG(cfg, th, pay)
    : cfg.motor.K.map((k, i) => k * cfg.motor.N[i] * cfg.motor.i[i]);
}
function rpCur(cfg, tau) {
  return cfg.torqueMode === 'gravity'
    ? tau.map((t, k) => {
        const d = cfg.motor.K[k] * cfg.motor.N[k];
        return d ? t / d : 0;
      })
    : cfg.motor.i.slice();
}

function rpSegAt(rec, t) {
  let k = rec.segs.length - 1;
  for (let i = 0; i < rec.segs.length; i++) {
    const s = rec.segs[i];
    if (t < s.t0 + s.T) {
      k = i;
      break;
    }
  }
  const sg = rec.segs[k];
  return { k, sg, u: Math.min(1, Math.max(0, (t - sg.t0) / sg.T)) };
}
function rpQ(rec, t) {
  const { sg, u } = rpSegAt(rec, t);
  return segQ(sg, u);
}
function rpPay(rec, t) {
  if (rec.ik) return rec.payload0 || 0;
  return rec.tGrasp !== null && t >= rec.tGrasp && t < rec.tRelease ? rec.kg : 0;
}
function rpSample(rec, t) {
  const cfg = rec.cfg,
    D = rec.D,
    d = 0.002,
    ta = Math.max(0, t - d),
    tb = Math.min(D, t + d),
    th = rpQ(rec, t),
    a = rpQ(rec, ta),
    b = rpQ(rec, tb);
  const w = th.map((_, i) => (tb > ta ? (((b[i] - a[i]) / (tb - ta)) * Math.PI) / 180 : 0));
  const pay = rpPay(rec, t),
    tau = rpTau(cfg, th, pay),
    cur = rpCur(cfg, tau);
  return {
    t,
    th,
    w,
    pay,
    tau,
    cur,
    Pm: tau.reduce((s, x, i) => s + x * w[i], 0),
    Pa: tau.reduce((s, x, i) => s + Math.abs(x * w[i]), 0),
    Pf: w.reduce((s, x, i) => s + cfg.dash.b[i] * x * x + cfg.dash.c[i] * Math.abs(x), 0),
    Pe: cfg.dash.V * cur.reduce((s, x) => s + Math.abs(x), 0)
  };
}
// Timeline: integrasi trapesium tiap 0,01 s, baris laporan tiap 0,2 s ditambah baris akhir tepat di t = D
function rpTimeline(rec) {
  const cfg = rec.cfg,
    D = rec.D,
    n = Math.max(1, Math.ceil(D / RP_H - 1e-9)),
    every = Math.round(RP_DT / RP_H),
    rows = [];
  const acc = { Em: 0, Ea: 0, Ef: 0, Ee: 0 },
    sum = {
      tmax: [0, 0, 0, 0, 0, 0],
      tmaxT: [0, 0, 0, 0, 0, 0],
      imax: [0, 0, 0, 0, 0, 0],
      wmax: [0, 0, 0, 0, 0, 0],
      Pmax: 0,
      Pemax: 0,
      L: 0
    };
  const Ep0 = rpPE(cfg, rpQ(rec, 0), rpPay(rec, 0)).total;
  let last = null,
    star = null,
    pPrev = null;
  for (let k = 0; k <= n; k++) {
    const t = k === n ? D : k * RP_H,
      s = rpSample(rec, t),
      p = rpFK(cfg, s.th);
    if (last) {
      const h = t - last.t;
      acc.Em += 0.5 * (last.Pm + s.Pm) * h;
      acc.Ea += 0.5 * (last.Pa + s.Pa) * h;
      acc.Ef += 0.5 * (last.Pf + s.Pf) * h;
      acc.Ee += 0.5 * (last.Pe + s.Pe) * h;
    }
    if (pPrev) sum.L += Math.hypot(p[0] - pPrev[0], p[1] - pPrev[1], p[2] - pPrev[2]);
    pPrev = p;
    last = s;
    for (let i = 0; i < 6; i++) {
      const a = Math.abs(s.tau[i]);
      if (a > sum.tmax[i]) {
        sum.tmax[i] = a;
        sum.tmaxT[i] = t;
      }
      sum.imax[i] = Math.max(sum.imax[i], Math.abs(s.cur[i]));
      sum.wmax[i] = Math.max(sum.wmax[i], Math.abs(s.w[i]));
    }
    sum.Pmax = Math.max(sum.Pmax, Math.abs(s.Pm));
    sum.Pemax = Math.max(sum.Pemax, s.Pe);
    // titik contoh: utamakan segmen garis lurus dengan beban, lalu garis lurus, lalu mana saja; di tiap kelas daya absolut terbesar
    const rank = (rpSegAt(rec, t).sg.type === 'line' ? 2 : 0) + (s.pay > 0 ? 1 : 0);
    if (!star || rank > star.rank || (rank === star.rank && s.Pa > star.Pa))
      star = Object.assign({}, s, { Em: acc.Em, Ea: acc.Ea, Ef: acc.Ef, Ee: acc.Ee, p, rank });
    if (k % every === 0 || k === n) {
      const Ep = rpPE(cfg, s.th, s.pay).total,
        r4 = v => +v.toFixed(4);
      rows.push({
        t: +t.toFixed(2),
        si: rpSegAt(rec, t).k,
        pay: s.pay,
        p: p.map(r4),
        th: s.th.map(v => +v.toFixed(3)),
        w: s.w.map(r4),
        tau: s.tau.map(r4),
        cur: s.cur.map(r4),
        Pm: r4(s.Pm),
        Pa: r4(s.Pa),
        Pf: r4(s.Pf),
        Pe: +s.Pe.toFixed(3),
        Em: r4(acc.Em),
        Ea: r4(acc.Ea),
        Ef: r4(acc.Ef),
        Ee: +acc.Ee.toFixed(3),
        dEp: r4(Ep - Ep0)
      });
    }
  }
  const lastR = rows[rows.length - 1];
  Object.assign(sum, { D, Em: lastR.Em, Ea: lastR.Ea, Ef: lastR.Ef, Ee: lastR.Ee, dEp: lastR.dEp });
  return { rows, sum, star };
}
// Ringkasan segmen untuk tabel dan penurunan Trajectory
function rpSegInfo(rec) {
  const cfg = rec.cfg;
  return rec.segs.map((sg, k) => {
    const o = { k, label: sg.label, type: sg.type, t0: sg.t0, T: sg.T };
    if (sg.type === 'joint') {
      o.thA = sg.q0.slice();
      o.thB = sg.q1.slice();
      o.dmax = Math.max(...sg.q0.map((v, i) => Math.abs(sg.q1[i] - v)));
      o.pA = rpFK(cfg, sg.q0);
      o.pB = rpFK(cfg, sg.q1);
    } else if (sg.type === 'line') {
      const K = sg.q.length - 1;
      o.thA = sg.q[0].slice();
      o.thB = sg.q[K].slice();
      o.pA = rpFK(cfg, sg.q[0]);
      o.pB = rpFK(cfg, sg.q[K]);
      o.L = Math.hypot(o.pB[0] - o.pA[0], o.pB[1] - o.pA[1], o.pB[2] - o.pA[2]);
      let dq = 0;
      for (let j = 1; j <= K; j++)
        for (let i = 0; i < 6; i++) dq = Math.max(dq, Math.abs(sg.q[j][i] - sg.q[j - 1][i]) * K);
      o.dmax = dq;
      o.samples = K;
    } else {
      o.thA = sg.q0.slice();
      o.thB = sg.q0.slice();
      o.pA = o.pB = rpFK(cfg, sg.q0);
      o.dmax = 0;
    }
    return o;
  });
}
// Salinan solver IK posisi (solveIK6) di frame base DH dengan catatan iterasi. Hasil sudut identik karena DLS
// tidak berubah terhadap rotasi frame (J dan e berputar bersama).
function rpSolveDLS3(cfg, tg, start) {
  let th = start.slice();
  const lam = IK_LAMBDA,
    hist = [];
  let first = null;
  for (let it = 0; it < 300; it++) {
    const p = rpFK(cfg, th),
      e = [tg[0] - p[0], tg[1] - p[1], tg[2] - p[2]],
      en = Math.hypot(e[0], e[1], e[2]);
    hist.push({ k: it, en, th: th.slice() });
    if (en < 0.001) break;
    const d = 0.5,
      J = [[], [], []];
    for (let i = 0; i < 6; i++) {
      const t2 = th.slice();
      t2[i] += d;
      const p2 = rpFK(cfg, t2);
      for (let r = 0; r < 3; r++) J[r][i] = (p2[r] - p[r]) / d;
    }
    const A = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let k = 0; k < 6; k++) s += J[r][k] * J[c][k];
        A[r][c] = s + (r === c ? lam * lam : 0);
      }
    const inv = invert3x3(A);
    if (!inv) break;
    const y = mat3VecMul(inv, e);
    const dth = [0, 1, 2, 3, 4, 5].map(i => J[0][i] * y[0] + J[1][i] * y[1] + J[2][i] * y[2]);
    const th0 = th.slice();
    for (let i = 0; i < 6; i++) th[i] = Math.max(cfg.dh[i].thMin, Math.min(cfg.dh[i].thMax, th[i] + dth[i]));
    if (!first) first = { th: th0, p, e, en, J, A, y, dth, th1: th.slice() };
  }
  const pf = rpFK(cfg, th);
  return { th, hist, first, iters: hist.length - 1, pf, err: Math.hypot(tg[0] - pf[0], tg[1] - pf[1], tg[2] - pf[2]) };
}
// Urutan hitung blok: telusuri sambungan dari Setpoint (sambungan balik ke Setpoint = umpan balik)
function rpBdOrder(edges) {
  const order = ['b1'],
    seen = new Set(order);
  for (let i = 0; i < order.length; i++)
    edges
      .filter(e => e[0] === order[i] && e[1] !== 'b1')
      .forEach(e => {
        if (!seen.has(e[1])) {
          seen.add(e[1]);
          order.push(e[1]);
        }
      });
  return { order, miss: Object.keys(BD_BLOCKS).filter(id => !seen.has(id)) };
}
function rpDiff(a, b) {
  if (!a || !b) return [];
  const out = [],
    eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!eq(a.dh, b.dh)) out.push('parameter DH');
  if (a.robotMeta.totalMass !== b.robotMeta.totalMass) out.push('massa total');
  if (!eq(a.motor, b.motor)) out.push('K, N, i motor');
  if (!eq(a.dash, b.dash)) out.push('parameter energi');
  if (a.torqueMode !== b.torqueMode) out.push('mode torsi');
  if (a.traj.wmax !== b.traj.wmax) out.push('ω maks');
  if (!eq(a.zz, b.zz)) out.push('0 Zone');
  return out;
}

// Susun laporan beku dari konfigurasi tersimpan dan rekaman gerak halaman
function rpBuild(page) {
  const cfg = rpClone(REP.cfg[page]),
    rec = REP.rec[page],
    R = {
      v: 1,
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      page,
      createdAt: new Date().toISOString(),
      cfg
    };
  if (rec) {
    const tl = rpTimeline(rec),
      si = rpSegInfo(rec);
    R.rec = {
      label: rec.label,
      at: rec.at,
      D: rec.D,
      kg: rec.kg,
      ik: rec.ik,
      src: rec.src,
      mode: rec.mode,
      frac: rec.frac,
      reachedAll: rec.reachedAll,
      target: rec.target,
      tGrasp: rec.tGrasp,
      tRelease: rec.tRelease,
      cfg: rec.cfg,
      diff: rpDiff(cfg, rec.cfg),
      segs: si,
      rows: tl.rows,
      sum: tl.sum
    };
    const st = tl.star,
      { k, u } = rpSegAt(rec, st.t),
      sg = si[k],
      sd = 0.005,
      pm = rpFK(rec.cfg, rpQ(rec, Math.max(0, st.t - sd))),
      pp = rpFK(rec.cfg, rpQ(rec, Math.min(rec.D, st.t + sd)));
    R.rec.star = {
      t: st.t,
      k,
      u,
      th: st.th,
      w: st.w,
      pay: st.pay,
      tau: st.tau,
      cur: st.cur,
      Pm: st.Pm,
      Pa: st.Pa,
      Pf: st.Pf,
      Pe: st.Pe,
      Em: st.Em,
      Ea: st.Ea,
      Ef: st.Ef,
      Ee: st.Ee,
      p: st.p,
      pdot: pm.map((v, i) => (pp[i] - v) / (2 * sd)),
      pe: rpPE(rec.cfg, st.th, st.pay)
    };
    R.rec.Ep0 = rpPE(rec.cfg, rpQ(rec, 0), rpPay(rec, 0)).total;
    if (rec.ik && rec.segs[0].q) {
      const q = rec.segs[0].q,
        N = 60,
        p0 = rpFK(rec.cfg, q[0]),
        tg = rec.target ? [rec.target.x, rec.target.y, rec.target.z] : rpFK(rec.cfg, q[q.length - 1]);
      R.rec.path = q.map((th, j) => {
        const s = j / N,
          pl = p0.map((v, i) => v + (tg[i] - v) * s),
          pr = rpFK(rec.cfg, th);
        return { j, s, pl, pr, e: Math.hypot(pl[0] - pr[0], pl[1] - pr[1], pl[2] - pr[2]), th };
      });
    }
  }
  const F = rpChain(cfg, cfg.theta);
  R.fk = {
    T: [0, 1, 2, 3, 4, 5].map(i => rpRows(dhMatrix(cfg.theta[i], cfg.dh[i].d, cfg.dh[i].a, cfg.dh[i].alpha))),
    T06: rpRows(F[6]),
    org: F.map(rpPos),
    p: rpPos(F[6])
  };
  if (cfg.zz.locked) R.fk.p0 = rpFK(cfg, cfg.zz.q0);
  if (page === 'ik') {
    const t = cfg.ik.target,
      tg = [t.x, t.y, t.z],
      same = REP.ik && Math.hypot(REP.ik.target.x - t.x, REP.ik.target.y - t.y, REP.ik.target.z - t.z) < 1e-9;
    const start = same ? REP.ik.start : cfg.zz.locked ? cfg.zz.q0 : cfg.theta;
    R.ik = {
      target: tg,
      start,
      startFrom: same ? 'aksi' : cfg.zz.locked ? 'zz' : 'cfg',
      method: same ? REP.ik.method : 'dls3',
      mode: same ? REP.ik.mode || '' : '',
      sol: rpSolveDLS3(cfg, tg, start)
    };
    R.ik.sol.hist = R.ik.sol.hist.filter((h, i, a) => i < 12 || i >= a.length - 3 || i % 10 === 0);
  }
  if (page === 'bd') {
    const o = rpBdOrder(cfg.bd.edges);
    R.bd = { order: o.order, miss: o.miss, sp: cfg.zz.locked ? rpFK(cfg, cfg.zz.q0) : null };
  }
  return R;
}

/* ---- Sesi 20b: isi laporan (template FK, IK, Blok Diagram) sebagai daftar blok ----
   Satu daftar blok dipakai tiga penyaji: pratinjau HTML (KaTeX), PDF, dan Docx. Rumus statis; angka yang berubah
   hanya substitusi input sampai output. Jenis blok: title, h1, h2, p, note, eq, table, chart, svg, pb. */
const X = String.raw;
const RPF = (v, d = 3) => {
  const x = +v;
  if (!isFinite(x)) return '-';
  let s = x.toFixed(d);
  if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
  return s;
};
const rpTexMat = (rows, d) =>
  X`\begin{bmatrix}` +
  rows.map(r => r.map(v => (typeof v === 'string' ? v : RPF(v, d))).join('&')).join(X`\\`) +
  X`\end{bmatrix}`;
const rpTexVec = (v, d) =>
  rpTexMat(
    v.map(x => [x]),
    d
  );
const RP_JC = ['#c9605a', '#e8a23d', '#5a9e57', '#3f9fc0', '#4d6fd1', '#a8408f'];
const RP_PAGE_NAME = {
  fk: 'JAKA Forward Kinematics (FK)',
  ik: 'JAKA Inverse Kinematics (IK)',
  bd: 'JAKA + Blok Diagram'
};
const RP_TITLE = {
  fk: 'Laporan Forward Kinematics',
  ik: 'Laporan Inverse Kinematics',
  bd: 'Laporan Blok Diagram Sistem'
};
const H1 = text => ({ t: 'h1', text }),
  H2 = text => ({ t: 'h2', text }),
  P = text => ({ t: 'p', text }),
  NOTE = text => ({ t: 'note', text }),
  EQ = (tex, label) => ({ t: 'eq', tex, label });
const TB = (head, rows, o) => Object.assign({ t: 'table', head, rows }, o || {});
const qn = i => 'q' + (i + 1);
const rpVec3 = v => '(' + v.map(x => RPF(x, 4)).join(', ') + ')';

function rpDocHead(R) {
  const rows = [
    ['Halaman', RP_PAGE_NAME[R.page]],
    ['Laporan dibuat', rpTime(R.createdAt)],
    ['Konfigurasi disimpan', rpTime(R.cfg.savedAt)],
    [
      'Rekaman gerak',
      R.rec ? R.rec.label + ', durasi ' + RPF(R.rec.D, 2) + ' s, selesai ' + rpTime(R.rec.at) : 'tidak ada'
    ],
    [
      'Satuan dan frame',
      'meter, derajat, detik; frame base DH dengan sumbu Z ke atas (sama dengan MATLAB dan controller JAKA); desimal memakai titik'
    ]
  ];
  return [
    { t: 'title', text: 'Laporan Simulasi JAKA ZU5', sub: RP_TITLE[R.page] },
    TB(null, rows, { kv: true }),
    NOTE(
      'Laporan ini disusun otomatis oleh Mode Laporan dari konfigurasi yang disimpan dan rekaman gerak terakhir di halaman ini. Rumus ditulis dalam bentuk umum, lalu diisi angka dari input sampai output. Simulator adalah alat bantu belajar: tidak ada model dinamika (M, C, G) dan tidak ada klaim stabilitas.'
    )
  ];
}
function rpDocCfg(R) {
  const c = R.cfg,
    B = [
      H1('1. Konfigurasi tersimpan (input)'),
      P(
        'Nilai-nilai berikut dipotret saat tombol Simpan Konfigurasi ditekan dan menjadi input seluruh perhitungan di laporan ini.'
      )
    ];
  if (!c.robotTouched)
    B.push(
      NOTE(
        'Parameter Robot belum diatur pengguna saat konfigurasi disimpan (pilihan "Tetap simpan"), jadi nilai bawaan simulator dipakai.'
      )
    );
  B.push(
    H2('1.1 Parameter Denavit-Hartenberg'),
    TB(
      ['Sendi', 'a (m)', 'α (°)', 'd (m)', 'θ min (°)', 'θ maks (°)'],
      c.dh.map((j, i) => [qn(i), RPF(j.a, 4), RPF(j.alpha, 1), RPF(j.d, 4), RPF(j.thMin, 0), RPF(j.thMax, 0)])
    )
  );
  B.push(
    H2('1.2 Sudut sendi dan 0 Zone'),
    TB(
      ['Sendi', 'θ (°)', 'θ₀ 0 Zone (°)', 'q = θ - θ₀ (°)'],
      c.theta.map((v, i) => [
        qn(i),
        RPF(v, 2),
        c.zz.locked ? RPF(c.zz.q0[i], 2) : '-',
        c.zz.locked ? RPF(v - c.zz.q0[i], 2) : '-'
      ])
    )
  );
  const kv = [
    ['0 Zone', c.zz.locked ? 'terkunci' : 'belum dikunci'],
    ['Massa total robot', RPF(c.robotMeta.totalMass, 2) + ' kg'],
    ['Payload aktif saat disimpan', RPF(c.payloadKg, 2) + ' kg'],
    ['Mode torsi', c.torqueMode === 'gravity' ? 'estimasi statis gravitasi' : 'arus input K·N·i'],
    [
      'Trajectory',
      'balok ' +
        c.traj.kg +
        ' kg, ω maks ' +
        c.traj.wmax +
        ' °/s, v maks ' +
        c.traj.vmax +
        ' m/s, kecepatan animasi ' +
        c.traj.speed +
        'x (tidak memengaruhi angka)'
    ]
  ];
  if (R.page === 'ik')
    kv.push(
      ['Target IK (x, y, z)', rpVec3([c.ik.target.x, c.ik.target.y, c.ik.target.z]) + ' m'],
      ['Mulai dari', c.ik.start === 'home' ? '0 Zone' : 'posisi sekarang'],
      ['Animasi penyelesaian', c.ik.animate ? 'ya (gerak lurus, IK 6D)' : 'tidak (langsung ke solusi)']
    );
  if (R.page === 'bd')
    kv.push(
      ['Balok untuk Play berulang', c.bd.kg + ' kg'],
      ['Status alur diagram', c.bd.valid ? 'valid' : 'tidak valid']
    );
  B.push(H2('1.3 Nilai lain'), TB(['Butir', 'Nilai'], kv, { kv: true }));
  if (R.page === 'bd') {
    B.push(
      H2('1.4 Motor dan parameter energi'),
      TB(
        ['Sendi', 'K (N·m/A)', 'N', 'i (A)', 'Massa link (kg)', 'b (N·m·s/rad)', 'c (N·m)', 'τ rated (N·m)'],
        c.dh.map((_, i) => [
          qn(i),
          RPF(c.motor.K[i], 3),
          RPF(c.motor.N[i], 0),
          RPF(c.motor.i[i], 2),
          RPF(c.dash.linkMass[i], 2),
          RPF(c.dash.b[i], 3),
          RPF(c.dash.c[i], 3),
          RPF(c.dash.rated[i], 1)
        ]),
        { small: true }
      ),
      P('Tegangan bus V = ' + c.dash.V + ' V, percepatan gravitasi g = ' + G_ACC + ' m/s².')
    );
  }
  return B;
}
// Penurunan bentuk umum DH (dipakai FK dan Blok Diagram)
function rpDocDH() {
  return [
    P(
      'Setiap sendi i dijelaskan empat parameter: θᵢ (putar terhadap sumbu z, variabel sendi), dᵢ (geser sepanjang z), aᵢ (panjang link sepanjang sumbu x yang baru), dan αᵢ (puntir terhadap sumbu x yang baru). Transformasi dari frame i-1 ke frame i adalah perkalian empat matriks dasar dengan urutan tetap:'
    ),
    EQ(X`{}^{i-1}\mathbf{T}_{i}=\mathbf{R}_z(\theta_i)\,\mathbf{T}_z(d_i)\,\mathbf{T}_x(a_i)\,\mathbf{R}_x(\alpha_i)`),
    P('Keempat matriks dasar homogen 4 × 4 itu adalah:'),
    EQ(
      X`\mathbf{R}_z(\theta_i)=\begin{bmatrix}\cos\theta_i&-\sin\theta_i&0&0\\\sin\theta_i&\cos\theta_i&0&0\\0&0&1&0\\0&0&0&1\end{bmatrix},\qquad \mathbf{T}_z(d_i)=\begin{bmatrix}1&0&0&0\\0&1&0&0\\0&0&1&d_i\\0&0&0&1\end{bmatrix}`
    ),
    EQ(
      X`\mathbf{T}_x(a_i)=\begin{bmatrix}1&0&0&a_i\\0&1&0&0\\0&0&1&0\\0&0&0&1\end{bmatrix},\qquad \mathbf{R}_x(\alpha_i)=\begin{bmatrix}1&0&0&0\\0&\cos\alpha_i&-\sin\alpha_i&0\\0&\sin\alpha_i&\cos\alpha_i&0\\0&0&0&1\end{bmatrix}`
    ),
    P('Langkah 1. Putar lalu geser sepanjang sumbu z yang sama. Karena sumbunya sama, urutan keduanya boleh ditukar:'),
    EQ(
      X`\mathbf{R}_z(\theta_i)\,\mathbf{T}_z(d_i)=\begin{bmatrix}\cos\theta_i&-\sin\theta_i&0&0\\\sin\theta_i&\cos\theta_i&0&0\\0&0&1&d_i\\0&0&0&1\end{bmatrix}`
    ),
    P('Langkah 2. Geser lalu puntir terhadap sumbu x yang baru:'),
    EQ(
      X`\mathbf{T}_x(a_i)\,\mathbf{R}_x(\alpha_i)=\begin{bmatrix}1&0&0&a_i\\0&\cos\alpha_i&-\sin\alpha_i&0\\0&\sin\alpha_i&\cos\alpha_i&0\\0&0&0&1\end{bmatrix}`
    ),
    P(
      'Langkah 3. Kalikan hasil langkah 1 dan langkah 2 (baris matriks kiri dikali kolom matriks kanan). Contoh elemen baris 1 kolom 2: cos θᵢ · 0 + (-sin θᵢ) · cos αᵢ + 0 · sin αᵢ + 0 · 0 = -sin θᵢ cos αᵢ. Elemen baris 1 kolom 4: cos θᵢ · aᵢ + 0 + 0 + 0 = aᵢ cos θᵢ. Hasil lengkapnya adalah bentuk umum matriks DH:'
    ),
    EQ(
      X`{}^{i-1}\mathbf{T}_{i}=\begin{bmatrix}\cos\theta_i&-\sin\theta_i\cos\alpha_i&\sin\theta_i\sin\alpha_i&a_i\cos\theta_i\\\sin\theta_i&\cos\theta_i\cos\alpha_i&-\cos\theta_i\sin\alpha_i&a_i\sin\theta_i\\0&\sin\alpha_i&\cos\alpha_i&d_i\\0&0&0&1\end{bmatrix}`
    ),
    P(
      'Tiga kolom pertama berisi orientasi frame i dilihat dari frame i-1 (matriks rotasi 3 × 3), kolom keempat berisi posisi titik asal frame i, dan baris terakhir [0 0 0 1] membuat rotasi dan translasi bisa digabung dalam satu perkalian.'
    )
  ];
}
function rpDocFKNum(R, sec) {
  const c = R.cfg,
    F = R.fk,
    B = [
      H2(sec + '.2 Substitusi parameter tiap sendi'),
      P('Parameter DH dan sudut sendi dari konfigurasi tersimpan dimasukkan ke bentuk umum di atas.')
    ];
  for (let i = 0; i < 6; i++)
    B.push(
      EQ(
        X`{}^{${i}}\mathbf{T}_{${i + 1}}=` + rpTexMat(F.T[i], 4),
        'Sendi ' +
          (i + 1) +
          ': θ = ' +
          RPF(c.theta[i], 2) +
          '°, d = ' +
          RPF(c.dh[i].d, 4) +
          ' m, a = ' +
          RPF(c.dh[i].a, 4) +
          ' m, α = ' +
          RPF(c.dh[i].alpha, 1) +
          '°'
      )
    );
  B.push(
    H2(sec + '.3 Rantai kinematik'),
    P(
      'Frame end-effector dicapai dengan mengalikan keenam matriks berurutan dari kiri ke kanan. Urutan ini penting karena perkalian matriks tidak komutatif: tiap matriks menyatakan gerak relatif terhadap frame sebelumnya. Perkalian dikerjakan bertahap, satu sendi setiap langkah:'
    ),
    EQ(
      X`{}^{0}\mathbf{T}_{6}={}^{0}\mathbf{T}_{1}\;{}^{1}\mathbf{T}_{2}\;{}^{2}\mathbf{T}_{3}\;{}^{3}\mathbf{T}_{4}\;{}^{4}\mathbf{T}_{5}\;{}^{5}\mathbf{T}_{6},\qquad {}^{0}\mathbf{T}_{k}={}^{0}\mathbf{T}_{k-1}\;{}^{k-1}\mathbf{T}_{k}`
    ),
    P(
      'Kolom keempat dari tiap hasil antara (matriks base ke frame k) adalah posisi titik asal frame k, yaitu posisi sendi di frame base:'
    ),
    TB(
      ['Frame', 'x (m)', 'y (m)', 'z (m)'],
      F.org.map((o, k) => [
        k === 0 ? 'base (0)' : k === 6 ? '6 (end-effector)' : String(k),
        RPF(o[0], 4),
        RPF(o[1], 4),
        RPF(o[2], 4)
      ])
    )
  );
  const T = F.T06;
  B.push(
    H2(sec + '.4 Hasil: posisi dan orientasi end-effector (output)'),
    EQ(X`{}^{0}\mathbf{T}_{6}=` + rpTexMat(T, 4)),
    EQ(
      X`\mathbf{p}=\begin{bmatrix}x\\y\\z\end{bmatrix}=` +
        rpTexVec(F.p, 4) +
        X`\ \mathrm{m},\qquad \mathbf{z}_6=` +
        rpTexVec([T[0][2], T[1][2], T[2][2]], 4)
    ),
    P(
      'Kolom keempat matriks base ke frame 6 adalah posisi end-effector (flange) di frame base. Tiga kolom pertama adalah orientasinya; kolom ketiga z₆ adalah arah sumbu alat. Nilai z₆ = (0, 0, -1) berarti alat menghadap tepat ke bawah.'
    )
  );
  if (F.p0) {
    const d = F.p.map((v, i) => v - F.p0[i]);
    B.push(
      H2(sec + '.5 Perubahan posisi dari 0 Zone'),
      P(
        '0 Zone adalah pose awal yang dikunci. Dengan rumus yang sama, sudut 0 Zone θ₀ menghasilkan posisi awal p₀. Selisih p - p₀ menunjukkan perpindahan end-effector akibat perubahan sudut sendi q = θ - θ₀ (tabel 1.2).'
      ),
      EQ(
        X`\mathbf{p}_0=\mathrm{FK}(\boldsymbol\theta_0)=` +
          rpTexVec(F.p0, 4) +
          X`\ \mathrm{m},\qquad \Delta\mathbf{p}=\mathbf{p}-\mathbf{p}_0=` +
          rpTexVec(d, 4) +
          X`\ \mathrm{m},\qquad \lVert\Delta\mathbf{p}\rVert=` +
          RPF(Math.hypot(...d), 4) +
          X`\ \mathrm{m}`
      )
    );
  }
  return B;
}
// Rekaman gerak: profil quintic, tabel segmen, data tiap 0,2 s, grafik
function rpDocTraj(R, n, energy) {
  const r = R.rec;
  if (!r)
    return [
      H1(n + '. Rekaman gerak'),
      P(
        'Belum ada rekaman gerak di halaman ini saat laporan dibuat, jadi tabel data dan grafik tidak disertakan. Jalankan Play (atau animasi IK) sampai selesai lalu buat laporan lagi.'
      )
    ];
  const B = [
    H1(n + '. Rekaman gerak: ' + r.label),
    P(
      'Rekaman diambil dari gerak terakhir yang selesai di halaman ini (' +
        rpTime(r.at) +
        '), durasi ' +
        RPF(r.D, 2) +
        ' s. Data dihitung ulang dari rencana gerak terhadap waktu simulasi dengan langkah 0,01 s, lalu ditampilkan tiap 0,2 s. Kecepatan animasi tidak memengaruhi angka, dan siklus Play berulang tidak memperpanjang waktu (satu siklus saja).'
    )
  ];
  if (r.diff.length)
    B.push(
      NOTE(
        'Perhatian: rekaman dibuat dengan nilai yang berbeda dari konfigurasi tersimpan (' +
          r.diff.join(', ') +
          '). Angka rekaman memakai nilai saat gerak berlangsung.'
      )
    );
  B.push(
    H2(n + '.1 Profil waktu quintic'),
    P(
      'Setiap segmen gerak memakai skala waktu quintic s(u), sehingga posisi, kecepatan, dan percepatan di awal serta akhir segmen bernilai nol (gerak halus tanpa sentakan):'
    ),
    EQ(X`s(u)=10u^{3}-15u^{4}+6u^{5},\qquad u=\frac{t-t_0}{T}\in[0,1]`),
    P('Turunannya terhadap waktu (dengan du/dt = 1/T):'),
    EQ(
      X`\dot s=\frac{30u^{2}-60u^{3}+30u^{4}}{T}=\frac{30u^{2}(1-u)^{2}}{T},\qquad \ddot s=\frac{60u(1-u)(1-2u)}{T^{2}}`
    ),
    P(
      'Kecepatan terbesar terjadi di tengah segmen (u = 0,5): ṡ maks = 30 · 0,25 · 0,25 / T = 1,875 / T. Supaya kecepatan sendi terbesar tidak melebihi ω maks (dan kecepatan Cartesian tidak melebihi v maks), durasi segmen dipilih:'
    ),
    EQ(
      X`T=\max\!\left(\frac{1.875\,\Delta\theta_{max}}{\omega_{max}},\ \frac{1.875\,L}{v_{max}},\ 0.6\ \mathrm{s}\right)`
    ),
    P(
      'Segmen sendi menginterpolasi sudut langsung: θ(t) = θ_A + s(u)(θ_B - θ_A). Segmen garis lurus menginterpolasi posisi: p(t) = p_A + s(u)(p_B - p_A), dan IK 6D diselesaikan pada 48 sampel sepanjang garis. Untuk segmen garis, Δθmax adalah laju sudut terbesar antar sampel IK dikali jumlah sampel. Segmen diam (ambil atau lepas balok) berdurasi 0,5 s.'
    ),
    TB(
      ['#', 'Fase', 'Tipe', 't₀ (s)', 'T (s)', 'Δθmax (°)', 'L (m)'],
      r.segs.map(s => [
        String(s.k + 1),
        s.label,
        s.type === 'joint' ? 'sendi' : s.type === 'line' ? 'garis lurus' : 'diam',
        RPF(s.t0, 2),
        RPF(s.T, 2),
        s.type === 'dwell' ? '-' : RPF(s.dmax, 1),
        s.L !== undefined ? RPF(s.L, 3) : '-'
      ]),
      { small: true }
    )
  );
  if (!r.ik)
    B.push(
      P(
        'Payload: balok ' +
          r.kg +
          ' kg menempel di end-effector dari t = ' +
          RPF(r.tGrasp, 2) +
          ' s (tengah segmen ambil) sampai t = ' +
          RPF(r.tRelease, 2) +
          ' s (tengah segmen lepas).'
      )
    );
  const rows = r.rows;
  B.push(
    H2(n + '.2 Data tiap 0,2 detik: kinematika'),
    TB(
      ['t (s)', 'Seg', 'x (m)', 'y (m)', 'z (m)', 'θ1', 'θ2', 'θ3', 'θ4', 'θ5', 'θ6'],
      rows.map(w => [
        RPF(w.t, 2),
        String(w.si + 1),
        RPF(w.p[0], 3),
        RPF(w.p[1], 3),
        RPF(w.p[2], 3),
        ...w.th.map(v => RPF(v, 1))
      ]),
      { small: true, caption: 'Sudut sendi θ dalam derajat. Kolom Seg merujuk nomor fase di tabel segmen.' }
    )
  );
  if (energy) {
    B.push(
      H2(n + '.3 Data tiap 0,2 detik: torsi dan energi mekanik'),
      TB(
        ['t (s)', 'τ1', 'τ2', 'τ3', 'τ4', 'τ5', 'τ6', 'Pm (W)', 'Em (J)', 'Eabs (J)'],
        rows.map(w => [RPF(w.t, 2), ...w.tau.map(v => RPF(v, 2)), RPF(w.Pm, 2), RPF(w.Em, 2), RPF(w.Ea, 2)]),
        {
          small: true,
          caption: 'Torsi τ dalam N·m. Dengan ω kecepatan sendi: Pm = Σ τ·ω, Em = ∫Pm dt, Eabs = ∫Σ|τ·ω| dt.'
        }
      ),
      H2(n + '.4 Data tiap 0,2 detik: arus dan energi elektrik'),
      TB(
        ['t (s)', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'Pe (W)', 'Ee (J)', 'ΔEp (J)'],
        rows.map(w => [RPF(w.t, 2), ...w.cur.map(v => RPF(v, 3)), RPF(w.Pe, 1), RPF(w.Ee, 1), RPF(w.dEp, 2)]),
        { small: true, caption: 'Arus i dalam A. Pe = V Σ|i|, Ee = ∫Pe dt, ΔEp = Ep(t) - Ep(0).' }
      )
    );
  }
  const x = rows.map(w => w.t),
    ser = (f, lab, col) => ({ label: lab, data: rows.map(f), color: col });
  B.push(
    H2(n + (energy ? '.5' : '.3') + ' Grafik rekap'),
    {
      t: 'chart',
      title: 'Sudut sendi terhadap waktu',
      xl: 't (s)',
      yl: 'θ (°)',
      x,
      series: [0, 1, 2, 3, 4, 5].map(i => ser(w => w.th[i], 'θ' + (i + 1), RP_JC[i])),
      caption: 'Gambar: sudut keenam sendi selama gerak.'
    },
    {
      t: 'chart',
      title: 'Posisi end-effector terhadap waktu',
      xl: 't (s)',
      yl: 'posisi (m)',
      x,
      series: [ser(w => w.p[0], 'x', '#c9605a'), ser(w => w.p[1], 'y', '#5a9e57'), ser(w => w.p[2], 'z', '#4d6fd1')],
      caption: 'Gambar: posisi end-effector di frame base (Z ke atas).'
    }
  );
  if (energy)
    B.push(
      {
        t: 'chart',
        title: 'Torsi sendi terhadap waktu',
        xl: 't (s)',
        yl: 'τ (N·m)',
        x,
        series: [0, 1, 2, 3, 4, 5].map(i => ser(w => w.tau[i], 'τ' + (i + 1), RP_JC[i])),
        caption: 'Gambar: torsi tiap sendi.'
      },
      {
        t: 'chart',
        title: 'Energi mekanik dan potensial',
        xl: 't (s)',
        yl: 'E (J)',
        x,
        series: [
          ser(w => w.Em, 'Em', '#4d6fd1'),
          ser(w => w.Ea, 'Eabs', '#e8a23d'),
          ser(w => w.dEp, 'ΔEp', '#5a9e57'),
          ser(w => w.Ef, 'Ef gesekan', '#a8408f')
        ],
        caption: 'Gambar: energi mekanik kumulatif, usaha absolut, perubahan energi potensial, dan energi gesekan.'
      },
      {
        t: 'chart',
        title: 'Daya dan energi elektrik',
        xl: 't (s)',
        yl: 'P (W) / E (J)',
        x,
        series: [ser(w => w.Pe, 'Pe (W)', '#c9605a'), ser(w => w.Ee, 'Ee (J)', '#3f9fc0')],
        caption: 'Gambar: daya elektrik dan energi elektrik kumulatif.'
      }
    );
  return B;
}
function rpDocTail(R, n) {
  const c = R.cfg,
    chg = (a, b) => (JSON.stringify(a) !== JSON.stringify(b) ? 'diubah pengguna' : 'nilai bawaan');
  const dhDef =
    JSON.stringify(defaultDH.map(j => ({ a: j.a, alpha: j.alpha, d: j.d, thMin: j.thMin, thMax: j.thMax }))) ===
    JSON.stringify(c.dh)
      ? 'nilai bawaan'
      : 'diubah pengguna';
  const rows = [
    [
      'Parameter DH',
      'Geometri file STEP resmi JAKA ZU5 pada pose nol',
      dhDef + '; arah nol sendi belum tentu sama dengan controller JAKA'
    ],
    [
      'Massa total robot',
      'Datasheet publik JAKA ZU5 (23 kg)',
      (c.robotMeta.totalMass === RP_DEF.mass ? 'nilai bawaan' : 'diubah pengguna') + '; belum diverifikasi'
    ],
    ['Massa tiap link', 'Massa total dibagi menurut volume mesh STEP (kerapatan seragam)', 'estimasi kasar'],
    ['Pusat massa link', 'Titik berat volume mesh STEP tiap link', 'estimasi kasar'],
    ['K, N, i motor', 'Placeholder simulator', chg(c.motor, RP_DEF.motor) + '; belum dari datasheet servo JAKA'],
    ['Tegangan bus V', 'Placeholder simulator', c.dash.V === RP_DEF.dash.V ? 'nilai bawaan' : 'diubah pengguna'],
    ['Gesekan b, c', 'Default 0 (belum ada data)', chg([c.dash.b, c.dash.c], [RP_DEF.dash.b, RP_DEF.dash.c])],
    ['τ rated', 'Placeholder simulator', chg(c.dash.rated, RP_DEF.dash.rated)],
    ['g', 'Konstanta 9,81 m/s²', 'tetap']
  ];
  return [
    H1(n + '. Asal nilai dan batasan'),
    TB(['Besaran', 'Sumber', 'Status'], rows, { small: true }),
    P(
      'Batasan: simulator ini alat bantu belajar dan presentasi. Tidak ada model dinamika (matriks inersia M, Coriolis C, gravitasi penuh G) dan tidak ada klaim stabilitas. Torsi mode gravitasi adalah statika penahan beban (tanpa inersia dan Coriolis). Eksekusi sendi dianggap ideal (tanpa PID). Hasil resmi proyek tetap dari MATLAB/Simulink dan SolidWorks.'
    )
  ];
}

function rpDocFK(R) {
  return [
    ...rpDocHead(R),
    ...rpDocCfg(R),
    H1('2. Penurunan Forward Kinematics'),
    P(
      'Forward Kinematics (FK) menjawab pertanyaan: jika sudut keenam sendi diketahui, di mana posisi dan ke mana arah end-effector? Jawabannya diperoleh dengan mengalikan matriks transformasi homogen tiap sendi, mulai dari base sampai flange.'
    ),
    H2('2.1 Empat gerakan dasar Denavit-Hartenberg'),
    ...rpDocDH(),
    ...rpDocFKNum(R, 2),
    ...rpDocTraj(R, 3, false),
    ...rpDocTail(R, 4)
  ];
}

function rpDocIK(R) {
  const c = R.cfg,
    K = R.ik,
    S = K.sol,
    f = S.first,
    tg = K.target,
    B = [...rpDocHead(R), ...rpDocCfg(R)];
  B.push(
    H1('2. Masalah Inverse Kinematics'),
    P(
      'Inverse Kinematics (IK) adalah kebalikan FK: posisi target end-effector p* diketahui, sudut sendi θ dicari sehingga FK(θ) = p*. Persamaan FK berisi perkalian sinus dan kosinus dari enam sudut, sehingga tidak diselesaikan langsung, melainkan dengan iterasi numerik: mulai dari tebakan θ, perbaiki sedikit demi sedikit sampai galat cukup kecil.'
    ),
    EQ(
      X`\text{cari }\boldsymbol\theta\ \text{sehingga}\ \mathrm{FK}(\boldsymbol\theta)=\mathbf{p}^{*}=` +
        rpTexVec(tg, 4) +
        X`\ \mathrm{m}`
    ),
    H2('2.1 Galat dan linearisasi'),
    EQ(X`\mathbf{e}=\mathbf{p}^{*}-\mathrm{FK}(\boldsymbol\theta)`),
    P(
      'Untuk langkah kecil Δθ, FK dapat didekati linear dengan matriks Jacobian J, yaitu turunan posisi end-effector terhadap tiap sudut sendi:'
    ),
    EQ(
      X`\mathrm{FK}(\boldsymbol\theta+\Delta\boldsymbol\theta)\approx\mathrm{FK}(\boldsymbol\theta)+\mathbf{J}(\boldsymbol\theta)\,\Delta\boldsymbol\theta,\qquad \mathbf{J}=\frac{\partial\,\mathrm{FK}}{\partial\boldsymbol\theta}\in\mathbb{R}^{3\times 6}`
    ),
    P(
      'Agar FK(θ + Δθ) = p*, syaratnya J Δθ ≈ e. Karena J berukuran 3 × 6 (tiga persamaan, enam sudut), solusinya tidak tunggal, dan di dekat singularitas J hampir kehilangan rank sehingga langkah biasa bisa sangat besar.'
    ),
    H2('2.2 Damped least squares (DLS)'),
    P('DLS mencari Δθ yang meminimalkan galat sisa sekaligus menghukum langkah yang terlalu besar:'),
    EQ(
      X`\min_{\Delta\boldsymbol\theta}\ \lVert\mathbf{e}-\mathbf{J}\Delta\boldsymbol\theta\rVert^{2}+\lambda^{2}\lVert\Delta\boldsymbol\theta\rVert^{2}`
    ),
    P('Turunan terhadap Δθ disamakan dengan nol:'),
    EQ(
      X`-2\mathbf{J}^{T}(\mathbf{e}-\mathbf{J}\Delta\boldsymbol\theta)+2\lambda^{2}\Delta\boldsymbol\theta=\mathbf{0}\quad\Rightarrow\quad(\mathbf{J}^{T}\mathbf{J}+\lambda^{2}\mathbf{I})\,\Delta\boldsymbol\theta=\mathbf{J}^{T}\mathbf{e}`
    ),
    P('Dengan identitas matriks berikut, cukup membalik matriks 3 × 3 (bukan 6 × 6):'),
    EQ(
      X`\left(\mathbf{J}^{T}\mathbf{J}+\lambda^{2}\mathbf{I}\right)^{-1}\mathbf{J}^{T}=\mathbf{J}^{T}\left(\mathbf{J}\mathbf{J}^{T}+\lambda^{2}\mathbf{I}\right)^{-1}`
    ),
    EQ(
      X`\Delta\boldsymbol\theta=\mathbf{J}^{T}\left(\mathbf{J}\mathbf{J}^{T}+\lambda^{2}\mathbf{I}\right)^{-1}\mathbf{e}`
    ),
    P(
      'λ adalah peredam: makin besar λ, langkah makin kecil dan stabil di dekat singularitas, tetapi konvergensi lebih lambat.'
    ),
    H2('2.3 Jacobian numerik dan aturan berhenti'),
    EQ(
      X`\mathbf{J}_{:,k}\approx\frac{\mathrm{FK}(\boldsymbol\theta+\delta\,\mathbf{e}_k)-\mathrm{FK}(\boldsymbol\theta)}{\delta},\qquad \delta=0.5^{\circ},\qquad \boldsymbol\theta_{n+1}=\mathrm{clip}\!\left(\boldsymbol\theta_n+\Delta\boldsymbol\theta_n,\ \boldsymbol\theta_{min},\ \boldsymbol\theta_{max}\right)`
    ),
    P(
      'Karena δ dalam derajat, satuan J adalah meter per derajat dan Δθ langsung dalam derajat. Setelah tiap langkah, sudut dibatasi ke rentang sendi. Iterasi berhenti bila ‖e‖ < 1 mm atau setelah 300 iterasi. Peredam λ = ' +
        IK_LAMBDA +
        '.'
    )
  );
  if (K.method === 'path6d')
    B.push(
      H2('2.4 Varian yang dipakai animasi: gerak lurus dengan IK 6D'),
      P(
        'Saat "animasikan penyelesaian" aktif, simulator tidak melompat langsung ke solusi. Garis lurus dari posisi awal ke target dibagi 60 sampel, dan tiap sampel diselesaikan dengan DLS 6D: tiga baris galat posisi ditambah tiga baris galat arah sumbu alat, supaya orientasi alat ikut dijaga. Hasil tiap sampel menjadi tebakan awal sampel berikutnya.'
      ),
      EQ(
        X`\mathbf{e}=\begin{bmatrix}\mathbf{p}^{*}-\mathbf{p}\\ w_o\,(\mathbf{z}_d-\mathbf{z}_6)\end{bmatrix},\qquad \lambda=0.003,\quad \delta=0.2^{\circ},\quad \lvert\Delta\theta_k\rvert\le 30^{\circ}`
      ),
      P(
        'Bobot orientasi w_o = 0,5; bila sampel gagal diturunkan ke 0,05, lalu 0 (orientasi bebas). Mode yang dipakai saat itu: ' +
          (K.mode || '-') +
          '. Solusi IK tidak tunggal, jadi jalur animasi bisa berakhir di konfigurasi sendi yang berbeda dari iterasi DLS posisi di bagian 3, walau posisi end-effector sama.'
      )
    );
  const startTxt =
    K.startFrom === 'aksi'
      ? 'sudut saat tombol Selesaikan IK ditekan'
      : K.startFrom === 'zz'
        ? 'sudut 0 Zone'
        : 'sudut pada konfigurasi tersimpan';
  B.push(
    H1('3. Perhitungan numerik (input sampai output)'),
    P(
      'Iterasi berikut dihitung ulang dengan DLS posisi (bagian 2.2 dan 2.3) dari ' +
        startTxt +
        ' ke target tersimpan, memakai parameter DH tersimpan. Solver sama persis dengan tombol "Selesaikan IK" tanpa animasi.'
    )
  );
  if (f) {
    B.push(
      H2('3.1 Iterasi pertama, disubstitusi lengkap'),
      EQ(
        X`\boldsymbol\theta_0=` +
          rpTexVec(f.th, 3) +
          X`^{\circ},\qquad \mathrm{FK}(\boldsymbol\theta_0)=` +
          rpTexVec(f.p, 4) +
          X`\ \mathrm{m}`
      ),
      EQ(
        X`\mathbf{e}_0=\mathbf{p}^{*}-\mathrm{FK}(\boldsymbol\theta_0)=` +
          rpTexVec(tg, 4) +
          '-' +
          rpTexVec(f.p, 4) +
          '=' +
          rpTexVec(f.e, 4) +
          X`\ \mathrm{m},\qquad \lVert\mathbf{e}_0\rVert=` +
          RPF(f.en * 1000, 2) +
          X`\ \mathrm{mm}`
      ),
      EQ(X`\mathbf{J}_0=` + rpTexMat(f.J, 5) + X`\ \mathrm{m}/^{\circ}`),
      EQ(
        X`\mathbf{J}_0\mathbf{J}_0^{T}+\lambda^{2}\mathbf{I}=` +
          rpTexMat(f.A, 6) +
          X`,\qquad \mathbf{y}=\left(\mathbf{J}_0\mathbf{J}_0^{T}+\lambda^{2}\mathbf{I}\right)^{-1}\mathbf{e}_0=` +
          rpTexVec(f.y, 3)
      ),
      EQ(
        X`\Delta\boldsymbol\theta_0=\mathbf{J}_0^{T}\mathbf{y}=` +
          rpTexVec(f.dth, 3) +
          X`^{\circ},\qquad \boldsymbol\theta_1=\mathrm{clip}(\boldsymbol\theta_0+\Delta\boldsymbol\theta_0)=` +
          rpTexVec(f.th1, 3) +
          X`^{\circ}`
      )
    );
  } else B.push(P('Posisi awal sudah berada dalam 1 mm dari target, jadi tidak ada iterasi yang diperlukan.'));
  B.push(
    H2('3.2 Riwayat iterasi'),
    TB(
      ['n', '‖e‖ (mm)', 'θ1', 'θ2', 'θ3', 'θ4', 'θ5', 'θ6'],
      S.hist.map(h => [String(h.k), RPF(h.en * 1000, 3), ...h.th.map(v => RPF(v, 2))]),
      { small: true, caption: 'Sudut dalam derajat. Ditampilkan 12 iterasi pertama, tiap 10 iterasi, dan 3 terakhir.' }
    )
  );
  const ok = S.err < 0.003;
  B.push(
    H2('3.3 Hasil (output)'),
    TB(
      ['Sendi', 'θ awal (°)', 'θ* (°)', 'Δθ (°)'],
      S.th.map((v, i) => [qn(i), RPF(K.start[i], 2), RPF(v, 2), RPF(v - K.start[i], 2)])
    ),
    EQ(
      X`\mathrm{FK}(\boldsymbol\theta^{*})=` +
        rpTexVec(S.pf, 4) +
        X`\ \mathrm{m},\qquad \lVert\mathbf{p}^{*}-\mathrm{FK}(\boldsymbol\theta^{*})\rVert=` +
        RPF(S.err * 1000, 3) +
        X`\ \mathrm{mm}`
    ),
    P(
      ok
        ? 'Solver konvergen setelah ' +
            S.iters +
            ' iterasi: posisi end-effector hasil FK dari θ* berada dalam ' +
            RPF(S.err * 1000, 2) +
            ' mm dari target.'
        : 'Solver belum konvergen (galat ' +
            RPF(S.err * 1000, 1) +
            ' mm setelah ' +
            S.iters +
            ' iterasi). Target kemungkinan di luar jangkauan, dekat singularitas, atau terhalang batas sendi.'
    )
  );
  const r = R.rec;
  if (r && r.path) {
    const pts = r.path.filter((p, i, a) => i % 6 === 0 || i === a.length - 1);
    B.push(
      H2('3.4 Jalur animasi IK (rekaman)'),
      P(
        'Setiap sampel jalur diselesaikan dengan DLS 6D. Tabel membandingkan titik pada garis lurus dengan posisi hasil FK dari sudut yang ditemukan. Jalur mencapai ' +
          Math.round((r.frac || 1) * 100) +
          '% garis.'
      ),
      TB(
        ['Sampel', 's', 'Titik garis (m)', 'Hasil FK (m)', 'Galat (mm)'],
        pts.map(p => [String(p.j), RPF(p.s, 2), rpVec3(p.pl), rpVec3(p.pr), RPF(p.e * 1000, 2)]),
        { small: true }
      )
    );
  }
  B.push(...rpDocTraj(R, 4, false), ...rpDocTail(R, 5));
  return B;
}

// SVG diagram blok untuk laporan (gaya cetak, warna terang, atribut inline)
function rpBdSvg(cfg) {
  const pos = cfg.bd.pos,
    W = BD_W,
    H = BD_H,
    P2 = id => ({ x: pos[id][0], y: pos[id][1] }),
    esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const path = (a, b) => {
    const A = P2(a),
      Bq = P2(b),
      x1 = A.x + W,
      y1 = A.y + H / 2,
      x2 = Bq.x - 2,
      y2 = Bq.y + H / 2;
    if (x2 >= x1 - 10) {
      const dx = Math.max(40, (x2 - x1) / 2);
      return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2;
    }
    const top = Math.max(4, Math.min(A.y, Bq.y) - 44);
    return 'M' + x1 + ',' + y1 + ' C' + (x1 + 90) + ',' + top + ' ' + (x2 - 90) + ',' + top + ' ' + x2 + ',' + y2;
  };
  let s =
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="350" viewBox="0 0 960 350"><rect width="960" height="350" fill="#ffffff"/>' +
    '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2f66b3"/></marker>' +
    '<marker id="arb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#b5533f"/></marker></defs>';
  cfg.bd.edges.forEach(([a, b]) => {
    const bad = BD_BLOCKS[a].out !== BD_BLOCKS[b].in,
      fb = b === 'b1';
    s +=
      '<path d="' +
      path(a, b) +
      '" fill="none" stroke="' +
      (bad ? '#b5533f' : fb ? '#7b8698' : '#2f66b3') +
      '" stroke-width="2"' +
      (bad || fb ? ' stroke-dasharray="6 4"' : '') +
      ' marker-end="url(#' +
      (bad ? 'arb' : 'ar') +
      ')"/>';
  });
  Object.keys(BD_BLOCKS).forEach(id => {
    const b = BD_BLOCKS[id],
      p = P2(id);
    s +=
      '<rect x="' +
      p.x +
      '" y="' +
      p.y +
      '" width="' +
      W +
      '" height="' +
      H +
      '" rx="6" fill="#f2f6fc" stroke="#2f66b3" stroke-width="1.5"/>' +
      '<text x="' +
      (p.x + W / 2) +
      '" y="' +
      (p.y + 30) +
      '" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="#0b1220">' +
      esc(b.t[0]) +
      '</text>' +
      '<text x="' +
      (p.x + W / 2) +
      '" y="' +
      (p.y + 50) +
      '" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#566275">' +
      esc(b.t[1]) +
      '</text>';
  });
  return s + '</svg>';
}
function rpDocBD(R) {
  const c = R.cfg,
    r = R.rec,
    B = [...rpDocHead(R), ...rpDocCfg(R)],
    nm = id => BD_BLOCKS[id].t[0];
  B.push(
    H1('2. Diagram alur sistem'),
    P(
      'Blok dan sambungan di bawah persis seperti yang disusun di halaman Blok Diagram saat konfigurasi disimpan. Tiap sambungan membawa satu jenis sinyal: P posisi Cartesian p beserta kecepatan dan percepatannya, Q sudut sendi θ, I arus motor, T torsi.'
    ),
    {
      t: 'svg',
      svg: rpBdSvg(c),
      w: 960,
      h: 350,
      caption:
        'Gambar: diagram blok. Garis putus-putus abu-abu = umpan balik ke Setpoint; garis merah putus-putus = sambungan dengan tipe sinyal tidak cocok.'
    },
    TB(
      ['#', 'Dari', 'Ke', 'Sinyal', 'Status'],
      c.bd.edges.map(([a, b], k) => {
        const ok = BD_BLOCKS[a].out === BD_BLOCKS[b].in;
        return [
          String(k + 1),
          nm(a),
          nm(b),
          BD_BLOCKS[a].out || '-',
          ok ? (b === 'b1' ? 'umpan balik' : 'cocok') : 'tipe tidak cocok'
        ];
      }),
      { small: true }
    )
  );
  if (c.bd.errors && c.bd.errors.length) B.push(NOTE('Alur tidak valid saat disimpan: ' + c.bd.errors.join(' ')));
  if (c.bd.warns && c.bd.warns.length) B.push(NOTE('Catatan alur: ' + c.bd.warns.join(' ')));
  const O = R.bd.order;
  B.push(
    H2('2.1 Urutan perhitungan'),
    P(
      'Urutan diperoleh dengan menelusuri sambungan mulai dari Setpoint. Sambungan kembali ke Setpoint adalah umpan balik dan tidak menambah urutan. Penurunan di bagian 3 mengikuti urutan ini.'
    ),
    TB(
      ['Urutan', 'Blok', 'Masukan', 'Keluaran'],
      O.map((id, k) => [
        String(k + 1),
        nm(id),
        BD_TYPE[BD_BLOCKS[id].in] || '-',
        BD_BLOCKS[id].out ? BD_TYPE[BD_BLOCKS[id].out] : '-'
      ]),
      { small: true }
    )
  );
  if (R.bd.miss.length)
    B.push(NOTE('Blok yang tidak tersambung dari Setpoint dan tidak dihitung: ' + R.bd.miss.map(nm).join(', ') + '.'));
  // titik contoh: saat daya mekanik absolut terbesar; tanpa rekaman memakai pose konfigurasi (diam)
  let S;
  if (r) S = r.star;
  else {
    const pay = c.payloadKg,
      tau = rpTau(c, c.theta, pay),
      cur = rpCur(c, tau);
    S = {
      t: 0,
      k: -1,
      u: 0,
      th: c.theta,
      w: [0, 0, 0, 0, 0, 0],
      pay,
      tau,
      cur,
      Pm: 0,
      Pa: 0,
      Pf: 0,
      Pe: c.dash.V * cur.reduce((s, x) => s + Math.abs(x), 0),
      Em: 0,
      Ea: 0,
      Ef: 0,
      Ee: 0,
      p: rpFK(c, c.theta),
      pdot: [0, 0, 0],
      pe: rpPE(c, c.theta, pay)
    };
  }
  const cf = r ? r.cfg : c,
    sg = r && S.k >= 0 ? r.segs[S.k] : null;
  B.push(
    H1('3. Penurunan rumus per blok (berurutan)'),
    P(
      r
        ? 'Setiap blok ditulis dengan rumus umum lalu diisi angka pada titik contoh t* = ' +
            RPF(S.t, 2) +
            ' s (fase ' +
            (S.k + 1) +
            ': ' +
            sg.label +
            '). Titik ini dipilih pada segmen garis lurus (bila ada, saat membawa beban) dengan daya mekanik absolut terbesar, supaya blok IK aktif dan besaran gerak, beban, torsi, serta daya tidak nol.'
        : 'Belum ada rekaman gerak, jadi angka diambil dari pose konfigurasi tersimpan dalam keadaan diam (kecepatan dan daya bernilai nol).'
    )
  );
  const u = S.u,
    T = sg ? sg.T : 1,
    sv = quintic(u),
    sd = sg ? (30 * u * u * (1 - u) * (1 - u)) / T : 0,
    sdd = sg ? (60 * u * (1 - u) * (1 - 2 * u)) / (T * T) : 0;
  let no = 0;
  O.forEach(id => {
    no++;
    const h = '3.' + no + ' ' + nm(id);
    if (id === 'b1') {
      B.push(
        H2(h),
        P(
          'Setpoint adalah titik awal alur. Posisi awal end-effector diambil dari 0 Zone yang dikunci, dengan kecepatan dan percepatan awal nol karena robot mulai dari diam. Simbol p dipakai untuk posisi Cartesian (turunan pertamanya kecepatan, turunan keduanya percepatan) supaya tidak tertukar dengan q (sudut sendi).'
        )
      );
      if (c.zz.locked)
        B.push(
          EQ(
            X`\mathbf{p}_0=\mathrm{FK}(\boldsymbol\theta_0)=` +
              rpTexVec(R.bd.sp, 4) +
              X`\ \mathrm{m},\qquad \dot{\mathbf{p}}_0=\mathbf{0},\qquad \ddot{\mathbf{p}}_0=\mathbf{0}`
          ),
          EQ(X`\boldsymbol\theta_0=` + rpTexVec(c.zz.q0, 2) + X`^{\circ}`)
        );
      else B.push(NOTE('0 Zone belum dikunci saat konfigurasi disimpan, jadi setpoint belum terdefinisi.'));
      if (r) {
        const L = r.segs.filter(s => s.type === 'line');
        if (L.length)
          B.push(
            P('Titik-titik jalur pick and place (dari posisi balok) yang diteruskan ke Trajectory:'),
            TB(
              ['Segmen', 'Titik awal p_A (m)', 'Titik akhir p_B (m)'],
              L.map(s => [s.label, rpVec3(s.pA), rpVec3(s.pB)]),
              { small: true }
            )
          );
      }
    } else if (id === 'b2') {
      B.push(
        H2(h),
        P(
          'Trajectory mengubah titik-titik setpoint menjadi fungsi waktu dengan profil quintic (penurunan lengkap di bagian 4.1).'
        ),
        EQ(
          X`s(u)=10u^{3}-15u^{4}+6u^{5},\qquad \dot s=\frac{30u^{2}(1-u)^{2}}{T},\qquad \ddot s=\frac{60u(1-u)(1-2u)}{T^{2}}`
        )
      );
      if (sg) {
        B.push(
          EQ(
            X`u=\frac{t^{*}-t_0}{T}=\frac{` +
              RPF(S.t, 2) +
              '-' +
              RPF(sg.t0, 3) +
              '}{' +
              RPF(T, 3) +
              '}=' +
              RPF(u, 4) +
              X`,\qquad s=` +
              RPF(sv, 4) +
              X`,\quad \dot s=` +
              RPF(sd, 4) +
              X`\ \mathrm{s^{-1}},\quad \ddot s=` +
              RPF(sdd, 4) +
              X`\ \mathrm{s^{-2}}`
          )
        );
        if (sg.type === 'line') {
          const d = sg.pB.map((v, i) => v - sg.pA[i]),
            pt = sg.pA.map((v, i) => v + sv * d[i]);
          B.push(
            P('Fase ini segmen garis lurus, jadi posisi, kecepatan, dan percepatan acuan adalah:'),
            EQ(
              X`\mathbf{p}(t^{*})=\mathbf{p}_A+s\,(\mathbf{p}_B-\mathbf{p}_A)=` +
                rpTexVec(sg.pA, 4) +
                '+' +
                RPF(sv, 4) +
                rpTexVec(d, 4) +
                '=' +
                rpTexVec(pt, 4) +
                X`\ \mathrm{m}`
            ),
            EQ(
              X`\dot{\mathbf{p}}(t^{*})=\dot s\,(\mathbf{p}_B-\mathbf{p}_A)=` +
                rpTexVec(
                  d.map(v => sd * v),
                  4
                ) +
                X`\ \mathrm{m/s},\qquad \ddot{\mathbf{p}}(t^{*})=\ddot s\,(\mathbf{p}_B-\mathbf{p}_A)=` +
                rpTexVec(
                  d.map(v => sdd * v),
                  4
                ) +
                X`\ \mathrm{m/s^{2}}`
            )
          );
        } else if (sg.type === 'joint') {
          const d = sg.thB.map((v, i) => v - sg.thA[i]);
          B.push(
            P(
              'Fase ini segmen sendi: sudut diinterpolasi langsung (bukan posisi), sehingga lintasan end-effector melengkung.'
            ),
            EQ(
              X`\boldsymbol\theta(t^{*})=\boldsymbol\theta_A+s\,(\boldsymbol\theta_B-\boldsymbol\theta_A)=` +
                rpTexVec(
                  sg.thA.map((v, i) => v + sv * d[i]),
                  2
                ) +
                X`^{\circ},\qquad \dot{\boldsymbol\theta}(t^{*})=\dot s\,(\boldsymbol\theta_B-\boldsymbol\theta_A)=` +
                rpTexVec(
                  d.map(v => sd * v),
                  2
                ) +
                X`\ ^{\circ}/\mathrm{s}`
            ),
            EQ(
              X`\dot{\mathbf{p}}(t^{*})\approx\frac{\mathbf{p}(t^{*}+\delta)-\mathbf{p}(t^{*}-\delta)}{2\delta}=` +
                rpTexVec(S.pdot, 4) +
                X`\ \mathrm{m/s},\quad \delta=0.005\ \mathrm{s}`
            )
          );
        } else B.push(P('Fase ini segmen diam: s tidak berubah dan robot tidak bergerak.'));
      }
    } else if (id === 'b3') {
      B.push(
        H2(h),
        P(
          'Inverse Kinematics mengubah posisi acuan p menjadi sudut sendi θ. Pada trajectory dipakai DLS 6D (posisi dan arah sumbu alat) di 48 sampel tiap garis; sudut di antara sampel diinterpolasi. Penurunan langkah DLS sama dengan laporan IK:'
        ),
        EQ(
          X`\mathbf{e}=\begin{bmatrix}\mathbf{p}^{*}-\mathbf{p}\\ w_o\,(\mathbf{z}_d-\mathbf{z}_6)\end{bmatrix},\qquad \Delta\boldsymbol\theta=\mathbf{J}^{T}\left(\mathbf{J}\mathbf{J}^{T}+\lambda^{2}\mathbf{I}\right)^{-1}\mathbf{e},\qquad \lambda=0.003,\ w_o=0.5`
        )
      );
      if (sg && sg.type === 'line') {
        const d = sg.pB.map((v, i) => v - sg.pA[i]),
          pt = sg.pA.map((v, i) => v + sv * d[i]),
          ee = Math.hypot(...pt.map((v, i) => v - S.p[i]));
        B.push(
          EQ(
            X`\boldsymbol\theta(t^{*})=\mathrm{IK}(\mathbf{p}(t^{*}))=` +
              rpTexVec(S.th, 2) +
              X`^{\circ},\qquad \lVert\mathbf{p}(t^{*})-\mathrm{FK}(\boldsymbol\theta(t^{*}))\rVert=` +
              RPF(ee * 1000, 3) +
              X`\ \mathrm{mm}`
          )
        );
      } else if (sg)
        B.push(
          P(
            'Pada fase ini IK hanya dipakai di titik ujung segmen (dicari dengan banyak tebakan awal saat perencanaan). Di antara ujung, sudut berasal langsung dari interpolasi sendi, jadi blok IK tidak aktif pada t*. Sudut saat ini: ' +
              S.th.map(v => RPF(v, 2) + '°').join(', ') +
              '.'
          )
        );
      else B.push(EQ(X`\boldsymbol\theta=` + rpTexVec(S.th, 2) + X`^{\circ}`));
    } else if (id === 'b4') {
      B.push(
        H2(h),
        P(
          'Tiap sendi dianggap mengikuti perintah sudut dengan ideal (tanpa PID dan tanpa dinamika), sehingga sudut aktual sama dengan perintah. Kecepatan sendi dihitung dengan beda pusat:'
        ),
        EQ(X`\boldsymbol\theta_{aktual}(t^{*})=\boldsymbol\theta_{cmd}(t^{*})=` + rpTexVec(S.th, 2) + X`^{\circ}`),
        EQ(
          X`\dot{\boldsymbol\theta}(t^{*})\approx\frac{\boldsymbol\theta(t^{*}+\delta)-\boldsymbol\theta(t^{*}-\delta)}{2\delta}=` +
            rpTexVec(S.w, 4) +
            X`\ \mathrm{rad/s},\qquad \delta=0.002\ \mathrm{s}`
        )
      );
    } else if (id === 'b5') {
      const Fq = rpChain(cf, S.th);
      B.push(
        H2(h),
        P(
          'Forward Kinematics mengalikan matriks DH keenam sendi (penurunan bentuk umum ada di bagian 5) untuk mendapat posisi aktual end-effector. Pada alur baku, keluaran ini diumpankan kembali ke Setpoint untuk dibandingkan dengan acuan.'
        ),
        EQ(X`{}^{0}\mathbf{T}_{6}(\boldsymbol\theta(t^{*}))=` + rpTexMat(rpRows(Fq[6]), 4)),
        EQ(X`\mathbf{p}_{aktual}=` + rpTexVec(S.p, 4) + X`\ \mathrm{m}`)
      );
      if (sg && sg.type === 'line') {
        const d = sg.pB.map((v, i) => v - sg.pA[i]),
          pt = sg.pA.map((v, i) => v + sv * d[i]),
          e = pt.map((v, i) => v - S.p[i]);
        B.push(
          EQ(
            X`\mathbf{e}_{fb}=\mathbf{p}(t^{*})-\mathbf{p}_{aktual}=` +
              rpTexVec(
                e.map(v => v * 1000),
                3
              ) +
              X`\ \mathrm{mm}`
          ),
          P(
            'Galat umpan balik kecil karena eksekusi sendi ideal; sisanya berasal dari toleransi IK dan interpolasi antar sampel.'
          )
        );
      }
    } else if (id === 'b6') {
      B.push(H2(h));
      if (cf.torqueMode === 'gravity') {
        B.push(
          P(
            'Mode estimasi statis gravitasi: torsi penahan beban dihitung dari energi potensial U, lalu arus dihitung balik dari torsi. Ini statika, bukan prediksi dinamika.'
          ),
          EQ(X`U(\boldsymbol\theta)=\sum_{k=1}^{6}m_k\,g\,h_k(\boldsymbol\theta)+m_{p}\,g\,h_{ee}(\boldsymbol\theta)`),
          EQ(
            X`U(t^{*})=` +
              RPF(S.pe.links, 3) +
              X`\ (\text{link})+` +
              RPF(S.pe.payload, 3) +
              X`\ (\text{payload }` +
              RPF(S.pay, 1) +
              X`\ \mathrm{kg})=` +
              RPF(S.pe.total, 3) +
              X`\ \mathrm{J}`
          ),
          EQ(
            X`\tau_k=\frac{\partial U}{\partial\theta_k}\approx\frac{U(\boldsymbol\theta+\delta\mathbf{e}_k)-U(\boldsymbol\theta-\delta\mathbf{e}_k)}{2\delta},\qquad \delta=0.25^{\circ}=0.004363\ \mathrm{rad},\qquad i_k=\frac{\tau_k}{K_k\,N_k}`
          ),
          TB(
            ['Sendi', 'τ (N·m)', 'K (N·m/A)', 'N', 'i = τ/(K·N) (A)'],
            S.tau.map((t, i) => [qn(i), RPF(t, 3), RPF(cf.motor.K[i], 3), RPF(cf.motor.N[i], 0), RPF(S.cur[i], 4)]),
            { small: true }
          )
        );
      } else
        B.push(
          P('Mode arus input: arus tiap motor diambil langsung dari tabel K, N, i (bukan hasil hitung).'),
          TB(
            ['Sendi', 'i (A)'],
            S.cur.map((v, i) => [qn(i), RPF(v, 3)]),
            { small: true }
          )
        );
    } else if (id === 'b7') {
      B.push(
        H2(h),
        P(
          'Torsi sisi keluaran gearbox dari arus motor, dengan K konstanta torsi motor dan N rasio gearbox.' +
            (cf.torqueMode === 'gravity'
              ? ' Pada mode gravitasi, arus berasal dari τ/(K·N), jadi hasilnya kembali sama dengan torsi penahan gravitasi.'
              : '')
        ),
        EQ(X`\tau_k=K_k\,N_k\,i_k`),
        TB(
          ['Sendi', 'K', 'N', 'i (A)', 'τ = K·N·i (N·m)', 'τ rated (N·m)'],
          S.tau.map((t, i) => [
            qn(i),
            RPF(cf.motor.K[i], 3),
            RPF(cf.motor.N[i], 0),
            RPF(S.cur[i], 4),
            RPF(t, 3),
            RPF(cf.dash.rated[i], 1)
          ]),
          { small: true }
        )
      );
    } else if (id === 'b8') {
      const tm = S.tau.map((t, i) => '(' + RPF(t, 2) + ')(' + RPF(S.w[i], 3) + ')'),
        isum = S.cur.reduce((a, x) => a + Math.abs(x), 0);
      B.push(
        H2(h),
        P(
          'Daya dan energi dihitung dari torsi dan kecepatan sendi. Energi adalah integral daya terhadap waktu dengan aturan trapesium tiap Δt = 0,01 s. Em boleh negatif (gravitasi membantu gerak), sedangkan Eabs menjumlahkan usaha tanpa saling meniadakan.'
        ),
        EQ(
          X`\begin{aligned}P_m&=\sum_{k=1}^{6}\tau_k\,\dot\theta_k\\&=` +
            tm.slice(0, 3).join('+') +
            X`\\&\quad+` +
            tm.slice(3).join('+') +
            X`\\&=` +
            RPF(S.Pm, 3) +
            X`\ \mathrm{W}\end{aligned}`
        ),
        EQ(
          X`P_{abs}=\sum_{k}\lvert\tau_k\,\dot\theta_k\rvert=` +
            RPF(S.Pa, 3) +
            X`\ \mathrm{W},\qquad P_f=\sum_{k}\left(b_k\dot\theta_k^{2}+c_k\lvert\dot\theta_k\rvert\right)=` +
            RPF(S.Pf, 3) +
            X`\ \mathrm{W}`
        ),
        EQ(
          X`P_e=V\sum_{k}\lvert i_k\rvert=` +
            RPF(cf.dash.V, 0) +
            X`\times` +
            RPF(isum, 4) +
            '=' +
            RPF(S.Pe, 2) +
            X`\ \mathrm{W}`
        ),
        EQ(X`E_{n+1}=E_n+\tfrac12\,(P_n+P_{n+1})\,\Delta t,\qquad \Delta t=0.01\ \mathrm{s}`),
        EQ(
          X`\text{pada }t^{*}:\quad E_m=` +
            RPF(S.Em, 3) +
            X`\ \mathrm{J},\quad E_{abs}=` +
            RPF(S.Ea, 3) +
            X`\ \mathrm{J},\quad E_e=` +
            RPF(S.Ee, 2) +
            X`\ \mathrm{J}`
        )
      );
      if (r)
        B.push(
          EQ(
            X`E_p=\sum_k m_k g h_k+m_p g h_{ee},\qquad \Delta E_p(t^{*})=E_p(t^{*})-E_p(0)=` +
              RPF(S.pe.total, 3) +
              '-' +
              RPF(r.Ep0, 3) +
              '=' +
              RPF(S.pe.total - r.Ep0, 3) +
              X`\ \mathrm{J}`
          )
        );
    }
  });
  B.push(H1('4. Data rekaman'), ...rpDocTraj(R, '4', true).slice(1));
  if (r) {
    const s = r.sum;
    B.push(
      H2('4.6 Ringkasan siklus'),
      TB(
        ['Sendi', 'τ maks (N·m)', 'pada t (s)', 'i maks (A)', 'ω maks (°/s)', 'τ rated (N·m)'],
        s.tmax.map((v, i) => [
          qn(i),
          RPF(v, 2),
          RPF(s.tmaxT[i], 2),
          RPF(s.imax[i], 3),
          RPF((s.wmax[i] * 180) / Math.PI, 1),
          RPF(r.cfg.dash.rated[i], 1)
        ]),
        { small: true }
      ),
      TB(
        ['Besaran', 'Nilai'],
        [
          ['Durasi satu siklus', RPF(s.D, 2) + ' s'],
          ['Panjang lintasan end-effector', RPF(s.L, 3) + ' m'],
          ['|Pm| maks', RPF(s.Pmax, 2) + ' W'],
          ['Pe maks', RPF(s.Pemax, 1) + ' W'],
          ['Em akhir', RPF(s.Em, 2) + ' J'],
          ['Eabs akhir', RPF(s.Ea, 2) + ' J'],
          ['Ef akhir (gesekan)', RPF(s.Ef, 3) + ' J'],
          ['Ee akhir (elektrik)', RPF(s.Ee, 1) + ' J'],
          ['ΔEp akhir', RPF(s.dEp, 3) + ' J']
        ],
        { kv: true }
      )
    );
    const over = s.tmax
      .map((v, i) => (v > r.cfg.dash.rated[i] && r.cfg.dash.rated[i] > 0 ? qn(i) : null))
      .filter(Boolean);
    if (over.length) B.push(NOTE('Torsi maks melebihi τ rated (placeholder) di sendi: ' + over.join(', ') + '.'));
  }
  B.push(H1('5. Lampiran: penurunan matriks DH'), ...rpDocDH(), ...rpDocTail(R, 6));
  return B;
}
function rpDoc(R) {
  return R.page === 'fk' ? rpDocFK(R) : R.page === 'ik' ? rpDocIK(R) : rpDocBD(R);
}

/* ---- Sesi 20b: Save Report, daftar laporan, pratinjau ---- */
const RP_MAX = 5; // laporan tersimpan per halaman (yang tertua dibuang)
function rpReport(page) {
  const make = () => {
    let R;
    try {
      R = rpBuild(page);
    } catch (e) {
      console.error(e);
      toast(tr('lp.fail') + e.message);
      return;
    }
    REP.reports.unshift(R);
    const mine = REP.reports.filter(r => r.page === page);
    if (mine.length > RP_MAX) {
      const drop = new Set(mine.slice(RP_MAX).map(r => r.id));
      REP.reports = REP.reports.filter(r => !drop.has(r.id));
    }
    rpPersist();
    rpRender();
    toast(tr('lp.made'));
  };
  const go = () => {
    if (REP.rec[page]) make();
    else
      rpAsk(
        tr('lp.q.norec'),
        [
          { k: 'go', label: tr('lp.b.norec'), primary: true },
          { k: 'cancel', label: tr('lp.b.cancel') }
        ],
        k => {
          if (k === 'go') make();
        }
      );
  };
  if (!REP.cfg[page]) {
    rpAsk(
      tr('lp.q.nocfg'),
      [
        { k: 'save', label: tr('lp.b.savego'), primary: true },
        { k: 'cancel', label: tr('lp.b.cancel') }
      ],
      k => {
        if (k === 'save')
          rpSave(page, ok => {
            if (ok) go();
          });
      }
    );
    return;
  }
  go();
}
function rpRenderList(bar, p) {
  const items = REP.reports.filter(r => r.page === p);
  bar.querySelector('[data-lp-list]').innerHTML = items
    .map(
      r =>
        '<div class="lp-item" data-id="' +
        r.id +
        '"><div><b>' +
        RP_TITLE[p] +
        '</b><small>' +
        tr('lp.made.t') +
        ' ' +
        rpTime(r.createdAt) +
        ' · ' +
        (r.rec ? r.rec.label + ', ' + r.rec.D.toFixed(1) + ' s' : tr('lp.none')) +
        '</small></div><div class="lp-btns">' +
        '<button type="button" class="btn" data-a="view">' +
        tr('lp.view') +
        '</button><button type="button" class="btn primary" data-a="pdf">PDF</button>' +
        '<button type="button" class="btn primary" data-a="docx">Docx</button><button type="button" class="btn" data-a="del">' +
        tr('lp.del') +
        '</button></div></div>'
    )
    .join('');
}
const rpGet = id => REP.reports.find(r => r.id === id);
function rpAct(a, id) {
  const R = rpGet(id);
  if (!R) return;
  if (a === 'view') rpPreview(id);
  else if (a === 'pdf') rpDownload(R, 'pdf');
  else if (a === 'docx') rpDownload(R, 'docx');
  else if (a === 'del')
    rpAsk(
      tr('lp.q.del'),
      [
        { k: 'yes', label: tr('lp.b.del'), primary: true },
        { k: 'cancel', label: tr('lp.b.cancel') }
      ],
      k => {
        if (k === 'yes') {
          REP.reports = REP.reports.filter(r => r.id !== id);
          rpPersist();
          rpRender();
        }
      }
    );
}
document.querySelectorAll('.lp-bar [data-lp-list]').forEach(list =>
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (b) rpAct(b.dataset.a, b.closest('.lp-item').dataset.id);
  })
);
// Nama berkas unduhan: Laporan_FK_2026-09-28_14-05
function rpFileName(R, ext) {
  const d = new Date(R.createdAt),
    z = n => String(n).padStart(2, '0');
  return (
    'Laporan_' +
    R.page.toUpperCase() +
    '_' +
    d.getFullYear() +
    '-' +
    z(d.getMonth() + 1) +
    '-' +
    z(d.getDate()) +
    '_' +
    z(d.getHours()) +
    '-' +
    z(d.getMinutes()) +
    '.' +
    ext
  );
}
function rpSaveBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function rpDownload(R, kind) {
  if (typeof rpExport === 'function') rpExport(R, kind);
  else toast(tr('wip'));
}

// Grafik laporan: Chart.js di kanvas tersembunyi, gaya cetak (latar putih), hasil PNG
function rpChartImg(spec) {
  let cv = null,
    ch = null;
  try {
    cv = document.createElement('canvas');
    cv.width = 1000;
    cv.height = 420;
    cv.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:420px;';
    document.body.appendChild(cv);
    ch = new Chart(cv.getContext('2d'), {
      type: 'line',
      data: {
        datasets: spec.series.map(s => ({
          label: s.label,
          data: spec.x.map((x, i) => ({ x, y: s.data[i] })),
          borderColor: s.color,
          backgroundColor: s.color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0
        }))
      },
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: 2,
        parsing: false,
        plugins: {
          legend: { labels: { color: '#1a1f2b', font: { family: 'Arial', size: 13 }, boxWidth: 16 } },
          title: {
            display: true,
            text: spec.title,
            color: '#0b1220',
            font: { family: 'Arial', size: 16, weight: 'bold' }
          },
          tooltip: { enabled: false }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: spec.xl, color: '#1a1f2b', font: { family: 'Arial', size: 13 } },
            ticks: { color: '#566275', maxTicksLimit: 12 },
            grid: { color: '#e3e7ee' }
          },
          y: {
            title: { display: true, text: spec.yl, color: '#1a1f2b', font: { family: 'Arial', size: 13 } },
            ticks: { color: '#566275' },
            grid: { color: '#e3e7ee' }
          }
        }
      },
      plugins: [
        {
          id: 'lpbg',
          beforeDraw: c => {
            const x = c.ctx;
            x.save();
            x.fillStyle = '#ffffff';
            x.fillRect(0, 0, c.width, c.height);
            x.restore();
          }
        }
      ]
    });
    return cv.toDataURL('image/png');
  } catch (e) {
    return null;
  } finally {
    try {
      if (ch && ch.destroy) ch.destroy();
    } catch (e) {}
    if (cv) cv.remove();
  }
}
const rpEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rpHtml(blocks) {
  return blocks
    .map((b, i) => {
      switch (b.t) {
        case 'title':
          return '<div class="lpd-title"><div class="k">' + rpEsc(b.text) + '</div><h1>' + rpEsc(b.sub) + '</h1></div>';
        case 'h1':
          return '<h2 class="lpd-h1">' + rpEsc(b.text) + '</h2>';
        case 'h2':
          return '<h3 class="lpd-h2">' + rpEsc(b.text) + '</h3>';
        case 'p':
          return '<p>' + rpEsc(b.text) + '</p>';
        case 'note':
          return '<div class="lpd-note">' + rpEsc(b.text) + '</div>';
        case 'eq':
          return (
            (b.label ? '<div class="lpd-eql">' + rpEsc(b.label) + '</div>' : '') +
            '<div class="lpd-eq" data-eq="' +
            i +
            '"></div>'
          );
        case 'table':
          return (
            (b.caption ? '<div class="lpd-cap">' + rpEsc(b.caption) + '</div>' : '') +
            '<div class="lpd-tw"><table class="lpd-t' +
            (b.small ? ' sm' : '') +
            (b.kv ? ' kv' : '') +
            '">' +
            (b.head ? '<thead><tr>' + b.head.map(h => '<th>' + rpEsc(h) + '</th>').join('') + '</tr></thead>' : '') +
            '<tbody>' +
            b.rows.map(r => '<tr>' + r.map(c => '<td>' + rpEsc(c) + '</td>').join('') + '</tr>').join('') +
            '</tbody></table></div>'
          );
        case 'chart':
        case 'svg':
          return '<figure class="lpd-fig" data-fig="' + i + '"></figure>';
        default:
          return '';
      }
    })
    .join('');
}
function rpShowDoc(el, blocks) {
  el.innerHTML = rpHtml(blocks);
  el.querySelectorAll('[data-eq]').forEach(d => {
    const b = blocks[+d.dataset.eq];
    try {
      katex.render(b.tex, d, { displayMode: true, throwOnError: false });
    } catch (e) {
      d.textContent = b.tex;
    }
  });
  el.querySelectorAll('[data-fig]').forEach(f => {
    const b = blocks[+f.dataset.fig],
      src = b.t === 'chart' ? rpChartImg(b) : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b.svg);
    f.innerHTML =
      (src
        ? '<img alt="" src="' + src + '">'
        : '<div class="lpd-note">Grafik tidak dapat digambar di lingkungan ini.</div>') +
      (b.caption ? '<figcaption>' + rpEsc(b.caption) + '</figcaption>' : '');
  });
}
const RPV = { id: null };
function rpPreview(id) {
  const R = rpGet(id);
  if (!R) return;
  RPV.id = id;
  document.getElementById('lp-prev-t').textContent = RP_TITLE[R.page] + ' · ' + rpTime(R.createdAt);
  document.getElementById('lp-prev').classList.add('open');
  document.body.style.overflow = 'hidden';
  const el = document.getElementById('lp-doc');
  el.innerHTML = '<p class="lpd-wait">Menyusun laporan...</p>';
  setTimeout(() => {
    try {
      rpShowDoc(el, rpDoc(R));
    } catch (e) {
      console.error(e);
      el.textContent = tr('lp.fail') + e.message;
    }
    document.getElementById('lp-prev-body').scrollTop = 0;
  }, 30);
}
function rpClosePreview() {
  document.getElementById('lp-prev').classList.remove('open');
  document.body.style.overflow = '';
  RPV.id = null;
}
document.getElementById('lp-prev-x').addEventListener('click', rpClosePreview);
document.getElementById('lp-prev-pdf').addEventListener('click', () => {
  const R = rpGet(RPV.id);
  if (R) rpDownload(R, 'pdf');
});
document.getElementById('lp-prev-docx').addEventListener('click', () => {
  const R = rpGet(RPV.id);
  if (R) rpDownload(R, 'docx');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && RPV.id && !document.getElementById('lp-modal').classList.contains('open')) rpClosePreview();
});
rpRender();

/* ---- Sesi 20c: unduh PDF dan Docx ----
   Library di Simulator/vendor dimuat hanya saat mengunduh. Rumus: MathJax (SVG) lalu PNG, jadi tampilannya sama
   di PDF dan Docx. Grafik: Chart.js PNG. Diagram blok: SVG ke PNG. PDF memakai font Liberation Sans (metrik Arial). */
const RP_VENDOR = 'vendor/';
const RP_LIBS = {
  pdf: ['jspdf.umd.min.js', 'jspdf.plugin.autotable.min.js', 'report-fonts.js'],
  docx: ['docx.iife.js'],
  tex: ['tex-svg-full.js']
};
const RPL = { done: {} };
function rpLoadScript(f) {
  if (RPL.done[f]) return RPL.done[f];
  return (RPL.done[f] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = RP_VENDOR + f;
    s.onload = () => res();
    s.onerror = () => {
      delete RPL.done[f];
      rej(new Error('berkas ' + f + ' tidak ditemukan di ' + RP_VENDOR));
    };
    document.head.appendChild(s);
  }));
}
async function rpLoadLibs(kind) {
  if (!window.MathJax || !window.MathJax.tex2svg) {
    if (!window.MathJax || !window.MathJax.startup)
      window.MathJax = { startup: { typeset: false }, svg: { fontCache: 'none' }, options: { enableMenu: false } };
  }
  for (const f of RP_LIBS.tex) await rpLoadScript(f);
  await MathJax.startup.promise;
  for (const f of RP_LIBS[kind]) await rpLoadScript(f);
}
function rpSvgPng(svg, w, h, scale) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * scale);
      c.height = Math.ceil(h * scale);
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/png'));
    };
    img.onerror = () => rej(new Error('gambar SVG gagal digambar'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
const RP_EX = 7; // px per ex untuk rumus (setara huruf sekitar 15 px)
async function rpTexPng(tex) {
  const node = MathJax.tex2svg(tex, { display: true }),
    svg = node.querySelector('svg');
  if (!svg || node.querySelector('[data-mjx-error]')) throw new Error('rumus tidak valid: ' + tex.slice(0, 60));
  const w = parseFloat(svg.getAttribute('width')) * RP_EX,
    h = parseFloat(svg.getAttribute('height')) * RP_EX;
  svg.setAttribute('width', w + 'px');
  svg.setAttribute('height', h + 'px');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.removeAttribute('style');
  const xml = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, '#0b1220');
  return { src: await rpSvgPng(xml, w, h, 3), w, h };
}
// Semua gambar untuk satu laporan: rumus, grafik, diagram (indeks = indeks blok)
async function rpAssets(blocks, prog) {
  const out = {},
    n = blocks.filter(b => b.t === 'eq' || b.t === 'chart' || b.t === 'svg').length;
  let k = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === 'eq') out[i] = await rpTexPng(b.tex);
    else if (b.t === 'chart') {
      const src = rpChartImg(b);
      if (src) out[i] = { src, w: 1000, h: 420 };
    } else if (b.t === 'svg') out[i] = { src: await rpSvgPng(b.svg, b.w, b.h, 2), w: b.w, h: b.h };
    else continue;
    k++;
    if (prog && (k % 8 === 0 || k === n)) prog(k, n);
    if (k % 6 === 0) await new Promise(r => setTimeout(r, 0)); // beri kesempatan layar diperbarui
  }
  return out;
}
const rpHex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---- PDF (A4 tegak, margin 18 mm) ----
function rpMakePdf(R, blocks, A) {
  const { jsPDF } = window.jspdf,
    doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('LiberationSans-Regular.ttf', RP_FONTS.regular);
  doc.addFont('LiberationSans-Regular.ttf', 'LiberationSans', 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', RP_FONTS.bold);
  doc.addFont('LiberationSans-Bold.ttf', 'LiberationSans', 'bold');
  const PW = 210,
    PH = 297,
    M = 18,
    CW = PW - 2 * M,
    TOP = 20,
    BOT = PH - 16,
    MM = 25.4 / 96;
  let y = TOP;
  const font = (st, sz, col) => {
    doc.setFont('LiberationSans', st);
    doc.setFontSize(sz);
    doc.setTextColor(...rpHex(col || '#1a1f2b'));
  };
  const lh = sz => sz * 0.3528 * 1.4;
  const need = h => {
    if (y + h > BOT) {
      doc.addPage();
      y = TOP;
    }
  };
  const text = (t, sz, st, col, indent) => {
    font(st, sz, col);
    const x = M + (indent || 0),
      lines = doc.splitTextToSize(t, CW - (indent || 0));
    lines.forEach(L => {
      need(lh(sz));
      doc.text(L, x, y + lh(sz) * 0.72);
      y += lh(sz);
    });
  };
  const img = (a, maxW, scale) => {
    let w = a.w * MM * scale,
      h = a.h * MM * scale;
    if (w > maxW) {
      h *= maxW / w;
      w = maxW;
    }
    if (h > BOT - TOP) {
      w *= (BOT - TOP) / h;
      h = BOT - TOP;
    }
    need(h);
    doc.addImage(a.src, 'PNG', M + (CW - w) / 2, y, w, h, undefined, 'FAST');
    y += h;
  };
  blocks.forEach((b, i) => {
    if (b.t === 'title') {
      text(b.text.toUpperCase(), 9, 'bold', '#2f66b3');
      y += 1;
      text(b.sub, 20, 'bold', '#0b1220');
      y += 2;
      doc.setDrawColor(47, 102, 179);
      doc.setLineWidth(0.6);
      doc.line(M, y, PW - M, y);
      y += 5;
    } else if (b.t === 'h1') {
      need(18);
      y += 5;
      text(b.text, 13, 'bold', '#0b1220');
      doc.setDrawColor(208, 213, 221);
      doc.setLineWidth(0.3);
      doc.line(M, y + 0.5, PW - M, y + 0.5);
      y += 3.5;
    } else if (b.t === 'h2') {
      need(14);
      y += 3;
      text(b.text, 11, 'bold', '#2f66b3');
      y += 1;
    } else if (b.t === 'p') {
      text(b.text, 10, 'normal');
      y += 2;
    } else if (b.t === 'note') {
      font('normal', 9);
      const lines = doc.splitTextToSize(b.text, CW - 8),
        h = lines.length * lh(9) + 4;
      need(h);
      doc.setFillColor(255, 247, 232);
      doc.rect(M, y, CW, h, 'F');
      doc.setFillColor(183, 121, 31);
      doc.rect(M, y, 1.2, h, 'F');
      doc.setTextColor(74, 58, 26);
      lines.forEach((L, k) => doc.text(L, M + 5, y + 2 + lh(9) * (k + 0.72)));
      y += h + 3;
    } else if (b.t === 'eq') {
      const a = A[i];
      if (!a) return;
      const hh = a.h * MM * 0.92;
      need((b.label ? lh(8.5) + 1 : 0) + Math.min(hh, BOT - TOP));
      y += 1;
      if (b.label) {
        text(b.label, 8.5, 'bold', '#566275');
        y += 0.5;
      }
      img(a, CW, 0.92);
      y += 3.5;
    } else if (b.t === 'table') {
      if (b.caption) {
        need(12);
        text(b.caption, 8.5, 'normal', '#566275');
        y += 0.5;
      }
      const small = !!b.small,
        opt = {
          startY: y,
          margin: { left: M, right: M, top: TOP, bottom: PH - BOT },
          theme: 'grid',
          body: b.rows,
          styles: {
            font: 'LiberationSans',
            fontSize: small ? 7.2 : 9,
            cellPadding: small ? 0.9 : 1.4,
            textColor: [26, 31, 43],
            lineColor: [208, 213, 221],
            lineWidth: 0.15,
            overflow: 'linebreak'
          },
          headStyles: { font: 'LiberationSans', fontStyle: 'bold', fillColor: [238, 243, 250], textColor: [11, 18, 32] }
        };
      if (b.head) opt.head = [b.head];
      if (b.kv) opt.columnStyles = { 0: { fontStyle: 'bold', fillColor: [247, 249, 252], cellWidth: CW * 0.34 } };
      doc.autoTable(opt);
      y = doc.lastAutoTable.finalY + 4;
    } else if (b.t === 'chart' || b.t === 'svg') {
      const a = A[i];
      if (!a) {
        text('(gambar tidak tersedia)', 9, 'normal', '#566275');
        return;
      }
      const w = b.t === 'chart' ? 170 : CW,
        h = (a.h * w) / a.w;
      need(h + (b.caption ? lh(8.5) + 2 : 0));
      doc.addImage(a.src, 'PNG', M + (CW - w) / 2, y, w, h, undefined, 'FAST');
      y += h + 1.5;
      if (b.caption) {
        font('normal', 8.5, '#566275');
        doc.splitTextToSize(b.caption, CW).forEach(L => {
          doc.text(L, PW / 2, y + lh(8.5) * 0.72, { align: 'center' });
          y += lh(8.5);
        });
      }
      y += 4;
    }
  });
  const N = doc.getNumberOfPages();
  for (let p = 1; p <= N; p++) {
    doc.setPage(p);
    font('normal', 8, '#7b8698');
    if (p > 1) doc.text('Laporan Simulasi JAKA ZU5 · ' + RP_TITLE[R.page], M, 11);
    doc.text('Halaman ' + p + ' dari ' + N, PW - M, PH - 8, { align: 'right' });
    doc.text('Dibuat ' + rpTime(R.createdAt), M, PH - 8);
  }
  return doc.output('blob');
}

// ---- Docx (A4, margin 2 cm, Arial) ----
const rpB64 = d => {
  const b = atob(d.split(',')[1]),
    u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};
async function rpMakeDocx(R, blocks, A) {
  const D = window.docx,
    {
      Paragraph,
      TextRun,
      ImageRun,
      Table,
      TableRow,
      TableCell,
      WidthType,
      AlignmentType,
      ShadingType,
      BorderStyle,
      HeadingLevel,
      Footer,
      Header,
      PageNumber
    } = D;
  const CWPX = 640,
    run = (t, o) => new TextRun(Object.assign({ text: t, font: 'Arial' }, o || {}));
  const imgP = (a, maxW, scale) => {
    let w = a.w * scale,
      h = a.h * scale;
    if (w > maxW) {
      h *= maxW / w;
      w = maxW;
    }
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [
        new ImageRun({
          type: 'png',
          data: rpB64(a.src),
          transformation: { width: Math.round(w), height: Math.round(h) }
        })
      ]
    });
  };
  const cellP = (t, o) => new Paragraph({ spacing: { before: 0, after: 0 }, children: [run(String(t), o)] });
  const kids = [];
  blocks.forEach((b, i) => {
    if (b.t === 'title') {
      kids.push(
        new Paragraph({ children: [run(b.text.toUpperCase(), { bold: true, color: '2F66B3', size: 18 })] }),
        new Paragraph({
          spacing: { after: 160 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '2F66B3', space: 4 } },
          children: [run(b.sub, { bold: true, size: 40, color: '0B1220' })]
        })
      );
    } else if (b.t === 'h1')
      kids.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DD', space: 2 } },
          children: [run(b.text, { bold: true, size: 28, color: '0B1220' })]
        })
      );
    else if (b.t === 'h2')
      kids.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
          children: [run(b.text, { bold: true, size: 23, color: '2F66B3' })]
        })
      );
    else if (b.t === 'p')
      kids.push(new Paragraph({ spacing: { after: 120, line: 300 }, children: [run(b.text, { size: 21 })] }));
    else if (b.t === 'note')
      kids.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF7E8' },
          border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'B7791F', space: 6 } },
          children: [run(b.text, { size: 19, color: '4A3A1A' })]
        })
      );
    else if (b.t === 'eq') {
      const a = A[i];
      if (b.label)
        kids.push(
          new Paragraph({
            spacing: { before: 120, after: 0 },
            children: [run(b.label, { bold: true, size: 17, color: '566275' })]
          })
        );
      if (a) kids.push(imgP(a, CWPX, 0.92));
    } else if (b.t === 'table') {
      if (b.caption)
        kids.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [run(b.caption, { size: 17, color: '566275' })]
          })
        );
      const sz = b.small ? 15 : 18,
        rows = [];
      if (b.head)
        rows.push(
          new TableRow({
            tableHeader: true,
            children: b.head.map(
              h =>
                new TableCell({
                  shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF3FA' },
                  margins: { top: 30, bottom: 30, left: 60, right: 60 },
                  children: [cellP(h, { bold: true, size: sz, color: '0B1220' })]
                })
            )
          })
        );
      b.rows.forEach(r =>
        rows.push(
          new TableRow({
            children: r.map(
              (c, k) =>
                new TableCell({
                  shading: b.kv && k === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F7F9FC' } : undefined,
                  margins: { top: 20, bottom: 20, left: 60, right: 60 },
                  children: [cellP(c, { size: sz, bold: !!(b.kv && k === 0) })]
                })
            )
          })
        )
      );
      kids.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        new Paragraph({ spacing: { after: 80 }, children: [] })
      );
    } else if (b.t === 'chart' || b.t === 'svg') {
      const a = A[i];
      if (a) kids.push(imgP(a, b.t === 'chart' ? 620 : CWPX, 1));
      if (b.caption)
        kids.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [run(b.caption, { size: 17, color: '566275' })]
          })
        );
    }
  });
  const doc = new D.Document({
    creator: 'JAKA ZU5 Simulator',
    title: RP_TITLE[R.page],
    description: 'Laporan Mode Laporan',
    styles: { default: { document: { run: { font: 'Arial', size: 21 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [run('Laporan Simulasi JAKA ZU5 · ' + RP_TITLE[R.page], { size: 16, color: '7B8698' })]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: ['Halaman ', PageNumber.CURRENT, ' dari ', PageNumber.TOTAL_PAGES],
                    font: 'Arial',
                    size: 16,
                    color: '7B8698'
                  })
                ]
              })
            ]
          })
        },
        children: kids
      }
    ]
  });
  return await D.Packer.toBlob(doc);
}

// ---- Alur unduh: siapkan gambar, susun berkas, simpan (hanya saat tombol ditekan) ----
const RPX = { busy: false };
async function rpExport(R, kind) {
  if (RPX.busy) {
    toast(tr('lp.x.busy'));
    return;
  }
  RPX.busy = true;
  try {
    toast(tr('lp.x.prep'));
    await rpLoadLibs(kind);
    const blocks = rpDoc(R),
      A = await rpAssets(blocks, (k, n) => toast(tr('lp.x.img') + ' ' + k + '/' + n));
    const blob = kind === 'pdf' ? rpMakePdf(R, blocks, A) : await rpMakeDocx(R, blocks, A);
    rpSaveBlob(blob, rpFileName(R, kind));
    toast(tr('lp.x.done') + ' ' + rpFileName(R, kind));
    return blob;
  } catch (e) {
    console.error(e);
    toast(tr('lp.x.fail') + e.message);
  } finally {
    RPX.busy = false;
  }
}
