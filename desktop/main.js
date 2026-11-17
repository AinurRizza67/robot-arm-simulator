// Desktop shell (Electron): opens app/index.html (copied from ../app by prepare.js) in a window, fully offline,
// and starts the Python process bridge/robot_bridge.py for Start Control (JAKA robot through the jkrc SDK).
const { app, BrowserWindow, Menu, shell, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.setAppUserModelId('id.kelompok1.jakazu5simulator');
// keep the user data folder of earlier versions (settings, presets, reports)
app.setPath('userData', path.join(app.getPath('appData'), 'JAKA ZU5 Simulator'));
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#0d1117',
    title: 'Robot Arm Simulator',
    icon: path.join(__dirname, 'app', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'), { hash: 'start' });
  // tautan luar dibuka di browser bawaan, bukan di jendela aplikasi
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  win.on('page-title-updated', e => e.preventDefault());
}

// Unduhan (laporan PDF/Docx, CSV, gambar PNG, program .py): dialog Simpan dengan folder awal Dokumen
function setupDownloads() {
  session.defaultSession.on('will-download', (e, item) => {
    if (process.env.JAKA_SMOKE) {
      item.setSavePath(path.join(process.env.JAKA_SMOKE, item.getFilename()));
      return;
    }
    item.setSaveDialogOptions({
      title: 'Simpan berkas',
      defaultPath: path.join(app.getPath('documents'), item.getFilename())
    });
  });
}

function setupMenu() {
  const tpl = [
    { label: 'Berkas', submenu: [{ label: 'Keluar', role: 'quit' }] },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Muat ulang', role: 'reload' },
        { label: 'Layar penuh', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Perbesar', role: 'zoomIn' },
        { label: 'Perkecil', role: 'zoomOut' },
        { label: 'Ukuran asli', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Alat pengembang', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Bantuan',
      submenu: [
        {
          label: 'About Robot Arm Simulator',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Tentang',
              message: 'Robot Arm Simulator ' + app.getVersion(),
              detail:
                'Simulator dan kendali robot JAKA ZU5 (Kelompok PjBL T-17): simulasi kinematika, monitoring, teach pendant, dan program Python lewat SDK resmi JAKA. Bukan model dinamika dan tanpa klaim stabilitas. Tombol E-stop fisik tetap pengaman utama. Library pihak ketiga: lihat Simulator/vendor/LICENSES.md.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ---- Jembatan Python (Start Control) ----
// Protokol JSON per baris dengan robot_bridge.py. Python dicari berurutan: path dari Settings, py -3, python, python3.
const BR = { proc: null, pending: new Map(), next: 1, buf: '', ready: null, info: null, py: null, starting: null };
const bridgeDir = () => (app.isPackaged ? path.join(process.resourcesPath, 'bridge') : path.join(__dirname, 'bridge'));
function brEvent(m) {
  if (win && !win.isDestroyed()) win.webContents.send('bridge:event', m);
}
function brLine(line) {
  let m;
  try {
    m = JSON.parse(line);
  } catch (e) {
    brEvent({ event: 'log', data: { stream: 'err', text: line } });
    return;
  }
  if (m.id != null && BR.pending.has(m.id)) {
    const p = BR.pending.get(m.id);
    BR.pending.delete(m.id);
    clearTimeout(p.t);
    m.ok ? p.res(m.data) : p.rej(new Error(m.error || 'galat'));
    return;
  }
  if (m.id != null) return; // jawaban perintah tanpa penunggu (bridge:send)
  if (m.event === 'ready' && BR.ready) {
    const f = BR.ready;
    BR.ready = null;
    f(m.data);
  }
  brEvent(m);
}
function trySpawn(cmd, pre) {
  return new Promise((res, rej) => {
    const dir = bridgeDir(),
      script = path.join(dir, 'robot_bridge.py');
    if (!fs.existsSync(script)) return rej(new Error('berkas jembatan tidak ditemukan: ' + script));
    let p;
    try {
      p = spawn(cmd, [...pre, '-u', script, '--sdk', path.join(dir, 'sdk')], {
        cwd: dir,
        windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
      });
    } catch (e) {
      return rej(e);
    }
    let done = false,
      errTxt = '';
    const fail = e => {
      if (done) return;
      done = true;
      clearTimeout(t);
      try {
        p.kill();
      } catch (_) {}
      rej(e);
    };
    const t = setTimeout(() => fail(new Error('tidak ada jawaban dalam 15 detik')), 15000);
    BR.ready = info => {
      if (done) return;
      done = true;
      clearTimeout(t);
      res({ p, info });
    };
    p.on('error', e => fail(e));
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', d => {
      BR.buf += d;
      let i;
      while ((i = BR.buf.indexOf('\n')) >= 0) {
        const ln = BR.buf.slice(0, i).trim();
        BR.buf = BR.buf.slice(i + 1);
        if (ln) brLine(ln);
      }
    });
    p.stderr.on('data', d => {
      errTxt += d;
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach(x => brEvent({ event: 'log', data: { stream: 'err', text: x } }));
    });
    p.on('exit', code => {
      if (!done) {
        fail(new Error('keluar dengan kode ' + code + ' ' + errTxt.slice(-300)));
        return;
      }
      if (BR.proc === p) {
        BR.proc = null;
        BR.pending.forEach(x => {
          clearTimeout(x.t);
          x.rej(new Error('Jembatan Python berhenti'));
        });
        BR.pending.clear();
        brEvent({ event: 'bridge-exit', data: { code } });
      }
    });
  });
}
async function startBridge(opts) {
  if (BR.proc) return Object.assign({ py: BR.py }, BR.info);
  if (BR.starting) return BR.starting;
  BR.starting = (async () => {
    const cand = [];
    if (opts && opts.python) cand.push([opts.python, []]);
    cand.push(['py', ['-3']], ['python', []], ['python3', []]);
    const errs = [];
    for (const [cmd, pre] of cand) {
      try {
        BR.buf = '';
        const { p, info } = await trySpawn(cmd, pre);
        BR.proc = p;
        BR.py = [cmd, ...pre].join(' ');
        BR.info = info;
        return Object.assign({ py: BR.py }, info);
      } catch (e) {
        errs.push(cmd + ': ' + e.message);
      }
    }
    throw new Error('Python 3 (64-bit) tidak ditemukan atau gagal menjalankan jembatan. ' + errs.join(' | '));
  })();
  try {
    return await BR.starting;
  } finally {
    BR.starting = null;
  }
}
function brCall(cmd, args) {
  return new Promise((res, rej) => {
    if (!BR.proc) return rej(new Error('Jembatan Python belum berjalan'));
    const id = BR.next++,
      ms = cmd === 'connect' ? 45000 : 30000;
    const t = setTimeout(() => {
      BR.pending.delete(id);
      rej(new Error(cmd + ': tidak ada jawaban'));
    }, ms);
    BR.pending.set(id, { res, rej, t });
    BR.proc.stdin.write(JSON.stringify({ id, cmd, args: args || {} }) + '\n');
  });
}
function stopBridge() {
  const p = BR.proc;
  if (!p) return Promise.resolve();
  BR.proc = null;
  // stdin ditutup: jembatan menghentikan gerak, logout, lalu keluar sendiri
  return new Promise(r => {
    const t = setTimeout(() => {
      try {
        p.kill();
      } catch (e) {}
      r();
    }, 2500);
    p.once('exit', () => {
      clearTimeout(t);
      r();
    });
    try {
      p.stdin.end();
    } catch (e) {
      r();
    }
  });
}
ipcMain.handle('bridge:start', (e, o) => startBridge(o));
ipcMain.handle('bridge:call', (e, cmd, args) => brCall(cmd, args));
ipcMain.on('bridge:send', (e, cmd, args) => {
  if (BR.proc) BR.proc.stdin.write(JSON.stringify({ id: null, cmd, args: args || {} }) + '\n');
});
ipcMain.handle('bridge:stop', () => stopBridge());
let quitting = false;
app.on('before-quit', e => {
  if (BR.proc && !quitting) {
    e.preventDefault();
    quitting = true;
    stopBridge().then(() => app.quit());
  }
});

// Uji asap (hanya untuk pengembang): JAKA_SMOKE=<folder> membuka beberapa halaman, menyimpan tangkapan layar, lalu keluar
async function smoke(dir) {
  const wait = ms => new Promise(r => setTimeout(r, ms)),
    out = {};
  const shot = async n =>
    fs.writeFileSync(path.join(dir, 'electron_' + n + '.png'), (await win.webContents.capturePage()).toPNG());
  await wait(2500);
  for (const h of ['start', 'dash', 'home', 'jaka-fk', 'jaka-bd', 'jaka-draw']) {
    await win.webContents.executeJavaScript("nav('#" + h + "')");
    await wait(2000);
    await shot(h);
  }
  // menu Draw: Axis Draw, lalu Cinematic, lalu pop-up Blok Diagram
  out.versi = app.getVersion();
  out.draw = await win.webContents.executeJavaScript(
    '(()=>{zzSetPose(READY_POSE);drAxis(true);return {axis:DRAW.axis,dh:AX.root.visible,mesh:fkScene.partGroups.some(p=>p.visible)};})()'
  );
  await wait(1200);
  await shot('draw_axis');
  out.cine = await win.webContents.executeJavaScript(
    "(()=>{drCine(true);return document.body.classList.contains('dr-cine');})()"
  );
  await wait(1500);
  await shot('draw_cine');
  out.bdpop = await win.webContents.executeJavaScript(
    "(()=>{drCine(false);drAxis(false);drDh(false);nav('#jaka-bd');bdPop(true);return bdPopOpen();})()"
  );
  await wait(1500);
  await shot('bd_pop');
  await win.webContents.executeJavaScript('bdPop(false)');
  out.cek = await win.webContents.executeJavaScript(
    '({three:!!window.THREE,katex:!!window.katex,chart:!!window.Chart,mesh:!!window.ZU5_MESH,mode:document.body.dataset.mode,judul:document.title,bridge:!!window.jakaBridge})'
  );
  // Start Control dengan robot virtual lewat jembatan Python sungguhan
  out.control = await win.webContents
    .executeJavaScript(`(async()=>{nav('#control');await new Promise(r=>setTimeout(r,800));
    const r=await ctlSmoke();return r;})()`);
  await wait(1500);
  await shot('control');
  out.ctlProg = await win.webContents
    .executeJavaScript(`(async()=>{ctlTab('prog');ctlLoadTemplate('pipeline');await ctlRun(true);await new Promise(r=>setTimeout(r,9000));
    return {status:CTL.prog,log:document.getElementById('ctl-console').innerText.slice(-600)};})()`);
  await shot('control_prog');
  out.ctlEq = await win.webContents.executeJavaScript(
    `(()=>{ctlTab('teach');ctlEqOpen(true);return document.querySelectorAll('#ctl-eq .katex').length;})()`
  );
  await wait(1200);
  await shot('control_eq');
  // laporan Blok Diagram lalu unduh PDF dan Docx lewat alur unduh Electron sungguhan
  out.laporan = await win.webContents
    .executeJavaScript(`(async()=>{nav('#jaka-bd');zzSetPose(READY_POSE);zzLock();REP.robotTouched=true;rpSaveNow('bd');const P=planPickPlace(3);P.src='bd';rpCapture(P);rpReport('bd');
    const R=REP.reports[0];const a=await rpExport(R,'pdf'),b=await rpExport(R,'docx');return {pdf:a?a.size:0,docx:b?b.size:0,berkas:[rpFileName(R,'pdf'),rpFileName(R,'docx')]};})()`);
  await wait(3000);
  out.tersimpan = out.laporan.berkas.map(f => {
    try {
      return f + ': ' + fs.statSync(path.join(dir, f)).size + ' byte';
    } catch (e) {
      return f + ': TIDAK ADA';
    }
  });
  fs.writeFileSync(path.join(dir, 'electron_smoke.json'), JSON.stringify(out, null, 1));
  app.quit();
}
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.whenReady().then(() => {
  setupMenu();
  setupDownloads();
  createWindow();
  if (process.env.JAKA_SMOKE)
    smoke(process.env.JAKA_SMOKE).catch(e => {
      fs.writeFileSync(
        path.join(process.env.JAKA_SMOKE, 'electron_smoke.json'),
        JSON.stringify({ error: String((e && e.stack) || e) })
      );
      app.quit();
    });
});
app.on('window-all-closed', () => app.quit());
