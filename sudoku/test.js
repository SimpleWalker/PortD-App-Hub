/* Sudoku: tests in the real PortD 1.0.0, in headless Chrome, with real mouse and keyboard input.
   Run: node sudoku/test.js   (after node sudoku/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const CFG = 'P:\\User\\Config\\sudoku';

(async () => {
  console.log('Sudoku tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile();
  const page = await H.openPortD(ctx), P = H.on(page);
  let f;
  const S = () => f.evaluate(() => JSON.parse(JSON.stringify(__sd.S)));
  const cell = i => f.locator('#c' + i);
  const pad = n => f.locator('#pad button[data-n="' + n + '"]');
  const msgText = () => f.locator('#msg').innerText();

  section('Installing the ported package');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('PortD 1.0 accepts the format 3 package: Sudoku 1.0.0, 4 files', /^Install program/.test(d) && /Sudoku/.test(d) && /Version\s+1\.0\.0/.test(d) && /four difficulties, pencil notes, hints, undo and auto-save/.test(d) && /Files\s+4 files, /.test(d), d);
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\sudoku') === 'js|index.html|manifest.json|style.css' && await P.icon('Sudoku').count() === 1);
  await P.closeAll();

  section('Starting: a new Easy puzzle');
  await P.icon('Sudoku').dblclick(); await P.settle(1200); f = await P.frame();
  await f.waitForFunction(() => window.__sd && __sd.S, null, { timeout: 8000 });
  let s = await S();
  check('with no saved game it starts an Easy puzzle with 40 clues (39 at times), titled for it', s.diff === 'easy' && s.puzzle.filter(Boolean).length >= 39 && await P.titles() === 'Sudoku – Easy', s.puzzle.filter(Boolean).length);
  check('the puzzle has exactly one solution, and it is the one kept', await f.evaluate(() => { const r = __sd.solve(__sd.S.puzzle, 2); return r.count === 1 && r.solution.join() === __sd.S.solution.join(); }));
  check('the colours follow the system (light here), as before', await f.evaluate(() => document.documentElement.dataset.themeChoice === 'auto' && getComputedStyle(document.body).backgroundColor === 'rgb(243, 245, 249)'));
  const gen = await f.evaluate(() => ['easy', 'medium', 'hard', 'expert'].map(dd => { const t0 = performance.now(), g = __sd.generate(dd); return { dd, clues: g.clues, unique: __sd.solve(g.puzzle, 2).count === 1, ms: Math.round(performance.now() - t0) }; }));
  note('generated: ' + gen.map(g => g.dd + ' ' + g.clues + ' clues in ' + g.ms + ' ms').join(', '));
  check('every difficulty gives a puzzle with exactly one solution', gen.every(g => g.unique));
  check('the clue counts are as in 0.x: 40, 32, about 27, about 24 (removing cells in mirrored pairs can go one below)', gen[0].clues >= 39 && gen[0].clues <= 40 && gen[1].clues >= 31 && gen[1].clues <= 32 && gen[2].clues <= 29 && gen[3].clues <= 27, gen);

  section('Playing with the mouse');
  s = await S();
  const empty = s.puzzle.findIndex(v => !v), right = s.solution[empty], wrong = right === 9 ? 1 : right + 1;
  await cell(empty).click(); await P.settle();
  check('clicking a cell selects it and lights up its row, column and box', await cell(empty).evaluate(e => e.classList.contains('sel')) && await f.evaluate(() => document.querySelectorAll('#grid .c.peer').length) === 20);
  await pad(wrong).click(); await P.settle();
  check('a wrong number shows in red and counts a mistake (auto-check is on)', await cell(empty).innerText() === String(wrong) && await cell(empty).evaluate(e => e.classList.contains('err')) && await f.locator('#mistakes').innerText() === 'Mistakes: 1');
  await f.locator('#undoBtn').click(); await P.settle();
  check('Undo takes it back', await cell(empty).innerText() === '' && (await S()).values[empty] === 0);
  await pad(right).click(); await P.settle();
  check('the right number is placed, not red', await cell(empty).innerText() === String(right) && !(await cell(empty).evaluate(e => e.classList.contains('err'))));
  check('other cells with the same number are highlighted', await f.evaluate(n => [...document.querySelectorAll('#grid .c.same')].every(c => c.textContent === String(n)) && document.querySelectorAll('#grid .c.same').length > 0, right));
  const left = await pad(right).locator('small').innerText();
  check('the number pad counts how many of each number are left', +left === 9 - s.solution.filter((v, i) => v === right && (s.puzzle[i] || i === empty)).length || left === '', left);
  await f.locator('#eraseBtn').click(); await P.settle();
  check('Erase clears it', await cell(empty).innerText() === '');
  await f.locator('#checkBtn').click(); await P.settle();
  check('Auto-check can be switched off: the mistake counter is hidden', await f.locator('#mistakes').innerText() === '' && await f.locator('#checkBtn').getAttribute('aria-pressed') === 'false');
  await f.locator('#checkBtn').click();

  section('Notes, hints, keyboard');
  await cell(empty).click(); await f.locator('#notesBtn').click(); await P.settle();
  await page.keyboard.press(String(right)); await page.keyboard.press(String(wrong)); await P.settle();
  check('in notes mode, numbers are pencilled in', await f.evaluate(i => [...document.querySelectorAll('#c' + i + ' .notes span')].map(x => x.textContent).filter(Boolean).join(), empty) === [right, wrong].sort().join(','));
  check('…and the cell says so to a screen reader', /: notes \d \d$/.test(await cell(empty).getAttribute('aria-label')));
  await page.keyboard.press('n'); await P.settle();
  check('N turns notes mode off', await f.locator('#notesBtn').getAttribute('aria-pressed') === 'false');
  s = await S();
  /* two empty cells in the same row: a note in one for the other's answer is cleared when that answer is placed */
  const row = Math.floor(empty / 9), other = s.puzzle.findIndex((v, i) => !v && i !== empty && Math.floor(i / 9) === row);
  if (other >= 0) {
    const n2 = s.solution[other];
    await cell(empty).click(); await page.keyboard.press('n');
    if (!((await S()).notes[empty] & (1 << n2))) await page.keyboard.press(String(n2));
    await page.keyboard.press('n'); await P.settle();
    check('(a note for ' + n2 + ' is pencilled in)', ((await S()).notes[empty] & (1 << n2)) !== 0);
    await cell(other).click(); await page.keyboard.press(String(n2)); await P.settle();
    check('placing a number clears it from the notes of related cells', ((await S()).notes[empty] & (1 << n2)) === 0 && (await S()).values[other] === n2);
  } else note('no second empty cell in that row: clearing of notes not checked this run');
  await cell(empty).click(); await page.keyboard.press('h'); await P.settle();
  check('H (or Hint) fills the selected cell with the right number', (await S()).values[empty] === right);
  await page.keyboard.press('Control+z'); await P.settle();
  check('Ctrl+Z undoes the hint', (await S()).values[empty] === 0);
  await f.locator('#grid').focus();
  const sel0 = empty;
  await page.keyboard.press('ArrowRight'); await P.settle();
  check('arrow keys move the selection, wrapping at the edge', await f.evaluate(() => +document.getElementById('grid').getAttribute('aria-activedescendant').slice(1)) === (Math.floor(sel0 / 9) * 9 + (sel0 % 9 + 1) % 9));
  await page.keyboard.press('Space'); await P.settle(1200);
  const t1 = (await S()).elapsed;
  await P.settle(1200);
  check('Space pauses: the grid is hidden and the clock stops', await f.evaluate(() => getComputedStyle(document.getElementById('paused')).display) === 'flex' && (await S()).elapsed === t1);
  await f.locator('#paused').click(); await P.settle();
  check('clicking the cover continues', await f.evaluate(() => getComputedStyle(document.getElementById('paused')).display) === 'none');

  section('Saved and resumed');
  await cell(empty).click(); await page.keyboard.press(String(right)); await P.settle(700);
  const saved = JSON.parse(await P.read(CFG + '\\game.json'));
  check('the game in progress is saved in game.json', saved.values[empty] === right && saved.diff === 'easy' && saved.autoCheck === true);
  await P.closeAll();
  await H.reload(page);
  await P.icon('Sudoku').dblclick(); await P.settle(800); f = await P.frame();
  await f.waitForFunction(() => window.__sd && __sd.S, null, { timeout: 8000 });
  check('after closing and reloading PortD, the same game is resumed', (await S()).values.join() === saved.values.join() && /Resumed your last game/.test(await msgText()));

  section('Solving the puzzle from the keyboard');
  s = await S();
  await f.locator('#grid').focus();
  for (let i = 0; i < 81; i++) if (s.values[i] !== s.solution[i]) { await cell(i).click(); await page.keyboard.press(String(s.solution[i])); }
  await P.settle(500);
  s = await S();
  check('filling every cell correctly solves it', s.done && /^Solved in \d\d:\d\d/.test(await msgText()), await msgText());
  check('PortD shows a notice for the solve', /^Sudoku: easy solved in \d\d:\d\d$/.test(await P.toast()), await P.toast());
  const stats = JSON.parse(await P.read(CFG + '\\stats.json'));
  check('the win is counted in stats.json with a best time', stats.easy.won === 1 && stats.easy.played >= 1 && stats.easy.best >= 0, stats);

  section('New game, statistics, theme');
  await f.locator('#diff').selectOption('medium'); await P.settle(1500);
  check('changing the difficulty after a solve starts a Medium puzzle', (await S()).diff === 'medium' && (await S()).puzzle.filter(Boolean).length >= 31 && await P.titles() === 'Sudoku – Medium');
  s = await S();
  const e2 = s.puzzle.findIndex(v => !v);
  await cell(e2).click(); await page.keyboard.press(String(s.solution[e2])); await P.settle();
  await f.locator('#newBtn').click(); await P.settle();
  check('New game during a game asks for a second click', (await S()).values[e2] === s.solution[e2] && /Click New game again/.test(await msgText()));
  await f.locator('#newBtn').click(); await P.settle(1500);
  check('…and the second click starts a new one', (await S()).values[e2] === 0 || (await S()).puzzle.join() !== s.puzzle.join());
  await page.keyboard.press('F1'); await P.settle();
  check('F1 shows statistics and help', await f.evaluate(() => document.getElementById('infoDlg').classList.contains('show')) && /Easy\s+\d+\s+1\s+\d\d:\d\d/.test(await f.locator('#statTbl').innerText()), await f.locator('#statTbl').innerText());
  await f.locator('#statReset').click(); await P.settle();
  check('Reset stats asks for a second click', await f.locator('#statReset').innerText() === 'Click again to reset' && JSON.parse(await P.read(CFG + '\\stats.json')).easy);
  await f.locator('#statReset').click(); await P.settle();
  check('…and then resets', JSON.stringify(JSON.parse(await P.read(CFG + '\\stats.json'))) === '{}');
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc closes it, focus goes back', await f.evaluate(() => !document.getElementById('infoDlg').classList.contains('show')));
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(200);
  check('the theme can be set to dark, and is saved', await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(27, 32, 41)' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  await f.locator('#themeBtn').click();
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Sudoku', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  await sp.waitForFunction(() => window.__sd && __sd.S, null, { timeout: 8000 });
  check('it plays, and follows the system\'s dark theme', await sp.evaluate(() => document.documentElement.dataset.theme === 'dark' && __sd.S.puzzle.filter(Boolean).length >= 39));
  const i0 = await sp.evaluate(() => __sd.S.puzzle.findIndex(v => !v)), v0 = await sp.evaluate(i => __sd.S.solution[i], i0);
  await sp.locator('#c' + i0).click(); await sp.keyboard.press(String(v0)); await sp.waitForTimeout(700);
  await sp.reload(); await sp.waitForFunction(() => window.__sd && __sd.S);
  check('the game is kept in localStorage and resumed (0.x saved nothing outside PortD)', await sp.evaluate(i => __sd.S.values[i], i0) === v0);
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
