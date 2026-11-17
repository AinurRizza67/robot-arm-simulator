/* 05_math_display.js
   Live math rendering with KaTeX: DH matrices, chain products, general formulas.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ ACCORDION ============ */
function toggleAccordion(key) {
  const header = document.querySelector(`.accordion-header[data-target="${key}"]`);
  const body = document.getElementById(`acc-${key}`);
  if (!header || !body) return;
  const isOpen = body.classList.contains('open');
  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px';
    void body.offsetHeight;
    body.style.maxHeight = '0px';
    body.classList.remove('open');
    header.classList.remove('open');
  } else {
    body.classList.add('open');
    header.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    body.addEventListener('transitionend', function onEnd(e) {
      if (e.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', onEnd);
      if (body.classList.contains('open')) body.style.maxHeight = 'none';
    });
  }
}

/* ============ DH MATH DISPLAY ============ */
function renderGeneralFormulas6() {
  if (!window.katex) return;
  const render = (id, latex) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      katex.render(latex, el, { displayMode: true, throwOnError: false });
    } catch (e) {
      el.textContent = latex;
    }
  };
  render(
    'fk-formula-general',
    `T_i^{\\,i-1}=\\begin{bmatrix}\\cos\\theta_i&-\\sin\\theta_i\\cos\\alpha_i&\\sin\\theta_i\\sin\\alpha_i&a_i\\cos\\theta_i\\\\\\sin\\theta_i&\\cos\\theta_i\\cos\\alpha_i&-\\cos\\theta_i\\sin\\alpha_i&a_i\\sin\\theta_i\\\\0&\\sin\\alpha_i&\\cos\\alpha_i&d_i\\\\0&0&0&1\\end{bmatrix}`
  );
  render(
    'fk-formula-chain',
    `T_{6}^{0}=\\prod_{i=1}^{6}T_i^{\\,i-1}=T_1^{0}\\,T_2^{1}\\,T_3^{2}\\,T_4^{3}\\,T_5^{4}\\,T_6^{5}`
  );
  render('ik-formula-error', `\\mathbf{e}=\\mathbf{p}_{target}-\\mathbf{p}(\\theta)`);
  render(
    'ik-formula-jacobian',
    `J_{:,i}\\approx\\dfrac{\\mathbf{p}(\\theta+\\Delta\\theta\\,\\hat{e}_i)-\\mathbf{p}(\\theta)}{\\Delta\\theta},\\;i=1,\\dots,6`
  );
  render(
    'ik-formula-update',
    `\\Delta\\theta=J^{T}\\left(JJ^{T}+\\lambda^{2}I\\right)^{-1}\\mathbf{e},\\;\\theta\\leftarrow\\theta+\\Delta\\theta`
  );
}

function renderDHMatrices6(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const j = joints6[i];
    const th = (j.theta * Math.PI) / 180,
      al = (j.alpha * Math.PI) / 180;
    const ct = Math.cos(th),
      st = Math.sin(th),
      ca = Math.cos(al),
      sa = Math.sin(al);
    const m = new THREE.Matrix4();
    m.set(ct, -st * ca, st * sa, j.a * ct, st, ct * ca, -ct * sa, j.a * st, 0, sa, ca, j.d, 0, 0, 0, 1);
    const row = document.createElement('div');
    row.className = 'matrix-row';
    const lbl = document.createElement('div');
    lbl.className = 'matrix-label';
    lbl.textContent = `Sendi ${i + 1}: frame ${i} ke frame ${i + 1} (θ=${j.theta.toFixed(1)}°${ZZ.locked ? ` = θ₀ ${ZZ.q0[i].toFixed(0)}° + q ${(j.theta - ZZ.q0[i]).toFixed(1)}°` : ''}, d=${j.d.toFixed(4)} m, a=${j.a.toFixed(4)} m, α=${j.alpha.toFixed(1)}°)`;
    const eq = document.createElement('div');
    eq.className = 'matrix-equation';
    try {
      katex.render(`T_{${i + 1}}^{${i}}=${mat4ToTex(m, 3)}`, eq, { displayMode: true, throwOnError: false });
    } catch (e) {
      eq.textContent = '[error]';
    }
    row.appendChild(lbl);
    row.appendChild(eq);
    container.appendChild(row);
  }
  // T60 murni hasil kali enam matriks di atas (frame base DH, Z ke atas). computeChain6() sendiri
  // mengawali dengan Rx(-90°) untuk layar Three.js (Y ke atas), jadi rotasi itu dibatalkan di sini.
  const finalM = T60dh();
  const fRow = document.createElement('div');
  fRow.className = 'matrix-row final';
  const fLbl = document.createElement('div');
  fLbl.className = 'matrix-label';
  fLbl.textContent = 'T₆⁰ = T₁⁰·T₂¹·T₃²·T₄³·T₅⁴·T₆⁵ (frame base, Z ke atas; kolom terakhir = posisi end-effector)';
  const fEq = document.createElement('div');
  fEq.className = 'matrix-equation';
  try {
    katex.render(`T_{6}^{0}=${mat4ToTex(finalM, 3)}`, fEq, { displayMode: true, throwOnError: false });
  } catch (e) {
    fEq.textContent = '[error]';
  }
  fRow.appendChild(fLbl);
  fRow.appendChild(fEq);
  container.appendChild(fRow);
}

