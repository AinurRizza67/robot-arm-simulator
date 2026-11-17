/* 21_content_i18n.js
   Content translation (Indonesian source text to English). The page markup and many feature modules write
   Indonesian text; when the language is English every visible text node, placeholder and tooltip is looked up in
   CONTENT_EN (exact phrase), then in CONTENT_PATTERNS (texts with live numbers), then CONTENT_PHRASES (fragments).
   A MutationObserver translates text written later by feature code, and switching back to Indonesian restores the
   original text. KaTeX output, code editors and user input are never touched.
   To translate a new text: add the exact Indonesian phrase and its English version to CONTENT_EN.
   Classic script: all files share one global scope and are loaded in order by index.html. */

const CONTENT_EN = new Map([
  // ---------- shell, dashboard, settings, models ----------
  ['Python: hanya di aplikasi .exe', 'Python: desktop app only'],
  ['Python: belum dinyalakan', 'Python: not started'],
  ['Robot: tidak tersambung', 'Robot: not connected'],
  ['Tidak tersambung', 'Not connected'],
  ['Semua simulator yang sudah ada, tanpa perlu robot.', 'Every simulator, no robot needed.'],
  ['Tampilan aplikasi dan koneksi ke robot.', 'App appearance and robot connection.'],
  ['Bahasa, tema, Rujukan, Mode Laporan, Mode Pengamat', 'Language, theme, References, Report Mode, Observer Mode'],
  ['IP robot, lokasi Python, batas kecepatan', 'Robot IP, Python location, speed limit'],
  [
    'Model 3D ZU5 disambungkan ke robot nyata (atau robot virtual) lewat Python dan IP.',
    'The ZU5 3D model connected to the real robot (or a virtual one) through Python and IP.'
  ],
  ['Monitoring 3D mengikuti pose robot asli', '3D monitoring that follows the real robot pose'],
  ['Teach pendant: jog sendi dan kartesian', 'Teach pendant: joint and Cartesian jog'],
  ['Set posisi x, y, z dengan IK dan FK, persamaan live', 'Set x, y, z position with IK and FK, live equations'],
  ['Wadah program Python dengan Code Template', 'Python program editor with code templates'],
  ['JAKA Simulation: FK, IK, Blok Diagram, Draw', 'Robot Arm Simulation: FK, IK, Block Diagram, Draw'],
  ['Vector Simulation: vektor, rotasi, homogen, DH', 'Vector Simulation: vectors, rotation, homogeneous, DH'],
  ['Tutorial interaktif', 'Interactive tutorial'],
  ['Buka Simulation →', 'Open Simulation →'],
  ['Buka Settings →', 'Open Settings →'],
  ['Mulai kendali →', 'Start control →'],
  ['buka →', 'open →'],
  ['Model Robot', 'Robot Models'],
  [
    'JAKA ZU5, UR3e, UR5e, UR10e, atau model sendiri dari tabel DH dan mesh.',
    'JAKA ZU5, UR3e, UR5e, UR10e, or your own model from a DH table and meshes.'
  ],
  ['Mesh unggahan', 'Uploaded mesh'],
  ['Tubuh dari DH', 'Body from DH'],
  ['Model pengguna', 'User model'],
  ['Aktif', 'Active'],
  ['Jangkauan', 'Reach'],
  ['Massa', 'Mass'],
  ['IP robot', 'Robot IP'],
  ['Lokasi Python', 'Python location'],
  ['Batas kecepatan aplikasi', 'App speed limit'],
  ['Pemetaan sudut sendi', 'Joint angle mapping'],
  ['Pemetaan sudut sendi model ke controller', 'Model to controller joint angle mapping'],
  ['Koneksi robot (Start Control)', 'Robot connection (Start Control)'],
  ['tanda', 'sign'],
  ['offset', 'offset'],
  ['otomatis', 'automatic'],
  ['Asisten belajar dan panduan simulator', 'Learning assistant and simulator guide'],
  ['Dalam pengerjaan', 'In progress'],
  ['Segera hadir', 'Coming soon'],
  ['Kirim', 'Send'],
  ['Mode Pengamat aktif', 'Observer Mode on'],
  ['Mode Laporan aktif', 'Report Mode on'],

  // ---------- Vector Simulation ----------
  ['1. Vektor & Dot Product', '1. Vectors & Dot Product'],
  ['2. Rotasi Dasar', '2. Basic Rotation'],
  ['3. Rotasi Komposit', '3. Composite Rotation'],
  ['4. Matriks Homogen & DH', '4. Homogeneous Matrix & DH'],
  ['5. FK N-DOF (3D)', '5. N-DOF FK (3D)'],
  ['Vektor & Dot Product', 'Vectors & Dot Product'],
  ['Vektor A', 'Vector A'],
  ['Operasi vektor penting:', 'Key vector operations:'],
  ['Perkalian matriks-vektor', 'Matrix-vector product'],
  ['Vektor B', 'Vector B'],
  ['Vektor A (Cyan)', 'Vector A (Cyan)'],
  ['Vektor B (Amber)', 'Vector B (Amber)'],
  ['Panjang vektor A', 'Length of vector A'],
  ['Panjang vektor B', 'Length of vector B'],
  ['Sudut antar vektor', 'Angle between vectors'],
  ['Sudut θ', 'Angle θ'],
  ['Definisi aljabar', 'Algebraic definition'],
  ['Definisi geometris', 'Geometric definition'],
  ['Proyeksi A pada B', 'Projection of A onto B'],
  ['Proyeksi skalar A pada B', 'Scalar projection of A onto B'],
  ['Proyeksi vektor A pada B (garis magenta)', 'Vector projection of A onto B (magenta line)'],
  ['Sebagai perkalian matriks', 'As a matrix product'],
  [
    'Mode Kuadran: sudut polar A & B (proyeksi bidang XY)',
    'Quadrant mode: polar angles of A & B (XY plane projection)'
  ],
  ['Mode Kuadran (lihat dari atas sumbu rotasi)', 'Quadrant mode (looking down the rotation axis)'],
  ['Tampilkan diagram kuadran', 'Show the quadrant diagram'],
  ['Kuadran I', 'Quadrant I'],
  ['Kuadran II', 'Quadrant II'],
  ['Kuadran III', 'Quadrant III'],
  ['Kuadran IV', 'Quadrant IV'],
  [': cos positif, sin positif', ': cos positive, sin positive'],
  [': cos negatif, sin positif', ': cos negative, sin positive'],
  [': cos negatif, sin negatif', ': cos negative, sin negative'],
  [': cos positif, sin negatif', ': cos positive, sin negative'],
  ['cos → sumbu Y', 'cos → Y axis'],
  ['sin → sumbu Z', 'sin → Z axis'],
  ['→ komponen sumbu Y', '→ Y axis component'],
  ['→ komponen sumbu Z', '→ Z axis component'],
  ['Matriks Rotasi', 'Rotation Matrix'],
  ['Rotasi Dasar 3x3', 'Basic 3x3 Rotation'],
  ['Sumbu Rotasi', 'Rotation axis'],
  ['Koordinat P Hasil Rotasi (XYZ)', 'Rotated point P coordinates (XYZ)'],
  ['Titik P', 'Point P'],
  ['Titik P (dalam frame UVW)', 'Point P (in the UVW frame)'],
  ['Frame Bergerak', 'Moving frame'],
  ['Rotasi Komposit (Non-Komutatif)', 'Composite Rotation (Non-Commutative)'],
  ['Rotasi Pertama', 'First rotation'],
  ['Rotasi Kedua', 'Second rotation'],
  ['Hasil A·B', 'Result A·B'],
  ['Hasil B·A', 'Result B·A'],
  ['Selisih Orientasi', 'Orientation difference'],
  [
    'Terbukti: R_AB ≠ R_BA. Urutan rotasi menentukan hasil akhir.',
    'Proven: R_AB ≠ R_BA. The rotation order decides the result.'
  ],
  ['Matriks Homogen & Denavit-Hartenberg', 'Homogeneous Matrix & Denavit-Hartenberg'],
  ['Matriks transformasi T', 'Transformation matrix T'],
  ['Posisi Hasil (titik lokal (1,0,0))', 'Resulting position (local point (1,0,0))'],
  ['Rumus DH', 'DH formula'],
  ['Forward Kinematics N-DoF (3D)', 'N-DoF Forward Kinematics (3D)'],
  ['Jumlah Derajat Kebebasan', 'Degrees of freedom'],
  ['Sudut Sendi, Panjang Link & Sumbu', 'Joint Angles, Link Lengths & Axes'],
  [
    'Rantai transformasi (tiap sendi: putar lalu geser sepanjang link)',
    'Transformation chain (each joint: rotate, then translate along the link)'
  ],
  ['Posisi End-Effector', 'End-effector position'],
  ['Output Numerik', 'Numeric output'],
  ['Link & Joint', 'Link & Joint'],

  // ---------- JAKA FK / IK pages ----------
  ['Tabel Parameter DH', 'DH Parameter Table'],
  ['Sudut Sendi θ', 'Joint Angles θ'],
  ['0 Zone (titik awal)', '0 Zone (initial pose)'],
  ['Belum dikunci', 'Not locked'],
  ['belum dikunci', 'not locked'],
  ['Terkunci', 'Locked'],
  ['Atur pose awal', 'Set the initial pose'],
  ['Kunci 0 Zone', 'Lock 0 Zone'],
  ['Gerakkan robot', 'Move the robot'],
  ['tampilkan bayangan pose siap', 'show the ready pose ghost'],
  ['posisi end-effector (frame base, Z ke atas)', 'end-effector position (base frame, Z up)'],
  ['posisi end-effector, hasil (frame base, Z ke atas)', 'end-effector position, result (base frame, Z up)'],
  ['Persamaan Transformasi DH', 'DH Transformation Equations'],
  ['Bentuk umum transformasi tiap sendi', 'General transformation of each joint'],
  ['Rantai kinematik', 'Kinematic chain'],
  ['Nilai saat ini (live)', 'Current values (live)'],
  ['Jacobian J(θ) (live)', 'Jacobian J(θ) (live)'],
  ['Kolom yang ditampilkan:', 'Column shown:'],
  ['Grafik Time-Series', 'Time-Series Plots'],
  ['Grafik Solver Trajectory', 'Trajectory Solver Plots'],
  ['Ambil balok', 'Pick block'],
  ['Lepas balok', 'Release block'],
  ['meteran', 'rulers'],
  ['Kecepatan', 'Speed'],
  ['ω maks sendi (°/s)', 'max joint ω (°/s)'],
  ['ω maks sendi', 'max joint ω'],
  ['Sumber torsi', 'Torque source'],
  ['Estimasi statis gravitasi', 'Static gravity estimate'],
  ['frame axes', 'frame axes'],
  ['Fase: diam', 'Phase: idle'],
  ['diam', 'idle'],
  ['Persamaan FK', 'FK equations'],
  ['Persamaan Solver IK', 'IK solver equations'],
  ['Target Posisi End-Effector', 'End-effector target position'],
  ['Isi target di atas balok:', 'Put the target above a block:'],
  [
    'animasikan penyelesaian (end-effector bergerak lurus dari posisi sekarang ke target, sendi mengikuti)',
    'animate the solution (the end-effector moves straight from the current pose to the target, joints follow)'
  ],
  ['Masukkan target, lalu klik "Selesaikan IK".', 'Enter a target, then press "Solve IK".'],
  ['Hasil Sudut Sendi θ', 'Resulting joint angles θ'],
  ['Update damped least squares', 'Damped least squares update'],
  ['Jejak Trajectory', 'Trajectory trace'],
  ['Rekam jejak end-effector', 'Record the end-effector trace'],
  ['Profil quintic', 'Quintic profile'],
  [
    'Profil waktu quintic (posisi, kecepatan, dan percepatan awal serta akhir nol) dengan durasi segmen dari batas kecepatan sendi dan kecepatan Cartesian. Nilai u dan s di bawah mengikuti waktu trajectory yang sedang berjalan.',
    'Quintic time profile (zero position, velocity and acceleration change at both ends) with segment durations from the joint and Cartesian speed limits. The u and s values below follow the running trajectory time.'
  ],
  ['Durasi segmen', 'Segment duration'],
  ['Durasi total', 'Total duration'],
  ['Waktu sekarang', 'Current time'],
  ['Segmen', 'Segment'],
  ['v maks Cartesian', 'max Cartesian v'],
  ['Posisi antara dua titik', 'Position between two points'],
  ['Tidak ada peringatan', 'No warning'],
  ['Galat posisi sekarang (target mode IK)', 'Current position error (IK page target)'],
  ['Kecepatan sendi (rad/s)', 'Joint speed (rad/s)'],
  ['Sudut sekarang (derajat)', 'Current angles (degrees)'],
  ['Sudut di luar batas sendi', 'Angle outside the joint limits'],
  ['Solusi ini di luar batas sudut sendi', 'This solution is outside the joint limits'],
  ['Belum ada solusi untuk diterapkan', 'No solution to apply yet'],
  ['Langkah DLS', 'DLS step'],
  ['Posisi aktual', 'Actual position'],
  ['Nilai sekarang', 'Current value'],
  [
    'Kunci 0 Zone dulu: tentukan pose awal robot, lalu tekan Kunci 0 Zone.',
    'Lock the 0 Zone first: set the initial robot pose, then press Lock 0 Zone.'
  ],
  ['posisi end-effector saat ini, 0 Zone belum dikunci', 'current end-effector position, 0 Zone not locked'],
  [
    'Solver aktif: IK 6D per sampel (kotak "animasikan penyelesaian" dicentang)',
    'Active solver: 6D IK per sample ("animate the solution" checked)'
  ],
  ['Solver aktif: IK posisi saja (animasi dimatikan)', 'Active solver: position-only IK (animation off)'],
  [
    'Sudut dalam derajat. Ditampilkan 12 iterasi pertama, tiap 10 iterasi, dan 3 terakhir.',
    'Angles in degrees. Shown: the first 12 iterations, every 10th, and the last 3.'
  ],
  [
    'Tiap joint dianggap mengikuti perintah sudut dengan ideal (tanpa PID dan tanpa dinamika). Kecepatan sendi dihitung dari selisih sudut antar sampel 10 Hz.',
    'Each joint is assumed to follow its angle command ideally (no PID, no dynamics). Joint speed comes from the angle difference between 10 Hz samples.'
  ],

  // ---------- Block diagram ----------
  ['Konfigurasi Blok Diagram', 'Block Diagram Configuration'],
  ['Upside bar', 'Upside bar'],
  ['perhitungan tiap blok, parameter, energi dan torsi', 'per-block calculations, parameters, energy and torque'],
  ['Perhitungan blok', 'Block math'],
  ['Parameter robot', 'Robot parameters'],
  ['Energi & torsi', 'Energy & torque'],
  ['Aliran data', 'Data flow'],
  ['Alur valid.', 'Flow is valid.'],
  ['Robot bisa dijalankan dari alur ini.', 'The robot can run from this flow.'],
  ['Alur tidak valid, robot tidak dijalankan.', 'The flow is not valid, the robot will not run.'],
  ['Balok', 'Block'],
  ['Siap', 'Ready'],
  ['Blok tidak bisa disambung ke dirinya sendiri', 'A block cannot connect to itself'],
  ['tipe tidak cocok', 'type mismatch'],
  ['tidak valid', 'not valid'],
  ['tidak terjawab', 'unanswered'],
  ['Daya dan energi elektrik', 'Electrical power and energy'],
  ['Energi mekanik dan potensial', 'Mechanical and potential energy'],
  ['Gambar: daya elektrik dan energi elektrik kumulatif.', 'Plot: electrical power and cumulative electrical energy.'],
  [
    'Gambar: energi mekanik kumulatif, usaha absolut, perubahan energi potensial, dan energi gesekan.',
    'Plot: cumulative mechanical energy, absolute work, potential energy change and friction energy.'
  ],

  // ---------- Draw ----------
  ['Draw: Sumbu dan Parameter DH', 'Draw: Axes and DH Parameters'],
  ['Axis Draw: mati', 'Axis Draw: off'],
  ['Axis Draw: nyala', 'Axis Draw: on'],
  ['Parameter yang digambar', 'Parameters drawn'],
  ['IK buku', 'Book IK'],
  ['Gabungan', 'Combined'],
  ['Elemen visual DH', 'DH visual elements'],
  ['Elemen visual IK buku', 'Book IK visual elements'],
  ['Elemen adegan 3D', '3D scene elements'],
  ['Garis link (kerangka)', 'Link lines (skeleton)'],
  ['Arah putar positif', 'Positive rotation direction'],
  ['Panjang a', 'Length a'],
  ['Sudut θ', 'Angle θ'],
  ['Titik end-effector', 'End-effector point'],
  ['Sumbu sendi z', 'Joint z axes'],
  ['Simbol revolute', 'Revolute symbol'],
  ['Offset d', 'Offset d'],
  ['Sudut α (twist)', 'Angle α (twist)'],
  ['Label angka', 'Number labels'],
  ['Vektor posisi p', 'Position vector p'],
  ['Vektor n, t, b', 'Vectors n, t, b'],
  ['Titik W dan l₂b', 'Point W and l₂b'],
  ['Proyeksi W, l₁, θ₁', 'Projection W, l₁, θ₁'],
  ['Segitiga a₂, a₃, r', 'Triangle a₂, a₃, r'],
  ['Sudut θ₅ (z₁ ke b)', 'Angle θ₅ (z₁ to b)'],
  ['Frame x, y, z', 'Frames x, y, z'],
  ['Badan robot tembus pandang', 'See-through robot body'],
  ['Garis grid lantai', 'Floor grid lines'],
  ['Angka grid', 'Grid numbers'],
  ['Meteran', 'Rulers'],
  ['Balok payload', 'Payload blocks'],
  ['Lantai', 'Floor'],
  ['Tombol kamera dan legenda', 'Camera buttons and legend'],
  ['Putar kamera otomatis', 'Auto-rotate the camera'],
  ['Fokus kamera', 'Camera focus'],
  ['Seluruh adegan', 'Whole scene'],
  ['Parameter DH', 'DH parameters'],
  ['Tabel DH', 'DH table'],
  ['sendi', 'joint'],
  ['θ (variabel)', 'θ (variable)'],
  ['Sudut sendi θ (nilai DH, absolut)', 'Joint angle θ (DH value, absolute)'],
  ['1. Aturan DH dan matriks transformasi homogen', '1. DH rules and the homogeneous transformation matrix'],
  ['2. Matriks tiap sendi dan T60 (nilai sekarang)', '2. Matrix of each joint and T60 (current values)'],
  ['3. Dari transformasi ke sudut sendi (IK geometri)', '3. From the transformation to joint angles (geometric IK)'],
  [
    '4. Notasi buku (Asada dan Slotine) pada parameter DH ZU5',
    '4. Book notation (Asada and Slotine) on the ZU5 DH parameters'
  ],
  [
    'Tiap sendi punya empat parameter DH. Dari frame i-1 ke frame i dilakukan empat gerakan berurutan, dan tiap gerakan digambar di Axis Draw dengan warna yang sama dengan tabel di atas:',
    'Each joint has four DH parameters. Going from frame i-1 to frame i takes four moves in order, and each move is drawn in Axis Draw with the same colour as the table above:'
  ],
  [
    'putar terhadap sumbu z frame sebelumnya (sumbu sendi),',
    'rotate about the z axis of the previous frame (the joint axis),'
  ],
  ['geser sepanjang sumbu z itu,', 'translate along that z axis,'],
  ['geser sepanjang sumbu x frame baru,', 'translate along the x axis of the new frame,'],
  ['putar terhadap sumbu x frame baru (twist).', 'rotate about the x axis of the new frame (twist).'],
  [
    'Keempat gerakan itu masing-masing punya matriks homogen 4×4 sendiri:',
    'Each of the four moves has its own 4×4 homogeneous matrix:'
  ],
  [
    'Hasil perkaliannya adalah matriks transformasi satu sendi (c = cos, s = sin):',
    'Their product is the transformation matrix of one joint (c = cos, s = sin):'
  ],
  [
    'Blok R (3×3) adalah orientasi frame i dilihat dari frame i-1, dan kolom p adalah posisi originnya. Karena R ortonormal, inversnya cukup memakai transpos:',
    'Block R (3×3) is the orientation of frame i seen from frame i-1, and column p is the position of its origin. Since R is orthonormal, its inverse is just the transpose:'
  ],
  [
    'Di dalam matriks itu hanya θ yang merupakan variabel gerak. Nilai d, a, dan α tidak berubah saat sendi diputar, karena ketiganya mengukur bentuk link, bukan posenya.',
    'Inside that matrix only θ is a motion variable. d, a and α do not change when the joint turns, because they measure the shape of the link, not its pose.'
  ],
  [
    'Rantai enam sendi memberi pose end-effector terhadap base (forward kinematics):',
    'The six-joint chain gives the end-effector pose relative to the base (forward kinematics):'
  ],
  ['Urutan 4 gerakan', 'Order of the 4 moves'],
  ['θ (rotasi z)', 'θ (z rotation)'],
  ['d (translasi z)', 'd (z translation)'],
  ['a (panjang link)', 'a (link length)'],
  ['α (twist x)', 'α (x twist)'],
  ['Sudut α', 'Angle α'],
  ['Sudut β', 'Angle β'],
  ['Sudut α & β', 'Angles α & β'],
  [
    'Target ditulis sebagai matriks homogen. Titik p₅ (origin frame 5) didapat dengan mundur sejauh d₆ sepanjang sumbu alat, karena α₆ = 180° membuat z₅ berlawanan arah dengan z₆.',
    'The target is written as a homogeneous matrix. Point p₅ (origin of frame 5) is found by stepping back d₆ along the tool axis, because α₆ = 180° makes z₅ point opposite to z₆.'
  ],
  ['x₆, y₆, z₆ (kolom 1 sampai 3 dari R)', 'x₆, y₆, z₆ (columns 1 to 3 of R)'],
  ['p₆ (kolom 4 dari T₆⁰)', 'p₆ (column 4 of T₆⁰)'],
  ['origin frame 5 (p₅)', 'origin of frame 5 (p₅)'],
  [
    'Sumbu sendi 2, 3, dan 4 sejajar, jadi p₅ selalu berjarak D = d₂ + d₃ + d₄ dari bidang tegak yang lewat sumbu sendi 1. Ada dua sudut yang memenuhi (bahu kiri atau kanan).',
    'Joint axes 2, 3 and 4 are parallel, so p₅ always lies D = d₂ + d₃ + d₄ from the vertical plane through joint axis 1. Two angles satisfy this (left or right shoulder).'
  ],
  [
    'Substitusi t = tan(θ₁/2) mengubahnya menjadi persamaan kuadrat:',
    'Substituting t = tan(θ₁/2) turns it into a quadratic equation:'
  ],
  [
    'Jarak end-effector dari bidang yang sama berbeda dari D sebesar d₆ cos θ₅.',
    'The end-effector distance from the same plane differs from D by d₆ cos θ₅.'
  ],
  [
    'sin θ₅ = 0: sumbu sendi 4 dan 6 segaris (singular pergelangan), jadi θ₆ tidak tertentu dan dipakai nilai pose sekarang.',
    'sin θ₅ = 0: joint axes 4 and 6 are aligned (wrist singularity), so θ₆ is undetermined and the current pose value is used.'
  ],
  ['Lepas sendi 1, 5, dan 6 dari rantai', 'Remove joints 1, 5 and 6 from the chain'],
  [
    'Tiga matriks yang sudah diketahui dipindah ke ruas kanan. Sisanya adalah lengan planar tiga sendi (2, 3, 4) di frame 1.',
    'The three known matrices move to the right-hand side. What remains is a planar three-joint arm (2, 3, 4) in frame 1.'
  ],
  [
    'Aturan kosinus pada segitiga yang sisinya a₂ dan a₃ (siku ke atas atau ke bawah).',
    'Law of cosines on the triangle with sides a₂ and a₃ (elbow up or down).'
  ],
  ['segitiga planar a₂, a₃ dan θ₃', 'planar triangle a₂, a₃ and θ₃'],
  ['θ₅ dan θ₆ dulu, θ₄ = θ₂₃₄ - θ₂ - θ₃', 'θ₅ and θ₆ first, θ₄ = θ₂₃₄ - θ₂ - θ₃'],
  ['Periksa dengan FK', 'Check with FK'],
  [
    'Sudut hasil dimasukkan lagi ke rantai transformasi. Posisinya harus kembali ke target.',
    'The solved angles go back into the transformation chain. The position must return to the target.'
  ],
  ['solusi', 'solutions'],
  [
    'untuk target ini. Baris yang disorot adalah yang langkahnya ditampilkan di atas (bawaan: paling dekat dengan pose sekarang). Klik baris lain untuk melihat langkahnya.',
    'for this target. The highlighted row is the one whose steps are shown above (default: closest to the current pose). Click another row to see its steps.'
  ],
  ['Buku menulis pose end-effector sebagai', 'The book writes the end-effector pose as'],
  ['orientasi alat; b = arah pendekatan', 'tool orientation; b = approach direction'],
  ['lalu memecah IK menjadi dua: posisi titik pergelangan', 'then splits IK into two: the wrist point position'],
  [
    '(tiga sendi pertama) dan orientasi (tiga sendi terakhir). Kolom kiri adalah simbol buku, kolom tengah padanannya di tabel DH ZU5.',
    '(first three joints) and the orientation (last three joints). The left column is the book symbol, the middle column its ZU5 DH equivalent.'
  ],
  ['Padanan DH ZU5', 'ZU5 DH equivalent'],
  ['Buku', 'Book'],
  ['Mundur dari flange sejauh l₂ sepanjang b untuk mendapat W:', 'Step back from the flange by l₂ along b to get W:'],
  [
    'Komponen W yang tegak lurus bidang lengan selalu sama dengan l₁, berapa pun θ₂, θ₃, θ₄:',
    'The component of W normal to the arm plane always equals l₁, whatever θ₂, θ₃, θ₄:'
  ],
  [
    'Gagasan buku tetap dipakai: tulis ulang persamaan kinematik dengan memindah matriks yang sudah diketahui ke ruas kiri, seperti persamaan (2-55) sampai (2-57):',
    'The idea of the book still applies: rewrite the kinematic equation by moving known matrices to the left-hand side, as in equations (2-55) to (2-57):'
  ],
  [
    'Robot buku (5-R-1-P) punya sendi prismatik d₃ dan pergelangan bola, jadi θ₂ dan d₃ langsung dari W. ZU5 punya tiga sumbu sejajar (2, 3, 4) dan pergelangan tidak bola, jadi θ₅ dan θ₆ dihitung lebih dulu dari b, lalu θ₂, θ₃, θ₄ dari segitiga a₂, a₃ (lihat akordeon 3, langkah 3 sampai 7):',
    'The book robot (5-R-1-P) has a prismatic joint d₃ and a spherical wrist, so θ₂ and d₃ come straight from W. The ZU5 has three parallel axes (2, 3, 4) and no spherical wrist, so θ₅ and θ₆ are found first from b, then θ₂, θ₃, θ₄ from the triangle a₂, a₃ (see accordion 3, steps 3 to 7):'
  ],
  ['Langkah 1, persamaan (2-45).', 'Step 1, equation (2-45).'],
  ['Langkah 2, persamaan (2-48).', 'Step 2, equation (2-48).'],
  ['Langkah 3, persamaan (2-49) sampai (2-52).', 'Step 3, equations (2-49) to (2-52).'],
  ['Langkah 4, yang berbeda dari buku.', 'Step 4, which differs from the book.'],
  ['pergelangan ZU5 bukan bola', 'the ZU5 wrist is not spherical'],
  ['d₃ (prismatik)', 'd₃ (prismatic)'],
  ['Sendi 1', 'Joint 1'],
  ['Sendi 2 dan 4', 'Joints 2 and 4'],
  ['Sendi 3', 'Joint 3'],
  ['Sendi 5', 'Joint 5'],
  ['Sendi 6', 'Joint 6'],
  ['Pose cepat', 'Quick poses'],
  ['dari 0 Zone', 'from 0 Zone'],
  ['posisi sekarang', 'current position'],
  ['z target (m, tinggi)', 'target z (m, height)'],
  ['Kunci lagi supaya parameter DH tidak berubah', 'Lock again so the DH parameters do not change'],
  ['Parameter DH dibuka: d, a, dan α bisa diubah', 'DH parameters unlocked: d, a and α can be edited'],
  ['Cinematic aktif. Tekan Esc untuk keluar.', 'Cinematic on. Press Esc to leave.'],
  [
    'Arah sumbu sendi 2, 3, 4 dilihat dari frame alat hanya bergantung pada θ₅ dan θ₆.',
    'The direction of joint axes 2, 3, 4 seen from the tool frame depends only on θ₅ and θ₆.'
  ],
  [
    'Titik pergelangan terlalu dekat dengan sumbu sendi 1 (ρ lebih kecil dari |D|).',
    'The wrist point is too close to joint axis 1 (ρ smaller than |D|).'
  ],

  // ---------- Start Control ----------
  ['Mode lihat saja.', 'View-only mode.'],
  [
    'Kendali robot butuh aplikasi JAKA Remake (.exe) dengan Python 3 64-bit. Di sini model 3D, FK, IK, persamaan, dan editor program tetap bisa dipakai.',
    'Robot control needs the desktop app (.exe) with 64-bit Python 3. The 3D model, FK, IK, equations and program editor still work here.'
  ],
  ['TCP (FRAME BASE, Z KE ATAS)', 'TCP (BASE FRAME, Z UP)'],
  ['SUDUT SENDI (DERAJAT)', 'JOINT ANGLES (DEGREES)'],
  ['Jog sendi', 'Joint jog'],
  ['Jog kartesian (frame base)', 'Cartesian jog (base frame)'],
  ['Kecepatan dan langkah', 'Speed and step'],
  ['Persamaan live', 'Live equations'],
  [
    'Robot virtual tidak punya data listrik, nilainya 0. Sambungkan ke robot nyata untuk arus, tegangan, suhu, dan torsi.',
    'The virtual robot has no electrical data, values are 0. Connect a real robot for current, voltage, temperature and torque.'
  ],
  ['Isi IP robot dulu', 'Enter the robot IP first'],
  ['Hentikan gerak robot dulu', 'Stop the robot motion first'],
  ['Tidak ada gerak yang berjalan dari aplikasi', 'No motion is running from the app'],
  ['Model vs controller: belum ada data', 'Model vs controller: no data yet'],
  [' (belum tersambung ke robot)', ' (not connected to a robot)'],
  ['Gerak pertama yang aman', 'A safe first motion'],
  ['Gerak lurus menuju target IK', 'Straight motion to the IK target'],
  ['Fokus tabel DH dan FK', 'DH table and FK focus'],
  [
    'Mulai dari nol, dengan ringkasan semua fungsi robot dan model.',
    'Start from scratch, with a summary of every robot and model function.'
  ],
  [
    'Sendi 6 berputar +10 lalu -10 derajat, kecepatan 5 persen. Cocok untuk uji pertama di robot nyata.',
    'Joint 6 turns +10 then -10 degrees at 5 percent speed. Good for a first test on the real robot.'
  ],
  [
    'Cetak tabel DH, matriks tiap sendi, T60, posisi, orientasi, dan det J. Tidak menggerakkan robot.',
    'Print the DH table, every joint matrix, T60, position, orientation and det J. Does not move the robot.'
  ],
  [
    'Hitung sampai 8 solusi untuk satu target x, y, z, tampilkan tabelnya, lalu gerak ke solusi terdekat.',
    'Compute up to 8 solutions for one x, y, z target, show the table, then move to the nearest solution.'
  ],
  [
    'Inti proyek T-17: lintasan sama untuk tiap beban, rekam 10 Hz, hitung energi listrik dan torsi maksimum per siklus.',
    'Payload test: same path for every load, 10 Hz recording, electrical energy and peak torque per cycle.'
  ],

  // ---------- report mode ----------
  ['Konfigurasi: belum disimpan', 'Configuration: not saved'],
  ['Rekaman gerak: belum ada', 'Motion recording: none yet'],
  [
    'Konfigurasi halaman ini belum disimpan. Simpan sekarang lalu buat laporan?',
    'This page configuration is not saved. Save it now and build the report?'
  ],
  [
    'Anda belum mengatur konfigurasi pada Parameter Robot, apakah Anda tetap ingin simpan?',
    'You have not set the Robot Parameters configuration. Save anyway?'
  ],
  ['Simpan dan lanjutkan', 'Save and continue'],
  [
    'Laporan disimpan (belum diunduh). Pilih PDF atau Docx di daftar bar laporan.',
    'Report saved (not downloaded yet). Pick PDF or Docx in the report bar list.'
  ],
  ['Menggambar rumus dan grafik', 'Drawing formulas and plots'],
  [
    'Belum ada rekaman gerak, jadi angka diambil dari pose konfigurasi tersimpan dalam keadaan diam (kecepatan dan daya bernilai nol).',
    'No motion recording yet, so the numbers come from the saved configuration pose at rest (speed and power are zero).'
  ],

  // ---------- Reference: section titles ----------
  ['References: Material and Glossary', 'References: Material and Glossary'],
  ['Rujukan: Materi dan Glosarium', 'References: Material and Glossary'],
  ['A. Materi dasar', 'A. Basics'],
  ['B. Robot JAKA ZU5 dan alur kerja proyek', 'B. The JAKA ZU5 robot and the project workflow'],
  ['B. Robot JAKA ZU5 dan proyek', 'B. The JAKA ZU5 robot and the project'],
  ['C. Glosarium', 'C. Glossary'],
  ['Glosarium', 'Glossary'],
  ['1. Vektor & Ruang 3D', '1. Vectors & 3D Space'],
  ['1. Vektor dan ruang 3D', '1. Vectors and 3D space'],
  ['2. Matriks', '2. Matrices'],
  ['2. Matriks & Operasi Dasar', '2. Matrices & Basic Operations'],
  ['3. Translasi', '3. Translation'],
  ['4. Rotasi', '4. Rotation'],
  ['4. Rotasi & Matriks Rotasi', '4. Rotation & Rotation Matrices'],
  ['5. Matriks homogen', '5. Homogeneous matrix'],
  ['5. Transformasi Geometris (Matriks Homogen 4×4)', '5. Geometric Transformation (4×4 Homogeneous Matrix)'],
  ['6. Konvensi DH', '6. DH convention'],
  ['6. Konvensi Denavit-Hartenberg (DH)', '6. Denavit-Hartenberg (DH) Convention'],
  ['7. Forward Kinematics (FK)', '7. Forward Kinematics (FK)'],
  ['8. Inverse Kinematics (IK)', '8. Inverse Kinematics (IK)'],
  ['2.1 Tabel parameter Denavit-Hartenberg', '2.1 Denavit-Hartenberg parameter table'],
  [
    '2.3.1 IK geometri: dari matriks transformasi ke sudut sendi',
    '2.3.1 Geometric IK: from the transformation matrix to joint angles'
  ],
  ['Cara memakai simulator', 'Using the simulator'],
  ['Ringkasan proyek', 'Project summary'],
  ['Istilah dasar', 'Basic terms'],
  ['Istilah robot dan proyek', 'Robot and project terms'],
  ['Checklist konfirmasi', 'Confirmation checklist'],
  ['Checklist: perlu dikonfirmasi atau dicari', 'Checklist: to confirm or find out'],
  ['Bacaan lanjut:', 'Further reading:'],
  [
    'Klik tautan pada tiap istilah untuk melompat ke penjelasannya.',
    'Click the link of each term to jump to its explanation.'
  ],
  ['Step 1: Blok diagram', 'Step 1: Block diagram'],
  ['Step 1: Blok diagram dan persamaan tiap komponen', 'Step 1: Block diagram and the equations of each component'],
  ['Step 2: Kinematika JAKA', 'Step 2: JAKA kinematics'],
  ['Step 2: Persamaan trajectory, FK, dan IK', 'Step 2: Trajectory, FK and IK equations'],
  ['Step 3 sampai 6', 'Steps 3 to 6'],
  ['Step 3 sampai 6: arahan kerja', 'Steps 3 to 6: work guide'],
  ['Step 3: Simulasi blok diagram di MATLAB/Simulink', 'Step 3: Block diagram simulation in MATLAB/Simulink'],
  ['Step 4: Simulasi visual di SolidWorks', 'Step 4: Visual simulation in SolidWorks'],
  ['Step 5: Robot aktual JAKA', 'Step 5: The real JAKA robot'],
  ['Step 6: Software aplikatif dengan UI sederhana', 'Step 6: Application software with a simple UI'],
  // reference: tables and short labels
  ['Besaran & rumus', 'Quantity & formula'],
  ['Besaran berarah di ruang', 'Directed quantity in space'],
  ['Array 2D bilangan', '2D array of numbers'],
  ['Pergeseran posisi', 'Position shift'],
  ['Pemutaran terhadap sumbu', 'Turning about an axis'],
  ['Gabungan rotasi + translasi', 'Rotation + translation combined'],
  ['Perkalian titik (skalar)', 'Dot product (scalar)'],
  ['Rantai transformasi', 'Transformation chain'],
  [
    'Matriks pemetaan kecepatan sendi ke kecepatan end-effector.',
    'Matrix mapping joint velocities to end-effector velocity.'
  ],
  [
    'Pose ketika Jacobian tidak dapat dibalik sehingga sebagian arah gerak hilang.',
    'A pose where the Jacobian cannot be inverted, so some motion directions are lost.'
  ],
  [
    'Sinkronisasi enam joint dengan polinomial orde lima berkecepatan dan percepatan nol di ujung.',
    'Synchronising six joints with fifth-order polynomials that have zero velocity and acceleration at the ends.'
  ],
  [
    'Kebalikan FK: dari posisi target mencari sudut joint. Pada diagram dosen, namanya tertukar dengan FK.',
    'The inverse of FK: find joint angles from a target position.'
  ],
  [
    'Dari sudut joint θ₁...θ₆ menghitung posisi dan orientasi end-effector (x, y, z).',
    'From joint angles θ₁...θ₆, compute the end-effector position and orientation (x, y, z).'
  ],
  [
    'Faktor pengubah arus motor menjadi torsi; N ikut memuat rasio gearbox bila perlu.',
    'Factor converting motor current to torque; N holds the gearbox ratio when needed.'
  ],
  [
    'Torsi penahan beban akibat gravitasi pada pose tertentu, tanpa efek inersia.',
    'Torque holding the load against gravity at a given pose, without inertia effects.'
  ],
  [
    'Ketidakpastian massa dan pusat massa beban yang memengaruhi torsi gravitasi.',
    'Uncertainty of load mass and centre of mass, which changes gravity torque.'
  ],
  [
    'Urutan gerak mendekati, mengambil, memindahkan, dan melepas benda.',
    'Sequence of approaching, grasping, moving and releasing an object.'
  ],
  [
    'Variabel yang berubah saat robot bergerak. Pada sendi revolute (putar), q sama dengan θ. Ada 6 untuk robot 6-DOF seperti JAKA ZU5.',
    'The variables that change as the robot moves. For a revolute joint, q equals θ. A 6-DOF robot such as the JAKA ZU5 has 6.'
  ],
  [
    'Bila sumbu joint 4, 5, 6 berpotongan, posisi dan orientasi dapat diselesaikan terpisah.',
    'When joint axes 4, 5, 6 intersect, position and orientation can be solved separately.'
  ],
  ['Spherical wrist dan geometric decoupling', 'Spherical wrist and geometric decoupling'],
  ['Payload uncertainty', 'Payload uncertainty'],
  ['Torsi statis gravitasi', 'Static gravity torque'],
  ['Torsi statis penahan gravitasi', 'Static gravity holding torque'],
  ['Torsi dari arus', 'Torque from current'],
  ['Torsi dari arus (konstanta torsi K)', 'Torque from current (torque constant K)'],
  ['Konstanta torsi', 'Torque constant'],
  ['Trajectory ambil dan pindah', 'Pick-and-place trajectory'],
  ['Sudut sendi (joint variable)', 'Joint angle (joint variable)'],
  ['Vektor posisi', 'Position vector'],
  ['Vektor', 'Vector'],
  ['Matriks', 'Matrix'],
  ['Rotasi', 'Rotation'],
  ['Translasi', 'Translation'],
  ['Transformasi Geometris', 'Geometric Transformation'],
  ['Rotasi komposit', 'Composite rotation'],
  ['Rotasi komposit: urutan menentukan hasil', 'Composite rotation: order decides the result'],
  ['Rotasi terhadap sumbu X, Y, Z', 'Rotation about the X, Y, Z axes'],
  ['Translasi sebagai penjumlahan vektor', 'Translation as vector addition'],
  ['Bentuk umum matriks homogen', 'General homogeneous matrix'],
  ['Penurunan matriks transformasi homogen satu sendi', 'Deriving the homogeneous transformation of one joint'],
  ['Empat parameter DH per sendi', 'Four DH parameters per joint'],
  ['Parameter DH per Joint', 'DH Parameters per Joint'],
  ['Perkalian empat matriks (urutan penting!)', 'Product of four matrices (order matters!)'],
  ['Transformasi satu joint dan rantai lengkap', 'One-joint transformation and the full chain'],
  ['Pose target dan titik pergelangan', 'Target pose and wrist point'],
  ['Sendi 1, 5, dan 6', 'Joints 1, 5 and 6'],
  ['Sendi 2, 3, dan 4 (lengan planar tiga sendi)', 'Joints 2, 3 and 4 (planar three-joint arm)'],
  ['Inti numerik IK (damped least squares)', 'Numerical IK core (damped least squares)'],
  ['Jacobian numerik', 'Numerical Jacobian'],
  ['IK geometri', 'Geometric IK'],
  ['Dua urutan yang berbeda', 'Two different orders'],
  ['Perkalian matriks-vektor', 'Matrix-vector product'],
  ['Cross product (hasil vektor)', 'Cross product (vector result)'],
  ['Dot product (hasil skalar)', 'Dot product (scalar result)'],
  ['Operasi vektor penting:', 'Key vector operations:'],
  ['Pergeseran sepanjang zᵢ₋₁', 'Offset along zᵢ₋₁'],
  ['Panjang link (sepanjang xᵢ)', 'Link length (along xᵢ)'],
  ['Sudut twist (kemiringan sumbu z)', 'Twist angle (tilt of the z axis)'],
  ['Rotasi mengelilingi zᵢ₋₁', 'Rotation about zᵢ₋₁'],
  ['Putar θᵢ mengelilingi zᵢ₋₁', 'Rotate θᵢ about zᵢ₋₁'],
  ['Geser dᵢ sepanjang zᵢ₋₁', 'Translate dᵢ along zᵢ₋₁'],
  ['Geser aᵢ sepanjang xᵢ (sumbu baru)', 'Translate aᵢ along xᵢ (new axis)'],
  ['Putar αᵢ mengelilingi xᵢ', 'Rotate αᵢ about xᵢ'],
  [
    'Menggerakkan titik asal sepanjang sumbu putar sendi sebelumnya.',
    'Moves the origin along the previous joint axis.'
  ],
  ['Menggerakkan titik asal sepanjang panjang link.', 'Moves the origin along the link length.'],
  ['Menyamakan arah sumbu x agar sejajar dengan frame berikutnya.', 'Aligns the x axis with the next frame.'],
  [
    'Menyamakan kemiringan sumbu z agar sejajar dengan sumbu putar sendi berikutnya.',
    'Tilts the z axis to match the next joint axis.'
  ],
  [
    'Jarak antar frame diukur sepanjang sumbu putar sendi sebelumnya. Untuk sendi revolute biasanya konstan.',
    'Distance between frames measured along the previous joint axis. Usually constant for a revolute joint.'
  ],
  [
    'Jarak fisik antara sumbu zᵢ₋₁ dan zᵢ. Murni ukuran fisik robot, didapat dari datasheet atau pengukuran.',
    'Physical distance between axes zᵢ₋₁ and zᵢ. A pure robot dimension, from the datasheet or measurement.'
  ],
  [
    'Seberapa miring arah zᵢ dibanding zᵢ₋₁, diukur mengelilingi xᵢ. Biasanya 0°, +90°, atau -90°.',
    'How much zᵢ is tilted from zᵢ₋₁, measured about xᵢ. Usually 0°, +90° or -90°.'
  ],
  [
    'Parameter DH. Untuk sendi revolute, inilah variabel gerak (θᵢ = qᵢ). Diatur lewat slider di kalkulator FK.',
    'DH parameter. For a revolute joint this is the motion variable (θᵢ = qᵢ). Set with the sliders of the FK page.'
  ],
  [
    'θ rotasi terhadap Z (variabel sendi putar), d geser sepanjang Z, a panjang link sepanjang X, α twist terhadap X.',
    'θ rotation about Z (revolute joint variable), d offset along Z, a link length along X, α twist about X.'
  ],
  [
    'Didefinisikan oleh magnitude (panjang) dan arah. Dalam 3D, ditulis sebagai (x, y, z). Operasi: penjumlahan, dot product, cross product.',
    'Defined by magnitude (length) and direction. In 3D it is written as (x, y, z). Operations: addition, dot product, cross product.'
  ],
  [
    'Vektor ini menyatakan "di mana" suatu titik berada relatif terhadap satu frame acuan.',
    'This vector states "where" a point is relative to a reference frame.'
  ],
  [
    'A·B = ‖A‖‖B‖cos θ. Hasilnya skalar. Dipakai untuk mengukur kesegarisan dua vektor dan menghitung sudut.',
    'A·B = ‖A‖‖B‖cos θ. The result is a scalar, used to measure how aligned two vectors are and to find angles.'
  ],
  [
    'Cross product menghasilkan vektor tegak lurus terhadap A dan B, dengan panjang = ‖A‖‖B‖ sin θ.',
    'The cross product gives a vector normal to A and B, with length ‖A‖‖B‖ sin θ.'
  ],
  [
    'Susunan m×n bilangan dalam baris dan kolom. Dalam robotika, matriks 3×3 untuk rotasi, 4×4 untuk transformasi homogen.',
    'An m×n arrangement of numbers in rows and columns. In robotics, 3×3 matrices are rotations and 4×4 are homogeneous transforms.'
  ],
  [
    'Matriks adalah susunan bilangan dalam baris dan kolom. Dalam robotika, matriks digunakan untuk merepresentasikan',
    'A matrix is an arrangement of numbers in rows and columns. In robotics, matrices represent'
  ],
  ['dalam satu operasi perkalian.', 'in a single multiplication.'],
  [
    'Hasilnya adalah vektor baru yang telah ditransformasi oleh matriks M.',
    'The result is a new vector transformed by the matrix M.'
  ],
  [
    'Memindahkan titik tanpa mengubah orientasi. Diwakili vektor perpindahan (dx, dy, dz). Dalam matriks homogen, masuk kolom terakhir.',
    'Moves a point without changing orientation. Represented by a displacement vector (dx, dy, dz). In a homogeneous matrix it is the last column.'
  ],
  [
    'adalah pergeseran posisi tanpa mengubah orientasi. Dalam ruang 3D, translasi didefinisikan oleh vektor perpindahan (dx, dy, dz).',
    'is a change of position without a change of orientation. In 3D space a translation is defined by a displacement vector (dx, dy, dz).'
  ],
  [
    'Mengubah orientasi tanpa mengubah posisi origin. Matriks rotasi 3×3 bersifat ortogonal: R',
    'Changes orientation without moving the origin. A 3×3 rotation matrix is orthogonal: R'
  ],
  [
    'Rotasi murni di sekitar satu sumbu direpresentasikan matriks rotasi 3×3. Sifat penting: R',
    'A pure rotation about one axis is a 3×3 rotation matrix. Key property: R'
  ],
  ['(ortogonal) dan det(R) = 1.', '(orthogonal) and det(R) = 1.'],
  [
    'Dua rotasi berturut-turut digabung dengan perkalian matriks. Untuk rotasi terhadap',
    'Two successive rotations combine by matrix multiplication. For rotations about the'
  ],
  [
    '(sumbu dunia), rotasi yang dilakukan belakangan dikalikan dari kiri; untuk rotasi terhadap',
    '(world axes), the later rotation multiplies from the left; for rotations about the'
  ],
  ['(sumbu lokal), dikalikan dari kanan.', '(local axes), it multiplies from the right.'],
  ['frame tetap', 'fixed frame'],
  ['frame lokal', 'local frame'],
  ['frame yang sedang bergerak', 'moving frame'],
  [
    'Perkalian matriks tidak komutatif. Keduanya sama hanya pada kasus khusus, misalnya kedua rotasi terhadap sumbu yang sama atau salah satu sudut bernilai nol. Itu sebabnya urutan empat gerakan DH tidak boleh ditukar.',
    'Matrix multiplication is not commutative. Both orders agree only in special cases, such as two rotations about the same axis or one angle being zero. That is why the four DH moves must not be reordered.'
  ],
  [
    'Operasi gabungan yang mengubah posisi dan orientasi sekaligus. Dikemas dalam matriks homogen 4×4.',
    'A combined operation that changes position and orientation at once, packed into a 4×4 homogeneous matrix.'
  ],
  [
    'Translasi murni tidak bisa direpresentasikan oleh perkalian matriks 3×3 biasa, sehingga kita perlu matriks homogen 4×4.',
    'A pure translation cannot be a plain 3×3 matrix product, so a 4×4 homogeneous matrix is needed.'
  ],
  ['Supaya rotasi', 'So that rotation'],
  [
    'translasi bisa digabung jadi satu perkalian matriks, kita "membungkus" keduanya ke dalam matriks 4×4:',
    'translation can combine into one matrix product, both are "wrapped" into a 4×4 matrix:'
  ],
  [
    'R = bagian rotasi (arah), p = bagian translasi (posisi). Baris terakhir [0 0 0 1] menjaga konsistensi perkalian matriks.',
    'R = rotation part (direction), p = translation part (position). The last row [0 0 0 1] keeps the matrix product consistent.'
  ],
  [
    'c dan s adalah singkatan cos dan sin. Blok R (3×3) adalah orientasi, kolom p (3×1) adalah posisi. Invers matriks homogen tidak perlu dihitung dengan cara umum: cukup transpos R.',
    'c and s stand for cos and sin. Block R (3×3) is the orientation, column p (3×1) the position. The inverse of a homogeneous matrix needs no general method: just transpose R.'
  ],
  [
    'DH adalah resep standar untuk berpindah dari frame sendi (i-1) ke frame sendi (i) menggunakan',
    'DH is the standard recipe for going from joint frame (i-1) to joint frame (i) using'
  ],
  ['4 gerakan berurutan', '4 moves in order'],
  [
    '(konvensi DH standar, sama dengan tabel 2.1). Dari frame i-1 ke frame i dilakukan empat gerakan berurutan: putar θᵢ terhadap sumbu Zᵢ₋₁, geser dᵢ sepanjang Zᵢ₋₁, geser aᵢ sepanjang Xᵢ, lalu putar αᵢ terhadap Xᵢ. Hanya θᵢ yang berubah saat sendi putar bergerak; dᵢ, aᵢ, dan αᵢ adalah ukuran bentuk robot, jadi nilainya tetap untuk pose apa pun.',
    '(standard DH convention, same as table 2.1). From frame i-1 to frame i there are four moves in order: rotate θᵢ about Zᵢ₋₁, translate dᵢ along Zᵢ₋₁, translate aᵢ along Xᵢ, then rotate αᵢ about Xᵢ. Only θᵢ changes when a revolute joint moves; dᵢ, aᵢ and αᵢ describe the robot shape, so they stay fixed for any pose.'
  ],
  [
    'Aturan: sumbu Zᵢ searah sumbu rotasi joint i+1; origin di titik potong garis normal Zᵢ₋₁ dan Zᵢ; sumbu Xᵢ searah garis normal tersebut. Nilai di bawah adalah nilai aktif simulator (satuan meter dan derajat). Nilai awalnya diturunkan dari geometri file STEP resmi JAKA ZU5 pada pose nol; nol dan arah putar sendi mengikuti pose STEP, belum tentu sama dengan konvensi controller. Ubah lewat JAKA Simulation, mode Blok Diagram, upside bar tab Parameter robot.',
    'Rules: axis Zᵢ points along the rotation axis of joint i+1; the origin is where the common normal of Zᵢ₋₁ and Zᵢ meets Zᵢ; Xᵢ points along that normal. The values below are the active simulator values (metres and degrees). For the JAKA ZU5 they were derived from the official STEP file at the zero pose; joint zeros and directions follow the STEP pose and may differ from the controller convention. Edit them in Robot Arm Simulation, Block Diagram page, upside bar, Robot parameters tab.'
  ],
  ['Setelah matriks DH tiap sendi didapat, FK tinggal', 'Once each joint DH matrix is known, FK is just'],
  ['mengalikan berurutan', 'multiplying them in order'],
  ['dari base ke end-effector:', 'from the base to the end-effector:'],
  [
    'Kolom terakhir T(0→6) baris 1-3 = posisi (x,y,z) end-effector. Bagian 3×3 kiri-atas = orientasi.',
    'The last column of T(0→6), rows 1-3 = end-effector position (x,y,z). The upper-left 3×3 block = orientation.'
  ],
  [
    'Kolom translasi T₆⁰ adalah posisi x, y, z end-effector. FK dihitung langsung dari sudut, jadi slider sudut di mode FK boleh menghasilkan pose yang tidak mungkin secara fisik (menembus lantai atau tabrakan). Indikator pose di mode FK dan IK memberi peringatan kasar untuk itu.',
    'The translation column of T₆⁰ is the end-effector x, y, z position. FK comes straight from the angles, so the FK sliders can produce physically impossible poses (through the floor or colliding). The pose indicator on the FK and IK pages gives a rough warning.'
  ],
  [
    'IK membalik arah FK: input posisi target, cari sudut sendi. Karena hubungan θ → posisi non-linear, perlu pendekatan numerik:',
    'IK reverses FK: given a target position, find joint angles. Since θ → position is non-linear, a numerical approach is needed:'
  ],
  [
    'Untuk 6-DOF dengan spherical wrist (sumbu joint 4, 5, 6 berpotongan di satu titik) dipakai',
    'For a 6-DOF arm with a spherical wrist (joint axes 4, 5, 6 meet at one point) one uses'
  ],
  ['geometric decoupling', 'geometric decoupling'],
  [
    ': posisi diselesaikan oleh joint 1 sampai 3 (mencari wrist center) dan orientasi oleh joint 4 sampai 6. Jika bukan spherical wrist, dipakai metode numerik lewat Jacobian. Simulator memakai metode numerik damped least squares:',
    ': position is solved by joints 1 to 3 (finding the wrist centre) and orientation by joints 4 to 6. Without a spherical wrist, a numerical method through the Jacobian is used. The simulator uses damped least squares:'
  ],
  [
    'Langkah per iterasi (Jacobian beda hingga, Δθ = 0.2°, langkah dibatasi 30° per sendi)',
    'Step per iteration (finite-difference Jacobian, Δθ = 0.2°, step limited to 30° per joint)'
  ],
  [
    'Untuk trajectory pick and place dipakai IK 6D: galat posisi flange digabung galat arah sumbu alat (harus menghadap ke bawah), yaw dibiarkan bebas. Solver mencoba banyak titik awal dan memakai hasil sampel sebelumnya sebagai tebakan awal untuk sampel berikutnya.',
    'The pick-and-place trajectory uses 6D IK: the flange position error is combined with the tool axis direction error (it must face down), yaw is free. The solver tries many starting points and seeds each sample with the previous result.'
  ],
  [
    'Arah kebalikan dari FK: pose target end-effector diketahui, yang dicari sudut tiap sendi. Karena sumbu sendi 2, 3, dan 4 JAKA ZU5 sejajar, sudutnya bisa diturunkan langsung dari matriks transformasi, tanpa iterasi. Hasilnya sampai 8 kombinasi sudut untuk satu pose.',
    'The reverse of FK: the end-effector target pose is known and the joint angles are wanted. Since JAKA ZU5 joint axes 2, 3 and 4 are parallel, the angles follow directly from the transformation matrix, without iteration. One pose gives up to 8 angle sets.'
  ],
  [
    'FK mengalikan keenam matriks untuk mendapat pose end-effector. IK membalik arahnya: pose target diketahui, lalu persamaan matriks itu dibongkar untuk mendapat sudutnya. Pada JAKA ZU5 sumbu sendi 2, 3, dan 4 sejajar (α₂ = α₃ = 0), sehingga pembongkaran bisa dilakukan dengan geometri dan menghasilkan rumus tertutup.',
    'FK multiplies the six matrices to get the end-effector pose. IK goes the other way: the target pose is known and the matrix equation is unpacked to find the angles. On the JAKA ZU5 joint axes 2, 3 and 4 are parallel (α₂ = α₃ = 0), so it can be unpacked geometrically into closed-form formulas.'
  ],
  [
    'Karena α₆ = 180°, sumbu z₅ berlawanan arah dengan z₆. Frame 6 berada sejauh d₆ dari frame 5 sepanjang z₅, jadi p₅ = p₆ - d₆ z₅ = p₆ + d₆ z₆.',
    'Since α₆ = 180°, axis z₅ points opposite to z₆. Frame 6 lies d₆ from frame 5 along z₅, so p₅ = p₆ - d₆ z₅ = p₆ + d₆ z₆.'
  ],
  [
    'Vektor (sin θ₁, -cos θ₁, 0) adalah arah sumbu sendi 2, 3, dan 4 di frame base. Titik p₅ selalu berjarak D dari bidang tegak yang memuat sumbu sendi 1 dan tegak lurus arah itu, dan dari situ θ₁ didapat. Bila sin θ₅ = 0 (sumbu sendi 4 dan 6 segaris), θ₆ tidak tertentu: itu pose singular pergelangan.',
    'Vector (sin θ₁, -cos θ₁, 0) is the direction of joint axes 2, 3 and 4 in the base frame. Point p₅ always lies D from the vertical plane through joint axis 1 normal to that direction, which gives θ₁. When sin θ₅ = 0 (joint axes 4 and 6 aligned), θ₆ is undetermined: a wrist singularity.'
  ],
  [
    'x dan y adalah dua komponen pertama kolom posisi T₄¹, r₁₁ dan r₂₁ adalah dua elemen pertama kolom pertama rotasinya. Rumus cos θ₃ adalah aturan kosinus pada segitiga yang sisinya a₂ dan a₃. Dua pilihan θ₁, dua pilihan θ₅, dan dua pilihan θ₃ memberi sampai 2 × 2 × 2 = 8 solusi untuk satu pose target.',
    'x and y are the first two entries of the position column of T₄¹; r₁₁ and r₂₁ are the first two entries of its first rotation column. The cos θ₃ formula is the law of cosines on the triangle with sides a₂ and a₃. Two choices of θ₁, two of θ₅ and two of θ₃ give up to 2 × 2 × 2 = 8 solutions for one target pose.'
  ],
  [
    'Rumus tertutup ini hanya berlaku untuk struktur DH bawaan (α = 90°, 0°, 0°, 90°, 90°, 180° dan a₁ = a₄ = a₅ = a₆ = 0). Bila tabel DH diubah di luar pola itu, pakai IK numerik di menu IK. Menu Draw selalu memeriksa hasilnya dengan FK dan menampilkan galatnya.',
    'These closed-form formulas only hold for the ZU5 DH structure (α = 90°, 0°, 0°, 90°, 90°, 180° and a₁ = a₄ = a₅ = a₆ = 0). For other DH tables use the numerical IK on the IK page. The Draw page always checks the result with FK and shows the error.'
  ],
  [
    'J (Jacobian) menyatakan seberapa besar posisi end-effector berubah untuk perubahan kecil tiap sudut.',
    'J (Jacobian) tells how much the end-effector position changes for a small change of each angle.'
  ],
  [
    'Jacobian menghubungkan kecepatan sendi dengan kecepatan Cartesian end-effector. Tab 07 menampilkan J(θ) 6x6 beserta perhitungan tiap kolomnya secara live, dan bagian linearnya sudah diverifikasi terhadap turunan numerik FK.',
    'The Jacobian links joint velocities to the Cartesian end-effector velocity. The FK page shows the 6x6 J(θ) with the live calculation of each column, and its linear part is verified against the numerical derivative of FK.'
  ],
  [
    'Pada pose singular, determinan Jacobian mendekati nol sehingga J tidak dapat dibalik: sebagian arah gerak end-effector tidak bisa dihasilkan, dan solusi IK menuntut kecepatan sendi yang sangat besar. Contoh: lengan lurus penuh (pose nol simulator) berada di singularitas siku. Damped least squares meredam masalah ini tetapi mengorbankan ketelitian; sebutkan ini sebagai limitasi metode di laporan.',
    'At a singular pose the Jacobian determinant approaches zero and J cannot be inverted: some end-effector directions cannot be produced, and IK demands very large joint speeds. Example: the fully stretched arm (simulator zero pose) is at an elbow singularity. Damped least squares softens this at the cost of accuracy.'
  ],
  [
    'Agar keenam joint tiba bersamaan, durasi dipilih dari joint yang paling lambat, lalu tiap joint memakai polinomial orde lima (quintic). Catatan: bentuk',
    'So that all six joints arrive together, the duration comes from the slowest joint, and each joint uses a fifth-order (quintic) polynomial. Note: the form'
  ],
  [
    'di Referensi Teknis hanya berlaku untuk profil kecepatan konstan; dengan quintic, kecepatan puncaknya 1,875 kali kecepatan rata-rata, sehingga durasi harus dikali 1,875 agar batas kecepatan sendi tidak terlampaui (lihat penurunan di bawah).',
    'only holds for a constant-velocity profile; with a quintic the peak speed is 1.875 times the average, so the duration is multiplied by 1.875 to keep within the joint speed limit (see the derivation below).'
  ],
  ['Enam koefisien ditentukan oleh enam kondisi:', 'Six coefficients come from six conditions:'],
  ['Kondisi batas', 'Boundary conditions'],
  ['Normalisasi waktu', 'Time normalisation'],
  ['Menyelesaikan tiga koefisien sisa', 'Solving the three remaining coefficients'],
  ['Tiga kondisi di', 'Three conditions at'],
  [', tiga kondisi awal memberi', ', the three initial conditions give'],
  ['menghasilkan sistem linear untuk', 'give a linear system for'],
  ['dengan solusi berikut.', 'with the following solution.'],
  ['Turunan pertama bernilai maksimum di', 'The first derivative peaks at'],
  ['Kecepatan puncak', 'Peak speed'],
  [
    'untuk tiap joint. Alternatif lain adalah profil kecepatan trapezoidal.',
    'for each joint. An alternative is a trapezoidal velocity profile.'
  ],
  ['Semua yang kita hitung pada akhirnya adalah', 'Everything we compute ends up as a'],
  ['posisi titik dalam ruang 3D', 'point position in 3D space'],
  [
    ', yang direpresentasikan sebagai vektor kolom (x, y, z). End-effector robot adalah satu titik; setiap sendi juga punya "titik asal" (origin) dan tiga arah sumbu miliknya sendiri, yang disebut',
    ', represented as a column vector (x, y, z). The robot end-effector is one point; every joint also has its own origin and three axis directions, called a'
  ],
  ['. Karena itu simulator memakai', '. That is why the simulator uses'],
  ['Bagian ini mendampingi menu', 'This section goes with the'],
  [
    'di JAKA Simulation. Di sana tiap parameter DH digambar langsung pada robot (Axis Draw), dan angka pada langkah di bawah dihitung untuk target yang kamu isi.',
    'page of Robot Arm Simulation. There every DH parameter is drawn on the robot (Axis Draw), and the numbers in the steps below are computed for the target you enter.'
  ],
  ['Dari FK ke IK.', 'From FK to IK.'],
  [
    'Simulator ini adalah alat bantu belajar dan presentasi, bukan pengganti simulasi MATLAB/Simulink dan SolidWorks yang menjadi deliverable resmi. Model dinamika robot (M, C, G) tidak termasuk scope proyek, jadi simulator tidak membuat klaim stabilitas dan hanya menampilkan peringatan indikatif.',
    'This simulator is a learning and presentation tool. It has no robot dynamics model (M, C, G), so it makes no stability claims and only shows indicative warnings.'
  ],
  ['Dashboard:', 'Dashboard:'],
  ['Settings:', 'Settings:'],
  ['Rujukan:', 'References:'],
  ['JAKA Simulation, mode FK:', 'Robot Arm Simulation, FK page:'],
  ['JAKA Simulation, mode IK:', 'Robot Arm Simulation, IK page:'],
  ['JAKA Simulation, mode Blok Diagram:', 'Robot Arm Simulation, Block Diagram page:'],
  ['Balok 1/3/5 kg:', '1/3/5 kg blocks:'],
  [
    'layar pembuka dengan empat menu: Vector Simulation, JAKA Simulation, Tutorial, dan Settings.',
    'the opening screen with the main menus.'
  ],
  [
    'bahasa, tema terang/gelap, Aktifkan Rujukan (tombol ke halaman ini), Mode Pengamat (tampilan tanpa rumus).',
    'language, light/dark theme, Enable References (button to this page), Observer Mode (view without formulas).'
  ],
  [
    'tombol di halaman simulasi melompat ke bagian materi yang sesuai; tombol "Kembali ke halaman" mengembalikan ke posisi semula.',
    'the button on a simulation page jumps to the matching material; the back button returns to where you were.'
  ],
  [
    'geser sudut sendi, lihat posisi end-effector, matriks DH, Jacobian, torsi, dan energi live. Bar di bawah kanvas menjalankan trajectory pick and place.',
    'move joint angles and see the end-effector position, DH matrices, Jacobian, torque and energy live. The bar under the canvas runs a pick-and-place trajectory.'
  ],
  [
    'masukkan target x, y, z (meter) lalu selesaikan IK; penyelesaian dianimasikan dari pose sekarang ke target. Bar trajectory yang sama juga tersedia.',
    'enter a target x, y, z (metres) and solve IK; the solution is animated from the current pose to the target. The same trajectory bar is available.'
  ],
  [
    'alur sistem, parameter, dan rumus tiap blok secara live.',
    'system flow, parameters and live formulas of each block.'
  ],
  [
    'klik balok di kanvas untuk memasangnya di end-effector; klik lagi untuk melepas.',
    'click a block in the canvas to attach it to the end-effector; click again to release it.'
  ],
  ['lihat cara memakai', 'see how to use'],
  ['lihat penjelasan', 'see the explanation'],
  ['lihat tabel DH', 'see the DH table'],
  ['konsep dasar', 'basic concept'],
  ['catatan penamaan', 'naming note'],
  ['Catatan', 'Note'],
  ['Keterangan', 'Description'],
  ['Persamaan', 'Equation'],
  ['Rumus', 'Formula'],
  ['Jenis', 'Type'],
  ['Blok', 'Block'],
  ['Input → output', 'Input → output'],
  ['input', 'input'],
  ['hasil', 'result'],
  ['hasil / input', 'result / input'],
  ['operasi', 'operation'],
  ['operasi vektor', 'vector operation'],
  ['transformasi', 'transformation'],
  ['translasi', 'translation'],
  ['rotasi', 'rotation'],
  ['tetap', 'fixed'],
  ['biasanya tetap', 'usually fixed'],
  ['berubah-ubah', 'variable'],
  ['tidak', 'no'],
  ['tidak ada', 'none'],
  ['tidak (langsung ke solusi)', 'no (straight to the solution)'],
  ['dan', 'and'],
  ['Dengan', 'With'],
  ['Judul:', 'Title:'],
  ['Joint', 'Joint'],
  ['joint', 'joint'],
  ['link / payload', 'link / payload'],
  ['alat menghadap ke bawah', 'tool facing down'],
  ['sama dengan arah alat pose sekarang', 'same as the current tool direction'],
  ['Arah alat pada target', 'Tool direction at the target'],
  ['x target (m)', 'target x (m)'],
  ['y target (m)', 'target y (m)'],
  ['z target (m)', 'target z (m)'],
  ['waist, rotasi pada sumbu Z vertikal', 'waist, rotation about the vertical Z axis'],
  ['bahu, sejajar joint 3 dan 4', 'shoulder, parallel to joints 3 and 4'],
  ['siku, sejajar joint 2 dan 4', 'elbow, parallel to joints 2 and 4'],
  ['wrist 1, sejajar joint 2 dan 3', 'wrist 1, parallel to joints 2 and 3'],
  ['wrist 2, tegak lurus joint 4', 'wrist 2, normal to joint 4'],
  ['wrist 3, flange (titik alat)', 'wrist 3, flange (tool point)'],
  ['(h dari bidang base)', '(h from the base plane)'],
  ['Bukan parameter DH, melainkan', 'Not a DH parameter but'],
  ['dari FK (posisi end-effector) atau', 'from FK (end-effector position) or'],
  ['dari IK (target). Selalu relatif terhadap frame acuan.', 'from IK (target). Always relative to a reference frame.'],
  ['Koordinat posisi', 'Position coordinates'],
  ['posisi p', 'position p'],
  // energy, torque, configuration
  ['Energi dan torsi', 'Energy and torque'],
  ['Analisis energi dan torsi', 'Energy and torque analysis'],
  ['Torsi & Energi (τ = K·i)', 'Torque & Energy (τ = K·i)'],
  ['Konfigurasi Robot', 'Robot Configuration'],
  [
    'Parameter di bawah ini mendefinisikan geometri (DH, satuan meter & derajat), massa, dan payload robot yang dipakai di seluruh tab kalkulator FK/IK. Nilai DH awal diturunkan dari geometri file STEP resmi JAKA ZU5 pada pose nol. Mesh 3D memakai frame yang sama, jadi mengubah DH mengubah kinematika (FK/IK) tetapi',
    'The parameters below define the robot geometry (DH, metres & degrees), mass and payload used on every FK/IK page. The initial DH values come from the active model. The 3D mesh uses the same frames, so changing DH changes the kinematics (FK/IK) but does not'
  ],
  ['menggeser bentuk mesh.', 'move the mesh shape.'],
  [
    'Perubahan di tab ini otomatis diterapkan ke mode FK dan IK, termasuk rentang slider sudut sendi dan hasil forward/inverse kinematics.',
    'Changes here apply to the FK and IK pages at once, including joint slider ranges and the forward/inverse kinematics results.'
  ],
  ['Pilih preset', 'Choose a preset'],
  ['Preset Tersimpan (localStorage)', 'Saved presets (localStorage)'],
  ['Massa & Payload', 'Mass & Payload'],
  ['Massa total robot (kg)', 'Total robot mass (kg)'],
  ['Massa link adalah estimasi dari volume mesh', 'Link masses are estimated from the mesh volume'],
  ['Payload aktif', 'Active payload'],
  ['Payload custom (kg)', 'Custom payload (kg)'],
  ['Tanpa beban (0 kg)', 'No load (0 kg)'],
  ['Custom…', 'Custom…'],
  ['Parameter tambahan (placeholder)', 'Extra parameters (placeholder)'],
  ['Tegangan bus V (V)', 'Bus voltage V (V)'],
  ['Tegangan bus V masih placeholder', 'Bus voltage V is still a placeholder'],
  ['massa link (kg)', 'link mass (kg)'],
  ['Dashboard Energi & Torsi | Payload aktif:', 'Energy & Torque Dashboard | Active payload:'],
  ['Akumulasi', 'Accumulated'],
  ['Aliran data real-time', 'Real-time data flow'],
  [
    'Baris baru tiap 0,25 detik selama robot bergerak (terbaru di atas). Centang kolom yang ingin ditampilkan.',
    'A new row every 0.25 s while the robot moves (newest on top). Tick the columns to show.'
  ],
  ['Energi kumulatif vs waktu (per jenis)', 'Cumulative energy vs time (by type)'],
  ['Torsi τ semua joint vs waktu', 'Torque τ of every joint vs time'],
  ['Rincian jenis energi', 'Energy types in detail'],
  ['Ringkasan per siklus', 'Per-cycle summary'],
  ['Jenis energi', 'Energy type'],
  ['Jenis energi yang dihitung dashboard', 'Energy types computed by the dashboard'],
  [
    'Mengikuti penjelasan dosen (elektrik, mekanik, potensial, dan energi yang melibatkan gaya lawan), dashboard menghitung hanya jenis yang punya rumus valid dan parameter yang jelas:',
    'The dashboard computes only the energy types (electrical, mechanical, potential, friction) that have a valid formula and clear parameters:'
  ],
  ['Elektrik', 'Electrical'],
  ['Mekanik', 'Mechanical'],
  ['Mekanik (absolut)', 'Mechanical (absolute)'],
  ['Mekanik (usaha absolut)', 'Mechanical (absolute work)'],
  ['Potensial', 'Potential'],
  ['Gaya lawan (gesekan)', 'Opposing force (friction)'],
  ['Kinetik / inersia', 'Kinetic / inertia'],
  ['Energi kumulatif E', 'Cumulative energy E'],
  ['Bertanda; pada siklus tertutup mendekati nol', 'Signed; close to zero on a closed cycle'],
  ['Usaha total tanpa saling meniadakan', 'Total work without cancelling out'],
  ['Koefisien default 0 (belum ada data)', 'Default coefficient 0 (no data yet)'],
  ['butuh model inersia M(q)', 'needs the inertia model M(q)'],
  ['butuh model inersia M(q); di luar scope proyek saat ini', 'needs the inertia model M(q); out of scope for now'],
  ['Di luar scope, belum tersedia', 'Out of scope, not available'],
  ['dibaca dari driver', 'read from the driver'],
  ['↳ rincian potensial', '↳ potential in detail'],
  ['dt (tidak saling meniadakan)', 'dt (no cancelling out)'],
  ['Arus motor i', 'Motor current i'],
  ['Asumsi tracking ideal (tanpa PID dan dinamika)', 'Ideal tracking assumption (no PID, no dynamics)'],
  ['Ditentukan profil lintasan (Step 2.5)', 'Set by the trajectory profile'],
  ['Eksekusi 6 joint independen', 'Six independent joints'],
  ['Eksekusi joint', 'Joint execution'],
  ['jalur terpisah, tidak memengaruhi gerakan', 'separate path, does not affect motion'],
  ['arus per joint → τ per joint', 'current per joint → τ per joint'],
  ['motor, encoder, arus', 'motor, encoder, current'],
  ['Ketidakpastian payload', 'Payload uncertainty'],
  [
    'K adalah konstanta torsi (N·m/A), N rasio gearbox, i arus (A). Jika K sudah dihitung di sisi sendi, isi N dengan 1. Nilai K per joint dari datasheet servo JAKA masih perlu dicari, termasuk apakah sudah memuat rasio gear.',
    'K is the torque constant (N·m/A), N the gearbox ratio, i the current (A). If K is already on the joint side, set N to 1. Per-joint K values from the servo datasheet are still to be found.'
  ],
  ['Torsi sendi τᵢ = Kᵢ·Nᵢ·iᵢ (live)', 'Joint torque τᵢ = Kᵢ·Nᵢ·iᵢ (live)'],
  [
    'Ini hanya statika penahan beban (tanpa inersia dan Coriolis), bukan model dinamika penuh. Dipakai agar pengaruh payload terlihat selama animasi trajectory. Kerja gravitasi sepanjang lintasan sama dengan perubahan energi potensial, dan simulator memverifikasinya. Perlu dikonfirmasi ke dosen.',
    'This is load-holding statics only (no inertia, no Coriolis), not a full dynamics model. It makes the payload effect visible during trajectory playback. Gravity work along the path equals the potential energy change, and the simulator checks this.'
  ],
  [
    'Payload uncertainty adalah ketidakpastian massa dan pusat massa beban yang dibawa end-effector; nilai yang keliru mengubah torsi gravitasi tiap joint. Proyek memakai payload 1, 3, dan 5 kg sebagai label skenario, dan simulator menampilkannya sebagai balok yang dapat dipasang di end-effector. Balok tidak mengubah kinematika (posisi dan sudut), tetapi menambah torsi statis gravitasi dan energi potensial.',
    'Payload uncertainty is the uncertainty of the mass and centre of mass carried by the end-effector; a wrong value changes the gravity torque of every joint. The simulator shows 1, 3 and 5 kg blocks that can be attached to the end-effector. Blocks do not change the kinematics (positions and angles) but add static gravity torque and potential energy.'
  ],
  [
    'Daya dan energi dari torsi dan kecepatan sendi, diintegrasi trapesium tiap 100 ms. Daya elektrik memakai tegangan bus V (placeholder). Tidak ada model dinamika di balik angka ini.',
    'Power and energy from joint torque and speed, trapezoidal integration every 100 ms. Electrical power uses the bus voltage V (placeholder). There is no dynamics model behind these numbers.'
  ],
  [
    'Torsi sisi keluaran gearbox dari arus. K adalah konstanta torsi motor, N rasio gearbox. Nilai default K dan N adalah placeholder sampai data resmi JAKA ada. Ubah di dashboard.',
    'Gearbox output torque from current. K is the motor torque constant, N the gearbox ratio. Default K and N are placeholders until official data is available. Edit them in the dashboard.'
  ],
  ['1. Bentuk umum (sendi putar / revolute)', '1. General form (revolute joint)'],
  ['1. Bentuk umum torsi sendi', '1. General form of joint torque'],
  [
    '1. Bentuk umum: torsi statis penahan gravitasi (bukan dinamika penuh)',
    '1. General form: static gravity holding torque (not full dynamics)'
  ],
  ['2. Substitusi nilai dan hasil', '2. Substituted values and result'],
  [
    '2. Substitusi nilai (turunan numerik U terhadap q) dan arus estimasi',
    '2. Substituted values (numerical derivative of U with respect to q) and estimated current'
  ],
  ['3. Hasil: J(θ) lengkap dan determinannya', '3. Result: the full J(θ) and its determinant'],
  ['3. Kecepatan sendi (beda hingga tiap langkah waktu)', '3. Joint speed (finite difference per time step)'],
  ['4. Substitusi kecepatan (Δθ dalam rad, Δt dalam s)', '4. Substituted speeds (Δθ in rad, Δt in s)'],
  ['5. Daya mekanik sendi: bentuk umum', '5. Mechanical joint power: general form'],
  ['6. Substitusi daya', '6. Substituted power'],
  ['7. Energi kumulatif (aturan trapesium): bentuk umum', '7. Cumulative energy (trapezoidal rule): general form'],
  ['8. Substitusi energi', '8. Substituted energy'],
  ['Error posisi', 'Position error'],
  [
    'Error posisi: substitusi (frame base, Z ke atas, meter)',
    'Position error: substituted values (base frame, Z up, metres)'
  ],
  ['Matriks saat ini (live)', 'Current matrix (live)'],
  ['Substitusi nilai (live)', 'Substituted values (live)'],
  ['Trajectory ambil dan pindah', 'Pick-and-place trajectory'],
  ['Trajectory generator', 'Trajectory generator'],
  // project-specific reference text
  [
    'Catatan penamaan: pada gambar diagram dosen, istilah "Forward" dan "Invers" tertukar dibanding definisi baku (Craig, Spong, Siciliano). Blok x,y,z → θ adalah',
    'Naming note: in some diagrams "Forward" and "Inverse" are swapped compared to the standard definition (Craig, Spong, Siciliano). The block x,y,z → θ is'
  ],
  [', blok θ → x,y,z adalah', ', the block θ → x,y,z is'],
  [
    '. Laporan memakai istilah baku, tetapi preferensi dosen tetap perlu ditanyakan.',
    '. Reports use the standard terms.'
  ],
  [
    'Implementasi pengukuran konsumsi energi dan torsi motor pada robotic manipulator JAKA ZU5 (6-DOF) dengan variasi payload 1, 3, dan 5 kg.',
    'Measuring energy consumption and motor torque of the JAKA ZU5 (6-DOF) manipulator with 1, 3 and 5 kg payloads.'
  ],
  ['Robot fisik yang dipakai: JAKA ZU5 atau ZU7 (charter masih campur).', 'Physical robot: JAKA ZU5.'],
  [
    'Tujuan: satu diagram sistem yang disepakati tim beserta persamaan tiap blok, sebagai acuan tunggal untuk step berikutnya.',
    'Goal: one agreed system diagram with the equations of each block, as the single reference for the next steps.'
  ],
  [
    'Fitur minimum: input target, tombol jalankan trajectory, θ live, τ dan estimasi energi live, pilihan payload.',
    'Minimum features: target input, run trajectory, live θ, live τ and energy estimate, payload choice.'
  ],
  [
    'Mulai dari trajectory sederhana (garis lurus point to point). Plot θ terhadap waktu dan x,y,z terhadap waktu; lintasan rencana dan hasil FK harus berimpit.',
    'Start with a simple trajectory (straight point to point). Plot θ and x,y,z against time; the planned path and the FK result must overlap.'
  ],
  [
    'Buat fungsi MATLAB untuk FK, IK, dan Jacobian; uji di command window sebelum dimasukkan ke Simulink.',
    'Write MATLAB functions for FK, IK and the Jacobian; test them in the command window before Simulink.'
  ],
  [
    'Bangun blok Simulink mengikuti diagram Step 1 (Trajectory, IK, Robot ideal, FK, feedback) ditambah blok terpisah τ = K·i.',
    'Build Simulink blocks following the Step 1 diagram (Trajectory, IK, ideal robot, FK, feedback) plus a separate τ = K·i block.'
  ],
  [
    'Gunakan model JAKA ZU5 (pastikan bukan ZU7) dan buat motion study mengikuti θ(t) dari Step 3.',
    'Use the JAKA ZU5 model and build a motion study following θ(t) from Step 3.'
  ],
  [
    'Bandingkan lintasan visual dengan rencana; jika ada selisih, periksa kembali tabel DH.',
    'Compare the visual path with the plan; if they differ, check the DH table again.'
  ],
  [
    'Tentukan komunikasi ke controller (TCP/IP atau Modbus), kirim θ(t) hasil time-scaling, dan baca balik posisi encoder serta arus motor.',
    'Choose the controller link (TCP/IP or Modbus), send the time-scaled θ(t), and read back encoder positions and motor currents.'
  ],
  [
    'Hitung τ = K·i dari arus yang benar-benar terbaca untuk tiap payload, bandingkan posisi aktual dengan target (target galat 5 persen atau kurang), simpan data dalam CSV.',
    'Compute τ = K·i from the measured current for each payload, compare the actual position with the target (error goal 5 percent or less), save the data as CSV.'
  ],
  [
    'Uji tiga payload (1, 3, 5 kg) sebagai skenario terpisah.',
    'Test three payloads (1, 3, 5 kg) as separate scenarios.'
  ],
  [
    'Reuse fungsi IK dan FK yang sudah tervalidasi, tambahkan indikator galat serta peringatan singularity dan batas sudut.',
    'Reuse the validated IK and FK functions, add error indicators and singularity and joint limit warnings.'
  ],
  [
    'Elektrik, mekanik, potensial, dan gaya lawan (gesekan) sesuai penjelasan dosen.',
    'Electrical, mechanical, potential and friction energy.'
  ],
  [
    'Definisi pasti E mekanik dibanding E inersia yang dimaksud dosen.',
    'Exact definition of mechanical E versus inertial E.'
  ],
  [
    'Istilah "Forward" dan "Invers" dosen dibanding definisi baku.',
    'Use of the terms "Forward" and "Inverse" versus the standard definition.'
  ],
  [
    'Apakah estimasi torsi statis gravitasi boleh dipakai tanpa model dinamika penuh.',
    'Whether a static gravity torque estimate is acceptable without a full dynamics model.'
  ],
  [
    'Metode pengukuran arus i real-time dari controller JAKA (protokol pasti).',
    'How to measure current i in real time from the JAKA controller (exact protocol).'
  ],
  [
    'Nilai konstanta torsi K per joint dari datasheet servo, dan apakah sudah termasuk gear ratio.',
    'Per-joint torque constant K from the servo datasheet, and whether it includes the gear ratio.'
  ],
  [
    'Tabel DH resmi (manual servis, CAD, atau pengukuran fisik) dan apakah joint 4, 5, 6 membentuk spherical wrist.',
    'An official DH table (service manual, CAD or physical measurement) and whether joints 4, 5, 6 form a spherical wrist.'
  ],
  ['In progress', 'In progress'],
  // tooltips and leftovers found by tools/find_untranslated.js
  [
    'Hentikan gerak dan program (tombol E-stop fisik tetap pengaman utama)',
    'Stop motion and program (the physical E-stop stays the main safety device)'
  ],
  ['Tarik untuk mengubah lebar', 'Drag to resize'],
  ['Rotasi Dasar', 'Basic Rotation'],
  ['Rotasi Komposit', 'Composite Rotation'],
  ['Simpan gambar pose (PNG)', 'Save a pose image (PNG)'],
  ['Kunci 0 Zone dulu', 'Lock the 0 Zone first'],
  ['Posisi end-effector', 'End-effector position'],
  ['Buka kunci untuk mengubah d, a, dan α', 'Unlock to edit d, a and α'],
  ['Klik untuk memilih solusi ini', 'Click to choose this solution'],
  [', dan', ', and'],
  ['x, y, z dan turunannya', 'x, y, z and their derivatives'],
  [
    ', bab 3 dan 4. M. W. Spong, S. Hutchinson, M. Vidyasagar,',
    ', chapters 3 and 4. M. W. Spong, S. Hutchinson, M. Vidyasagar,'
  ],
  [', bab 3. B. Siciliano dkk.,', ', chapter 3. B. Siciliano et al.,'],
  [', bab 2. K. P. Hawkins,', ', chapter 2. K. P. Hawkins,'],
  [
    ', Georgia Institute of Technology, 2013 (lengan dengan tiga sumbu sejajar seperti JAKA ZU5).',
    ', Georgia Institute of Technology, 2013 (arms with three parallel axes like the JAKA ZU5).'
  ],
  // 0 Zone panel, hand model, trajectory phases, Start Control tables
  ['Rujukan', 'Reference'],
  ['Daftar isi rujukan', 'Reference contents'],
  ['Matikan di Settings', 'Turn off in Settings'],
  ['Matriks Homogen & DH', 'Homogeneous Matrix & DH'],
  ['Keluar ke Dashboard', 'Exit to Dashboard'],
  ['Sudut kamera', 'Camera angle'],
  ['Simpan gambar pose', 'Save pose image'],
  ['Berada di', 'Located in'],
  ['Model tangan', 'Hand model'],
  ['model tangan', 'hand model'],
  ['Warna:', 'Color:'],
  ['Kembali ke 0 Zone', 'Back to 0 Zone'],
  ['Kembali ke pose awal', 'Back to the initial pose'],
  ['tampilkan bayangan 0 Zone', 'show the 0 Zone ghost'],
  ['Buka kunci', 'Unlock'],
  ['Belum dikunci', 'Not locked'],
  ['Kunci 0 Zone dulu', 'Lock the 0 Zone first'],
  [
    'Pose awal terkunci. Slider sendi kini relatif terhadap 0 Zone (q = θ - θ₀); trajectory dan IK aktif. Buka kunci untuk kalibrasi ulang.',
    'The initial pose is locked. The joint sliders are now relative to the 0 Zone (q = θ - θ₀); trajectory and IK are active. Unlock to recalibrate.'
  ],
  [
    'Geser slider sendi untuk menentukan pose awal robot, lalu kunci. Trajectory dan IK aktif setelah 0 Zone dikunci.',
    'Move the joint sliders to set the initial pose of the robot, then lock it. Trajectory and IK become active once the 0 Zone is locked.'
  ],
  ['nilai slider relatif terhadap 0 Zone: q = θ - θ₀', 'slider values relative to the 0 Zone: q = θ - θ₀'],
  ['Forward kinematics: sudut sendi ke posisi', 'Forward kinematics: joint angles to position'],
  ['Inverse kinematics: posisi x, y, z ke sudut sendi', 'Inverse kinematics: x, y, z position to joint angles'],
  ['Posisi:', 'Position:'],
  ['Data tiap sendi', 'Per-joint data'],
  ['Sendi', 'Joint'],
  ['Sudut (°)', 'Angle (°)'],
  ['Torsi (N·m)', 'Torque (N·m)'],
  ['Arus (A)', 'Current (A)'],
  ['Tegangan (V)', 'Voltage (V)'],
  ['Suhu (°C)', 'Temperature (°C)'],
  ['Turun ke balok', 'Down to the block'],
  ['Angkat balok', 'Lift the block'],
  ['Lepas balok', 'Release the block'],
  ['Pindah ke atas lokasi tujuan', 'Move above the target location'],
  ['Turun ke lokasi tujuan', 'Down to the target location'],
  ['Naik dari lokasi tujuan', 'Rise from the target location'],
  ['Gerak lurus menuju target IK', 'Straight motion to the IK target'],
  ['Selesai', 'Done'],
  ['IP controller JAKA (lihat Coboπ, Home, Connection Info)', 'JAKA controller IP (see Coboπ, Home, Connection Info)'],
  ['Ambabot (dalam pengerjaan)', 'Ambabot (in progress)'],
  ['Pindah simulasi', 'Switch simulation']
]);

