// Screenshot visual dengan Chrome sungguhan (puppeteer-core, memakai Chrome yang sudah terpasang).
// Pakai: node shots.js            -> semua skenario, hasil di tools/shots/
//        node shots.js home jaka  -> skenario tertentu saja
const { URL_APP, CHROME } = require('./paths');
const URL = URL_APP;
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const SCEN = {
  home: async p => {
    await p.goto(URL + '#home');
  },
  jaka: async p => {
    await p.goto(URL + '#jaka');
  },
  settings: async p => {
    await p.goto(URL + '#settings');
  },
  settings_pengamat: async p => {
    await p.goto(URL + '#settings');
    await p.click('#set-observer');
  },
  settings_en_light: async p => {
    await p.goto(URL + '#settings');
    await p.click('#set-lang [data-v="en"]');
    await p.click('#set-theme [data-v="light"]');
  },
  home_light: async p => {
    await p.goto(URL + '#home');
    await p.evaluate(() => setTheme('light'));
  },
  amba: async p => {
    await p.goto(URL + '#home');
    await p.click('#assistant-btn');
    await wait(400);
  },
  jaka_fk: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(2500);
  },
  dash: async p => {
    await p.goto(URL + '#dash');
    await wait(1200);
  },
  tutorial_page: async p => {
    await p.goto(URL + '#tutorial');
    await wait(1200);
  },
  jac_view: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(2500);
    await p.evaluate(() => {
      const set = (i, v) => {
        const s = document.querySelectorAll('#theta-fk input[type=range]')[i];
        s.value = v;
        s.dispatchEvent(new Event('input'));
      };
      set(1, 60);
      set(2, -70);
      set(4, 50);
      document.getElementById('jac-toggle').click();
      document.querySelector('#jac-hud [data-col="1"]').click();
      fkScene.setView(0.9, 0.42, 7.5);
    });
    await wait(1500);
  },
  jac_light: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(2000);
    await p.evaluate(() => {
      setTheme('light');
      document.getElementById('jac-toggle').click();
    });
    await wait(1500);
  },
  title_screen_id: async p => {
    await p.evaluateOnNewDocument(() => localStorage.setItem('jakaSimSettings', JSON.stringify({ lang: 'id' })));
    await p.goto(URL + '#start');
    await wait(1200);
  },
  title_screen: async p => {
    await p.goto(URL + '#start');
    await wait(1200);
  },
  models: async p => {
    await p.goto(URL + '#models');
    await wait(1200);
  },
  model_form: async p => {
    await p.goto(URL + '#models');
    await wait(1000);
    await p.evaluate(() => modelAction('ur5e', 'dup'));
    await wait(800);
  },
  ur5e_fk: async p => {
    await p.evaluateOnNewDocument(() => localStorage.setItem('rasActiveModel', 'ur5e'));
    await p.goto(URL + '#jaka-fk');
    await wait(2500);
    const ee = await p.evaluate(() => {
      const u = toUser(eeFromThetas6([0, 0, 0, 0, 0, 0]));
      return [ACTIVE_MODEL.name, u.x.toFixed(4), u.y.toFixed(4), u.z.toFixed(4)].join(' ');
    });
    console.log('   UR5e zero pose tool point (m):', ee);
    await p.evaluate(() => {
      zzSetPose(READY_POSE);
      document.getElementById('jac-toggle').click();
    });
    await wait(1500);
  },
  jaka_ik: async p => {
    await p.goto(URL + '#jaka-ik');
    await wait(2500);
  },
  jaka_fk_side: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1500);
    await p.click('.jk-views [data-view="side"][data-t="fk"]');
    await wait(600);
  },
  jaka_fk_scrolled: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1500);
    await p.evaluate(() => window.scrollTo(0, 1100));
    await wait(600);
  },
  jaka_mobile: async p => {
    await p.setViewport({ width: 420, height: 860 });
    await p.goto(URL + '#jaka-ik');
    await wait(2000);
  },
  zz_unlocked: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1500);
    await p.evaluate(() => document.getElementById('zz-fk').scrollIntoView({ block: 'center' }));
    await wait(400);
  },
  zz_locked: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1500);
    await p.click('#zz-fk [data-zz="ready"]');
    await p.click('#zz-fk [data-zz="lock"]');
    await p.click('#zz-fk .zz-ghost');
    await p.evaluate(() => document.getElementById('zz-fk').scrollIntoView({ block: 'center' }));
    await wait(600);
  },
  zz_ik_locked: async p => {
    await p.goto(URL + '#jaka-ik');
    await wait(1500);
    await p.click('#zz-ik [data-zz="ready"]');
    await p.click('#zz-ik [data-zz="lock"]');
    await wait(600);
  },
  bd_main: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(2200);
  },
  bd_up_rumus: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#bd-upbar');
    await wait(700);
  },
  bd_pop: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#bd-open');
    await wait(500);
    await p.click('#bd-svg .bd-block[data-id="b3"]');
    await wait(700);
  },
  draw_main: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2200);
    await p.click('[data-dr-act="ready"]');
    await wait(900);
  },
  draw_axis: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="axis"]');
    await wait(1200);
  },
  draw_axis_zoom: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="axis"]');
    await p.evaluate(() => {
      fkScene.setView(0.75, 0.35, 3.6);
    });
    await wait(1200);
  },
  draw_on_robot: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="dh"]');
    await p.evaluate(() => {
      fkScene.setView(0.75, 0.35, 4.2);
    });
    await wait(1200);
  },
  draw_cine: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dr-act="cine-on"]');
    await wait(1500);
  },
  draw_cine_axis: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="axis"]');
    await p.click('#dr-mode [data-dr-act="cine-on"]');
    await p.evaluate(() => {
      fkScene.setView(0.75, 0.3, 4.4);
    });
    await wait(1500);
  },
  draw_math: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.evaluate(() => {
      toggleAccordion('dr-rule');
      document.querySelector('.accordion-header[data-target="dr-rule"]').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
    await wait(1200);
  },
  draw_ik: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.evaluate(() => {
      document.querySelector('.accordion-header[data-target="dr-ik"]').click();
    });
    await wait(900);
    await p.evaluate(() => {
      document.querySelector('.accordion-header[data-target="dr-ik"]').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
    await wait(900);
  },
  draw_ik_end: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.evaluate(() => {
      document.querySelector('.accordion-header[data-target="dr-ik"]').click();
    });
    await wait(900);
    await p.evaluate(() => {
      document.querySelector('table.dr-sol').scrollIntoView({ block: 'center' });
    });
    await wait(900);
  },
  draw_focus4: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="axis"]');
    await p.select('.dr-stagectl select[data-dr-focus]', '4');
    await wait(1200);
  },
  draw_focus2_robot: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="dh"]');
    await p.select('.dr-stagectl select[data-dr-focus]', '2');
    await wait(1200);
  },
  draw_light: async p => {
    await p.goto(URL + '#jaka-draw');
    await p.evaluate(() => setTheme('light'));
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="axis"]');
    await p.select('.dr-stagectl select[data-dr-focus]', 'robot');
    await wait(1200);
  },
  g_fk_play: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.click('#zz-fk [data-zz="ready"]');
    await p.click('#zz-fk [data-zz="lock"]');
    await p.evaluate(() => {
      TRAJ.speed = 1;
    });
    await p.click('#traj-play');
    await wait(5200);
  },
  g_fk_attached: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.click('#zz-fk [data-zz="ready"]');
    await p.evaluate(() => onWeightClick(3));
    await wait(900);
  },
  g_fk_math: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.click('#zz-fk [data-zz="ready"]');
    await p.evaluate(() => {
      toggleAccordion('math-fk');
    });
    await wait(900);
    await p.evaluate(() => {
      document.querySelector('.accordion-header[data-target="math-fk"]').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
    await wait(900);
  },
  g_fk_jac: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.click('#zz-fk [data-zz="ready"]');
    await p.evaluate(() => {
      toggleAccordion('jac-fk');
    });
    await wait(900);
    await p.evaluate(() => {
      document.querySelector('.accordion-header[data-target="jac-fk"]').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
    await wait(900);
  },
  g_fk_plots: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.click('#zz-fk [data-zz="ready"]');
    await p.click('#zz-fk [data-zz="lock"]');
    await p.evaluate(() => {
      TRAJ.speed = 4;
    });
    await p.click('#traj-play');
    await wait(4500);
    await p.evaluate(() => openPlotsModal('fk'));
    await wait(1200);
  },
  g_fk_warn: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.evaluate(() => {
      applyPose([0, -35, 0, 0, 0, 0], true);
    });
    await wait(1500);
  },
  g_ik_solved: async p => {
    await p.goto(URL + '#jaka-ik');
    await wait(1800);
    await p.click('#zz-ik [data-zz="ready"]');
    await p.click('#zz-ik [data-zz="lock"]');
    await p.evaluate(() => {
      [
        ['tx', 0.35],
        ['ty', 0.25],
        ['tz', 0.3]
      ].forEach(([i, v]) => {
        const e = document.getElementById(i);
        e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.getElementById('ik-animate').checked = false;
      document.getElementById('solveBtn').click();
    });
    await wait(1200);
  },
  g_ik_top: async p => {
    await p.goto(URL + '#jaka-ik');
    await wait(1800);
    await p.click('#zz-ik [data-zz="ready"]');
    await p.click('#zz-ik [data-zz="lock"]');
    await p.evaluate(() => {
      [
        ['tx', 0.35],
        ['ty', 0.25],
        ['tz', 0.3]
      ].forEach(([i, v]) => {
        const e = document.getElementById(i);
        e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true }));
      });
      window.scrollTo(0, 0);
    });
    await wait(1000);
  },
  g_bd_bad: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#bd-open');
    await wait(400);
    await p.click('#bd-swap');
    await wait(700);
  },
  g_bd_run: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#zz-bd [data-zz="ready"]');
    await p.click('#zz-bd [data-zz="lock"]');
    await p.evaluate(() => {
      TRAJ.speed = 1;
    });
    await p.click('#bd-play');
    await wait(4200);
    await p.click('#bd-open');
    await wait(700);
  },
  g_lp_preview: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.evaluate(() => {
      zzSetPose(READY_POSE);
      zzLock();
      REP.robotTouched = true;
      rpSaveNow('fk');
      const P = planPickPlace(3);
      P.src = 'fk';
      rpCapture(P);
      rpReport('fk');
      if (!REP.reports.length) rpAnswer('go');
      rpPreview(REP.reports[0].id);
    });
    await wait(2500);
  },
  g_lp_list: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.evaluate(() => {
      zzSetPose(READY_POSE);
      zzLock();
      REP.robotTouched = true;
      rpSaveNow('fk');
      const P = planPickPlace(3);
      P.src = 'fk';
      rpCapture(P);
      rpReport('fk');
      if (!REP.reports.length) rpAnswer('go');
      window.scrollTo(0, 0);
    });
    await wait(1500);
  },
  g_draw_slider: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('#dr-mode [data-dsw="axis"]');
    await p.evaluate(() => {
      applyPose([30, 60, -70, 40, 90, 20], true);
      drRefresh();
      document.querySelector('.dr-head').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
    await p.select('.dr-stagectl select[data-dr-focus]', 'robot');
    await wait(1200);
  },
  g_draw_min: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-mode [data-dsw="axis"]');
    await p.evaluate(() => {
      ['rot', 'rev', 'theta', 'alpha', 'ee'].forEach(k => {
        document.querySelector('#dr-mode input[data-dv="' + k + '"]').click();
      });
    });
    await p.select('.dr-stagectl select[data-dr-focus]', 'robot');
    await wait(1200);
  },
  g_draw_unlock: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('[data-dr-act="ready"]');
    await p.click('#dr-lock');
    await p.evaluate(() => {
      document.querySelector('.dr-head').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
    await wait(900);
  },
  draw_mobile: async p => {
    await p.setViewport({ width: 420, height: 860 });
    await p.goto(URL + '#jaka-draw');
    await wait(2000);
    await p.click('#dr-mode [data-dsw="axis"]');
    await wait(900);
  },
  rujukan_geo: async p => {
    await p.goto(URL + '#jaka-draw');
    await wait(800);
    await p.evaluate(() => gotoReference('pd-geo'));
    await wait(1200);
  },
  bd_up_energi: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#bd-upbar');
    await p.click('.bd-up-tabs [data-up="energi"]');
    await wait(900);
  },
  bd_loop_stream: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#zz-bd [data-zz="ready"]');
    await p.click('#zz-bd [data-zz="lock"]');
    await p.evaluate(() => {
      TRAJ.speed = 4;
    });
    await p.click('#bd-play');
    await wait(5000);
    await p.click('#bd-upbar');
    await p.click('.bd-up-tabs [data-up="stream"]');
    await wait(600);
  },
  bd_loop_running: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#zz-bd [data-zz="ready"]');
    await p.click('#zz-bd [data-zz="lock"]');
    await p.evaluate(() => {
      TRAJ.speed = 2;
    });
    await p.click('#bd-play');
    await wait(3500);
  },
  bd_params: async p => {
    await p.goto(URL + '#jaka-bd');
    await wait(1500);
    await p.click('#bd-upbar');
    await p.click('.bd-up-tabs [data-up="robot"]');
    await wait(500);
  },
  exit_confirm: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(800);
    await p.click('#jk-exit');
    await wait(200);
  },
  rujukan_top: async p => {
    await p.goto(URL + '#reference');
    await wait(800);
  },
  rujukan_jump: async p => {
    await p.goto(URL + '#vector-3');
    await wait(800);
    await p.click('#vs-reference');
    await wait(900);
  },
  rujukan_quintic: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(800);
    await p.evaluate(() => gotoReference('pd-quintic'));
    await wait(900);
  },
  vs1: async p => {
    await p.goto(URL + '#vector-1');
    await wait(1200);
  },
  vs1_scrolled: async p => {
    await p.goto(URL + '#vector-1');
    await wait(1200);
    await p.evaluate(() => window.scrollTo(0, 900));
    await wait(500);
  },
  vs3: async p => {
    await p.goto(URL + '#vector-3');
    await wait(1200);
  },
  vs5: async p => {
    await p.goto(URL + '#vector-5');
    await wait(1200);
  },
  vs4_light: async p => {
    await p.goto(URL + '#vector-4');
    await p.evaluate(() => setTheme('light'));
    await wait(1200);
  },
  vs2_mobile: async p => {
    await p.setViewport({ width: 420, height: 860 });
    await p.goto(URL + '#vector-2');
    await wait(1200);
    await p.evaluate(() => window.scrollTo(0, 500));
    await wait(400);
  },
  vs5_6dof: async p => {
    await p.goto(URL + '#vector-5');
    await wait(900);
    await p.evaluate(() => {
      [...document.querySelectorAll('#dof-select button')][5].click();
      document.querySelector('#view-v5 .grid-btn[data-mode="numbers"]').click();
      window.scrollTo(0, 1400);
    });
    await wait(700);
  },
  vs2_numbers: async p => {
    await p.goto(URL + '#vector-2');
    await wait(900);
    await p.evaluate(() => document.querySelector('#view-v2 .grid-btn[data-mode="numbers"]').click());
    await wait(500);
  },
  pg_vs1: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ pengamat: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#vector-1');
    await wait(1200);
  },
  pg_fk: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ pengamat: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-fk');
    await wait(2200);
  },
  pg_ik: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ pengamat: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-ik');
    await wait(2200);
  },
  pg_bd: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ pengamat: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-bd');
    await wait(1800);
    await p.click('#bd-upbar');
    await wait(600);
  },
  tut_home: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await wait(600);
  },
  tut_amba: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(5, 1);
    });
    await wait(700);
  },
  tut_set: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(9, 1);
    });
    await wait(700);
  },
  tut_vec: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(10, 1);
    });
    await wait(1500);
  },
  tut_zz: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(17, 1);
    });
    await wait(2000);
  },
  tut_traj: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(20, 1);
    });
    await wait(2000);
  },
  tut_bdup: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(27, 1);
    });
    await wait(1500);
  },
  tut_rj: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(28, 1);
    });
    await wait(1200);
  },
  tut_mobile: async p => {
    await p.setViewport({ width: 420, height: 860 });
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await p.evaluate(() => {
      TUT.paused = true;
      tutShow(17, 1);
    });
    await wait(1800);
  },
  tut_auto: async p => {
    await p.goto(URL + '#home');
    await p.click('#menu-tutorial');
    await p.click('#tut-start-tour');
    await wait(5600);
  },
  lp_fk: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
  },
  lp_warn: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-fk');
    await wait(1500);
    await p.click('#view-v7 [data-lp-act="save"]');
    await wait(300);
  },
  lp_bd: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-bd');
    await wait(1500);
    await p.evaluate(() => {
      REP.robotTouched = true;
      document.querySelector('#view-bd [data-lp-act="save"]').click();
      document.querySelector('#view-bd .lp-bar').scrollIntoView({ block: 'center' });
    });
    await wait(500);
  },
  vec_zero: async p => {
    await p.goto(URL + '#vector-1');
    await p.evaluate(() => {
      ['v1-ax', 'v1-ay', 'v1-az'].forEach(id => {
        const e = document.getElementById(id);
        e.value = 0;
        e.dispatchEvent(new Event('input'));
      });
    });
    await wait(500);
  },
  lp_code_fk: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-fk');
    await wait(1500);
    await p.click('#view-v7 [data-lp-act="code"]');
    await wait(300);
  },
  lp_code_bd: async p => {
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('jakaSimSettings', JSON.stringify({ laporan: true }));
      } catch (e) {}
    });
    await p.goto(URL + '#jaka-bd');
    await wait(1500);
    await p.click('#view-bd [data-lp-act="code"]');
    await wait(300);
    await p.click('[data-code-lang="sim"]');
    await wait(300);
  },
  v2_start: async p => {
    await p.goto(URL + '#start');
    await wait(500);
  },
  v2_dash: async p => {
    await p.goto(URL + '#dash');
    await wait(500);
  },
  v2_dash_light: async p => {
    await p.goto(URL + '#dash');
    await p.evaluate(() => setTheme('light'));
    await wait(400);
  },
  v2_sim: async p => {
    await p.goto(URL + '#home');
    await wait(400);
  },
  v2_settings: async p => {
    await p.goto(URL + '#settings');
    await p.evaluate(() => document.getElementById('set-ctl-ip').scrollIntoView({ block: 'center' }));
    await wait(400);
  },
  v2_control_view: async p => {
    await p.goto(URL + '#control');
    await wait(1500);
  },
  v2_control: async p => {
    await p.goto(URL + '#control');
    await wait(1200);
    await p.evaluate(() => {
      const q = [25, 80, -75, 85, 90, 15],
        t = ctlPose(ctlFK(q));
      CTL.conn = true;
      CTL.mode = 'real';
      ctlState({
        connected: true,
        mode: 'real',
        ip: '192.168.1.100',
        power: true,
        enabled: true,
        estop: false,
        moving: false,
        q,
        tcp: t,
        t: 1,
        joints: [0, 1, 2, 3, 4, 5].map(i => ({
          i: 0.4 + i * 0.1,
          v: 47.9,
          temp: 31 + i,
          tau: [0.2, 38.5, 11.2, 1.4, 0.6, 0.1][i]
        })),
        cab: [0, 0, 32, 96.5, 2.1]
      });
    });
    await wait(1200);
  },
  v2_control_pos: async p => {
    await SCEN.v2_control(p);
    await p.evaluate(() => {
      ctlTab('pos');
      const ins = [...document.querySelectorAll('#ctl-ik-in input')];
      [420, -160, 260].forEach((v, i) => (ins[i].value = v));
      ctlIkSolve();
    });
    await wait(1000);
  },
  v2_control_eq: async p => {
    await SCEN.v2_control_pos(p);
    await p.evaluate(() => ctlEqOpen(true));
    await wait(1500);
  },
  v2_control_mon: async p => {
    await SCEN.v2_control(p);
    await p.evaluate(() => {
      ctlTab('mon');
      for (let k = 0; k < 40; k++)
        CTL.hist.push({ t: k * 0.5, tau: [0.2, 38 + Math.sin(k / 4) * 4, 11 + Math.cos(k / 5) * 2, 1.4, 0.6, 0.1] });
      ctlMon();
      CTL.chartT = 0;
      ctlMon();
    });
    await wait(1200);
  },
  v2_control_prog: async p => {
    await SCEN.v2_control(p);
    await p.evaluate(() => {
      ctlTab('prog');
      ctlLoadTemplate('pipeline');
      ctlLog('sys', '=== Program dijalankan (robot virtual) ===');
      ctlLog('out', 'Setpoint awal  : [482.0, 114.0, 443.1]');
      ctlLog('out', 'titik 1: galat posisi 0.000 mm');
      document.getElementById('ctl-tpl-btn').click();
    });
    await wait(800);
  },
  jaka_fk_home: async p => {
    await p.goto(URL + '#jaka-fk');
    await wait(1800);
    await p.click('#view-v7 [data-zz="ready"]');
    await wait(1200);
  }
};
(async () => {
  const pick = process.argv.slice(2);
  const names = pick.length ? pick : Object.keys(SCEN);
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--allow-file-access-from-files']
  }); // GPU normal: mode SwiftShader membuat semua rAF macet berkala (bukan bug halaman)
  void {};
  const errs = [];
  for (const n of names) {
    const p = await b.newPage();
    await p.setViewport({ width: 1400, height: 900 });
    p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
      } catch (e) {}
    });
    await SCEN[n](p);
    await wait(700);
    await p.screenshot({ path: path.join(OUT, n + '.png') });
    console.log('ok', n);
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ERROR HALAMAN:\n' + errs.join('\n') : 'tidak ada error halaman');
})();
