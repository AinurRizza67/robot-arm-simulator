// Lists visible texts that still look Indonesian while the app runs in English, page by page.
// Every route is visited twice (default modes, then Observer and Report modes on), and each page is put through
// the states that create new texts: tabs, accordions, 0 Zone locked, IK solved, trajectory played.
// Add the missing phrases to CONTENT_EN in app/scripts/21_content_i18n.js. Usage: node find_untranslated.js
const puppeteer = require('puppeteer-core');
const { URL_APP, CHROME } = require('./paths');

const ROUTES = [
  '#start',
  '#dash',
  '#home',
  '#jaka',
  '#models',
  '#tutorial',
  '#settings',
  '#vector-1',
  '#vector-2',
  '#vector-3',
  '#vector-4',
  '#vector-5',
  '#jaka-fk',
  '#jaka-ik',
  '#jaka-bd',
  '#jaka-draw',
  '#control',
  '#reference'
];
const ID =
  /\b(yang|dan|untuk|dengan|tidak|belum|sudah|atau|dari|pada|tiap|semua|ini|itu|bisa|saat|lalu|sendi|sudut|posisi|gerak|gerakkan|balok|kunci|simpan|tampilkan|bayangan|panjang|matriks|persamaan|definisi|rumus|hitung|langkah|nilai|kecepatan|sumbu|putar|rotasi|lengan|awal|akhir|lurus|beban|massa|torsi|energi|kolom|baris|hasil|masukkan|pilih|klik|geser|garis|atas|bawah|aktif|mati|terkunci|peringatan|galat|selesai|mulai|ulang|kembali|tutup|buka|unduh|salin|catatan|contoh|bagian|halaman|materi|rujukan|penjelasan|sebagai|adalah|juga|hanya|tetap|berubah|vektor|proyeksi|titik|tangan|warna|siap|nol|waktu|ke|di|frame base|tersambung|dinyalakan|selesaikan|solusi|terhadap|relatif|arus|tegangan|suhu|pertahankan|ambil|siklus|durasi|jarak|tinggi|lebar|berat|kiri|kanan|depan|belakang|naik|turun|angkat|lepas|pindah|menuju|sekarang|baru|sembunyikan|gunakan|tambah|hapus|ubah|atur|buat|lihat|coba|batas|luar|dalam|terlalu|kurang|lebih|antara|setiap|jika|maka|karena|agar|harus|perlu|ada|tanpa|oleh|ganti|kirim|terima|sambung|putus|kosong|isi|berkas|gambar|tabel|grafik|layar|ukuran|besar|kecil|jalankan|hentikan|berhenti|tunggu)\b/i;
const wait = ms => new Promise(res => setTimeout(res, ms));

// state changes per route; each step runs in the page, then the visible texts are collected again
const STEPS = {
  '#jaka-fk': [
    () => typeof zzLock === 'function' && zzLock(),
    () => document.querySelectorAll('.zz-ghost').forEach(c => c.click()),
    () => document.getElementById('traj-play') && document.getElementById('traj-play').click()
  ],
  '#jaka-ik': [
    () => typeof zzLock === 'function' && zzLock(),
    () => document.getElementById('solveBtn') && document.getElementById('solveBtn').click(),
    () => document.querySelectorAll('#app-jaka .ik-sol, #app-jaka [data-sol]').forEach((b, i) => i < 2 && b.click()),
    () => document.getElementById('traj-play-ik') && document.getElementById('traj-play-ik').click()
  ]
};

function collect(src) {
  const re = new RegExp(src, 'i');
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement;
    if (!el || el.closest('.katex, script, style, textarea, .moved-hint, #page-notes, .ctl-code')) continue;
    if (!el.getClientRects().length) continue;
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (t.length > 1 && re.test(t)) out.push(t);
  }
  document.querySelectorAll('[data-tip],[placeholder],[title],[aria-label]').forEach(e => {
    if (e.closest('#page-notes')) return;
    ['data-tip', 'placeholder', 'title', 'aria-label'].forEach(a => {
      const v = e.getAttribute(a);
      if (v && re.test(v)) out.push('[' + a + '] ' + v);
    });
  });
  return out;
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--allow-file-access-from-files']
  });
  const seen = new Set();
  for (const modes of [{}, { observer: true, report: true }]) {
    const p = await b.newPage();
    await p.setViewport({ width: 1400, height: 900 });
    await p.evaluateOnNewDocument(m => {
      localStorage.setItem('jakaSimSettings', JSON.stringify(Object.assign({ lang: 'en', reference: true }, m)));
    }, modes);
    console.log('#### modes ' + JSON.stringify(modes));
    for (const r of ROUTES) {
      await p.goto(URL_APP + r);
      await wait(1500);
      const rows = [];
      const grab = async () => rows.push(...(await p.evaluate(collect, ID.source)));
      await p.evaluate(() => document.querySelectorAll('.accordion-header:not(.open)').forEach(h => h.click()));
      await wait(800);
      await grab();
      const tabs = await p.evaluate(
        () => document.querySelectorAll('[role=tablist] > button, [role=tablist] > [role=tab]').length
      );
      for (let i = 0; i < tabs; i++) {
        await p.evaluate(i => {
          const t = document.querySelectorAll('[role=tablist] > button, [role=tablist] > [role=tab]')[i];
          if (t && t.getClientRects().length) t.click();
        }, i);
        await wait(300);
        await grab();
      }
      for (const step of STEPS[r] || []) {
        await p.evaluate(step).catch(() => {});
        await wait(1200);
        await grab();
      }
      const fresh = [...new Set(rows)].filter(t => !seen.has(t));
      fresh.forEach(t => seen.add(t));
      console.log('== ' + r + ' (' + fresh.length + ')');
      fresh.forEach(t => console.log('   ' + t));
    }
    await p.close();
  }
  await b.close();
})();