// texts that contain live numbers
const CONTENT_PATTERNS = [
  [/^Sendi (\d): frame (\d) ke frame (\d) \((.*)\)$/, 'Joint $1: frame $2 to frame $3 ($4)'],
  [/^Pose sekarang: (.*)$/, 'Current pose: $1'],
  [/^Proyeksi ([AB]) ke bidang XY: sudut = (.*)$/, 'Projection of $1 onto the XY plane: angle = $2'],
  [/^Efektif (\S+): sendi (.*), linear (.*)$/, 'Effective $1: joint $2, linear $3'],
  [
    /^Peringatan indikatif: mendekati singularity \((.*)\), presisi gerak menurun$/,
    'Indicative warning: close to a singularity ($1), motion precision drops'
  ],
  [
    /^Salah satu hasil sama dengan θ₁ sekarang \((.*)\)\. Dua hasil itu adalah dua konfigurasi bahu pada Gambar 2-16 buku\.$/,
    'One result equals the current θ₁ ($1). The two results are the two shoulder configurations of Figure 2-16 of the book.'
  ],
  [/^α = (.*) \(dilihat dari atas sumbu (\w)\)$/, 'α = $1 (seen from above the $2 axis)'],
  [/^(\d+) solusi$/, '$1 solutions'],
  [/^Fase: (.*)$/, m => 'Phase: ' + (contentToEn(m[1]) || m[1])],
  [
    /^2\. Substitusi nilai untuk kolom i = (\d+) \(pilih kolom di atas\), frame base DH \(Z ke atas\)$/,
    '2. Substituted values for column i = $1 (choose the column above), DH base frame (Z up)'
  ],
  [
    /^Model vs controller: FK model (.*) mm, selisih (.*) mm(.*)$/,
    m =>
      'Model vs controller: FK model ' +
      m[1] +
      ' mm, difference ' +
      m[2] +
      ' mm' +
      (m[3] ? ' (check the joint mapping or the tool/TCP offset on the controller)' : '')
  ],
  [/^Model tersimpan: (.*)$/, 'Model saved: $1'],
  [/^Python (\S+) aktif$/, 'Python $1 running'],
  [/^Robot nyata (.*)$/, 'Real robot $1'],
  [/^Robot virtual$/, 'Virtual robot'],
  [/^Proyeksi A pada B$/, 'Projection of A onto B'],
  [/^Menuju atas balok (.*)$/, 'Move above the $1 block'],
  [/^Berjalan, durasi total (.*)$/, 'Running, total duration $1'],
  [/^Sudut sendi (\d)$/, 'Joint angle $1'],
  [/^τ maks: (.*)$/, 'τ max: $1'],
  [
    /^t = (\S+) s · (.*?) · τ maks (.*)$/,
    m => 't = ' + m[1] + ' s · ' + (contentToEn(m[2]) || m[2]) + ' · τ max ' + m[3]
  ]
];