function initMathDisplays6() {
  if (window.katex) {
    renderGeneralFormulas6();
    renderDHMatrices6('math-display-fk');
    renderDHMatrices6('math-display-ik');
  } else setTimeout(initMathDisplays6, 500);
}
setTimeout(initMathDisplays6, 1000);

// Hook math display updates to FK
const _origFK6 = updateFK6;
updateFK6 = function () {
  _origFK6();
  setTimeout(() => renderDHMatrices6('math-display-fk'), 50);
};

/* ============ PLOTS MODAL ============ */
function openPlotsModal(tab) {
  const m = document.getElementById(`plotsModal-${tab}`);
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    (charts[tab]?.joints || []).forEach(c => c.resize());
    (charts[tab]?.position || []).forEach(c => c.resize());
  }, 60);
}
function closePlotsModal(tab) {
  const m = document.getElementById(`plotsModal-${tab}`);
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePlotsModal('fk');
    closePlotsModal('ik');
  }
});

/* ============ TIME-SERIES PLOTS ============ */
const plotData = {
  fk: { time: [], joints: [[], [], [], [], [], []], position: [[], [], []], startTime: performance.now() },
  ik: { time: [], joints: [[], [], [], [], [], []], position: [[], [], []], startTime: performance.now() }
};
const charts = { fk: { joints: [], position: [] }, ik: { joints: [], position: [] } };
themeHooks.push(t => {
  ['fk', 'ik'].forEach(tab =>
    [...charts[tab].joints, ...charts[tab].position].forEach(c => {
      ['x', 'y'].forEach(ax => {
        c.options.scales[ax].ticks.color = THEME_JS[t].tick;
        c.options.scales[ax].grid.color = THEME_JS[t].grid;
      });
      c.update('none');
    })
  );
});
const jClrs = ['#6fa3d8', '#8fb3c9', '#5b8ec9', '#a3b4c4', '#4a7ab0', '#7f95ab'];

