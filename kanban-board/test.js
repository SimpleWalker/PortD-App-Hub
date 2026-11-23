/* Kanban Board: tests in the real PortD 1.0.0, in headless Chrome, with real mouse, keyboard and touch input
   (touch drags go through Chrome's own touch input, so the page sees real touch pointer events).
   Run: node kanban-board/test.js   (after node kanban-board/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const DOCS = 'P:\\User\\Documents', CFG = 'P:\\User\\Config\\kanban-board';
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  console.log('Kanban Board tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile({ touch: true });
  const page = await H.openPortD(ctx), P = H.on(page);
  const cdp = await ctx.newCDPSession(page);
  let f;
  const launch = async () => { await P.icon('Kanban Board').dblclick(); await P.settle(700); f = await P.frame(); await f.waitForFunction(() => window.__kb && __kb.ready); };
  const until = fn => f.waitForFunction(fn, null, { timeout: 3000 }).catch(() => {});
  const cols = () => f.evaluate(() => __kb.B.columns.map(c => c.name + ':' + c.cards.map(k => k.title).join(',')).join(' | '));
  const card = t => f.locator('.card', { has: f.locator('.ctitle', { hasText: t }) });
  const col = n => f.locator('.col', { has: f.locator('.cname', { hasText: new RegExp('^' + n + '$') }) });
  const active = () => f.evaluate(() => { const a = document.activeElement; return a.classList.contains('card') ? 'card:' + a.querySelector('.ctitle').textContent : a.id || a.textContent; });
  const toast = () => f.locator('#toast').innerText();
  const said = () => f.locator('#say').textContent();
  const saved = async () => { await f.evaluate(() => __kb.saveNow()); const id = await f.evaluate(() => __kb.B.id); return JSON.parse(await P.read(CFG + '\\boards\\' + id + '.json')); };
  const box = async loc => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, top: b.y, bottom: b.y + b.height }; };
  async function mouseDrag(from, to) {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 }); await page.mouse.move(to.x, to.y, { steps: 10 });
    await P.settle(80);
  }
  async function touchDrag(from, to) {
    const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12) });
    await P.settle(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names Kanban Board 1.0.0, .json and 6 files', /Kanban Board/.test(d) && /Version\s+1\.0\.0/.test(d) && /Can open\s+\.json/.test(d) && /Files\s+6 files, /.test(d), d);
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\kanban-board') === 'js|icon.svg|index.html|manifest.json|style.css' && await P.icon('Kanban Board').count() === 1);
  await page.locator('#notices .notice .btn', { hasText: /^Dismiss$/ }).click().catch(() => {});
  await P.closeAll();

  section('A first board');
  await launch();
  check('it starts with "My board": To do, Doing, Done and four example cards', await cols() === 'To do:Try dragging this card to Doing,A card with a checklist,Due soon | Doing: | Done:Archive me when you are done' && await P.titles() === 'My board - Kanban Board');
  const id0 = await f.evaluate(() => __kb.B.id);
  check('each board has its own file, and boards.json lists them', JSON.parse(await P.read(CFG + '\\boards.json')).boards[0].name === 'My board' && (await P.ls(CFG + '\\boards')) === id0 + '.json');
  check('the first card has the keyboard', await active() === 'card:Try dragging this card to Doing');
  check('cards show checklist progress and the due date; screen readers get a summary', /☑ 1\/3/.test(await card('A card with a checklist').innerText()) && /Due soon/.test(await card('Due soon').getAttribute('aria-label')) && /1 of 3 checklist items done/.test(await card('A card with a checklist').getAttribute('aria-label')));

  section('Drag and drop with the mouse');
  await mouseDrag(await box(card('Try dragging')), await box(col('Doing').locator('.cards')));
  check('while dragging, a copy follows the pointer and a line shows where it will land', await f.locator('.card.ghost').count() === 1 && !(await f.locator('#dropLine').isHidden()) && await f.locator('.card.dragging').count() === 1);
  await page.mouse.up(); await until(() => __kb.B.columns[1].cards.length === 1);
  check('dropping on Doing moves it there', await cols() === 'To do:A card with a checklist,Due soon | Doing:Try dragging this card to Doing | Done:Archive me when you are done');
  check('…and the board is saved', (await saved()).columns[1].cards[0].title === 'Try dragging this card to Doing');
  const top = await box(card('A card with a checklist'));
  await mouseDrag(await box(card('Due soon')), { x: top.x, y: top.top + 4 }); await page.mouse.up(); await until(() => __kb.B.columns[0].cards[0].title === 'Due soon');
  check('dragging within a column reorders it (dropped above the first card)', (await cols()).startsWith('To do:Due soon,A card with a checklist |'));
  await mouseDrag(await box(card('Due soon')), await box(col('Done').locator('.cards')));
  await page.keyboard.press('Escape'); await page.mouse.up(); await P.settle(200);
  check('Esc during a drag cancels it: nothing moves', (await cols()).startsWith('To do:Due soon,A card with a checklist |') && await f.locator('.card.ghost').count() === 0 && /Move cancelled/.test(await said()));

  section('Drag and drop by touch');
  await touchDrag(await box(card('Archive me')), await box(col('To do').locator('.addcard')));
  await until(() => __kb.B.columns[0].cards.length === 3);
  check('a finger drag moves a card from Done to the end of To do', await cols() === 'To do:Due soon,A card with a checklist,Archive me when you are done | Doing:Try dragging this card to Doing | Done:');
  await P.settle(1500);  // Chrome ignores a tap that comes within a moment of the end of a touch gesture, as a person would not
  await card('Due soon').tap(); await P.settle(250);
  check('a tap opens the card', !(await f.locator('#cardDlg').isHidden()) && await f.locator('#cTitle').inputValue() === 'Due soon', [await f.locator('#cardDlg').isHidden(), await f.locator('#cTitle').inputValue(), await f.evaluate(() => document.querySelectorAll('.card.ghost').length), await active()]);
  await page.keyboard.press('Escape'); await P.settle(100);

  section('Moving with the keyboard');
  await card('Due soon').focus();
  await page.keyboard.press('ArrowDown');
  check('↓ goes to the next card', await active() === 'card:A card with a checklist');
  await page.keyboard.press('Control+ArrowUp'); await P.settle(100);
  check('Ctrl+↑ moves the card up, keeps the keyboard on it, and says where it is', (await cols()).startsWith('To do:A card with a checklist,Due soon,') && await active() === 'card:A card with a checklist' && /Moved A card with a checklist to To do, position 1 of 3/.test(await said()));
  await page.keyboard.press('Control+ArrowRight'); await P.settle(100);
  check('Ctrl+→ moves it to the next column', /Doing:A card with a checklist,Try dragging/.test(await cols()) && await active() === 'card:A card with a checklist' && /to Doing, position 1 of 2/.test(await said()));
  await page.keyboard.press('ArrowLeft');
  check('← goes to the card in the column to the left', await active() === 'card:Due soon');
  await page.keyboard.press('m'); await P.settle(100);
  const items = await f.evaluate(() => [...document.querySelectorAll('#menu .mi')].map(b => b.textContent + (b.disabled ? '(off)' : '')).join('|'));
  check('M opens the card menu: Open, Move to each other column, top, bottom, Archive', items === 'Open|Move to Doing|Move to Done|Move to top(off)|Move to bottom|Archive' && await f.evaluate(() => document.activeElement.textContent) === 'Open', items);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await P.settle(150);
  check('arrows and Enter pick "Move to Done"; the keyboard stays on the card', /Done:Due soon$/.test(await cols()) && await active() === 'card:Due soon');
  await page.keyboard.press('Shift+F10'); await page.keyboard.press('Escape'); await P.settle(100);
  check('Shift+F10 opens the menu too, and Esc closes it', await f.locator('#menu').isHidden() && await active() === 'card:Due soon');
  await page.keyboard.press('Delete'); await P.settle(150);
  check('Delete archives the card, with a notice', !(await cols()).includes('Due soon') && /^Archived "Due soon"\. Restore it from Archive/.test(await toast()) && await f.locator('#archBtn').innerText() === 'Archive (1)');

  section('The card: editing as you type');
  await card('Archive me').focus(); await page.keyboard.press('Enter'); await P.settle(150);
  check('Enter opens it, with the title selected for typing', !(await f.locator('#cardDlg').isHidden()) && await active() === 'cTitle');
  await f.locator('#cTitle').fill('Write the report'); await P.settle(600);
  let b = await saved();
  check('the title is saved without pressing anything', b.columns[0].cards.some(c => c.title === 'Write the report'));
  await f.locator('#cLabels [data-k=""]').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await P.settle(100);
  check('arrow keys pick a colour label (Orange)', await f.evaluate(() => __kb.B.columns[0].cards.find(c => c.title === 'Write the report').label) === 'orange' && await f.locator('#cLabels [data-k=orange]').getAttribute('aria-checked') === 'true');
  await f.locator('#cDue').fill(day(-2)); await P.settle(100);
  check('a due date in the past says Overdue', await f.locator('#cDueNote').innerText() === 'Overdue');
  await f.locator('#cNotes').fill('Numbers from finance first.');
  await f.locator('#cNewItem').fill('Draft'); await page.keyboard.press('Enter');
  await page.keyboard.type('Check figures'); await page.keyboard.press('Enter');
  await page.keyboard.type('Send'); await page.keyboard.press('Enter'); await P.settle(100);
  check('Enter adds checklist items and leaves the cursor for the next', await f.locator('#cList li').count() === 3 && await active() === 'cNewItem' && await f.locator('#cProg').innerText() === '0 of 3 done');
  await f.locator('#cList li').nth(0).locator('input[type=checkbox]').check(); await P.settle(100);
  await f.locator('#cList li').nth(2).locator('.btn').click(); await P.settle(100);
  check('ticking counts as done; × removes an item', await f.locator('#cProg').innerText() === '1 of 2 done' && await f.locator('#cList li').count() === 2);
  await f.locator('[data-act=close]', { hasText: 'Done' }).first().click(); await P.settle(200);
  check('Done closes it and gives the keyboard back to the card', await f.locator('#cardDlg').isHidden() && await active() === 'card:Write the report');
  const rc = card('Write the report');
  check('the card shows the label, an overdue date and 1/2', /l-orange/.test(await rc.getAttribute('class')) && await rc.locator('.due.overdue').count() === 1 && /⚠/.test(await rc.locator('.due').innerText()) && /☑ 1\/2/.test(await rc.innerText()) && /Overdue/.test(await rc.getAttribute('aria-label')));
  b = await saved();
  const wr = b.columns[0].cards.find(c => c.title === 'Write the report');
  check('all of it is in the board file', wr.label === 'orange' && wr.due === day(-2) && wr.notes === 'Numbers from finance first.' && wr.checklist.map(i => i.text + ':' + i.done).join() === 'Draft:true,Check figures:false');
  await rc.click(); await P.settle(150);
  await f.locator('#cMove').selectOption({ label: 'Doing' }); await P.settle(100);
  check('Move to in the card moves it straight away', /Doing:.*Write the report/.test(await cols()));
  await page.keyboard.press('Escape'); await P.settle(150);

  section('Search and filters');
  await page.keyboard.press('Control+f'); await page.keyboard.type('finance'); await P.settle(300);
  check('Ctrl+F searches titles, notes and checklists', await f.locator('.card').count() === 1 && await f.locator('.card .ctitle').innerText() === 'Write the report' && /^Showing 1 of 3 cards/.test(await f.locator('#filterNote').innerText()));
  await page.keyboard.press('Escape'); await P.settle(200);
  await f.locator('#dueSel').selectOption('overdue'); await P.settle(150);
  check('the Overdue filter shows overdue cards only', await f.locator('.card').count() === 1);
  await f.locator('#dueSel').selectOption('none'); await P.settle(150);
  check('No due date shows the others', await f.locator('.card').count() === 2);
  await f.locator('#labelSel').selectOption('orange'); await P.settle(150);
  check('label and date filters combine (none match)', await f.locator('.card').count() === 0 && /None match/.test(await f.locator('.board').innerText()));
  await f.locator('#filterNote .linkbtn').click(); await P.settle(150);
  check('Show all clears every filter', await f.locator('.card').count() === 3 && await f.locator('#filterNote').isHidden(), [await f.locator('.card').count(), await f.locator('#filterNote').isHidden(), await cols()]);

  section('Columns');
  await f.locator('#addColBtn').click(); await P.settle(100);
  await page.keyboard.type('Waiting'); await page.keyboard.press('Enter'); await P.settle(150);
  check('+ Column asks for a name and adds it at the end', (await cols()).endsWith('| Waiting:'));
  await col('Waiting').locator('.chead .btn').click(); await P.settle(100);
  await f.locator('#menu .mi', { hasText: 'Move left' }).click(); await P.settle(150);
  check('Move left puts it before Done', await f.evaluate(() => __kb.B.columns.map(c => c.name).join()) === 'To do,Doing,Waiting,Done');
  await col('Waiting').locator('.cname').dblclick(); await P.settle(100);
  await f.locator('#nameIn').fill('On hold'); await page.keyboard.press('Enter'); await P.settle(150);
  check('double-clicking a column name renames it', await f.evaluate(() => __kb.B.columns[2].name) === 'On hold');
  await col('To do').locator('.addcard').click(); await page.keyboard.type('Book the room'); await page.keyboard.press('Enter'); await P.settle(150);
  check('+ Add card adds a card to that column', (await cols()).startsWith('To do:Book the room |') || /To do:.*Book the room/.test(await cols()));
  await mouseDrag(await box(card('Book the room')), await box(col('On hold').locator('.cards'))); await page.mouse.up(); await P.settle(200);
  await col('On hold').locator('.chead .btn').click(); await f.locator('#menu .mi', { hasText: 'Delete column' }).click(); await P.settle(150);
  check('deleting a column asks first, and says its cards will be archived', !(await f.locator('#confirmDlg').isHidden()) && /Delete the column "On hold"\? Its 1 card will go to the archive/.test(await f.locator('#confMsg').innerText()) && await f.evaluate(() => document.activeElement.textContent) === 'Cancel');
  await f.locator('#confOk').click(); await P.settle(200);
  check('…and does it: the card is archived, not lost', await f.evaluate(() => __kb.B.columns.map(c => c.name).join()) === 'To do,Doing,Done' && await f.locator('#archBtn').innerText() === 'Archive (2)');

  section('The archive');
  await page.keyboard.press('Alt+a'); await P.settle(150);
  check('Alt+A lists archived cards with where they came from', /Book the room\s*From On hold/.test(await f.locator('#archList').innerText()) && /Due soon\s*From Done/.test(await f.locator('#archList').innerText()), await f.locator('#archList').innerText());
  await f.locator('#archList .arow', { hasText: 'Due soon' }).locator('.btn', { hasText: 'Restore' }).click(); await P.settle(150);
  check('Restore puts a card back in the column it came from', /Done:Due soon/.test(await cols()) && /^Restored "Due soon" to Done/.test(await toast()));
  const del = f.locator('#archList .arow', { hasText: 'Book the room' }).locator('.btn.danger');
  await del.click(); await P.settle(100);
  check('Delete forever asks for a second click', await del.innerText() === 'Click again to delete' && await f.locator('#archList .arow').count() === 1);
  await del.click(); await P.settle(150);
  check('a second click deletes it for good', /Nothing is archived/.test(await f.locator('#archList').innerText()) && (await saved()).archive.length === 0);
  await page.keyboard.press('Escape');

  section('Boards: new, switch, export, import, open from Files, delete');
  await f.locator('#boardMenuBtn').click(); await f.locator('#menu .mi', { hasText: 'New board' }).click(); await P.settle(100);
  await page.keyboard.type('Holiday'); await page.keyboard.press('Enter'); await P.settle(300);
  check('New board makes an empty board with To do, Doing, Done and opens it', await f.evaluate(() => __kb.B.name) === 'Holiday' && await cols() === 'To do: | Doing: | Done:' && await f.locator('#boardSel').inputValue() === await f.evaluate(() => __kb.B.id) && /Holiday - Kanban Board/.test(await P.titles()));
  await f.locator('#boardSel').selectOption({ label: 'My board' }); await P.settle(300);
  check('the board list switches back, with everything as it was', /Doing:.*Write the report/.test(await cols()));
  await f.locator('#boardMenuBtn').click(); await f.locator('#menu .mi', { hasText: 'Export board' }).click(); await P.settle(300);
  check('Export board offers "My board.json" in PortD\'s Save dialog', await P.ev(() => document.querySelector('.dlg input.field').value) === 'My board.json');
  await P.press('Save'); await P.settle(300);
  const ex = JSON.parse(await P.read(DOCS + '\\My board.json'));
  check('the file holds the whole board, marked as a Kanban board', ex.format === 'portd-kanban' && ex.board.columns.length === 3 && /Exported "My board"/.test(await toast()));
  await P.write(DOCS + '\\other.json', '{"name":"not a board"}');
  await f.locator('#boardMenuBtn').click(); await f.locator('#menu .mi', { hasText: 'Import board' }).click(); await P.settle(300);
  await P.pickInDialog('other.json'); await P.settle(300);
  check('a JSON file that is not a board is refused, plainly', /not a Kanban board/.test(await toast()) && (await f.evaluate(() => __kb.index.length)) === 2);
  await P.rowMenu(DOCS, 'My board.json'); await P.mi('Open with').hover(); await P.settle(250);
  await P.mi('Kanban Board', 1).click(); await P.settle(500);
  check('opening the board file from Files while Kanban Board is open asks in the same window', await page.locator('.win iframe[title*="Kanban Board"]').count() === 1 && /holds the board "My board" with 4 cards\. Add it as a new board\?/.test(await f.locator('#confMsg').innerText()));
  await f.locator('#confOk').click(); await P.settle(400);
  check('Add board adds it under a free name and opens it', await f.evaluate(() => __kb.B.name) === 'My board (2)' && await f.evaluate(() => __kb.index.map(b => b.name).join()) === 'My board,Holiday,My board (2)' && /Doing:.*Write the report/.test(await cols()));
  await f.locator('#boardMenuBtn').click(); await f.locator('#menu .mi', { hasText: 'Rename board' }).click(); await P.settle(100);
  await f.locator('#nameIn').fill('Copy of my board'); await page.keyboard.press('Enter'); await P.settle(200);
  check('Rename board renames it in the list and the title', await f.locator('#boardSel option:checked').innerText() === 'Copy of my board' && JSON.parse(await P.read(CFG + '\\boards.json')).boards[2].name === 'Copy of my board');
  const copyId = await f.evaluate(() => __kb.B.id);
  await f.locator('#boardMenuBtn').click(); await f.locator('#menu .mi', { hasText: 'Delete board' }).click(); await P.settle(100);
  check('Delete board asks first, naming the board and how many cards', /Delete "Copy of my board" and its 4 cards/.test(await f.locator('#confMsg').innerText()));
  await page.keyboard.press('Escape'); await P.settle(100);
  check('Esc keeps it', await f.evaluate(() => __kb.index.length) === 3);
  await f.locator('#boardMenuBtn').click(); await f.locator('#menu .mi', { hasText: 'Delete board' }).click(); await f.locator('#confOk').click(); await P.settle(400);
  check('OK deletes the board and its file, and opens another', await f.evaluate(() => __kb.index.length) === 2 && !(await P.ls(CFG + '\\boards')).includes(copyId) && await f.evaluate(() => __kb.B.name) === 'My board');

  section('Coming back later, theme, damaged files');
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(150);
  check('the theme button goes to light, then dark', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await f.evaluate(() => getComputedStyle(document.querySelector('.board')).backgroundColor) === 'rgb(21, 25, 32)');
  await f.locator('#boardSel').selectOption({ label: 'Holiday' }); await P.settle(300);
  await P.closeAll(); await H.reload(page); await launch();
  check('after a PortD reload the last board is open again, dark', await f.evaluate(() => __kb.B.name) === 'Holiday' && await f.evaluate(() => document.documentElement.dataset.theme) === 'dark');
  await f.locator('#boardSel').selectOption({ label: 'My board' }); await P.settle(300);
  check('…and My board is just as it was left', /Done:Due soon/.test(await cols()) && /Doing:.*Write the report/.test(await cols()));
  await f.locator('#themeBtn').click();
  await P.closeAll();
  await P.write(CFG + '\\boards\\' + id0 + '.json', '{ broken');
  await launch(); await P.settle(200);
  const kept = (await P.ls(CFG + '\\boards')).split('|').filter(n => n.startsWith(id0 + '-unreadable-'));
  check('a damaged board file is kept under another name, never overwritten, and the window says so', kept.length === 1 && await P.read(CFG + '\\boards\\' + kept[0]) === '{ broken' && /could not be read/.test(await toast()));
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Kanban Board', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  await sp.waitForFunction(() => window.__kb && __kb.ready, null, { timeout: 8000 });
  check('it runs with the example board and follows the system\'s dark theme', await sp.evaluate(() => __kb.B.columns.length === 3 && document.documentElement.dataset.theme === 'dark'));
  await sp.locator('.card').first().focus(); await sp.keyboard.press('Control+ArrowRight'); await sp.waitForTimeout(700);
  await sp.reload(); await sp.waitForFunction(() => window.__kb && __kb.ready);
  check('boards are kept in the browser\'s storage', await sp.evaluate(() => __kb.B.columns[1].cards.length === 1 && Object.keys(localStorage).some(k => k.startsWith('portd-hub:kanban-board:boards/'))));
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
