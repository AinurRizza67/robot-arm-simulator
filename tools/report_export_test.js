// Uji unduh laporan di Chrome sungguhan: node lp_export.js [bd|fk|ik]
// Hasil: shots/Laporan_<hal>.pdf/.docx, lalu halaman PDF dirender (pdf.js) dan Docx dirender (docx-preview) ke PNG.
const { URL_APP, CHROME } = require('./paths');
const URL = URL_APP;
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const list = process.argv.slice(2).length ? process.argv.slice(2) : ['bd', 'fk', 'ik'];
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--allow-file-access-from-files']
  });
  for (const pg of list) {
    const p = await b.newPage();
    await p.setViewport({ width: 1300, height: 900 });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', async m => {
      if (m.type() !== 'error') return;
      const parts = await Promise.all(m.args().map(h => h.evaluate(x => (x && x.stack) || String(x)).catch(() => '?')));
      errs.push(parts.join(' ') || m.text());
    });
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-' + pg);
    await wait(1500);
    const res = await p.evaluate(async pg => {
      zzSetPose(READY_POSE);
      zzLock();
      REP.robotTouched = true;
      if (pg === 'ik') {
        document.getElementById('tx').value = 0.5;
        document.getElementById('ty').value = -0.25;
        document.getElementById('tz').value = 0.3;
      }
      if (pg === 'fk') applyPose([20, 80, -70, 60, 90, 10], true);
      rpSaveNow(pg);
      if (pg === 'ik') {
        const P = ikPathPlan(targetFromInputs());
        P.src = 'ik';
        P.payload0 = 0;
        REP.ik = {
          method: 'path6d',
          at: new Date().toISOString(),
          start: P.q0.slice(),
          target: userTargetInputs(),
          mode: P.mode
        };
        rpCapture(P);
      } else {
        const P = planPickPlace(3);
        P.src = pg;
        rpCapture(P);
      }
      rpReport(pg);
      const R = REP.reports[0];
      const out = {};
      window.rpSaveBlob = (blob, name) => {
        window.__last = { blob, name };
      };
      for (const k of ['pdf', 'docx']) {
        const t0 = performance.now();
        window.__last = null;
        await rpExport(R, k);
        const L = window.__last;
        if (!L) {
          out[k] = { err: 'tidak ada berkas' };
          continue;
        }
        const buf = new Uint8Array(await L.blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        out[k] = { name: L.name, size: buf.length, ms: Math.round(performance.now() - t0), b64: btoa(s) };
      }
      return out;
    }, pg);
    for (const k of ['pdf', 'docx']) {
      const r = res[k];
      if (r.err) {
        console.log(pg, k, 'GAGAL', r.err);
        continue;
      }
      fs.writeFileSync(path.join(OUT, 'Laporan_' + pg + '.' + k), Buffer.from(r.b64, 'base64'));
      console.log(pg, k, r.name, (r.size / 1024).toFixed(0) + ' KB', r.ms + ' ms');
    }
    if (errs.length) console.log(pg, 'ERROR:', errs.join(' ; '));
    await p.close();
    // render PDF
    const v = await b.newPage();
    await v.setViewport({ width: 900, height: 1270 });
    await v.goto('about:blank');
    const pdfB64 = fs.readFileSync(path.join(OUT, 'Laporan_' + pg + '.pdf')).toString('base64');
    const n = await v.evaluate(async d => {
      const lib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      const bin = atob(d),
        u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const pdf = await lib.getDocument({ data: u }).promise;
      window.__pdf = pdf;
      document.body.style.margin = '0';
      return pdf.numPages;
    }, pdfB64);
    const pick = Array.from({ length: n }, (_, i) => i + 1);
    for (const k of pick) {
      await v.evaluate(async k => {
        const page = await window.__pdf.getPage(k),
          vp = page.getViewport({ scale: 1.5 });
        document.body.innerHTML = '';
        const c = document.createElement('canvas');
        c.width = vp.width;
        c.height = vp.height;
        document.body.appendChild(c);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }, k);
      await v.screenshot({ path: path.join(OUT, 'pdf_' + pg + '_p' + String(k).padStart(2, '0') + '.png') });
    }
    console.log(pg, 'PDF', n, 'halaman; dirender', pick.join(','));
    await v.close();
    // render Docx dengan docx-preview (hanya untuk cek visual)
    const w = await b.newPage();
    await w.setViewport({ width: 1000, height: 1300 });
    await w.goto('about:blank');
    await w.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js' });
    await w.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js' });
    const dB64 = fs.readFileSync(path.join(OUT, 'Laporan_' + pg + '.docx')).toString('base64');
    const H = await w.evaluate(async d => {
      const bin = atob(d),
        u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const box = document.createElement('div');
      document.body.appendChild(box);
      await docx.renderAsync(u.buffer, box);
      await new Promise(r => setTimeout(r, 800));
      return document.body.scrollHeight;
    }, dB64);
    let k = 0;
    for (let y = 0; y < H && k < 40; y += 1300) {
      await w.evaluate(y => window.scrollTo(0, y), y);
      await wait(150);
      await w.screenshot({ path: path.join(OUT, 'docx_' + pg + '_' + String(k).padStart(2, '0') + '.png') });
      k++;
    }
    console.log(pg, 'Docx dirender', k, 'layar');
    await w.close();
  }
  await b.close();
})();
