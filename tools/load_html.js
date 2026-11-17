// Loads app/index.html for browser-less tests (jsdom).
// Stylesheets from app/styles and scripts from app/scripts are inlined into one <style> and one <script>,
// keeping file order, so the tests see the page exactly as the browser executes it.
const fs = require('fs');
const path = require('path');
const { ROOT, APP_DIR } = require('./paths');

function loadHtml() {
  let raw = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const read = rel => fs.readFileSync(path.join(APP_DIR, rel), 'utf8').replace(/\r\n/g, '\n');

  const cssTag = /[ \t]*<link rel="stylesheet" href="(styles\/[^"]+)"\s*\/?>[ \t]*\n/g;
  const css = [...raw.matchAll(cssTag)].map(m => read(m[1]));
  raw = raw.replace(cssTag, '');
  raw = raw.replace('</head>', '<style>\n' + css.join('\n') + '</style>\n</head>');

  const jsTag = /[ \t]*<script src="(scripts\/[^"]+)"><\/script>[ \t]*\n/g;
  const files = [...raw.matchAll(jsTag)].map(m => m[1]);
  const js = files.map(read);
  raw = raw.replace(jsTag, '');
  raw = raw.replace('</body>', '<script>\n' + js.join('\n') + '</script>\n</body>');
  return { raw, root: ROOT + '/', cssFiles: css.length, jsFiles: files };
}

module.exports = { loadHtml, ROOT };
