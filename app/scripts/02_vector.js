/* 02_vector.js
   Vector Simulation: 2D/3D vectors, rotation matrices, homogeneous transforms, N-DOF forward kinematics.
   Classic script: all files share one global scope and are loaded in order by index.html. */
/* ============ MODULE 1: VECTOR & DOT PRODUCT ============ */
(function () {
  const S = makeVectorScene('ch1', [6, 5, 7], 's1');
  const L = makeLabelManager('ch1', S.camera);
  let arrowA = null,
    arrowB = null,
    projLine = null,
    dashB = null,
    angleArc = null;
  let quad1On = true;
  const quad1Toggle = document.getElementById('v1-quad-on');
  quad1Toggle.addEventListener('click', () => {
    quad1On = !quad1On;
    quad1Toggle.classList.toggle('on', quad1On);
    document.getElementById('v1-quad-wrap').style.display = quad1On ? 'block' : 'none';
    update();
  });
  function sign1Span(val) {
    const s = val >= 0 ? '+' : '-';
    const cls = val >= 0 ? 'quad-sign-pos' : 'quad-sign-neg';
    return `<span class="${cls}">${s}${Math.abs(val).toFixed(3)}</span>`;
  }
  function quadrantOf(deg) {
    const n = ((deg % 360) + 360) % 360;
    if (n < 90) return 'I';
    if (n < 180) return 'II';
    if (n < 270) return 'III';
    return 'IV';
  }
  function updateQuad1(ax, ay, bx, by) {
    if (!quad1On) return;
    const R = 78;
    const rA = Math.hypot(ax, ay),
      rB = Math.hypot(bx, by);
    const angA = rA > 0.001 ? (Math.atan2(ay, ax) * 180) / Math.PI : 0;
    const angB = rB > 0.001 ? (Math.atan2(by, bx) * 180) / Math.PI : 0;
    const pxA = 100 + R * Math.cos((angA * Math.PI) / 180),
      pyA = 100 - R * Math.sin((angA * Math.PI) / 180);
    const pxB = 100 + R * Math.cos((angB * Math.PI) / 180),
      pyB = 100 - R * Math.sin((angB * Math.PI) / 180);
    document.getElementById('v1-qlineA').setAttribute('x2', pxA);
    document.getElementById('v1-qlineA').setAttribute('y2', pyA);
    document.getElementById('v1-qpointA').setAttribute('cx', pxA);
    document.getElementById('v1-qpointA').setAttribute('cy', pyA);
    document.getElementById('v1-qlineB').setAttribute('x2', pxB);
    document.getElementById('v1-qlineB').setAttribute('y2', pyB);
    document.getElementById('v1-qpointB').setAttribute('cx', pxB);
    document.getElementById('v1-qpointB').setAttribute('cy', pyB);
    document.getElementById('v1-quad-text').innerHTML =
      `Proyeksi A ke bidang XY: sudut = ${fmt(angA, 1)}°, <b>Kuadran ${quadrantOf(angA)}</b>, ` +
      `cos = ${sign1Span(rA > 0.001 ? ax / rA : 0)}, sin = ${sign1Span(rA > 0.001 ? ay / rA : 0)}<br>` +
      `Proyeksi B ke bidang XY: sudut = ${fmt(angB, 1)}°, <b>Kuadran ${quadrantOf(angB)}</b>, ` +
      `cos = ${sign1Span(rB > 0.001 ? bx / rB : 0)}, sin = ${sign1Span(rB > 0.001 ? by / rB : 0)}`;
  }
  function ids() {
    return {
      ax: +document.getElementById('v1-ax').value,
      ay: +document.getElementById('v1-ay').value,
      az: +document.getElementById('v1-az').value,
      bx: +document.getElementById('v1-bx').value,
      by: +document.getElementById('v1-by').value,
      bz: +document.getElementById('v1-bz').value
    };
  }
  function update() {
    const { ax, ay, az, bx, by, bz } = ids();
    ['ax', 'ay', 'az', 'bx', 'by', 'bz'].forEach(
      k => (document.getElementById('v1-' + k + '-l').textContent = fmt(ids()[k], 1))
    );
    const A = new THREE.Vector3(ax, ay, az),
      B = new THREE.Vector3(bx, by, bz);
    const magA = A.length(),
      magB = B.length();
    const dot = A.dot(B);
    // Sudut antar vektor tidak terdefinisi kalau salah satu vektor nol (pembagi |A||B| = 0)
    const zeroVec = magA < 1e-9 || magB < 1e-9;
    const cosT = zeroVec ? 0 : THREE.MathUtils.clamp(dot / (magA * magB), -1, 1);
    const theta = (Math.acos(cosT) * 180) / Math.PI;
    document.getElementById('v1-magA').textContent = fmt(magA);
    document.getElementById('v1-magB').textContent = fmt(magB);
    document.getElementById('v1-dot').textContent = fmt(dot);
    document.getElementById('v1-theta').textContent = zeroVec ? 'tidak terdefinisi' : fmt(theta, 1) + '°';
    updateQuad1(ax, ay, bx, by);
    [arrowA, arrowB, projLine, dashB, angleArc].forEach(m => {
      if (m) S.scene.remove(m);
    });
    arrowA =
      A.length() > 0.01
        ? new THREE.ArrowHelper(A.clone().normalize(), new THREE.Vector3(0, 0, 0), A.length(), 0x49c7d6, 0.25, 0.12)
        : null;
    arrowB =
      B.length() > 0.01
        ? new THREE.ArrowHelper(B.clone().normalize(), new THREE.Vector3(0, 0, 0), B.length(), 0xe8a23d, 0.25, 0.12)
        : null;
    if (arrowA) S.scene.add(arrowA);
    if (arrowB) S.scene.add(arrowB);
    if (magA > 0.01 && magB > 0.01) {
      const r = Math.min(magA, magB) * 0.4 + 0.3;
      const arc = makeAngleArc(A, B, r, null, 0x6fbf8b);
      angleArc = arc.line;
      S.scene.add(angleArc);
      L.place('theta', arc.mid, `θ=${fmt(theta, 1)}°`, '#6fbf8b');
    } else {
      angleArc = null;
      L.hide('theta');
    }
    projLine = null;
    dashB = null;
    if (magB > 0.01) {
      const sp = dot / magB;
      const pp = B.clone().normalize().multiplyScalar(sp);
      projLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pp]),
        new THREE.LineBasicMaterial({ color: 0xd16bb7 })
      );
      const dm = new THREE.LineDashedMaterial({ color: 0xd16bb7, dashSize: 0.15, gapSize: 0.1 });
      dashB = new THREE.Line(new THREE.BufferGeometry().setFromPoints([A.clone(), pp]), dm);
      dashB.computeLineDistances();
      S.scene.add(projLine, dashB);
    }
    L.place('A', A, `A (${fmt(ax, 1)}, ${fmt(ay, 1)}, ${fmt(az, 1)})`, '#49c7d6');
    L.place('B', B, `B (${fmt(bx, 1)}, ${fmt(by, 1)}, ${fmt(bz, 1)})`, '#e8a23d');
    const magB2 = magB * magB;
    const scalarProj = magB > 1e-9 ? dot / magB : 0;
    const vecProjScale = magB > 1e-9 ? dot / magB2 : 0;
    const projX = vecProjScale * bx,
      projY = vecProjScale * by,
      projZ = vecProjScale * bz;

    // Tiap rumus diberi label teks terpisah (bukan \text di dalam rumus) dan rumus panjang dipecah dua baris,
    // supaya muat di kolom kanan tanpa terpotong
    const eqDefAljabar = `\\begin{aligned}\\vec{A}\\cdot\\vec{B}&=A_xB_x+A_yB_y+A_zB_z\\\\&=(${fmt(ax, 1)})(${fmt(bx, 1)})+(${fmt(ay, 1)})(${fmt(by, 1)})+(${fmt(az, 1)})(${fmt(bz, 1)})=${fmt(dot)}\\end{aligned}`;
    // Kuadrat bilangan negatif wajib dikurung: -2^2 berarti -(2^2) = -4, bukan (-2)^2 = 4
    const sq = v => (v < 0 ? `(${fmt(v, 1)})` : fmt(v, 1)) + '^2';
    const eqMagA = `\\Vert\\vec{A}\\Vert=\\sqrt{A_x^2+A_y^2+A_z^2}=\\sqrt{${sq(ax)}+${sq(ay)}+${sq(az)}}=${fmt(magA)}`;
    const eqMagB = `\\Vert\\vec{B}\\Vert=\\sqrt{B_x^2+B_y^2+B_z^2}=\\sqrt{${sq(bx)}+${sq(by)}+${sq(bz)}}=${fmt(magB)}`;
    const eqDefGeo = `\\vec{A}\\cdot\\vec{B} = \\Vert\\vec{A}\\Vert\\,\\Vert\\vec{B}\\Vert\\cos\\theta = (${fmt(magA)})(${fmt(magB)})\\cos\\theta = ${fmt(dot)}`;
    const eqTheta = zeroVec
      ? `\\cos\\theta=\\dfrac{\\vec{A}\\cdot\\vec{B}}{\\Vert\\vec{A}\\Vert\\,\\Vert\\vec{B}\\Vert}\\;\\text{tidak terdefinisi: salah satu vektor nol, pembagi }\\Vert\\vec{A}\\Vert\\,\\Vert\\vec{B}\\Vert=0`
      : `\\cos\\theta=\\dfrac{\\vec{A}\\cdot\\vec{B}}{\\Vert\\vec{A}\\Vert\\,\\Vert\\vec{B}\\Vert}=\\dfrac{${fmt(dot)}}{(${fmt(magA)})(${fmt(magB)})}\\;\\Rightarrow\\;\\theta=${fmt(theta, 1)}^\\circ`;
    const bZero = magB < 1e-9;
    const eqScalarProj = bZero
      ? `\\text{tidak terdefinisi, }\\Vert\\vec{B}\\Vert=0`
      : `\\text{comp}_{\\vec B}\\vec A=\\dfrac{\\vec{A}\\cdot\\vec{B}}{\\Vert\\vec{B}\\Vert}=\\dfrac{${fmt(dot)}}{${fmt(magB)}}=${fmt(scalarProj)}`;
    const eqVecProj = bZero
      ? `\\text{tidak terdefinisi, }\\Vert\\vec{B}\\Vert^2=0`
      : `\\begin{aligned}\\text{proj}_{\\vec B}\\vec A&=\\dfrac{\\vec{A}\\cdot\\vec{B}}{\\Vert\\vec{B}\\Vert^2}\\,\\vec B=(${fmt(vecProjScale)})\\,\\vec B\\\\&=(${fmt(projX)},\\,${fmt(projY)},\\,${fmt(projZ)})\\end{aligned}`;
    const eqMatrix = `\\vec{A}\\cdot\\vec{B}=\\vec{A}^{T}\\vec{B}=\\begin{bmatrix}${fmt(ax, 1)} & ${fmt(ay, 1)} & ${fmt(az, 1)}\\end{bmatrix}\\begin{bmatrix}${fmt(bx, 1)}\\\\${fmt(by, 1)}\\\\${fmt(bz, 1)}\\end{bmatrix}=${fmt(dot)}`;

    katexRLines(document.getElementById('v1-eq'), [
      { label: 'Definisi aljabar', tex: eqDefAljabar },
      { label: 'Definisi geometris', tex: eqDefGeo },
      { label: 'Panjang vektor A', tex: eqMagA },
      { label: 'Panjang vektor B', tex: eqMagB },
      { label: 'Sudut antar vektor', tex: eqTheta },
      { label: 'Proyeksi skalar A pada B', tex: eqScalarProj },
      { label: 'Proyeksi vektor A pada B (garis magenta)', tex: eqVecProj },
      {
        label: 'Sebagai perkalian matriks',
        tex: eqMatrix,
        note: 'Interpretasi: Aᵀ adalah peta linear dari ℝ³ ke ℝ, yang mereduksi vektor B menjadi satu skalar sepanjang arah A.'
      }
    ]);
  }
  ['v1-ax', 'v1-ay', 'v1-az', 'v1-bx', 'v1-by', 'v1-bz'].forEach(id =>
    document.getElementById(id).addEventListener('input', update)
  );
  update();
  (function tick() {
    requestAnimationFrame(tick);
    const { ax, ay, az, bx, by, bz } = ids();
    const A = new THREE.Vector3(ax, ay, az),
      B = new THREE.Vector3(bx, by, bz);
    L.place('A', A, `A (${fmt(ax, 1)}, ${fmt(ay, 1)}, ${fmt(az, 1)})`, '#49c7d6');
    L.place('B', B, `B (${fmt(bx, 1)}, ${fmt(by, 1)}, ${fmt(bz, 1)})`, '#e8a23d');
    if (A.length() > 0.01 && B.length() > 0.01) {
      const t = (Math.acos(THREE.MathUtils.clamp(A.dot(B) / (A.length() * B.length()), -1, 1)) * 180) / Math.PI;
      const r = Math.min(A.length(), B.length()) * 0.4 + 0.3;
      const p = arcPoints(A, B, r);
      L.place('theta', p[Math.floor(p.length / 2)], `θ=${fmt(t, 1)}°`, '#6fbf8b');
    }
  })();
})();

