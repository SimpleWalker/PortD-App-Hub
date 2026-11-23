/* Solitaire: tests in the real PortD 1.0.0, in headless Chrome, with real mouse and keyboard input.
   Run: node solitaire/test.js   (after node solitaire/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const CFG = 'P:\\User\\Config\\solitaire';
/* a card: suit 0 spades, 1 hearts, 2 diamonds, 3 clubs; rank 1 ace … 13 king */
const C = (s, r, up = true) => ({ id: s * 13 + r - 1, s, r, up });

(async () => {
  console.log('Solitaire tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile();
  const page = await H.openPortD(ctx), P = H.on(page);
  let f;
  const G = () => f.evaluate(() => JSON.parse(JSON.stringify(__sol.G)));
  const card = (s, r) => f.locator('.card[data-id="' + (s * 13 + r - 1) + '"]');
  /* waits for a state in the game window instead of a fixed pause (up to 3 s), so a busy machine can't run ahead of the game */
  const until = (fn, arg) => f.waitForFunction(fn, arg, { timeout: 3000 }).catch(() => {});
  const setG = g => f.evaluate(g => { __sol.G = g; }, g).then(() => P.settle(400));
  const ids = a => a.map(c => c.id).join();
  const msgText = () => f.locator('#msg').innerText();
  /* a state where every card is placed: the rest of the deck goes face down on the stock */
  const state = (o) => {
    const used = new Set([...(o.waste || []), ...(o.found || [[], [], [], []]).flat(), ...(o.tab || []).flat()].map(c => c.id));
    const stock = o.stock || []; for (let s = 0; s < 4 && !o.noStock; s++) for (let r = 1; r <= 13; r++) if (!used.has(s * 13 + r - 1) && !stock.some(c => c.id === s * 13 + r - 1)) stock.push(C(s, r, false));
    return { stock, waste: o.waste || [], found: o.found || [[], [], [], []], tab: o.tab || [[], [], [], [], [], [], []], draw: o.draw || 1, score: o.score || 0, moves: o.moves || 1, elapsed: o.elapsed || 0, done: false, recycles: 0 };
  };

  section('Installing the ported package');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('PortD 1.0 accepts the format 3 package: Solitaire 1.0.0, 4 files', /^Install program/.test(d) && /Solitaire/.test(d) && /Version\s+1\.0\.0/.test(d) && /Klondike solitaire, draw 1 or 3/.test(d) && /Files\s+4 files, /.test(d), d);
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\solitaire') === 'js|index.html|manifest.json|style.css' && await P.icon('Solitaire').count() === 1);
  await P.closeAll();

  section('A new deal');
  await P.icon('Solitaire').dblclick(); await P.settle(700); f = await P.frame();
  let g = await G();
  check('it deals Klondike: columns of 1 to 7 with the top card face up, 24 in the stock', g.tab.map(c => c.length).join() === '1,2,3,4,5,6,7' && g.tab.every(c => c[c.length - 1].up && c.slice(0, -1).every(x => !x.up)) && g.stock.length === 24 && g.draw === 1);
  check('all 52 cards are on the table, and titled Solitaire', await f.evaluate(() => document.querySelectorAll('#table .card').length) === 52 && await P.titles() === 'Solitaire');
  check('the felt and its colours follow the system (light here)', await f.evaluate(() => document.documentElement.dataset.themeChoice === 'auto' && getComputedStyle(document.documentElement).getPropertyValue('--felt').trim() === '#1f6b43'));
  const stockCard = g.stock[g.stock.length - 1];
  await card(stockCard.s, stockCard.r).click(); await P.settle(300);
  g = await G();
  check('clicking the stock turns one card onto the waste', g.waste.length === 1 && g.waste[0].id === stockCard.id && g.waste[0].up && g.moves === 1, [g.waste.length, g.moves]);
  await P.settle(1200);
  check('the clock starts with the first move', /^0:0[1-9]$/.test(await f.locator('#time').innerText()), await f.locator('#time').innerText());

  section('Moving cards: click, drag, undo, scoring');
  await setG(state({ waste: [C(0, 1)], tab: [[C(3, 9, false), C(0, 13)], [C(1, 12)], [C(2, 5)], [C(3, 4)], [], [], []] }));
  await card(0, 1).click(); await P.settle(300);
  g = await G();
  check('clicking an ace sends it to a foundation, +10 points', g.found[0].length === 1 && g.found[0][0].id === C(0, 1).id && g.score === 10, g.found.map(x => x.length));
  const from = await card(1, 12).boundingBox(), to = await card(0, 13).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 10); await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 4 }); await page.mouse.move(to.x + to.width / 2, to.y + 30, { steps: 8 });
  check('while dragging, the card it would land on is outlined', await card(0, 13).evaluate(e => e.classList.contains('hl')));
  await page.mouse.up(); await P.settle(300);
  g = await G();
  check('dragging the red queen onto the black king moves it', g.tab[0].map(c => c.id).join() === [C(3, 9).id, C(0, 13).id, C(1, 12).id].join() && g.tab[1].length === 0);
  await card(2, 5).click(); await P.settle(300);
  check('a card with nowhere to go stays put', (await G()).tab[2].length === 1);
  await card(0, 13).click(); await until(() => __sol.G.tab[1].length === 2);
  g = await G();
  check('a king with cards on it moves to an empty column, and the card under it turns up, +5', g.tab[1].map(c => c.id).join() === [C(0, 13).id, C(1, 12).id].join() && g.tab[0][0].up && g.score === 15, g.tab.map(c => c.length));
  await until(() => document.hasFocus());
  await page.keyboard.press('Control+z'); await until(() => __sol.G.tab[1].length === 0);
  g = await G();
  check('Ctrl+Z undoes it', g.tab[0].length === 3 && !g.tab[0][0].up && g.tab[1].length === 0 && g.score === 10);
  await f.locator('#undoBtn').click(); await until(() => __sol.G.tab[1].length === 1);
  check('so does the Undo button', (await G()).tab[1].length === 1 && (await G()).tab[1][0].id === C(1, 12).id);

  section('The stock, Draw 3, recycling');
  await setG(state({ stock: [C(1, 5, false), C(1, 6, false), C(1, 7, false), C(1, 8, false)], noStock: true, tab: [[C(0, 13)], [], [], [], [], [], []], found: [[], [C(1, 1), C(1, 2), C(1, 3), C(1, 4)], [], []], score: 200 }));
  await f.locator('#table').focus(); await until(() => document.hasFocus());
  for (let k = 0; k < 4; k++) await page.keyboard.press('Space');
  await P.settle(300);
  g = await G();
  check('Space turns the stock, one card at a time in Draw 1', g.stock.length === 0 && g.waste.length === 4);
  await f.locator('.slot.stock').click({ force: true }); await P.settle(300);
  g = await G();
  check('clicking the empty stock turns the waste back over, −100 in Draw 1', g.stock.length === 4 && g.waste.length === 0 && g.score === 100, g.score);
  await f.locator('#drawSel').selectOption('3'); await P.settle();
  check('Draw 3 is saved, and applies from the next game', JSON.parse(await P.read(CFG + '\\settings.json')).draw === 3 && /applies from the next game/.test(await msgText()) && (await G()).draw === 1);
  await f.locator('#newBtn').click(); await P.settle(200);
  check('New game during a game asks for a second click', /Click New game again/.test(await msgText()) && (await G()).stock.length === 4);
  await f.locator('#newBtn').click(); await P.settle(500);
  check('…and then deals a Draw 3 game', (await G()).draw === 3 && (await G()).stock.length === 24);
  await f.locator('#table').focus(); await until(() => document.hasFocus()); await page.keyboard.press('Space'); await P.settle(300);
  check('in Draw 3, three cards are turned at a time', (await G()).waste.length === 3);
  await f.locator('#drawSel').selectOption('1');

  section('Playing from the keyboard (added in the port)');
  await setG(state({ waste: [C(1, 1)], tab: [[C(0, 13)], [C(3, 8, false), C(1, 12)], [C(2, 2)], [], [], [], []] }));
  await f.locator('#table').focus(); await until(() => document.hasFocus());
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight'); await P.settle();
  const cur = () => f.evaluate(() => JSON.stringify(__sol.cursor));
  check('arrow keys move a cursor between the columns', /"pile":"tab","idx":0/.test(await cur()) && await card(0, 13).evaluate(e => e.classList.contains('kc')));
  check('…and say what is under it to a screen reader', /column 1: king of spades/.test(await f.locator('#say').textContent()));
  await page.keyboard.press('ArrowUp'); await P.settle();
  check('Up goes to the top row: the stock above column 1', /"pile":"stock"/.test(await cur()));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await P.settle(300);
  check('Enter on the waste plays its card like a click: the ace goes up', (await G()).found.some(x => x.length === 1 && x[0].id === C(1, 1).id) && /ace of hearts moved to foundation/.test(await f.locator('#say').textContent()));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await P.settle();
  check('Down goes back to the columns', /"pile":"tab","idx":2/.test(await cur()));
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('m'); await P.settle();
  check('M picks up the card under the cursor', await f.evaluate(() => !!__sol.held) && /Picked up queen of hearts/.test(await f.locator('#say').textContent()));
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('m'); await P.settle(300);
  g = await G();
  check('M on another pile puts it down there', ids(g.tab[0]) === ids([C(0, 13), C(1, 12)]) && g.tab[1].length === 1 && g.tab[1][0].up && /queen of hearts put on column 1/.test(await f.locator('#say').textContent()));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('m'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('m'); await P.settle(300);
  check('a card that cannot go there stays, and it says so', (await G()).tab[2].length === 1 && /cannot go there/.test(await f.locator('#say').textContent()));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await P.settle(300);
  check('Enter on the two of diamonds sends it nowhere when nothing fits, and says so', /cannot go anywhere/.test(await f.locator('#say').textContent()));

  section('Auto-finish and winning');
  const almost = { found: [0, 1, 2, 3].map(s => Array.from({ length: 12 }, (_, i) => C(s, i + 1))), tab: [[C(0, 13)], [C(1, 13)], [C(2, 13)], [C(3, 13)], [], [], []], noStock: true, elapsed: 95, moves: 120, score: 500 };
  await setG(state(almost));
  check('when every card is face up and the stock is empty, Auto-finish appears', await f.locator('#autoBtn').isVisible());
  await f.locator('#autoBtn').click(); await P.settle(1200);
  g = await G();
  check('Auto-finish moves every card to the foundations and the game is won', g.done && g.found.every(x => x.length === 13));
  const secs = Math.round(g.elapsed);
  check('the score gets the time bonus: 4 cards × 10, plus 700000 ÷ seconds', secs >= 95 && secs <= 98 && g.score === 500 + 40 + Math.round(700000 / secs), [secs, g.score]);
  check('"You win!" with time and score', /^You win! 1:3[5-8], score \d+/.test(await msgText()), await msgText());
  check('PortD shows a notice', /^Solitaire: won in 1:3[5-8] with \d+ points$/.test(await P.toast()), await P.toast());
  const stats = JSON.parse(await P.read(CFG + '\\stats.json'));
  check('the win, streak and Draw 1 records are saved in stats.json', stats.won === 1 && stats.streak === 1 && stats.bestStreak === 1 && stats.d1.bestTime === secs && stats.d1.bestScore === g.score, stats);

  section('Saved and resumed');
  await f.locator('#newBtn').click(); await P.settle(500);
  await f.locator('#table').focus(); await until(() => document.hasFocus()); await page.keyboard.press('Space'); await P.settle(800);
  const before = await G();
  check('the game in progress is saved in game.json', JSON.stringify(JSON.parse(await P.read(CFG + '\\game.json')).waste) === JSON.stringify(before.waste));
  await P.closeAll(); await H.reload(page);
  await P.icon('Solitaire').dblclick(); await P.settle(700); f = await P.frame();
  check('after closing and reloading PortD, the same game is resumed', ids((await G()).stock) === ids(before.stock) && ids((await G()).waste) === ids(before.waste) && /Resumed your last game/.test(await msgText()));

  section('Statistics, theme');
  await page.keyboard.press('F1'); await P.settle();
  const st = await f.locator('#statTbl').innerText();
  check('F1 shows the statistics: played, won with rate, streaks, best per draw mode', /Games played\s+\d+/.test(st) && /Games won\s+1 \(\d+%\)/.test(st) && /Best streak\s+1/.test(st) && /Best \(draw 1\)\s+1:3[5-8] · \d+ pts/.test(st) && /Best \(draw 3\)\s+—/.test(st), st);
  await f.locator('#statReset').click(); await P.settle();
  check('Reset stats asks for a second click', await f.locator('#statReset').innerText() === 'Click again to reset' && JSON.parse(await P.read(CFG + '\\stats.json')).won === 1);
  await f.locator('#statReset').click(); await P.settle();
  check('…and then resets', JSON.stringify(JSON.parse(await P.read(CFG + '\\stats.json'))) === '{}');
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc closes the box', await f.evaluate(() => !document.getElementById('infoDlg').classList.contains('show')));
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(200);
  check('the dark theme uses a deeper felt, and is saved', await f.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--felt').trim()) === '#123f28' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  await f.locator('#themeBtn').click();
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Solitaire', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  check('it deals and follows the system\'s dark theme', await sp.evaluate(() => __sol.G.stock.length === 24 && document.documentElement.dataset.theme === 'dark'));
  await sp.keyboard.press('Space'); await sp.waitForTimeout(700);
  const w = await sp.evaluate(() => __sol.G.waste.map(c => c.id).join());
  await sp.reload(); await sp.waitForTimeout(400);
  check('the game is kept in localStorage and resumed (0.x saved nothing outside PortD)', await sp.evaluate(() => __sol.G.waste.map(c => c.id).join()) === w && w !== '');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
