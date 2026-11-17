/* 08_block_diagram.js
   Block diagram editor: blocks, connections, validation, streaming data flow.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ SESI 12a: DIAGRAM BLOK (tab 11), mengikuti Referensi Teknis Step 1, tanpa blok dinamika ============ */
// Diagram blok bisa diubah pengguna (Sesi 17b): blok bisa digeser, sambungan dibuat dari port keluar ke port masuk,
// dan tiap sambungan divalidasi dari tipe sinyal. Tipe: P = posisi Cartesian (p, ṗ, p̈), Q = sudut sendi θ, I = arus, T = torsi.
const BD_TYPE = { P: 'posisi Cartesian p (x, y, z)', Q: 'sudut sendi θ₁..θ₆', I: 'arus motor i', T: 'torsi τ' };
const BD_W = 170,
  BD_H = 74;
const BD_DEFAULT_POS = {
  b1: [10, 60],
  b2: [200, 60],
  b3: [390, 60],
  b4: [580, 60],
  b5: [770, 60],
  b6: [390, 250],
  b7: [580, 250],
  b8: [770, 250]
};
const BD_BLOCKS = {
  b1: { t: ['Setpoint', 'p, ṗ, p̈ dari 0 Zone'], in: 'P', out: 'P' },
  b2: { t: ['Trajectory', 'quintic + time-scaling'], in: 'P', out: 'P' },
  b3: { t: ['Inverse Kinematics', 'p ke θ1..θ6 (DLS)'], in: 'P', out: 'Q' },
  b4: { t: ['Eksekusi 6 joint', 'tracking ideal'], in: 'Q', out: 'Q' },
  b5: { t: ['Forward Kinematics', 'θ ke p (feedback)'], in: 'Q', out: 'P' },
  b6: { t: ['Arus motor i', 'input atau estimasi'], in: 'Q', out: 'I' },
  b7: { t: ['Torsi τ = K·N·i', 'per joint'], in: 'I', out: 'T' },
  b8: { t: ['Energi dan daya', 'E = ∫ Σ τ·ω dt'], in: 'T', out: null }
};
const BD_DEFAULT_EDGES = [
  ['b1', 'b2'],
  ['b2', 'b3'],
  ['b3', 'b4'],
  ['b4', 'b5'],
  ['b5', 'b1'],
  ['b4', 'b6'],
  ['b6', 'b7'],
  ['b7', 'b8']
];
const BD = { sel: 'b2', svgBuilt: false, edges: BD_DEFAULT_EDGES.map(e => e.slice()), pending: null, drag: null };
Object.keys(BD_BLOCKS).forEach(id => {
  BD_BLOCKS[id].x = BD_DEFAULT_POS[id][0];
  BD_BLOCKS[id].y = BD_DEFAULT_POS[id][1];
});
function bdFmt(v, d) {
  return (+v).toFixed(d);
}
// Setpoint dari 0 Zone: posisi end-effector saat θ = θ₀, kecepatan dan percepatan awal nol
function bdSetpoint() {
  if (!ZZ.locked) return null;
  const e = toUser(eeFromThetas6(ZZ.q0));
  return { p: [e.x, e.y, e.z], v: [0, 0, 0], a: [0, 0, 0] };
}
function bdSeg() {
  const P = TRAJ.plan;
  if (!P) return null;
  let seg = P.segs[P.segs.length - 1];
  for (const sg of P.segs) {
    if (TRAJ.t < sg.t0 + sg.T) {
      seg = sg;
      break;
    }
  }
  return { seg, u: Math.min(1, Math.max(0, (TRAJ.t - seg.t0) / seg.T)) };
}
// Validasi alur: tipe tiap sambungan, satu masukan per blok, dan rantai wajib Setpoint > Trajectory > IK > Joint.
function bdValidate() {
  const E = BD.edges,
    name = id => BD_BLOCKS[id].t[0],
    errors = [],
    warns = [],
    bad = new Set();
  E.forEach(([a, b], k) => {
    const A = BD_BLOCKS[a],
      B = BD_BLOCKS[b];
    if (!A.out) {
      errors.push(name(a) + ' tidak punya keluaran.');
      bad.add(k);
      return;
    }
    if (A.out !== B.in) {
      errors.push(
        name(b) + ' butuh masukan ' + BD_TYPE[B.in] + ', tetapi ' + name(a) + ' mengeluarkan ' + BD_TYPE[A.out] + '.'
      );
      bad.add(k);
    }
  });
  Object.keys(BD_BLOCKS).forEach(id => {
    const n = E.filter(e => e[1] === id).length;
    if (n > 1) errors.push(name(id) + ' menerima ' + n + ' masukan; satu blok hanya boleh satu masukan.');
  });
  const ok = (a, b) => E.some((e, k) => e[0] === a && e[1] === b && !bad.has(k));
  const chain = [
    ['b1', 'b2'],
    ['b2', 'b3'],
    ['b3', 'b4']
  ].filter(([a, b]) => !ok(a, b));
  if (chain.length)
    errors.push(
      'Rantai gerak belum lengkap: ' +
        chain.map(([a, b]) => name(a) + ' ke ' + name(b)).join(', ') +
        '. Robot hanya bisa digerakkan lewat Setpoint, Trajectory, Inverse Kinematics, lalu Eksekusi joint.'
    );
  if (!ok('b4', 'b5'))
    warns.push('Tanpa Forward Kinematics setelah Eksekusi joint, posisi aktual end-effector tidak dihitung.');
  if (!ok('b5', 'b1')) warns.push('Tanpa umpan balik Forward Kinematics ke Setpoint, galat posisi tidak dibandingkan.');
  if (!(ok('b4', 'b6') && ok('b6', 'b7') && ok('b7', 'b8')))
    warns.push('Jalur arus, torsi, energi belum lengkap; analisis energi dan torsi tidak dihitung.');
  return { valid: errors.length === 0, errors, warns, bad };
}
function bdEdgePath(a, b) {
  const A = BD_BLOCKS[a],
    B = BD_BLOCKS[b],
    x1 = A.x + BD_W,
    y1 = A.y + BD_H / 2,
    x2 = B.x - 2,
    y2 = B.y + BD_H / 2;
  if (x2 >= x1 - 10) {
    const dx = Math.max(40, (x2 - x1) / 2);
    return 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2;
  }
  const top = Math.min(A.y, B.y) - 44; // sambungan balik (umpan balik) melengkung di atas blok
  return 'M' + x1 + ',' + y1 + ' C' + (x1 + 90) + ',' + top + ' ' + (x2 - 90) + ',' + top + ' ' + x2 + ',' + y2;
}
function bdBuildSvg() {
  const svg = document.getElementById('bd-svg');
  if (!svg) return;
  const W = BD_W,
    H = BD_H,
    v = bdValidate();
  let h = '';
  h +=
    '<defs><marker id="bd-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="bd-arrowhead"/></marker></defs>';
  BD.edges.forEach(([a, b], k) => {
    const side = BD_BLOCKS[a].out === 'I' || BD_BLOCKS[a].out === 'T' || (a === 'b4' && b === 'b6');
    const cls =
      'bd-edge bd-link' + (v.bad.has(k) ? ' bd-bad' : '') + (side ? ' bd-warn' : '') + (b === 'b1' ? ' bd-dash' : '');
    h +=
      '<path class="bd-hit" data-edge="' +
      k +
      '" d="' +
      bdEdgePath(a, b) +
      '"><title>Klik untuk menghapus sambungan</title></path>';
    h += '<path class="' + cls + '" data-edge="' + k + '" d="' + bdEdgePath(a, b) + '" marker-end="url(#bd-arr)"/>';
  });
  Object.keys(BD_BLOCKS).forEach(id => {
    const b = BD_BLOCKS[id];
    h +=
      '<g class="bd-block" data-id="' +
      id +
      '" tabindex="0"><rect x="' +
      b.x +
      '" y="' +
      b.y +
      '" width="' +
      W +
      '" height="' +
      H +
      '" rx="6"/>' +
      '<text class="bd-title" x="' +
      (b.x + W / 2) +
      '" y="' +
      (b.y + 26) +
      '" text-anchor="middle">' +
      b.t[0] +
      '</text>' +
      '<text class="bd-sub" x="' +
      (b.x + W / 2) +
      '" y="' +
      (b.y + 44) +
      '" text-anchor="middle">' +
      b.t[1] +
      '</text>' +
      '<text class="bd-live" id="bd-live-' +
      id +
      '" x="' +
      (b.x + W / 2) +
      '" y="' +
      (b.y + 62) +
      '" text-anchor="middle"></text></g>';
    if (b.in)
      h +=
        '<circle class="bd-port bd-in' +
        (BD.pending ? ' bd-target' : '') +
        '" data-port="in" data-id="' +
        id +
        '" cx="' +
        b.x +
        '" cy="' +
        (b.y + H / 2) +
        '" r="7"><title>Masukan: ' +
        BD_TYPE[b.in] +
        '</title></circle>';
    if (b.out)
      h +=
        '<circle class="bd-port bd-out' +
        (BD.pending === id ? ' bd-armed' : '') +
        '" data-port="out" data-id="' +
        id +
        '" cx="' +
        (b.x + W) +
        '" cy="' +
        (b.y + H / 2) +
        '" r="7"><title>Keluaran: ' +
        BD_TYPE[b.out] +
        ' (klik, lalu klik port masukan tujuan)</title></circle>';
  });
  h +=
    '<text class="bd-note" x="10" y="362">Istilah baku: IK = p ke θ, FK = θ ke p. Tidak ada blok dinamika (M, C, G) dan tidak ada klaim stabilitas.</text>';
  svg.innerHTML = h;
  const st = document.getElementById('bd-valid');
  if (st) {
    st.className = 'status ' + (v.valid ? (v.warns.length ? 'warn' : 'ok') : 'bad');
    st.innerHTML =
      (v.valid
        ? '<b>Alur valid.</b> Robot bisa dijalankan dari alur ini.'
        : '<b>Alur tidak valid, robot tidak dijalankan.</b>') +
      [...v.errors, ...v.warns].map(t => '<br>&bull; ' + t).join('');
    const sp = document.getElementById('bd-valid-pop');
    if (sp) {
      sp.className = st.className;
      sp.innerHTML = st.innerHTML;
    }
  }
  BD.svgBuilt = true;
  BD.valid = v.valid;
}
function bdPoint(e) {
  const svg = document.getElementById('bd-svg'),
    pt = svg.createSVGPoint ? svg.createSVGPoint() : { x: 0, y: 0 };
  pt.x = e.clientX;
  pt.y = e.clientY;
  const m = svg.getScreenCTM && svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: e.clientX, y: e.clientY };
}
function bdConnect(from, to) {
  if (from === to) {
    toast('Blok tidak bisa disambung ke dirinya sendiri');
    return;
  }
  BD.edges = BD.edges.filter(e => e[1] !== to); // satu masukan per blok: sambungan lama ke port ini diganti
  BD.edges.push([from, to]);
  BD.pending = null;
  bdBuildSvg();
  bdRender(true);
}
function bdResetFlow() {
  BD.edges = BD_DEFAULT_EDGES.map(e => e.slice());
  Object.keys(BD_BLOCKS).forEach(id => {
    BD_BLOCKS[id].x = BD_DEFAULT_POS[id][0];
    BD_BLOCKS[id].y = BD_DEFAULT_POS[id][1];
  });
  BD.pending = null;
  bdBuildSvg();
  bdRender(true);
}
function bdSwapIkFk() {
  // contoh alur salah: posisi dan sambungan IK serta FK ditukar
  const a = BD_BLOCKS.b3,
    b = BD_BLOCKS.b5;
  [a.x, b.x] = [b.x, a.x];
  [a.y, b.y] = [b.y, a.y];
  const map = { b3: 'b5', b5: 'b3' };
  BD.edges = BD.edges.map(([x, y]) => [map[x] || x, map[y] || y]);
  BD.pending = null;
  bdBuildSvg();
  bdRender(true);
}
(function () {
  const svg = document.getElementById('bd-svg');
  svg.addEventListener('pointerdown', e => {
    const port = e.target.closest('.bd-port');
    if (port) {
      e.stopPropagation();
      const id = port.dataset.id;
      if (port.dataset.port === 'out') {
        BD.pending = BD.pending === id ? null : id;
        bdBuildSvg();
        bdRender(true);
      } else if (BD.pending) bdConnect(BD.pending, id);
      return;
    }
    const hit = e.target.closest('[data-edge]');
    if (hit && !BD.drag) {
      BD.edges.splice(+hit.dataset.edge, 1);
      toast('Sambungan dihapus');
      bdBuildSvg();
      bdRender(true);
      return;
    }
    const g = e.target.closest('.bd-block');
    if (!g) return;
    const p = bdPoint(e),
      b = BD_BLOCKS[g.dataset.id];
    BD.drag = { id: g.dataset.id, dx: p.x - b.x, dy: p.y - b.y, moved: false, sx: e.clientX, sy: e.clientY };
  });
  window.addEventListener('pointermove', e => {
    const D = BD.drag;
    if (!D) return;
    if (!D.moved && Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < 5) return;
    D.moved = true;
    const p = bdPoint(e),
      b = BD_BLOCKS[D.id];
    b.x = Math.max(0, Math.min(960 - BD_W, p.x - D.dx));
    b.y = Math.max(0, Math.min(340 - BD_H, p.y - D.dy));
    bdBuildSvg();
    bdRender(true);
  });
  window.addEventListener('pointerup', () => {
    const D = BD.drag;
    BD.drag = null;
    if (D && D.moved) BD.justDragged = true;
  });
})();
function bdInfo(id) {
  const tau = totalTau(),
    cur = currentI(tau),
    th = joints6.map(j => j.theta),
    ee = eeFromThetas6(),
    sg = bdSeg(),
    tg = targetFromInputs(),
    tgu = userTargetInputs(),
    eu = toUser(ee),
    sp = bdSetpoint();
  const err = Math.hypot(tg.x - ee.x, tg.y - ee.y, tg.z - ee.z),
    w = liveState.omega;
  const J6 = (a, d) => a.map(v => bdFmt(v, d)).join(', ');
  const T = TRAJ.plan ? TRAJ.plan.D : 0;
  const s = sg ? quintic(sg.u) : 0;
  const info = {
    b1: sp
      ? {
          desc: 'Setpoint awal gerak: posisi, kecepatan, dan percepatan end-effector diambil dari 0 Zone yang dikunci (frame base, Z ke atas). Simbol p, ṗ, p̈ dipakai untuk posisi Cartesian supaya tidak tertukar dengan q (sudut sendi).',
          params: [
            ['p₀ (m)', sp.p.map(v => bdFmt(v, 3)).join(', ')],
            ['ṗ₀ (m/s)', '0, 0, 0'],
            ['p̈₀ (m/s²)', '0, 0, 0'],
            ['θ₀ 0 Zone (°)', ZZ.q0.map(v => bdFmt(v, 0)).join(', ')]
          ],
          tex: [
            {
              label: 'Setpoint dari 0 Zone',
              tex:
                '\\mathbf{p}_0=\\mathrm{FK}(\\boldsymbol\\theta_0)=\\begin{bmatrix}' +
                hl('bs0', sp.p[0], 3) +
                '\\\\' +
                hl('bs1', sp.p[1], 3) +
                '\\\\' +
                hl('bs2', sp.p[2], 3) +
                '\\end{bmatrix}\\ \\text{m},\\qquad \\dot{\\mathbf{p}}_0=\\mathbf{0},\\quad \\ddot{\\mathbf{p}}_0=\\mathbf{0}'
            }
          ]
        }
      : {
          desc: 'Setpoint diambil dari 0 Zone. Kunci 0 Zone dulu (kartu 0 Zone di kanan) supaya p, ṗ, p̈ terisi.',
          params: [['Status', '0 Zone belum dikunci']],
          tex: [
            {
              label: 'Setpoint',
              tex: '\\mathbf{p}_0=\\mathrm{FK}(\\boldsymbol\\theta_0),\\quad \\dot{\\mathbf{p}}_0=\\mathbf{0},\\quad \\ddot{\\mathbf{p}}_0=\\mathbf{0}'
            }
          ]
        },
    b2: {
      desc: 'Profil waktu quintic (posisi, kecepatan, dan percepatan awal serta akhir nol) dengan durasi segmen dari batas kecepatan sendi dan kecepatan Cartesian. Nilai u dan s di bawah mengikuti waktu trajectory yang sedang berjalan.',
      params: [
        ['ω maks sendi', TRAJ.wmax + ' °/s'],
        ['v maks Cartesian', TRAJ.vmax + ' m/s'],
        ['Durasi total', bdFmt(T, 2) + ' s'],
        ['Waktu sekarang', bdFmt(TRAJ.t, 2) + ' s'],
        ['Segmen', sg ? sg.seg.label : 'diam']
      ],
      tex: [
        { label: 'Profil quintic', tex: 's(u)=10u^{3}-15u^{4}+6u^{5},\\quad u=\\dfrac{t-t_0}{T_{seg}}\\in[0,1]' },
        { label: 'Posisi antara dua titik', tex: '\\mathbf{p}(t)=\\mathbf{p}_A+s(u)\\,(\\mathbf{p}_B-\\mathbf{p}_A)' },
        {
          label: 'Durasi segmen',
          tex: 'T=\\max\\!\\left(\\dfrac{1{,}875\\,\\Delta q_{max}}{\\omega_{max}},\\ \\dfrac{1{,}875\\,L}{v_{max}},\\ 0{,}6\\right)'
        },
        { label: 'Nilai sekarang', tex: 'u=' + hl('bu', sg ? sg.u : 0, 3) + ',\\quad s(u)=' + hl('bs', s, 3) }
      ]
    },
    b3: {
      desc: 'Menghitung sudut sendi dari posisi dan arah alat sebagai satu kesatuan (coupled). Numerik: damped least squares dari tebakan awal, dengan Jacobian numerik. Untuk trajectory, IK dijalankan pada tiap sampel garis lurus.',
      params: [
        ['λ (peredam)', '0,003'],
        ['Bobot orientasi', '0,5'],
        ['Batas langkah', '30 °/iterasi'],
        ['Galat posisi ke target mode IK', bdFmt(err * 1000, 1) + ' mm']
      ],
      tex: [
        {
          label: 'Langkah DLS',
          tex: '\\Delta\\boldsymbol\\theta=\\mathbf{J}^{T}\\left(\\mathbf{J}\\mathbf{J}^{T}+\\lambda^{2}\\mathbf{I}\\right)^{-1}\\mathbf{e}'
        },
        {
          label: 'Galat',
          tex: '\\mathbf{e}=\\begin{bmatrix}\\mathbf{p}^{*}-\\mathbf{p}\\\\ w_{o}\\,(\\mathbf{z}_d-\\mathbf{z}_{tool})\\end{bmatrix},\\quad \\lambda=0{,}003,\\ w_o=0{,}5'
        },
        {
          label: 'Galat posisi sekarang (target mode IK)',
          tex: '\\lVert\\mathbf{p}^{*}-\\mathbf{p}\\rVert=' + hl('be', err * 1000, 1) + '\\ \\text{mm}'
        }
      ]
    },
    b4: {
      desc: 'Tiap joint dianggap mengikuti perintah sudut dengan ideal (tanpa PID dan tanpa dinamika). Kecepatan sendi dihitung dari selisih sudut antar sampel 10 Hz.',
      params: [
        ['θ (°)', J6(th, 1)],
        ['ω (rad/s)', J6(w, 3)]
      ],
      tex: [
        { label: 'Tracking ideal', tex: '\\boldsymbol\\theta_{aktual}(t)=\\boldsymbol\\theta_{cmd}(t)' },
        { label: 'Sudut sekarang (derajat)', tex: '\\boldsymbol\\theta=' + vecTex('bth', th, 1) },
        {
          label: 'Kecepatan sendi (rad/s)',
          tex: '\\dot{\\boldsymbol\\theta}\\approx\\dfrac{\\Delta\\boldsymbol\\theta}{\\Delta t}=' + vecTex('bw', w, 3)
        }
      ]
    },
    b5: {
      desc: 'Hasil perkalian matriks DH tiap sendi menjadi posisi end-effector aktual. Ini pengganti sensor Cartesian pada loop umpan balik.',
      params: [
        ['x, y, z (frame base)', bdFmt(eu.x, 3) + ', ' + bdFmt(eu.y, 3) + ', ' + bdFmt(eu.z, 3) + ' m'],
        ['|det J|', Math.abs(det6(jacobian6().J)).toExponential(2) + ' m³']
      ],
      tex: [
        {
          label: 'Rantai transformasi',
          tex: '\\mathbf{T}_{6}^{0}=\\mathbf{T}_{1}^{0}\\mathbf{T}_{2}^{1}\\mathbf{T}_{3}^{2}\\mathbf{T}_{4}^{3}\\mathbf{T}_{5}^{4}\\mathbf{T}_{6}^{5}'
        },
        {
          label: 'Posisi aktual',
          tex:
            '\\mathbf{p}=\\begin{bmatrix}' +
            hl('bx', eu.x, 3) +
            '\\\\' +
            hl('by', eu.y, 3) +
            '\\\\' +
            hl('bz', eu.z, 3) +
            '\\end{bmatrix}\\ \\text{m}'
        }
      ]
    },
    b6: {
      desc: 'Arus tiap motor. Pada mode "arus input" nilainya dari tabel dashboard. Pada mode estimasi statis gravitasi, arus dihitung balik dari torsi penahan beban: i = τ/(K·N). Bukan prediksi model dinamika.',
      params: [
        ['Mode torsi', torqueMode === 'gravity' ? 'estimasi statis gravitasi' : 'arus input'],
        ['i (A)', J6(cur, 2)]
      ],
      tex: [
        { label: 'Arus per joint (A)', tex: '\\mathbf{i}=' + vecTex('bi', cur, 2) },
        { label: 'Estimasi dari torsi (mode gravitasi)', tex: 'i_k=\\dfrac{\\tau_k}{K_k N_k}' }
      ]
    },
    b7: {
      desc: 'Torsi sisi keluaran gearbox dari arus. K adalah konstanta torsi motor, N rasio gearbox. Nilai default K dan N adalah placeholder sampai data resmi JAKA ada. Ubah di dashboard.',
      params: [
        ['K (N·m/A)', J6(motorParams.K, 3)],
        ['N', J6(motorParams.N, 0)],
        ['τ (N·m)', J6(tau, 2)]
      ],
      tex: [
        { label: 'Torsi dari arus', tex: '\\tau_k=K_k\\,N_k\\,i_k' },
        { label: 'Torsi sekarang (N·m)', tex: '\\boldsymbol\\tau=' + vecTex('btau', tau, 2) },
        { label: 'Mode gravitasi (statika)', tex: '\\tau_k=\\dfrac{\\partial U}{\\partial q_k}' }
      ]
    },
    b8: {
      desc: 'Daya dan energi dari torsi dan kecepatan sendi, diintegrasi trapesium tiap 100 ms. Daya elektrik memakai tegangan bus V (placeholder). Tidak ada model dinamika di balik angka ini.',
      params: [
        ['P mekanik', bdFmt(liveState.P, 1) + ' W'],
        ['E mekanik', bdFmt(liveState.E, 1) + ' J'],
        ['E mekanik absolut', bdFmt(liveState.Eabs, 1) + ' J'],
        ['E elektrik', bdFmt(liveState.Ee, 0) + ' J'],
        ['V bus', dashParams.V + ' V']
      ],
      tex: [
        {
          label: 'Daya mekanik',
          tex: 'P_m=\\sum_{k=1}^{6}\\tau_k\\,\\omega_k=' + hl('bP', liveState.P, 1) + '\\ \\text{W}'
        },
        {
          label: 'Energi (trapesium)',
          tex: 'E_{n+1}=E_n+\\tfrac12\\,(P_n+P_{n+1})\\,\\Delta t=' + hl('bE', liveState.E, 1) + '\\ \\text{J}'
        },
        {
          label: 'Daya dan energi elektrik',
          tex: 'P_e=V\\sum_k\\lvert i_k\\rvert,\\quad E_e=' + hl('bEe', liveState.Ee, 0) + '\\ \\text{J}'
        }
      ]
    }
  };
  return info[id];
}
function bdRender(force) {
  if (!(document.body.dataset.mode === 'jaka' && JK.cur === 'bd')) return;
  if (!BD.svgBuilt) bdBuildSvg();
  const svg = document.getElementById('bd-svg');
  const run = TRAJ.playing;
  svg.classList.toggle('bd-running', run);
  svg.querySelectorAll('.bd-block').forEach(g => {
    g.classList.toggle('bd-sel', g.dataset.id === BD.sel);
    g.classList.toggle('bd-on', run && BD.valid);
  });
  const tau = totalTau(),
    ee = eeFromThetas6(),
    mx = Math.max(...tau.map(Math.abs));
  const set = (id, t) => {
    const el = document.getElementById('bd-live-' + id);
    if (el) el.textContent = t;
  };
  const tg = targetFromInputs();
  const sp = bdSetpoint();
  set('b1', sp ? 'p₀ = ' + sp.p.map(v => bdFmt(v, 2)).join(', ') : 'kunci 0 Zone dulu');
  const sg = bdSeg();
  set('b2', sg ? 'u = ' + bdFmt(sg.u, 2) + ', T = ' + (TRAJ.plan ? bdFmt(TRAJ.plan.D, 1) : '0') + ' s' : 'diam');
  set('b3', '|e| = ' + bdFmt(Math.hypot(tg.x - ee.x, tg.y - ee.y, tg.z - ee.z) * 1000, 0) + ' mm (target IK)');
  set('b4', 'θ1 = ' + bdFmt(joints6[0].theta, 0) + '°, θ2 = ' + bdFmt(joints6[1].theta, 0) + '°');
  const eu = toUser(ee);
  set('b5', 'p = ' + bdFmt(eu.x, 2) + ', ' + bdFmt(eu.y, 2) + ', ' + bdFmt(eu.z, 2));
  set('b6', 'i maks = ' + bdFmt(Math.max(...currentI(tau).map(Math.abs)), 2) + ' A');
  set('b7', 'τ maks = ' + bdFmt(mx, 1) + ' N·m');
  set('b8', 'E = ' + bdFmt(liveState.E, 1) + ' J');
  const inf = bdInfo(BD.sel),
    b = BD_BLOCKS[BD.sel];
  document.getElementById('bd-title').textContent = b.t[0];
  document.getElementById('bd-desc').textContent = inf.desc;
  document.getElementById('bd-params').innerHTML = inf.params
    .map(p => '<tr><td class="k">' + p[0] + '</td><td class="v">' + p[1] + '</td></tr>')
    .join('');
  renderBlocks(document.getElementById('bd-eqs'), inf.tex);
}
setInterval(bdRender, 250);

buildCfgUi();
refreshPresetSelect();

setTheme(currentTheme());
