/* 17_boot.js
   Boot: initial route and first render.
   Classic script: all files share one global scope and are loaded in order by index.html. */
document.querySelector('#tut-start-tour svg').innerHTML = ICON_SVG['play-circle'];
document.querySelector('#st-go svg').innerHTML = ICON_SVG['play'];
document.querySelectorAll('.dh-ic').forEach(e => (e.innerHTML = iconSvg(e.dataset.ic)));
{
  // language switch: refresh labels that are built in JavaScript
  const applyLangBase = applyLang;
  applyLang = function () {
    applyLangBase.apply(this, arguments);
    applyContentLang();
    iconTipsRefresh();
    jacLabels();
    if (document.body.dataset.mode === 'tutorial') {
      renderIconGuide(document.getElementById('icon-guide'));
      renderPageNotes(document.getElementById('page-notes'));
    }
  };
}
collectPageNotes();
applyLang();
route(location.hash);
modelManagerInit();
iconsInit();
contentI18nInit();
modelMeshesReady();