/* ============ MODULE 2: BASIC ROTATION ============ */
(function () {
  const S = makeVectorScene('ch2', [6, 5, 7], 's2');
  const L = makeLabelManager('ch2', S.camera);
  let lastP = new THREE.Vector3();
  const uvw = new THREE.Group();
  S.scene.add(uvw);
  uvw.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 2.2, 0x49c7d6, 0.2, 0.1));
  uvw.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2.2, 0x6fd6e0, 0.2, 0.1));
  uvw.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 2.2, 0x2f8fa0, 0.2, 0.1));
  let pArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 0.5, 0xe8a23d, 0.18, 0.09);
  S.scene.add(pArrow);
  const pMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8a23d })
  );
  S.scene.add(pMark);
  let arc = null;
  let currentAxis = 'x';
  const axisPlaneInfo = {
    x: { cosName: 'Y', sinName: 'Z', cosVar: '\\cos\\alpha \\to Y', sinVar: '\\sin\\alpha \\to Z' },
    y: { cosName: 'Z', sinName: 'X', cosVar: '\\cos\\alpha \\to Z', sinVar: '\\sin\\alpha \\to X' },
    z: { cosName: 'X', sinName: 'Y', cosVar: '\\cos\\alpha \\to X', sinVar: '\\sin\\alpha \\to Y' }
  };
  let quadOn = true;
  const quadToggle = document.getElementById('v2-quad-on');
  quadToggle.addEventListener('click', () => {
    quadOn = !quadOn;
    quadToggle.classList.toggle('on', quadOn);
    document.getElementById('v2-quad-wrap').style.display = quadOn ? 'block' : 'none';
    update();
  });
  function signSpan(val) {
    const s = val >= 0 ? '+' : '-';
    const cls = val >= 0 ? 'quad-sign-pos' : 'quad-sign-neg';
    return `<span class="${cls}">${s}${Math.abs(val).toFixed(3)}</span>`;
  }
  function updateQuadrant(angDeg, axis) {
    if (!quadOn) return;
    const info = axisPlaneInfo[axis];
    document.getElementById('v2-quad-cosname').textContent = `cos → sumbu ${info.cosName}`;
    document.getElementById('v2-quad-sinname').textContent = `sin → sumbu ${info.sinName}`;
    const a = (angDeg * Math.PI) / 180;
    const cosV = Math.cos(a),
      sinV = Math.sin(a);
    const R = 78;
    const px = 100 + R * cosV,
      py = 100 - R * sinV;
    document.getElementById('v2-qline').setAttribute('x2', px);
    document.getElementById('v2-qline').setAttribute('y2', py);
    document.getElementById('v2-qpoint').setAttribute('cx', px);
    document.getElementById('v2-qpoint').setAttribute('cy', py);
    let norm = ((angDeg % 360) + 360) % 360;
    let quadRoman = 'I',
      quadDesc = '';
    if (norm >= 0 && norm < 90) {
      quadRoman = 'I';
      quadDesc = 'cos positif, sin positif';
    } else if (norm >= 90 && norm < 180) {
      quadRoman = 'II';
      quadDesc = 'cos negatif, sin positif';
    } else if (norm >= 180 && norm < 270) {
      quadRoman = 'III';
      quadDesc = 'cos negatif, sin negatif';
    } else {
      quadRoman = 'IV';
      quadDesc = 'cos positif, sin negatif';
    }
    document.getElementById('v2-quad-text').innerHTML =
      `α = ${fmt(angDeg, 1)}° (dilihat dari atas sumbu ${axis.toUpperCase()})<br>` +
      `Berada di <b>Kuadran ${quadRoman}</b>: ${quadDesc}<br>` +
      `cos α = ${signSpan(cosV)} &nbsp;→ komponen sumbu ${info.cosName}<br>` +
      `sin α = ${signSpan(sinV)} &nbsp;→ komponen sumbu ${info.sinName}`;
  }
  document.querySelectorAll('#view-v2 [data-axis]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-v2 [data-axis]').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      currentAxis = btn.dataset.axis;
      update();
    });
  });
  function rotMatrix(axis, a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    if (axis === 'x')
      return [
        [1, 0, 0],
        [0, c, -s],
        [0, s, c]
      ];
    if (axis === 'y')
      return [
        [c, 0, s],
        [0, 1, 0],
        [-s, 0, c]
      ];
    return [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1]
    ];
  }
  function update() {
    const angDeg = +document.getElementById('v2-ang').value;
    document.getElementById('v2-ang-l').textContent = angDeg + '°';
    updateQuadrant(angDeg, currentAxis);
    const a = (angDeg * Math.PI) / 180;
    const pu = +document.getElementById('v2-pu').value,
      pv = +document.getElementById('v2-pv').value,
      pw = +document.getElementById('v2-pw').value;
    document.getElementById('v2-pu-l').textContent = fmt(pu, 1);
    document.getElementById('v2-pv-l').textContent = fmt(pv, 1);
    document.getElementById('v2-pw-l').textContent = fmt(pw, 1);
    const R = rotMatrix(currentAxis, a);
    if (currentAxis === 'x') uvw.rotation.set(a, 0, 0);
    if (currentAxis === 'y') uvw.rotation.set(0, a, 0);
    if (currentAxis === 'z') uvw.rotation.set(0, 0, a);
    if (arc) S.scene.remove(arc);
    const ref = refForAxis(currentAxis);
    const rot = new THREE.Vector3(
      R[0][0] * ref.x + R[0][1] * ref.y + R[0][2] * ref.z,
      R[1][0] * ref.x + R[1][1] * ref.y + R[1][2] * ref.z,
      R[2][0] * ref.x + R[2][1] * ref.y + R[2][2] * ref.z
    );
    const ar = makeAngleArc(ref, rot, 1.0, null, 0x6fbf8b);
    arc = ar.line;
    S.scene.add(arc);
    L.place('alpha', ar.mid, `α=${angDeg}°`, '#6fbf8b');
    const px = R[0][0] * pu + R[0][1] * pv + R[0][2] * pw,
      py = R[1][0] * pu + R[1][1] * pv + R[1][2] * pw,
      pz = R[2][0] * pu + R[2][1] * pv + R[2][2] * pw;
    document.getElementById('v2-px').textContent = fmt(px);
    document.getElementById('v2-py').textContent = fmt(py);
    document.getElementById('v2-pz').textContent = fmt(pz);
    const P = new THREE.Vector3(px, py, pz);
    pMark.position.copy(P);
    lastP.copy(P);
    S.scene.remove(pArrow);
    if (P.length() > 0.01) {
      pArrow = new THREE.ArrowHelper(
        P.clone().normalize(),
        new THREE.Vector3(0, 0, 0),
        P.length(),
        0xe8a23d,
        0.18,
        0.09
      );
      S.scene.add(pArrow);
    }
    L.place('P', P, `P (${fmt(px)}, ${fmt(py)}, ${fmt(pz)})`, '#e8a23d');
    const al = { x: 'R_x', y: 'R_y', z: 'R_z' }[currentAxis];
    katexRLines(document.getElementById('v2-eq'), [
      `${al}(\\alpha)=${matToTex(R, 3)}`,
      `P_{XYZ}=${al}(\\alpha)\\,P_{UVW}=${matToTex(R, 3)}\\begin{bmatrix}${fmt(pu, 1)}\\\\${fmt(pv, 1)}\\\\${fmt(pw, 1)}\\end{bmatrix}=\\begin{bmatrix}${fmt(px)}\\\\${fmt(py)}\\\\${fmt(pz)}\\end{bmatrix}`
    ]);
  }
  ['v2-ang', 'v2-pu', 'v2-pv', 'v2-pw'].forEach(id => document.getElementById(id).addEventListener('input', update));
  update();
  (function tick() {
    requestAnimationFrame(tick);
    L.place('P', lastP, `P (${fmt(lastP.x)}, ${fmt(lastP.y)}, ${fmt(lastP.z)})`, '#e8a23d');
  })();
})();