function createPlotCanvas(cid, label, color) {
  const ct = document.getElementById(cid);
  if (!ct) return null;
  const item = document.createElement('div');
  item.className = 'plot-item';
  const lb = document.createElement('div');
  lb.className = 'plot-label';
  lb.textContent = label;
  const cv = document.createElement('canvas');
  cv.className = 'plot-canvas';
  const wr = document.createElement('div');
  wr.className = 'plot-chart-wrap';
  wr.appendChild(cv);
  item.appendChild(lb);
  item.appendChild(wr);
  ct.appendChild(item);
  return cv;
}
function initPlots(tab) {
  for (let i = 0; i < 6; i++) {
    const cv = createPlotCanvas(`joint-plots-${tab}`, `θ${i + 1}`, jClrs[i]);
    if (!cv) continue;
    charts[tab].joints.push(
      new Chart(cv.getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: `J${i + 1}`,
              data: [],
              borderColor: jClrs[i],
              backgroundColor: jClrs[i] + '20',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, color: CT().tick, font: { size: 8 } }, grid: { color: CT().grid } },
            y: { ticks: { maxTicksLimit: 5, color: CT().tick, font: { size: 8 } }, grid: { color: CT().grid } }
          }
        }
      })
    );
  }
  const pLbl = ['X (m)', 'Y (m)', 'Z (m)'],
    pClr = ['#6fa3d8', '#9db4c9', '#4a7ab0'];
  for (let i = 0; i < 3; i++) {
    const cv = createPlotCanvas(`position-plots-${tab}`, pLbl[i], pClr[i]);
    if (!cv) continue;
    charts[tab].position.push(
      new Chart(cv.getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: pLbl[i],
              data: [],
              borderColor: pClr[i],
              backgroundColor: pClr[i] + '20',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, color: CT().tick, font: { size: 8 } }, grid: { color: CT().grid } },
            y: { ticks: { maxTicksLimit: 5, color: CT().tick, font: { size: 8 } }, grid: { color: CT().grid } }
          }
        }
      })
    );
  }
}
function appendPlotData(tab) {
  const d = plotData[tab];
  const elapsed = (performance.now() - d.startTime) / 1000;
  if (d.time.length >= 600) {
    d.time.shift();
    d.joints.forEach(a => a.shift());
    d.position.forEach(a => a.shift());
  }
  d.time.push(elapsed.toFixed(1));
  for (let i = 0; i < 6; i++) d.joints[i].push(joints6[i].theta);
  const ee = eeFromThetas6();
  d.position[0].push(ee.x.toFixed(3));
  d.position[1].push(ee.y.toFixed(3));
  d.position[2].push(ee.z.toFixed(3));
  charts[tab].joints.forEach((c, i) => {
    c.data.labels = d.time;
    c.data.datasets[0].data = d.joints[i];
    c.update('none');
  });
  charts[tab].position.forEach((c, i) => {
    c.data.labels = d.time;
    c.data.datasets[0].data = d.position[i];
    c.update('none');
  });
}
function clearPlots(tab) {
  const d = plotData[tab];
  d.time = [];
  d.joints = [[], [], [], [], [], []];
  d.position = [[], [], []];
  d.startTime = performance.now();
  charts[tab].joints.forEach(c => {
    c.data.labels = [];
    c.data.datasets[0].data = [];
    c.update('none');
  });
  charts[tab].position.forEach(c => {
    c.data.labels = [];
    c.data.datasets[0].data = [];
    c.update('none');
  });
}
function exportCSV(tab) {
  const d = plotData[tab];
  if (d.time.length === 0) {
    alert('Tidak ada data.');
    return;
  }
  let csv = 'time,theta1,theta2,theta3,theta4,theta5,theta6,x,y,z\n';
  for (let i = 0; i < d.time.length; i++)
    csv += [d.time[i], ...d.joints.map(a => a[i]), ...d.position.map(a => a[i])].join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `robot_${tab}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
setTimeout(() => {
  initPlots('fk');
  initPlots('ik');
}, 600);

let lastFKPlotT = 0;
const _origFK6b = updateFK6;
updateFK6 = function () {
  _origFK6b();
  const now = performance.now();
  if (now - lastFKPlotT > 100) {
    appendPlotData('fk');
    lastFKPlotT = now;
  }
};

const ikSolveBtn2 = document.getElementById('solveBtn');
if (ikSolveBtn2) {
  const orig = ikSolveBtn2.onclick;
  ikSolveBtn2.addEventListener('click', () => {
    setTimeout(() => {
      appendPlotData('ik');
      renderDHMatrices6('math-display-ik');
    }, 100);
  });
}

/* ============ HAND MODEL ============ */
function createGeomHand() {
  const hand = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0xc98a7a, shininess: 30, specular: 0x222222 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), mat);
  palm.position.set(0, 0.08, 0);
  hand.add(palm);
  [
    { x: -0.05, y: 0.16, a: -15 },
    { x: -0.03, y: 0.2, a: 0 },
    { x: 0, y: 0.21, a: 0 },
    { x: 0.03, y: 0.2, a: 0 },
    { x: 0.05, y: 0.18, a: 15 }
  ].forEach(p => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.06, 8), mat);
    f.position.set(p.x, p.y + 0.03, 0);
    f.rotation.z = (p.a * Math.PI) / 180;
    hand.add(f);
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), mat);
    t.position.set(p.x, p.y + 0.06, 0);
    hand.add(t);
  });
  hand.scale.setScalar(0.8);
  hand.rotation.x = Math.PI / 2;
  const outer = new THREE.Group();
  outer.add(hand);
  return outer;
}
const handModels = { fk: null, ik: null };
let handVisible = false,
  handColor = 0xc98a7a;
function initHand(sceneObj, tab) {
  const h = createGeomHand();
  h.visible = handVisible;
  handModels[tab] = h;
  sceneObj.world.add(h);
}
function updateHandPose(tab) {
  const h = handModels[tab];
  if (!h) return;
  const f = computeChain6();
  const m = f[f.length - 1];
  const p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3();
  m.decompose(p, q, s);
  h.position.copy(p);
  h.quaternion.copy(q);
}
function toggleHandVis(vis) {
  handVisible = vis;
  if (handModels.fk) handModels.fk.visible = vis;
  if (handModels.ik) handModels.ik.visible = vis;
}
function setHandClr(c) {
  handColor = c;
  ['fk', 'ik'].forEach(t => {
    const h = handModels[t];
    if (h)
      h.traverse(ch => {
        if (ch.isMesh) ch.material.color.setHex(c);
      });
  });
}
setTimeout(() => {
  initHand(fkScene, 'fk');
  initHand(ikScene, 'ik');
  updateHandPose('fk');
  updateHandPose('ik');
}, 700);

const _origFK6c = updateFK6;
updateFK6 = function () {
  _origFK6c();
  updateHandPose('fk');
};
document.getElementById('solveBtn').addEventListener('click', () => {
  setTimeout(() => updateHandPose('ik'), 150);
});

/* ============ LATEX AUTO-RENDER FOR MATERI TAB ============ */
document.addEventListener('DOMContentLoaded', function () {
  if (window.renderMathInElement) {
    renderMathInElement(document.getElementById('materi-content'), {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
});
