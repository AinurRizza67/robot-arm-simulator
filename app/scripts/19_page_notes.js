/* 19_page_notes.js
   Page notes: the small explanatory texts under features (camera hints, page subtitles, setting descriptions,
   formula notes, ...) are taken off the pages to keep the interface clean, and listed in the Tutorial page,
   grouped by page. Live status texts (validation, warnings, connection state) stay on the pages.
   The elements are only hidden (class .moved-hint), because some of them are still updated by feature code.
   Classic script: all files share one global scope and are loaded in order by index.html. */

const NOTE_SELECTORS = [
  '.dh-hero > p',
  '.dh-note',
  '#app-home .app-sub',
  '#app-settings .set-row .d',
  '.cam-hint',
  '.payload-hint',
  '#app-vector p.note',
  '#app-vector div.note:not([id])',
  '#app-vector .eq-note',
  '.motor-note',
  '.zz-desc',
  '.bd-open-card > p',
  '#dr-mode .dr-row > div > span',
  '.dr-const',
  '#app-control .ctl-small:not([id])',
  '.assistant-head small',
  '.models-note'
];

// page names for the Tutorial, matched on the nearest container id
const NOTE_PAGES = [
  ['app-dash', { id: 'Dashboard', en: 'Dashboard' }],
  ['app-home', { id: 'Simulation', en: 'Simulation' }],
  ['app-settings', { id: 'Settings', en: 'Settings' }],
  ['view-v1', { id: 'Vector Simulation: Vektor', en: 'Vector Simulation: Vectors' }],
  ['view-v2', { id: 'Vector Simulation: Rotasi', en: 'Vector Simulation: Rotation' }],
  ['view-v3', { id: 'Vector Simulation: Rotasi komposit', en: 'Vector Simulation: Composite rotation' }],
  ['view-v4', { id: 'Vector Simulation: Matriks homogen', en: 'Vector Simulation: Homogeneous matrix' }],
  ['view-v5', { id: 'Vector Simulation: FK N-DOF', en: 'Vector Simulation: N-DOF FK' }],
  ['view-v7', { id: 'JAKA FK', en: 'JAKA FK' }],
  ['view-v8', { id: 'JAKA IK', en: 'JAKA IK' }],
  ['view-bd', { id: 'JAKA Blok Diagram', en: 'JAKA Block Diagram' }],
  ['view-draw', { id: 'JAKA Draw', en: 'JAKA Draw' }],
  ['app-control', { id: 'Start Control', en: 'Start Control' }],
  ['app-models', { id: 'Model Robot', en: 'Robot Models' }],
  ['assistant-panel', { id: 'Ambabot', en: 'Ambabot' }]
];
const PAGE_NOTES = [];

function notePage(el) {
  for (let e = el; e; e = e.parentElement) {
    const hit = NOTE_PAGES.find(([id]) => e.id === id);
    if (hit) return hit;
  }
  return ['other', { id: 'Umum', en: 'General' }];
}

// a note can carry a short title: the bold label of its row (settings, Draw toggles)
function noteTitle(el) {
  const row = el.closest('.set-row, .dr-row');
  const b = row && row.querySelector('b, .t');
  return b && b !== el ? b.textContent.replace(/\s+/g, ' ').trim() : '';
}

function collectPageNotes() {
  const seen = new Set();
  NOTE_SELECTORS.forEach(sel =>
    document.querySelectorAll(sel).forEach(el => {
      if (el.classList.contains('moved-hint')) return;
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      el.classList.add('moved-hint');
      const [pageId, pageName] = notePage(el);
      const key = pageId + '|' + text;
      if (!text || seen.has(key)) return;
      seen.add(key);
      PAGE_NOTES.push({ pageId, pageName, title: noteTitle(el), el, i18n: el.dataset.i18n || null });
    })
  );
}

function renderPageNotes(container) {
  if (!container) return;
  const L = iconLang();
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const groups = [];
  NOTE_PAGES.concat([['other', { id: 'Umum', en: 'General' }]]).forEach(([id, name]) => {
    const items = PAGE_NOTES.filter(n => n.pageId === id);
    if (items.length) groups.push({ name: name[L], items });
  });
  container.innerHTML =
    '<h2 class="pn-title">' +
    (L === 'en' ? 'Notes per page' : 'Penjelasan per halaman') +
    '</h2>' +
    groups
      .map(
        g =>
          '<section class="pn-group"><h3>' +
          g.name +
          '</h3><ul>' +
          g.items
            .map(n => {
              const text = n.i18n ? tr(n.i18n) : n.el.textContent.replace(/\s+/g, ' ').trim();
              return '<li>' + (n.title ? '<b>' + esc(n.title) + '</b> ' : '') + esc(text) + '</li>';
            })
            .join('') +
          '</ul></section>'
      )
      .join('');
}