/* ============ MODULE 3: NON-COMMUTATIVE ============ */
(function () {
  const S = makeVectorScene('ch3', [7, 5, 9], 's3');
  const L = makeLabelManager('ch3', S.camera);
  function makeFrame(c) {
    const g = new THREE.Group();
    g.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.8, c, 0.16, 0.08));
    g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.8, c, 0.16, 0.08));
    g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.8, c, 0.16, 0.08));
    return g;
  }
  const fAB = makeFrame(0x49c7d6),
    fBA = makeFrame(0xe8a23d);
  S.scene.add(fAB, fBA);
  let axis1 = 'x',
    axis2 = 'z';
  document.querySelectorAll('#view-v3 [data-r1]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-v3 [data-r1]').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      axis1 = btn.dataset.r1;
      update();
    });
  });
  document.querySelectorAll('#view-v3 [data-r2]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-v3 [data-r2]').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      axis2 = btn.dataset.r2;
      update();
    });
  });
  function rotMatrix(axis, a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    if (axis === 'x')
      return [
        [1, 0, 0],
        [0, c, -s],
        [0, s, c]
      ];
    if (axis === 'y')
      return [
        [c, 0, s],
        [0, 1, 0],
        [-s, 0, c]
      ];
    return [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1]
    ];
  }
  function matMul(A, B) {
    const R = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i][j] += A[i][k] * B[k][j];
    return R;
  }
  function matToEuler(R) {
    const m = new THREE.Matrix4();
    m.set(R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, 0, 0, 0, 1);
    return new THREE.Euler().setFromRotationMatrix(m, 'XYZ');
  }
  function update() {
    const aD = +document.getElementById('v3-a').value,
      bD = +document.getElementById('v3-b').value;
    document.getElementById('v3-a-l').textContent = aD + '°';
    document.getElementById('v3-b-l').textContent = bD + '°';
    const a = (aD * Math.PI) / 180,
      b = (bD * Math.PI) / 180;
    const R1 = rotMatrix(axis1, a),
      R2 = rotMatrix(axis2, b);
    const RAB = matMul(R2, R1),
      RBA = matMul(R1, R2);
    fAB.setRotationFromEuler(matToEuler(RAB));
    fBA.setRotationFromEuler(matToEuler(RBA));
    fAB.position.set(-1.6, 0, 0);
    fBA.position.set(1.6, 0, 0);
    let diff = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) diff += Math.pow(RAB[i][j] - RBA[i][j], 2);
    diff = Math.sqrt(diff);
    document.getElementById('v3-diff').textContent = fmt(diff, 4);
    const noteEl = document.getElementById('v3-note');
    noteEl.textContent =
      diff < 1e-6
        ? 'Kedua urutan identik (kasus khusus).'
        : 'Terbukti: R_AB ≠ R_BA. Urutan rotasi menentukan hasil akhir.';
    const l1 = { x: 'R_x', y: 'R_y', z: 'R_z' }[axis1],
      l2 = { x: 'R_x', y: 'R_y', z: 'R_z' }[axis2];
    katexRLines(document.getElementById('v3-eq'), [
      `R_{AB}=${l2}(\\beta)\\,${l1}(\\alpha)=${matToTex(RAB, 3)}`,
      `R_{BA}=${l1}(\\alpha)\\,${l2}(\\beta)=${matToTex(RBA, 3)}`,
      // Kesimpulan mengikuti angka: rotasi pada sumbu yang sama, atau salah satu sudut nol, memang komutatif
      diff < 1e-6
        ? `R_{AB}=R_{BA}\\quad\\text{(kasus khusus: sumbu sama atau salah satu sudut nol)}`
        : `R_{AB}\\neq R_{BA},\\quad \\lVert R_{AB}-R_{BA}\\rVert_F=${fmt(diff, 3)}`
    ]);
  }
  ['v3-a', 'v3-b'].forEach(id => document.getElementById(id).addEventListener('input', update));
  update();
})();

