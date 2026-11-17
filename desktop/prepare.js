// Copies the web app (../app) and the Python bridge (../bridge) next to the Electron shell before start or build.
// The official JAKA SDK (bridge/sdk) is optional: without it the bridge runs the virtual robot only.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(__dirname, 'app');
const BRIDGE = path.join(__dirname, 'bridge');
const skip = name => /^(desktop\.ini|Thumbs\.db|__pycache__|tests)$/i.test(name);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip(name)) continue;
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(APP, { recursive: true, force: true });
copyDir(path.join(ROOT, 'app'), APP);
fs.copyFileSync(path.join(__dirname, 'build', 'icon.png'), path.join(APP, 'icon.png'));

fs.rmSync(BRIDGE, { recursive: true, force: true });
copyDir(path.join(ROOT, 'bridge'), BRIDGE);
if (!fs.existsSync(path.join(BRIDGE, 'sdk'))) {
  console.warn('bridge/sdk not found: the packaged app will only drive the virtual robot (see README).');
}