// fragments inside longer generated texts (matrix printouts, status lines)
const CONTENT_PHRASES = [
  ['frame base (Z ke atas)', 'base frame (Z up)'],
  ['frame base, Z ke atas', 'base frame, Z up'],
  ['kolom terakhir = posisi end-effector x, y, z', 'last column = end-effector position x, y, z'],
  ['kolom terakhir = posisi end-effector', 'last column = end-effector position'],
  ['Menganimasikan IK: gerak lurus ke target', 'Animating IK: straight motion to the target'],
  ['(orientasi alat dibiarkan bebas), durasi', '(tool orientation left free), duration'],
  ['Solver belum konvergen (galat', 'Solver has not converged (error'],
  ['Tidak ada solusi.', 'No solution.'],
  ['Ada sendi di luar batas', 'A joint is out of range']
];

function contentToEn(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!t || !/[a-z]/i.test(t)) return null;
  if (CONTENT_EN.has(t)) return CONTENT_EN.get(t);
  for (const [re, rep] of CONTENT_PATTERNS) {
    const m = t.match(re);
    if (m) return typeof rep === 'function' ? rep(m) : t.replace(re, rep);
  }
  return null;
}
// fragments inside longer generated texts; works on the raw text so line breaks are kept
function contentPhrasesToEn(raw) {
  let out = raw,
    hit = false;
  for (const [a, b] of CONTENT_PHRASES) {
    if (out.includes(a)) {
      out = out.split(a).join(b);
      hit = true;
    }
  }
  return hit ? out : null;
}

