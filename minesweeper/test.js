/* Minesweeper: tests in the real PortD 1.0.0, in headless Chrome, with real mouse, keyboard and touch input.
   Run: node minesweeper/test.js   (after node minesweeper/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const CFG = 'P:\\User\\Config\\minesweeper';

(async () => {
  console.log('Minesweeper tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile({ touch: true });
  const page = await H.openPortD(ctx), P = H.on(page);
  let f;
  const st = () => f.evaluate(() => { const s = __ms.state; return { W: s.W, H: s.H, M: s.M, over: s.over, revealed: s.revealed, started: s.started, level: s.level, kc: s.kc, flags: [...s.flag].filter(x => x === 1).length }; });
  const cell = i => f.locator('#c' + i);
  const face = () => f.locator('#face').innerText();
  /* the mine layout, read after the first click only to choose where to click next, as a player would after thinking */
  const layout = () => f.evaluate(() => ({ mine: [...__ms.state.mine], open: [...__ms.state.open], adj: [...__ms.state.adj], W: __ms.state.W }));

  section('Installing the ported package');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('PortD 1.0 accepts the format 3 package and shows its details', /^Install program/.test(d) && /Minesweeper/.test(d) && /Version\s+1\.0\.0/.test(d) && /Classic mine-clearing puzzle/.test(d) && /Files\s+4 files, /.test(d), d);
  check('…with the 💣 icon', await P.ev(() => !!document.querySelector('.dlg .phead .ico')) && /💣/.test(await P.ev(() => document.querySelector('.dlg .phead').textContent)));
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\minesweeper') === 'js|index.html|manifest.json|style.css' && await P.icon('Minesweeper').count() === 1);
  await P.closeAll();

  section('A beginner game, won with the mouse');
  await P.icon('Minesweeper').dblclick(); await P.settle(500); f = await P.frame();
  check('it starts a Beginner game (9×9, 10 mines), titled for the level', JSON.stringify(await st()).includes('"W":9,"H":9,"M":10') && await P.titles() === 'Minesweeper – Beginner' && await f.locator('#mines').innerText() === '010');
  check('the board is focused for the keyboard', await f.evaluate(() => document.activeElement.id) === 'board');
  check('the colours follow the system (light here), as before', await f.evaluate(() => document.documentElement.dataset.themeChoice === 'auto' && getComputedStyle(document.body).backgroundColor === 'rgb(238, 241, 246)'));
  await cell(40).click(); await P.settle();
  let s = await st();
  check('the first click is always safe and opens an area', s.started && !s.over && s.revealed > 1, s);
  check('…and starts the clock', await P.settle(1300) || /^00[1-9]$/.test(await f.locator('#time').innerText()), await f.locator('#time').innerText());
  let L = await layout();
  check('the first click and its neighbours hold no mine', [30, 31, 32, 39, 40, 41, 48, 49, 50].every(i => !L.mine[i]));
  const mineAt = L.mine.indexOf(1);
  await cell(mineAt).click({ button: 'right' }); await P.settle();
  check('right-click puts a flag, and the mine counter goes down', await cell(mineAt).innerText() === '🚩' && await f.locator('#mines').innerText() === '009');
  await cell(mineAt).click(); await P.settle();
  check('left-clicking a flag does nothing', !(await st()).over && await cell(mineAt).innerText() === '🚩');
  await cell(mineAt).click({ button: 'right' }); await P.settle();
  check('right-click again makes it a question mark', await cell(mineAt).innerText() === '❓' && await f.locator('#mines').innerText() === '010');
  await cell(mineAt).click({ button: 'right' }); await P.settle();
  check('…and again clears it', await cell(mineAt).innerText() === '');
  /* chord: a number whose mines are all flagged opens its other neighbours */
  L = await layout();
  const nb = i => { const x = i % 9, y = i / 9 | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < 9 && b < 9) r.push(b * 9 + a); } return r; };
  const num = L.open.findIndex((o, i) => o && L.adj[i] > 0 && nb(i).some(j => !L.open[j] && !L.mine[j]));
  if (num >= 0) {
    for (const j of nb(num).filter(j => L.mine[j])) await cell(j).click({ button: 'right' });
    const before = (await st()).revealed;
    await cell(num).click(); await P.settle();
    check('clicking a number whose flags are all placed reveals its neighbours', (await st()).revealed > before && !(await st()).over);
  } else note('no number with hidden safe neighbours on this board: chording checked in the keyboard game');
  L = await layout();
  for (let i = 0; i < 81; i++) if (!L.mine[i] && !L.open[i] && !(await st()).over) { await cell(i).click(); }
  await P.settle(300);
  s = await st();
  check('revealing every safe square wins', s.over && s.revealed === 71 && await face() === '😎', s);
  check('…the mines are flagged and the counter shows 000', s.flags === 10 && await f.locator('#mines').innerText() === '000');
  const best = JSON.parse(await P.read(CFG + '\\best.json'));
  check('the best time for Beginner is saved in best.json, with the date', best.beginner && best.beginner.t >= 1 && /^\d{4}-\d\d-\d\d$/.test(best.beginner.d), best);
  check('a new record is announced through PortD', /^Minesweeper: new beginner record, \d+s$/.test(await P.toast()), await P.toast());

  section('Losing');
  await f.locator('#face').click(); await P.settle();
  check('the face starts a new game', !(await st()).started && await face() === '🙂');
  await cell(0).click(); await P.settle();
  L = await layout();
  const wrongFlag = L.mine.findIndex((m, i) => !m && !L.open[i]);
  if (wrongFlag >= 0) await cell(wrongFlag).click({ button: 'right' });
  await cell(L.mine.indexOf(1)).click(); await P.settle();
  check('clicking a mine loses: the face, the red square, all mines shown', (await st()).over && await face() === '😵' && await cell(L.mine.indexOf(1)).evaluate(e => e.classList.contains('boom')) && await f.evaluate(() => [...document.querySelectorAll('#board .c')].filter(c => c.textContent === '💣').length) === 10);
  if (wrongFlag >= 0) check('…and a wrong flag is crossed out', await cell(wrongFlag).innerText() === '❌');
  check('the message says how to try again', /Boom! Press the face to try again\./.test(await f.locator('#msg').innerText()));
  const lostBest = JSON.parse(await P.read(CFG + '\\best.json')).beginner.t;
  check('a lost game does not change the best time', lostBest === best.beginner.t);

  section('Keyboard (added in the port)');
  await f.locator('#board').focus(); await page.keyboard.press('F2'); await P.settle();
  check('F2 starts a new game', !(await st()).started && !(await st()).over);
  await page.keyboard.press('Home'); for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
  check('arrow keys move the cursor', (await st()).kc === 40 && await f.evaluate(() => document.getElementById('board').getAttribute('aria-activedescendant')) === 'c40');
  await page.keyboard.press('Space'); await P.settle();
  check('Space reveals the square under the cursor, safely on the first move', (await st()).started && !(await st()).over && (await st()).revealed > 1);
  L = await layout();
  const hid = L.mine.findIndex((m, i) => m && !L.open[i]);
  await f.evaluate(() => 0);
  await page.keyboard.press('Home'); for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowUp');
  const target = hid, kx = target % 9, ky = target / 9 | 0;
  for (let k = 0; k < ky; k++) await page.keyboard.press('ArrowDown');
  for (let k = 0; k < kx; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('f'); await P.settle();
  check('F flags the square under the cursor', await cell(target).innerText() === '🚩' && (await st()).kc === target);
  check('each square says what it is to a screen reader', /^Row \d, column \d: flagged$/.test(await cell(target).getAttribute('aria-label')));
  /* finish the game from the keyboard: walk to each safe square and press Enter */
  L = await layout();
  let cur = target;
  for (let i = 0; i < 81 && !(await st()).over; i++) {
    if (L.mine[i] || (await layout()).open[i]) continue;
    const dx = i % 9 - cur % 9, dy = (i / 9 | 0) - (cur / 9 | 0);
    for (let k = 0; k < Math.abs(dy); k++) await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    for (let k = 0; k < Math.abs(dx); k++) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    await page.keyboard.press('Enter'); cur = i;
  }
  await P.settle(300);
  check('a whole game can be won from the keyboard', (await st()).over && (await st()).revealed === 71 && await face() === '😎');

  section('Touch: long-press and Flag mode');
  await f.locator('#face').click(); await P.settle();
  const cdp = await ctx.newCDPSession(page);
  const centre = async i => { const b = await cell(i).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const touch = async (i, ms) => { const p = await centre(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await P.settle(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await P.settle(150); };
  await touch(40, 60);
  check('a tap reveals', (await st()).started && (await st()).revealed > 1, await st());
  L = await layout();
  const t2 = L.open.findIndex((o, i) => !o);
  await touch(t2, 650);
  check('a long press flags instead', await cell(t2).innerText() === '🚩' && !(await st()).over);
  await f.locator('#flagMode').click(); await P.settle();
  const t3 = (await layout()).open.findIndex((o, i) => !o && i !== t2);
  await touch(t3, 60);
  check('in Flag mode a tap flags', await cell(t3).innerText() === '🚩' && await f.locator('#flagMode').getAttribute('aria-pressed') === 'true');
  await f.locator('#flagMode').click();

  section('Levels, Custom, and the board scaling');
  await f.locator('#level').selectOption('expert'); await P.settle(300);
  s = await st();
  check('Expert is 30×16 with 99 mines, titled for the level', s.W === 30 && s.H === 16 && s.M === 99 && await P.titles() === 'Minesweeper – Expert');
  const box = await f.locator('#board').boundingBox(), win = await f.locator('#wrap').boundingBox();
  check('the board scales to fit the window', box.width <= win.width && box.height <= win.height && box.width > 300, [box, win]);
  check('the level is saved in settings.json', JSON.parse(await P.read(CFG + '\\settings.json')).level === 'expert');
  await f.locator('#level').selectOption('custom'); await P.settle();
  check('Custom… opens its dialog with the last custom size, focused on Width', await f.evaluate(() => document.getElementById('customDlg').classList.contains('show') && document.activeElement.id === 'cw' && document.getElementById('cw').value === '20'));
  await f.locator('#cw').fill('8'); await f.locator('#ch').fill('6'); await f.locator('#cm').fill('100');
  await page.keyboard.press('Enter'); await P.settle(300);
  s = await st();
  check('Start makes the custom field, keeping mines below the number of squares', s.W === 8 && s.H === 6 && s.M === 47 && JSON.stringify(JSON.parse(await P.read(CFG + '\\settings.json')).custom) === '[8,6,47]', s);
  await f.locator('#level').selectOption('custom'); await P.settle();
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc cancels the custom dialog', await f.evaluate(() => !document.getElementById('customDlg').classList.contains('show')) && (await st()).level === 'custom');
  await f.locator('#level').selectOption('beginner'); await P.settle();

  section('Best times, Reset with a second click');
  await f.locator('#bestBtn').click(); await P.settle();
  const tbl = await f.locator('#bestTbl').innerText();
  check('Best times lists each level, with the Beginner record and its date', /Beginner\s+\d+ s\s+\d{4}-\d\d-\d\d/.test(tbl) && /Intermediate\s+—/.test(tbl) && /Expert\s+—/.test(tbl), tbl);
  await f.locator('#bestReset').click(); await P.settle();
  check('the first click on Reset only asks', await f.locator('#bestReset').innerText() === 'Click again to reset' && !!JSON.parse(await P.read(CFG + '\\best.json')).beginner);
  await f.locator('#bestReset').click(); await P.settle();
  check('the second click resets', JSON.stringify(JSON.parse(await P.read(CFG + '\\best.json'))) === '{}' && /Beginner\s+—/.test(await f.locator('#bestTbl').innerText()));
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc closes it, and focus goes back', await f.evaluate(() => !document.getElementById('bestDlg').classList.contains('show') && document.activeElement.id === 'bestBtn'));
  await page.keyboard.press('F1'); await P.settle();
  check('F1 shows How to play, which mentions the keyboard', await f.evaluate(() => document.getElementById('helpDlg').classList.contains('show')) && /Keyboard:/.test(await f.locator('#helpDlg').innerText()));
  await page.keyboard.press('Escape');

  section('Theme, and reloading');
  await f.locator('#themeBtn').click(); await P.settle(200);
  check('the theme button goes from following the system to light', await f.evaluate(() => document.documentElement.dataset.themeChoice) === 'light');
  await f.locator('#themeBtn').click(); await P.settle(200);
  check('…then dark', await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(30, 36, 48)' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  await P.closeAll(); await H.reload(page);
  await P.icon('Minesweeper').dblclick(); await P.settle(500); f = await P.frame();
  check('after reloading PortD the level and the theme are kept', (await st()).level === 'beginner' && await f.evaluate(() => document.documentElement.dataset.themeChoice) === 'dark');
  await f.locator('#themeBtn').click();
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Minesweeper', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile();
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  check('it plays: a first click opens an area', await (async () => { await sp.locator('#c40').click(); await sp.waitForTimeout(100); return sp.evaluate(() => __ms.state.revealed > 1); })());
  await sp.locator('#level').selectOption('intermediate'); await sp.waitForTimeout(100); await sp.reload(); await sp.waitForTimeout(300);
  check('settings are kept in localStorage (0.x saved nothing outside PortD)', await sp.evaluate(() => __ms.state.W) === 16);
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
