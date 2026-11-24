/* Freeze Test: tests in the real PortD, in headless Chrome or Edge, with real mouse and keyboard input.
   Run: node freeze-test/test.js   (after node freeze-test/build.js). PORTD=<a PortD 1.1 build> also checks the red bar. */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const CFG = 'P:\\User\\Config\\freeze-test';

(async () => {
  console.log('Freeze Test tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile();
  const page = await H.openPortD(ctx), P = H.on(page);
  const v = await P.ev(() => PortDHost.version), bar = v.split('.').map(Number)[1] >= 1 || +v.split('.')[0] > 1;
  /* whether a frame really answers: code run in it, with a time limit */
  const answers = fr => Promise.race([fr.evaluate(() => 1).then(() => true, () => false), new Promise(r => setTimeout(() => r(false), 1500))]);
  let f;

  section('Installing the package');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('PortD accepts the format 3 package and shows its details', /^Install program/.test(d) && /Freeze Test/.test(d) && /Version\s+1\.0\.0/.test(d) && /makes itself stop responding/.test(d), d);
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\freeze-test') === 'js|index.html|manifest.json|style.css' && await P.icon('Freeze Test').count() === 1);
  await P.closeAll();

  section('The clock and the buttons');
  await P.icon('Freeze Test').dblclick(); await P.settle(500); f = await P.frame();
  check('the window opens titled Freeze Test', await P.titles() === 'Freeze Test');
  const b0 = await f.evaluate(() => __fz.beats); await P.settle(800);
  check('the clock runs while the program answers', await f.evaluate(() => __fz.beats) > b0 && /^Answering · /.test(await f.locator('#beat').innerText()));
  check('both buttons are there', await f.locator('#shortBtn').innerText() === 'Freeze for 15 seconds, then recover' && await f.locator('#goodBtn').innerText() === 'Freeze for good');
  check('the colours follow the system (light here)', await f.evaluate(() => document.documentElement.dataset.themeChoice === 'auto' && getComputedStyle(document.body).backgroundColor === 'rgb(244, 246, 250)'));

  section('Freeze for 15 seconds, then recover');
  await P.ev(() => PortDHost.launch('todo')); await P.settle(600);
  const todo = await P.frame('.win iframe[title="To-Do"]');
  await P.ev(() => PortDHost.wm.wins.find(w => w.app === 'freeze-test').focus()); await P.settle();
  const t0 = Date.now();
  await f.locator('#shortBtn').click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(1500);
  check('while it is frozen, it does not answer', !await answers(f));
  const todoToo = !await answers(todo);
  note('while Freeze Test is frozen, To-Do ' + (todoToo ? 'does not answer either (the programs share one process)' : 'still answers'));
  check('PortD itself keeps working: the PortD menu opens', await (async () => { await page.locator('#start').click(); await P.settle(); const o = await P.ev(() => document.querySelector('#startmenu').classList.contains('open')); await page.keyboard.press('Escape'); return o; })());
  if (bar) {
    await page.waitForSelector('#frbar', { timeout: 9000 }).catch(() => {});
    check('PortD ' + v + ' shows its red bar and marks the window (Not responding)', await P.ev(() => !!document.querySelector('#frbar') && [...document.querySelectorAll('.win.hung .ttl')].some(t => t.textContent === 'Freeze Test')));
  } else note('PortD ' + v + ' has no red bar for frozen programs (1.1 and later have)');
  await f.waitForFunction(() => /^Recovered at /.test(document.getElementById('status').textContent), null, { timeout: 20000 }).catch(() => {});
  const took = Date.now() - t0, st = await f.locator('#status').innerText();
  check('it recovers by itself after about 15 seconds and says so (' + (took / 1000).toFixed(1) + ' s)', /^Recovered at .+, after 15 seconds\.$/.test(st) && took >= 14500 && took < 19000, st);
  check('the clock runs again', await (async () => { const b = await f.evaluate(() => __fz.beats); await P.settle(600); return await f.evaluate(() => __fz.beats) > b; })());
  check('To-Do answers again', await answers(todo));
  if (bar) { await page.waitForFunction(() => !document.querySelector('#frbar'), null, { timeout: 5000 }).catch(() => {}); check('the red bar goes by itself', await P.ev(() => !document.querySelector('#frbar'))); }

  section('Freeze for good, after a second click');
  await f.locator('#goodBtn').click(); await P.settle();
  check('the first click only arms it and warns that other programs freeze too', await f.evaluate(() => __fz.armed) && await f.locator('#goodBtn').innerText() === 'Click again to freeze for good' && /Other open programs will freeze too/.test(await f.locator('#status').innerText()));
  await P.settle(3300);
  check('without a second click within 3 seconds it disarms', !await f.evaluate(() => __fz.armed) && await f.locator('#goodBtn').innerText() === 'Freeze for good' && await answers(f));
  await f.locator('#goodBtn').focus(); await page.keyboard.press('Enter'); await P.settle(100);
  check('Enter on the button arms it too', await f.evaluate(() => __fz.armed));
  await page.keyboard.press('Enter'); await P.settle(1200);
  check('a second press freezes it, and it stays frozen', !await answers(f) && (await P.settle(2000), !await answers(f)));
  if (bar) {
    await page.waitForSelector('#frbar', { timeout: 9000 }).catch(() => {});
    await page.locator('#frbar button').click(); await P.settle(400);
    check('PortD ' + v + ': Close all programs closes it and To-Do', await P.ev(() => !PortDHost.wm.wins.some(w => w.frame)));
  } else {
    await page.locator('.win', { has: page.locator('.ttl', { hasText: /^Freeze Test$/ }) }).locator('.wbtn.x').click(); await P.settle(300);
    check('its × button closes it', await P.ev(() => !PortDHost.wm.wins.some(w => w.app === 'freeze-test')));
    await page.locator('.win', { has: page.locator('.ttl', { hasText: /^To-Do/ }) }).locator('.wbtn.x').click(); await P.settle(300);
  }
  await P.ev(() => PortDHost.launch('todo')); await P.settle(600);
  check('with all program windows closed, a program opened again answers', await answers(await P.frame('.win iframe[title="To-Do"]')));
  await P.closeAll();

  section('Theme, and reloading');
  await P.icon('Freeze Test').dblclick(); await P.settle(500); f = await P.frame();
  await f.locator('#themeBtn').click(); await P.settle(200);
  check('the theme button goes from following the system to light', await f.evaluate(() => document.documentElement.dataset.themeChoice) === 'light');
  await f.locator('#themeBtn').click(); await P.settle(200);
  check('…then dark, saved in settings.json', await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(30, 36, 48)' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  await P.closeAll(); await H.reload(page);
  await P.icon('Freeze Test').dblclick(); await P.settle(500); f = await P.frame();
  check('after reloading PortD the theme is kept', await f.evaluate(() => document.documentElement.dataset.themeChoice) === 'dark');
  check('the theme button has a screen-reader name', /^Theme: /.test(await f.locator('#themeBtn').getAttribute('aria-label')));
  await f.locator('#themeBtn').click();
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Freeze Test', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile();
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  check('it opens and its clock runs', /^Answering · /.test(await sp.locator('#beat').innerText()));
  await sp.locator('#themeBtn').click(); await sp.waitForTimeout(100); await sp.reload(); await sp.waitForTimeout(300);
  check('the theme is kept in localStorage', await sp.evaluate(() => document.documentElement.dataset.themeChoice) === 'light');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