const CONTENT_DONE = new Map(); // text node -> { orig, en }
const ATTR_DONE = new Map(); // element -> { attr: { orig, en } }
const CONTENT_ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip'];
const contentLangEn = () => typeof appSettings !== 'undefined' && appSettings.lang === 'en';
const contentSkip = el => !el || !!el.closest('.katex, script, style, textarea, .ctl-code, [contenteditable], .ui-tip');

function translateTextNode(n) {
  const el = n.parentElement;
  if (contentSkip(el)) return;
  const rec = CONTENT_DONE.get(n);
  if (rec && n.nodeValue === rec.en) return;
  const raw = n.nodeValue;
  const en = contentToEn(raw);
  let full;
  if (en != null) full = raw.match(/^\s*/)[0] + en + raw.match(/\s*$/)[0];
  else full = contentPhrasesToEn(raw);
  if (full == null) return;
  if (full === raw) return;
  CONTENT_DONE.set(n, { orig: raw, en: full });
  n.nodeValue = full;
}
function translateAttrs(el) {
  if (contentSkip(el)) return;
  CONTENT_ATTRS.forEach(a => {
    const v = el.getAttribute(a);
    if (!v) return;
    const rec = ATTR_DONE.get(el) || {};
    if (rec[a] && rec[a].en === v) return;
    const en = contentToEn(v) ?? contentPhrasesToEn(v);
    if (en == null || en === v) return;
    rec[a] = { orig: v, en };
    ATTR_DONE.set(el, rec);
    el.setAttribute(a, en);
  });
}
function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) return translateTextNode(root);
  if (root.nodeType !== 1) return;
  translateAttrs(root);
  root.querySelectorAll('[placeholder],[title],[aria-label],[data-tip]').forEach(translateAttrs);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) translateTextNode(n);
}
function restoreContent() {
  CONTENT_DONE.forEach((rec, n) => {
    if (n.isConnected && n.nodeValue === rec.en) n.nodeValue = rec.orig;
  });
  CONTENT_DONE.clear();
  ATTR_DONE.forEach((rec, el) =>
    Object.entries(rec).forEach(([a, r]) => {
      if (el.getAttribute(a) === r.en) el.setAttribute(a, r.orig);
    })
  );
  ATTR_DONE.clear();
}
// applyLang() calls this after the shell texts are set
function applyContentLang() {
  if (contentLangEn()) translateTree(document.body);
  else restoreContent();
}
const contentObserver = new MutationObserver(muts => {
  if (!contentLangEn()) return;
  muts.forEach(m => {
    if (m.type === 'characterData') translateTextNode(m.target);
    else if (m.type === 'attributes') translateAttrs(m.target);
    else m.addedNodes.forEach(translateTree);
  });
});
function contentI18nInit() {
  contentObserver.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: CONTENT_ATTRS
  });
  applyContentLang();
}