/* ============ MODULE 4: HOMOGENEOUS + DH ============ */
(function () {
  const S = makeVectorScene('ch4', [7, 6, 9], 's4');
  const L = makeLabelManager('ch4', S.camera);
  let lastOrigin = new THREE.Vector3(),
    lastLP = new THREE.Vector3();
  const movGroup = new THREE.Group();
  S.scene.add(movGroup);
  movGroup.add(
    new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.4, 0x49c7d6, 0.16, 0.08)
  );
  movGroup.add(
    new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.4, 0x6fd6e0, 0.16, 0.08)
  );
  movGroup.add(
    new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.4, 0x2f8fa0, 0.16, 0.08)
  );
  movGroup.add(
    new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshBasicMaterial({ color: 0x49c7d6 }))
  );
  const link = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0x5c6779, dashSize: 0.15, gapSize: 0.1 })
  );
  S.scene.add(link);
  const rpMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8a23d })
  );
  S.scene.add(rpMark);
  let angleArc = null;

  // Render static DH order equation
  katexR(
    document.getElementById('v4-dh-order'),
    'T_i^{i-1}=\\operatorname{Rot}_z(\\theta)\\;\\operatorname{Trans}_z(d)\\;\\operatorname{Trans}_x(a)\\;\\operatorname{Rot}_x(\\alpha)'
  );

  function update() {
    const thDeg = +document.getElementById('v4-th').value;
    const d = +document.getElementById('v4-d').value;
    const a = +document.getElementById('v4-a').value;
    const alDeg = +document.getElementById('v4-al').value;
    document.getElementById('v4-th-l').textContent = thDeg + '°';
    document.getElementById('v4-d-l').textContent = fmt(d, 1);
    document.getElementById('v4-a-l').textContent = fmt(a, 1);
    document.getElementById('v4-al-l').textContent = alDeg + '°';
    const th = (thDeg * Math.PI) / 180,
      al = (alDeg * Math.PI) / 180;
    const ct = Math.cos(th),
      st = Math.sin(th),
      ca = Math.cos(al),
      sa = Math.sin(al);
    const T = [
      [ct, -st * ca, st * sa, a * ct],
      [st, ct * ca, -ct * sa, a * st],
      [0, sa, ca, d],
      [0, 0, 0, 1]
    ];
    // Apply DH transform to frame
    const m4 = new THREE.Matrix4();
    m4.set(
      T[0][0],
      T[0][1],
      T[0][2],
      T[0][3],
      T[1][0],
      T[1][1],
      T[1][2],
      T[1][3],
      T[2][0],
      T[2][1],
      T[2][2],
      T[2][3],
      0,
      0,
      0,
      1
    );
    const pos = new THREE.Vector3(),
      quat = new THREE.Quaternion(),
      scl = new THREE.Vector3();
    m4.decompose(pos, quat, scl);
    movGroup.position.copy(pos);
    movGroup.quaternion.copy(quat);
    link.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), pos]);
    link.computeLineDistances();
    if (angleArc) S.scene.remove(angleArc);
    const rotDir = new THREE.Vector3(ct, st, 0);
    const ar = makeAngleArc(new THREE.Vector3(1, 0, 0), rotDir, 0.7, null, 0x6fbf8b);
    angleArc = ar.line;
    S.scene.add(angleArc);
    L.place('theta', ar.mid, `θ=${thDeg}°`, '#6fbf8b');
    // Sample local point (1,0,0,1)
    const lp = [1, 0, 0, 1],
      res = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) res[i] += T[i][j] * lp[j];
    rpMark.position.set(res[0], res[1], res[2]);
    lastOrigin.copy(pos);
    lastLP.set(res[0], res[1], res[2]);
    L.place('origin', lastOrigin, `O' (${fmt(pos.x, 1)}, ${fmt(pos.y, 1)}, ${fmt(pos.z, 1)})`, '#49c7d6');
    L.place('lp', lastLP, `P (${fmt(res[0])}, ${fmt(res[1])}, ${fmt(res[2])})`, '#e8a23d');
    document.getElementById('v4-px').textContent = fmt(res[0]);
    document.getElementById('v4-py').textContent = fmt(res[1]);
    document.getElementById('v4-pz').textContent = fmt(res[2]);
    katexRLines(document.getElementById('v4-eq'), [
      `T=\\begin{bmatrix}R_{3\\times3} & p_{3\\times1}\\\\0_{1\\times3} & 1\\end{bmatrix}=${matToTex(T, 3)}`,
      `T\\begin{bmatrix}1\\\\0\\\\0\\\\1\\end{bmatrix}=\\begin{bmatrix}${fmt(res[0])}\\\\${fmt(res[1])}\\\\${fmt(res[2])}\\\\1\\end{bmatrix}`
    ]);
  }
  ['v4-th', 'v4-d', 'v4-a', 'v4-al'].forEach(id => document.getElementById(id).addEventListener('input', update));
  update();
  (function tick() {
    requestAnimationFrame(tick);
    L.place(
      'origin',
      lastOrigin,
      `O' (${fmt(lastOrigin.x, 1)}, ${fmt(lastOrigin.y, 1)}, ${fmt(lastOrigin.z, 1)})`,
      '#49c7d6'
    );
    L.place('lp', lastLP, `P (${fmt(lastLP.x)}, ${fmt(lastLP.y)}, ${fmt(lastLP.z)})`, '#e8a23d');
  })();
})();

