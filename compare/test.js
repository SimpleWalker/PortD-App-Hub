/* Compare: tests in the real PortD 1.0.0, in headless Chrome, with real mouse and keyboard input.
   Run: node compare/test.js   (after node compare/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const DOCS = 'P:\\User\\Documents', CFG = 'P:\\User\\Config\\compare';

const body = n => Array.from({ length: n }, (_, i) => 'unchanged line ' + (i + 1));
const V1 = ['Shopping list', 'The quick brown fox jumps', 'apples', 'Pears', ...body(30), 'old ending', 'last line'].join('\n') + '\n';
const V2 = ['Shopping list', 'The quick red fox leaps', 'apples', 'pears', 'bananas', ...body(30), 'last line'].join('\n') + '\n';
const UNIFIED = '--- v1.txt\n+++ v2.txt\n@@ -1,7 +1,8 @@\n Shopping list\n-The quick brown fox jumps\n+The quick red fox leaps\n apples\n-Pears\n+pears\n+bananas\n unchanged line 1\n unchanged line 2\n unchanged line 3\n' +
  '@@ -32,5 +33,4 @@\n unchanged line 28\n unchanged line 29\n unchanged line 30\n-old ending\n last line\n';

(async () => {
  console.log('Compare tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await H.openPortD(ctx), P = H.on(page);
  const clip = async () => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  let f;

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names it, its version and description, and lists no file types', /^Install program/.test(d) && /Compare/.test(d) && /Version\s+1\.0\.0/.test(d) && /See the differences between two files/.test(d) && !/Can open/.test(d), d);
  check('…file count, where it goes and the permission note', /Files\s+6 files, /.test(d) && /Goes in\s+P:\\Programs\\compare/.test(d) && d.includes('It can\'t see the rest of your drive.'), d);
  await P.press('Install');
  check('installed: folder, toast, desktop shortcut, and no file-type notice', await P.ls('P:\\Programs\\compare') === 'js|icon.svg|index.html|manifest.json|style.css' && await P.toast() === 'Compare installed' && await P.icon('Compare').count() === 1 && await P.notices() === '');

  await P.closeAll();
  section('Two files, opened from inside Compare');
  await P.write(DOCS + '\\v1.txt', V1);
  await P.write(DOCS + '\\v2.txt', V2);
  await P.icon('Compare').dblclick(); await P.settle(500); f = await P.frame();
  check('it starts on the Texts tab with the left side ready for typing', await P.titles() === 'Compare' && await f.evaluate(() => !document.getElementById('texts').hidden && document.activeElement.id === 'textA'));
  await f.locator('[data-open=a]').click(); await P.settle(250);
  check('the left Open… button shows PortD\'s Open dialog for the left side', await P.ev(() => document.querySelector('.dlg h2').textContent) === 'Compare — Open for the left side');
  await P.pickInDialog('v1.txt'); await P.settle(200);
  check('the file appears on the left, named', await f.locator('#nameA').innerText() === 'v1.txt' && await f.locator('#textA').inputValue() === V1);
  await page.keyboard.press('Control+o'); await P.settle(250);
  check('Ctrl+O then opens a file for the right side', await P.ev(() => document.querySelector('.dlg h2').textContent) === 'Compare — Open for the right side');
  await P.pickInDialog('v2.txt'); await P.settle(400);
  check('with both sides filled, it compares at once', await f.evaluate(() => !document.getElementById('diff').hidden) && /v1\.txt ↔ v2\.txt - Compare/.test(await P.titles()), await P.titles());
  check('the summary counts changes and lines', await f.locator('#summary').innerText() === '3 changes: −3 lines removed, +3 added', await f.locator('#summary').innerText());

  section('Side by side');
  const rows = () => f.evaluate(() => [...document.querySelectorAll('#out .row, #out .fold')].map(r => r.classList.contains('fold') ? 'FOLD ' + r.querySelector('span').textContent : [...r.children].map(c => (c.classList.contains('gap') ? '[gap]' : c.textContent)).join('|')));
  let r = await rows();
  check('removed lines on the left, added on the right, changed lines paired', r[1] === '2|The quick brown fox jumps|2|The quick red fox leaps' && r[3] === '4|Pears|4|pears' && r[4] === '|[gap]|5|bananas', r.slice(0, 6));
  check('changed words are marked inside a changed line', await f.evaluate(() => [...document.querySelectorAll('#out .change')[0].querySelectorAll('.w')].map(w => w.textContent).join(',')) === 'brown,jumps,red,leaps');
  check('a line that is mostly different is marked as a whole line, not word by word', await f.evaluate(() => { const row = document.querySelectorAll('#out .change')[1].querySelectorAll('.row')[0]; return !row.querySelector('.w') && !!row.querySelector('.tx.del') && !!row.querySelector('.tx.ins'); }));
  check('a long unchanged stretch is folded, with 3 lines kept around the changes', r.some(x => x === 'FOLD ⋯ 24 unchanged lines (8–31)'), r);
  check('…so only a few rows are drawn', r.length < 20, r.length);
  await f.locator('.fold .btn').click(); await P.settle();
  check('"Show" opens the fold', (await rows()).filter(x => /^FOLD/.test(x)).length === 0 && (await rows()).length === 37);
  await f.locator('#context').selectOption('all'); await P.settle();
  check('"All lines" shows everything, and is remembered', !(await rows()).some(x => /^FOLD/.test(x)) && JSON.parse(await P.read(CFG + '\\settings.json')).context === 'all');
  await f.locator('#context').selectOption('3'); await P.settle();

  section('Moving between changes');
  await f.locator('#out').focus();
  await page.keyboard.press('F7'); await P.settle();
  check('F7 goes to the first change and marks it', await f.evaluate(() => __cmp.at) === 0 && await f.evaluate(() => document.querySelector('#out .change.cur').dataset.i) === '0');
  await page.keyboard.press('F7'); await P.settle();
  check('F7 again goes to the second', await f.evaluate(() => __cmp.at) === 1);
  await page.keyboard.press('F7'); await page.keyboard.press('F7'); await P.settle();
  check('…and after the last one wraps round to the first', await f.evaluate(() => __cmp.at) === 0);
  await page.keyboard.press('Shift+F7'); await P.settle();
  check('Shift+F7 goes back, round to the last', await f.evaluate(() => __cmp.at) === 2);
  await f.locator('#prevBtn').click(); await P.settle();
  check('the Previous button too', await f.evaluate(() => __cmp.at) === 1);

  section('Unified view and options');
  await f.locator('#uniBtn').click(); await P.settle();
  r = await rows();
  check('Unified shows one column with − and + and both line numbers', r.includes('2||−|The quick brown fox jumps') && r.includes('|2|+|The quick red fox leaps') && r.includes('|5|+|bananas'), r.slice(0, 8));
  check('…and the choice is saved', JSON.parse(await P.read(CFG + '\\settings.json')).layout === 'uni');
  await f.locator('#caseless').check(); await P.settle(200);
  check('Ignore case: Pears/pears is no longer a change', !(await rows()).some(x => /Pears/.test(x) && /−/.test(x)) && await f.locator('#summary').innerText() === '3 changes: −2 lines removed, +2 added', await f.locator('#summary').innerText());
  check('…and a note says what is ignored', /Ignoring upper and lower case/.test(await f.locator('#notes').innerText()));
  await f.locator('#caseless').uncheck(); await P.settle(200);
  await f.locator('#words').uncheck(); await P.settle();
  check('changed words can be switched off', await f.evaluate(() => document.querySelectorAll('#out .w').length) === 0);
  await f.locator('#words').check(); await f.locator('#sideBtn').click(); await P.settle();

  section('The unified diff: copy and save');
  await f.locator('#copyBtn').click(); await P.settle(250);
  check('Copy unified diff puts a standard unified diff on the clipboard', await clip() === UNIFIED, JSON.stringify(await clip()));
  check('…and says so', /Copied the unified diff/.test(await f.locator('#toast').innerText()));
  await page.keyboard.press('Control+s'); await P.settle(250);
  check('Ctrl+S asks where to save it, named after both files', await P.ev(() => document.querySelector('.dlg h2').textContent + '|' + document.querySelector('.dlg input.field').value) === 'Compare — Save the differences|v1 vs v2.diff');
  await P.press('Save'); await P.settle(250);
  check('the .diff file holds the same unified diff', await P.read(DOCS + '\\v1 vs v2.diff') === UNIFIED);

  section('Pasted texts, editing, swapping');
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc goes back to the texts', await f.evaluate(() => !document.getElementById('texts').hidden));
  await f.locator('#textB').click(); await page.keyboard.press('Control+End'); await page.keyboard.type('one more line\n'); await P.settle();
  check('editing a file\'s text marks it as edited', await f.locator('#nameB').innerText() === 'v2.txt (edited)');
  await page.keyboard.press('Control+Enter'); await P.settle(300);
  check('Ctrl+Enter compares the edited texts', /\+4 added/.test(await f.locator('#summary').innerText()), await f.locator('#summary').innerText());
  await f.locator('#tabTexts').click();
  await f.locator('#swapBtn').click(); await P.settle();
  check('Swap sides swaps the texts and their names', await f.locator('#nameA').innerText() === 'v2.txt (edited)' && await f.locator('#nameB').innerText() === 'v1.txt');
  await f.locator('[data-clear=a]').click(); await f.locator('[data-clear=b]').click(); await P.settle();
  await f.locator('#textA').fill('alpha  beta\ngamma'); await f.locator('#textB').fill('alpha beta\ngamma'); await P.settle();
  check('pasted texts are labelled as such', await f.locator('#stA').innerText() === 'Left: pasted text · 2 lines' && await f.locator('#nameA').innerText() === 'Left');
  await f.locator('#compareBtn').click(); await P.settle(250);
  check('a change in spacing is found', await f.locator('#summary').innerText() === '1 change: −1 line removed, +1 added', await f.locator('#summary').innerText());
  await f.locator('#space').selectOption('change'); await P.settle(250);
  check('"Ignore space changes" makes them the same, and says so', await f.locator('#out').innerText() === 'The two texts are the same, ignoring what is set above.' && await f.locator('#summary').innerText() === 'No differences');
  check('…with Copy and Save switched off', await f.evaluate(() => document.getElementById('copyBtn').disabled && document.getElementById('saveBtn').disabled));
  await f.locator('#space').selectOption('none'); await P.settle(200);
  await f.locator('#tabTexts').click();
  await f.locator('#textA').fill('a\r\nb\r\n'); await f.locator('#textB').fill('a\nb'); await f.locator('#compareBtn').click(); await P.settle(250);
  check('a missing line break at the end is a difference, and the diff says "No newline"', /Only one of them ends with a line break/.test(await f.locator('#notes').innerText()) && /\n\\ No newline at end of file\n$/.test(await f.evaluate(() => __cmp.unified())), await f.evaluate(() => __cmp.unified()));
  await P.closeAll();

  section('Opening files with Compare from Files');
  await P.write(DOCS + '\\crlf.txt', 'one\r\ntwo\r\nthree\r\n');
  await P.write(DOCS + '\\lf.txt', 'one\ntwo!\nthree\n');
  await P.rowMenu(DOCS, 'crlf.txt'); await P.mi('Open with').hover(); await P.settle(250);
  await P.mi('Choose another program…', 1).click(); await P.settle(250);
  check('"Choose another program…" lists Compare', (await P.ev(() => [...document.querySelectorAll('.dlg .clist .smi')].map(b => b.textContent).join('|'))).split('|').includes('Compare'));
  await page.locator('.dlg .clist .smi', { hasText: /^Compare$/ }).click(); await P.settle(500); f = await P.frame();
  check('a file opened with Compare goes on the left, and it asks for the other one', await f.locator('#nameA').innerText() === 'crlf.txt' && /crlf\.txt is on the left/.test(await f.locator('#toast').innerText()));
  await P.rowMenu(DOCS, 'lf.txt'); await P.mi('Open with').hover(); await P.settle(250);
  await P.mi('Choose another program…', 1).click(); await P.settle(250);
  await page.locator('.dlg .clist .smi', { hasText: /^Compare$/ }).click(); await P.settle(500);
  check('a second file goes into the same window, on the right, and they are compared', await P.ev(() => PortDHost.wm.wins.filter(w => w.app === 'compare').length) === 1 && await f.locator('#nameB').innerText() === 'lf.txt' && await f.evaluate(() => !document.getElementById('diff').hidden));
  check('different line endings are noted but not counted', /different line endings \(Windows on the left, Unix on the right\)/.test(await f.locator('#notes').innerText()) && await f.locator('#summary').innerText() === '1 change: −1 line removed, +1 added', await f.locator('#summary').innerText());
  check('the files given to it are not changed', await P.read(DOCS + '\\crlf.txt') === 'one\r\ntwo\r\nthree\r\n' && await P.read(DOCS + '\\lf.txt') === 'one\ntwo!\nthree\n');
  await P.closeAll();

  section('Large files');
  const big1 = Array.from({ length: 20000 }, (_, i) => 'row ' + i + ' of the big file'), big2 = big1.slice();
  for (let i = 0; i < 20000; i += 100) big2[i] = 'changed row ' + i;
  await P.write(DOCS + '\\big1.txt', big1.join('\n') + '\n'); await P.write(DOCS + '\\big2.txt', big2.join('\n') + '\n');
  await P.icon('Compare').dblclick(); await P.settle(500); f = await P.frame();
  await f.locator('[data-open=a]').click(); await P.settle(250); await P.pickInDialog('big1.txt');
  const t0 = Date.now();
  await f.locator('[data-open=b]').click(); await P.settle(250); await P.pickInDialog('big2.txt');
  await f.waitForFunction(() => !document.getElementById('diff').hidden && document.querySelectorAll('#out .change').length === 200, null, { timeout: 20000 });
  note('20,000 lines against 20,000 with 200 changes: compared and drawn ' + (Date.now() - t0) + ' ms after choosing the second file');
  check('200 changes found in 20,000 lines', await f.locator('#summary').innerText() === '200 changes: −200 lines removed, +200 added');
  check('folding keeps the page small', await f.evaluate(() => document.querySelectorAll('#out .row').length) < 1600, await f.evaluate(() => document.querySelectorAll('#out .row').length));
  await P.closeAll();

  section('Theme, and reloading');
  await P.icon('Compare').dblclick(); await P.settle(500); f = await P.frame();
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await f.locator('#uniBtn').click().catch(() => {}); await P.settle(200);
  await P.closeAll(); await H.reload(page);
  await P.icon('Compare').dblclick(); await P.settle(500); f = await P.frame();
  check('after reloading PortD, the dark theme and the unified layout are kept', await f.evaluate(() => document.documentElement.dataset.theme === 'dark' && document.getElementById('uniBtn').getAttribute('aria-pressed') === 'true') && await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(26, 30, 38)');
  await f.locator('#themeBtn').click();
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Compare', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  await c2.grantPermissions(['clipboard-read', 'clipboard-write']);
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  check('it opens on the Texts tab, following the system\'s dark theme', await sp.evaluate(() => !document.getElementById('texts').hidden && document.documentElement.dataset.theme === 'dark'));
  const p1 = path.join(H.tmp, 'v1.txt'), p2 = path.join(H.tmp, 'v2.txt'); fs.writeFileSync(p1, V1); fs.writeFileSync(p2, V2);
  let [ch] = await Promise.all([sp.waitForEvent('filechooser'), sp.locator('[data-open=a]').click()]); await ch.setFiles(p1); await sp.waitForTimeout(200);
  [ch] = await Promise.all([sp.waitForEvent('filechooser'), sp.locator('[data-open=b]').click()]); await ch.setFiles(p2); await sp.waitForTimeout(300);
  check('two files from the browser\'s file picker are compared', await sp.locator('#summary').innerText() === '3 changes: −3 lines removed, +3 added');
  await sp.locator('#copyBtn').click(); await sp.waitForTimeout(200);
  check('the unified diff is copied (clipboard API)', (await sp.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === UNIFIED);
  const [dl] = await Promise.all([sp.waitForEvent('download'), sp.locator('#saveBtn').click()]);
  check('Save diff… downloads it', dl.suggestedFilename() === 'v1 vs v2.diff');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