/* ============ MODULE 5: FK N-DOF 3D ============ */
(function () {
  const S = makeVectorScene('ch5', [5, 7, 9], 's5');
  const L = makeLabelManager('ch5', S.camera);
  let lastPts = [];

  let DOF = 3;
  let angles = [30, -20, 15, 10, -10, 5];
  let lengths = [2, 1.5, 1.2, 1, 0.8, 0.6];
  let jointAxes = ['z', 'y', 'y', 'x', 'y', 'z']; // sendi 1 berputar di lantai (pinggang), sendi 2-3 naik turun

  let linkMeshes = [],
    jointMeshes = [],
    eeMesh = null,
    jointArcs = [];
  let traceOn = true,
    tracePoints = [],
    traceLine = null;
  const traceMat = new THREE.LineBasicMaterial({ color: 0xd16bb7 });

  function clearChainMeshes() {
    linkMeshes.forEach(m => S.scene.remove(m));
    jointMeshes.forEach(m => S.scene.remove(m));
    jointArcs.forEach(m => S.scene.remove(m));
    if (eeMesh) S.scene.remove(eeMesh);
    linkMeshes = [];
    jointMeshes = [];
    jointArcs = [];
  }

  function computeChain5() {
    let T = new THREE.Matrix4();
    const pts = [new THREE.Vector3(0, 0, 0)];
    for (let i = 0; i < DOF; i++) {
      const ang = (angles[i] * Math.PI) / 180;
      const rotM = new THREE.Matrix4();
      switch (jointAxes[i]) {
        case 'x':
          rotM.makeRotationX(ang);
          break;
        case 'y':
          rotM.makeRotationY(ang);
          break;
        default:
          rotM.makeRotationZ(ang);
          break;
      }
      const transM = new THREE.Matrix4().makeTranslation(lengths[i], 0, 0);
      T = T.clone().multiply(rotM).multiply(transM);
      pts.push(new THREE.Vector3().setFromMatrixPosition(T));
    }
    return pts;
  }

  function clearTrace() {
    tracePoints = [];
    if (traceLine) {
      S.scene.remove(traceLine);
      traceLine = null;
    }
  }

  function buildDofBtns() {
    const w = document.getElementById('dof-select');
    w.innerHTML = '';
    for (let n = 1; n <= 6; n++) {
      const b = document.createElement('button');
      b.textContent = n;
      if (n === DOF) b.classList.add('active');
      b.addEventListener('click', () => {
        DOF = n;
        buildDofBtns();
        buildSliders();
        clearTrace();
        update();
      });
      w.appendChild(b);
    }
  }

  function buildSliders() {
    const c = document.getElementById('joint-sliders-5');
    c.innerHTML = '<h4>Sudut Sendi, Panjang Link & Sumbu</h4>';
    for (let i = 0; i < DOF; i++) {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '8px';
      wrap.style.paddingBottom = '6px';
      wrap.style.borderBottom = '1px solid var(--panel-line)';
      const axRow = document.createElement('div');
      axRow.style.display = 'flex';
      axRow.style.alignItems = 'center';
      axRow.style.gap = '4px';
      axRow.style.marginBottom = '4px';
      axRow.innerHTML = `<span style="font-size:11px;color:var(--gold);font-weight:600;">Joint ${i + 1}</span><div class="axis-sel" id="axsel${i}"></div>`;
      wrap.appendChild(axRow);
      const r1 = document.createElement('div');
      r1.className = 'slider-row';
      r1.innerHTML = `<div class="lbl"><span>θ${i + 1}</span><span id="v5-th${i}-l">${angles[i]}°</span></div><input type="range" id="v5-th${i}" min="-180" max="180" step="1" value="${angles[i]}">`;
      wrap.appendChild(r1);
      const r2 = document.createElement('div');
      r2.className = 'slider-row';
      r2.innerHTML = `<div class="lbl"><span>a${i + 1}</span><span id="v5-a${i}-l">${lengths[i]}</span></div><input type="range" id="v5-a${i}" min="0.3" max="3" step="0.1" value="${lengths[i]}">`;
      wrap.appendChild(r2);
      c.appendChild(wrap);

      // Axis selector
      const axSel = document.getElementById('axsel' + i);
      ['x', 'y', 'z'].forEach(ax => {
        const b = document.createElement('button');
        b.textContent = ax.toUpperCase();
        if (jointAxes[i] === ax) b.classList.add('active');
        b.addEventListener('click', () => {
          jointAxes[i] = ax;
          axSel.querySelectorAll('button').forEach(bb => bb.classList.remove('active'));
          b.classList.add('active');
          update();
        });
        axSel.appendChild(b);
      });

      document.getElementById('v5-th' + i).addEventListener('input', e => {
        angles[i] = +e.target.value;
        document.getElementById('v5-th' + i + '-l').textContent = angles[i] + '°';
        update();
      });
      document.getElementById('v5-a' + i).addEventListener('input', e => {
        lengths[i] = +e.target.value;
        document.getElementById('v5-a' + i + '-l').textContent = fmt(lengths[i], 1);
        update();
      });
    }
  }

  function update() {
    const pts = computeChain5();
    clearChainMeshes();
    for (let i = 0; i < pts.length - 1; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([pts[i], pts[i + 1]]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x49c7d6, linewidth: 2 }));
      S.scene.add(line);
      linkMeshes.push(line);
      const jm = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x8fa0ad })
      );
      jm.position.copy(pts[i]);
      S.scene.add(jm);
      jointMeshes.push(jm);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      // Sendi sumbu X memutar link pada porosnya sendiri (translasi juga sepanjang X), jadi arah link
      // tidak berubah dan busur antar-link bernilai nol; labelnya ditaruh di titik sendi.
      if (jointAxes[i] === 'x') {
        L.place(
          'jang' + i,
          pts[i].clone().add(new THREE.Vector3(0, 0.25, 0)),
          `θ${i + 1}=${angles[i]}° (putar pada poros link)`,
          '#6fbf8b'
        );
        continue;
      }
      const dirIn =
        i === 0
          ? new THREE.Vector3(1, 0, 0)
          : pts[i]
              .clone()
              .sub(pts[i - 1])
              .normalize();
      const dirOut = pts[i + 1].clone().sub(pts[i]).normalize();
      if (dirIn.length() > 0.01 && dirOut.length() > 0.01) {
        const arc = makeAngleArc(dirIn, dirOut, 0.35, pts[i], 0x6fbf8b);
        jointArcs.push(arc.line);
        S.scene.add(arc.line);
        L.place('jang' + i, arc.mid, `θ${i + 1}=${angles[i]}°`, '#6fbf8b');
      }
    }
    for (let i = pts.length - 1; i < 7; i++) {
      L.hide('jang' + i);
      L.hide('j' + i);
    }
    const ee = pts[pts.length - 1];
    eeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), new THREE.MeshBasicMaterial({ color: 0xe8a23d }));
    eeMesh.position.copy(ee);
    S.scene.add(eeMesh);
    lastPts = pts;
    for (let i = 1; i < pts.length - 1; i++)
      L.place('j' + i, pts[i], `(${fmt(pts[i].x)}, ${fmt(pts[i].y)}, ${fmt(pts[i].z)})`, '#8fa0ad');

    if (traceOn) {
      tracePoints.push(ee.clone());
      if (tracePoints.length > 1500) tracePoints.shift();
      if (traceLine) S.scene.remove(traceLine);
      traceLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tracePoints), traceMat);
      S.scene.add(traceLine);
    }

    document.getElementById('v5-x').textContent = fmt(ee.x);
    document.getElementById('v5-y').textContent = fmt(ee.y);
    document.getElementById('v5-z').textContent = fmt(ee.z);
    L.place('ee', ee, `EE (${fmt(ee.x)}, ${fmt(ee.y)}, ${fmt(ee.z)})`, '#e8a23d');

    // FK equation
    // Rantai ditulis dua sendi per baris supaya 6 DOF tidak perlu digeser ke samping
    let eqParts = [];
    for (let i = 0; i < DOF; i++) {
      const axLbl = { x: 'R_x', y: 'R_y', z: 'R_z' }[jointAxes[i]];
      eqParts.push(`${axLbl}(q_{${i + 1}})\\,T_x(a_{${i + 1}})`);
    }
    const rows = [];
    for (let i = 0; i < eqParts.length; i += 2) rows.push(eqParts.slice(i, i + 2).join('\\cdot '));
    const eqChain = `\\begin{aligned}T&=${rows.map((r, i) => (i ? '&\\quad\\cdot ' : '') + r).join('\\\\')}\\end{aligned}`;
    const eqNum = `\\mathbf{p}_{EE}=\\begin{bmatrix}${fmt(ee.x)}\\\\${fmt(ee.y)}\\\\${fmt(ee.z)}\\end{bmatrix}`;
    katexRLines(document.getElementById('v5-eq'), [
      { label: 'Rantai transformasi (tiap sendi: putar lalu geser sepanjang link)', tex: eqChain },
      { label: 'Posisi end-effector', tex: eqNum }
    ]);
  }

  document.getElementById('trace-toggle').addEventListener('click', function () {
    traceOn = !traceOn;
    this.classList.toggle('on', traceOn);
  });
  document.getElementById('trace-clear').addEventListener('click', clearTrace);

  let sweeping = false;
  document.getElementById('trace-sweep').addEventListener('click', function () {
    if (sweeping) return;
    sweeping = true;
    const slider = document.getElementById('v5-th0');
    let t = 0;
    const startVal = angles[0];
    function step() {
      t += 4;
      angles[0] = Math.round(180 * Math.sin((t * Math.PI) / 180));
      slider.value = angles[0];
      document.getElementById('v5-th0-l').textContent = angles[0] + '°';
      update();
      if (t < 360) requestAnimationFrame(step);
      else {
        sweeping = false;
        angles[0] = startVal;
        slider.value = startVal;
        document.getElementById('v5-th0-l').textContent = startVal + '°';
        update();
      }
    }
    step();
  });

  buildDofBtns();
  buildSliders();
  update();
  (function tick() {
    requestAnimationFrame(tick);
    if (lastPts.length) {
      const pts = lastPts;
      for (let i = 1; i < pts.length - 1; i++)
        L.place('j' + i, pts[i], `(${fmt(pts[i].x)}, ${fmt(pts[i].y)}, ${fmt(pts[i].z)})`, '#8fa0ad');
      const ee = pts[pts.length - 1];
      L.place('ee', ee, `EE (${fmt(ee.x)}, ${fmt(ee.y)}, ${fmt(ee.z)})`, '#e8a23d');
    }
  })();
})();
