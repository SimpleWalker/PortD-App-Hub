/* JSON Viewer: tests in the real PortD 1.0.0, in headless Chrome, with real mouse and keyboard input.
   Run: node json-viewer/test.js   (after node json-viewer/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const DOCS = 'P:\\User\\Documents', CFG = 'P:\\User\\Config\\json-viewer';

const STORE = JSON.stringify({
  store: { name: 'Corner Shop', 'opening hours': { mon: '9-5', sun: null }, open: true },
  books: [{ title: 'Moby Dick', price: 8.99, tags: ['sea', 'whale'] }, { title: 'Emma', price: 4.5, tags: [] }, { title: 'Dune', price: 9, tags: ['desert', 'Sea of sand'] }],
  big: 0, empty: {}
}, null, 2).replace('"big": 0', '"big": 12345678901234567890').replace('"empty": {}', '"empty": {},\n  "dup": 1,\n  "dup": 2');
const BROKEN = '{\n  "name": "x",\n  "list": [1, 2, 3,]\n}\n';

(async () => {
  console.log('JSON Viewer tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await H.openPortD(ctx), P = H.on(page);
  const clip = () => page.evaluate(() => navigator.clipboard.readText());

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names the program, version, description and .json', /^Install program/.test(d) && /JSON Viewer/.test(d) && /Version\s+1\.0\.0/.test(d) && /Explore JSON files as a tree/.test(d) && /Can open\s+\.json/.test(d), d);
  check('…the file count, where it goes and the permission note', /Files\s+6 files, /.test(d) && /Goes in\s+P:\\Programs\\json-viewer/.test(d) && d.includes('It can\'t see the rest of your drive.'), d);
  await P.press('Install');
  check('installed: folder, toast, desktop shortcut', await P.ls('P:\\Programs\\json-viewer') === 'js|icon.svg|index.html|manifest.json|style.css' && await P.toast() === 'JSON Viewer installed' && await P.icon('JSON Viewer').count() === 1);
  check('the notice offers .json without changing anything', /^JSON Viewer can open \.json files/.test(await P.notices()) && JSON.stringify(JSON.parse(await P.read('P:\\User\\Config\\associations.json')).assoc) === '{}', await P.notices());
  await P.write(DOCS + '\\store.json', STORE);
  await P.write(DOCS + '\\broken.json', BROKEN);
  await P.openInFiles(DOCS, 'store.json');
  check('before a default is chosen, .json still opens in Notepad', /store\.json - Notepad/.test(await P.titles()), await P.titles());
  await P.closeAll();
  await page.locator('.notice .btn', { hasText: /^Set as default$/ }).click(); await P.settle();
  check('Set as default makes it the program for .json', JSON.parse(await P.read('P:\\User\\Config\\associations.json')).assoc['.json'] === 'json-viewer');

  section('Opening by association; the tree');
  await P.openInFiles(DOCS, 'store.json'); let f = await P.frame();
  check('double-clicking a .json opens it in JSON Viewer, titled with the file', /store\.json - JSON Viewer/.test(await P.titles()) && JSON.stringify(await f.evaluate(() => PortD.app.args.open)) === JSON.stringify({ path: DOCS + '\\store.json', name: 'store.json', ext: 'json' }), await P.titles());
  const rows = () => f.evaluate(() => [...document.querySelectorAll('#rows .trow')].sort((a, b) => a.dataset.i - b.dataset.i).map(r => r.textContent));
  let r = await rows();
  check('the top level is open, small children opened too, in file order', r[0].startsWith('▾store.json') && r[1] === '▾store: {3}' && r.some(x => x === '▾books: [3]') && r.some(x => x === 'big: 12345678901234567890too large to be exact in most programs'), r);
  check('a number too large for JavaScript is shown exactly as written, and flagged', r.includes('big: 12345678901234567890too large to be exact in most programs'));
  check('duplicate keys are both shown, marked, and reported', r.includes('dup: 1') && r.includes('dup: 2duplicate') && /1 key appears twice/.test(await f.locator('#warn').innerText()), r);
  check('values are typed: strings quoted, numbers, true/false and null', r.includes('name: "Corner Shop"') && r.includes('open: true') && r.includes('empty: {}'), r);
  check('the status bar shows size, value count and the path of the current item', /store\.json/.test(await f.locator('.status').innerText()) && /· 2\d values/.test(await f.locator('#stInfo').innerText()) && await f.locator('#stPath').innerText() === '$', await f.locator('.status').innerText());
  check('the tree has tree roles and the current item is announced', await f.evaluate(() => document.getElementById('tree').getAttribute('role') === 'tree' && document.getElementById('tree').getAttribute('aria-activedescendant') === 'row-0' && document.getElementById('row-0').getAttribute('aria-expanded') === 'true'));

  section('Keyboard in the tree');
  const at = () => f.evaluate(() => document.getElementById('stPath').textContent);
  await f.locator('#tree').focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await P.settle();
  check('Down moves through items: $.store.name', await at() === '$.store.name', await at());
  await page.keyboard.press('ArrowDown'); await P.settle();
  check('a key with a space gets a bracket path: $.store["opening hours"]', await at() === '$.store["opening hours"]', await at());
  await page.keyboard.press('ArrowRight'); await P.settle();
  check('Right opens a closed item', (await rows()).includes('▾opening hours: {2}'));
  await page.keyboard.press('ArrowRight'); await P.settle();
  check('Right again goes to its first child', await at() === '$.store["opening hours"].mon');
  await page.keyboard.press('ArrowLeft'); await P.settle();
  check('Left on a child goes to its parent', await at() === '$.store["opening hours"]');
  await page.keyboard.press('ArrowLeft'); await P.settle();
  check('Left on an open item closes it', (await rows()).includes('▸opening hours: { 2 keys }'));
  await page.keyboard.press('Control+c'); await P.settle(200);
  check('Ctrl+C copies the value as formatted JSON', (await clip()).replace(/\r\n/g, '\n') === '{\n  "mon": "9-5",\n  "sun": null\n}', await clip());
  await page.keyboard.press('Control+Shift+C'); await P.settle(200);
  check('Ctrl+Shift+C copies the path', await clip() === '$.store["opening hours"]');
  await page.keyboard.press('ArrowUp'); await P.settle();
  await page.keyboard.press('Control+c'); await P.settle(200);
  check('a string value is copied as its text, without quotes', await clip() === 'Corner Shop');
  await page.keyboard.press('Shift+F10'); await P.settle();
  check('Shift+F10 opens the copy menu, focused on its first item', await f.evaluate(() => !document.getElementById('menu').hidden && document.activeElement.dataset.cmd === 'value'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await P.settle(200);
  check('…Copy JSON Pointer from it', await clip() === '/store/name' && await f.evaluate(() => document.getElementById('menu').hidden && document.activeElement.id === 'tree'));
  await page.keyboard.press('End'); await page.keyboard.press('Home'); await P.settle();
  check('Home and End go to the first and last items', await at() === '$');

  section('Mouse');
  const row = text => f.locator('#rows .trow', { hasText: new RegExp('^' + text) });
  await row('▾books').locator('.tog').click(); await P.settle();
  check('clicking the arrow closes an item', (await rows()).includes('▸books: [ 3 items ]'));
  await row('▸books').dblclick(); await P.settle();
  check('double-clicking opens it again', (await rows()).includes('▾books: [3]'));
  await row('▸0: ').first().click({ button: 'right' }); await P.settle();
  check('right-clicking an item opens the menu for it', await f.evaluate(() => !document.getElementById('menu').hidden) && await at() === '$.books[0]');
  await f.locator('#menu [data-cmd=expand]').click(); await P.settle();
  check('"Expand all below" opens everything under it', (await rows()).includes('▾tags: [2]') && (await rows()).includes('0: "sea"'), await rows());
  await row('▾books').click({ button: 'right' }); await f.locator('#menu [data-cmd=path]').click(); await P.settle(200);
  check('"Copy path" from the menu', await clip() === '$.books');
  await f.locator('#stFile').click(); await P.settle();

  section('Search');
  await page.keyboard.press('Control+f'); await P.settle();
  check('Ctrl+F goes to the search box', await f.evaluate(() => document.activeElement.id) === 'search');
  await page.keyboard.type('sea'); await P.settle(400);
  check('matches in keys and values, case ignored, are counted', await f.locator('#hits').innerText() === '1 of 2', await f.locator('#hits').innerText());
  check('the list shows each match with its path', await f.evaluate(() => [...document.querySelectorAll('#rlist .rp')].map(e => e.textContent).join('|')) === '$.books[0].tags[0]|$.books[2].tags[1]', await f.evaluate(() => [...document.querySelectorAll('#rlist .rp')].map(e => e.textContent).join('|')));
  check('the first match is revealed and current', await at() === '$.books[0].tags[0]');
  await page.keyboard.press('Enter'); await P.settle();
  check('Enter goes to the next match, opening its parents', await at() === '$.books[2].tags[1]' && await f.locator('#hits').innerText() === '2 of 2' && (await rows()).includes('1: "Sea of sand"'));
  check('the matching text is marked', await f.evaluate(() => [...document.querySelectorAll('#rows mark')].map(m => m.textContent).join()) === 'sea,Sea');
  await page.keyboard.press('Shift+Enter'); await P.settle();
  check('Shift+Enter goes back', await at() === '$.books[0].tags[0]');
  await f.locator('#search').fill('hours'); await P.settle(400);
  check('a key matches too', await f.locator('#hits').innerText() === '1 of 1' && await at() === '$.store["opening hours"]');
  await f.locator('#search').fill('9'); await P.settle(400);
  check('numbers and strings both match "9"', await f.locator('#hits').innerText() === '1 of 4', await f.locator('#hits').innerText());
  await f.locator('#rlist .ritem').nth(2).click(); await P.settle();
  check('clicking a match in the list goes to it', await at() === '$.books[2].price' && await f.locator('#hits').innerText() === '3 of 4', await at());
  await page.keyboard.press('F3'); await P.settle();
  check('F3 goes to the next match (the long number)', await at() === '$.big');
  await page.keyboard.press('F3'); await P.settle();
  check('F3 wraps round to the first match', await f.locator('#hits').innerText() === '1 of 4');
  await f.locator('#search').fill('nothing like this'); await P.settle(400);
  check('no match says so', await f.locator('#hits').innerText() === 'No matches');
  await f.locator('#search').press('Escape'); await P.settle();
  check('Esc clears the search', await f.locator('#search').inputValue() === '' && await f.evaluate(() => document.getElementById('results').hidden));

  section('Raw text');
  await f.locator('#tree').focus(); await page.keyboard.press('r'); await P.settle();
  check('R shows the raw text as in the file, with line numbers', await f.evaluate(() => !document.getElementById('raw').hidden) && await f.locator('#rawText').inputValue() === STORE && /^1\n2\n3/.test(await f.locator('#gutter').innerText()));
  await f.locator('#asPretty').click(); await P.settle();
  const pretty = await f.locator('#rawText').inputValue();
  check('"Formatted" shows it re-indented, keeping the large number and both duplicate keys exactly', pretty.includes('"big": 12345678901234567890') && (pretty.match(/"dup"/g) || []).length === 2 && pretty.startsWith('{\n  "store": {'));
  await f.locator('#copyRaw').click(); await P.settle(200);
  check('Copy all copies the raw text', (await clip()).replace(/\r\n/g, '\n') === pretty);
  await f.locator('#rawText').press('Escape'); await P.settle();
  check('Esc goes back to the tree', await f.evaluate(() => !document.getElementById('tree').hidden));
  await P.closeAll();

  section('A file that is not valid JSON');
  await P.openInFiles(DOCS, 'broken.json'); f = await P.frame();
  check('the error is shown with its line and column and what is wrong', await f.locator('#errMsg').innerText() === 'Line 3, column 20: There is a comma after the last item: remove it.', await f.locator('#errMsg').innerText());
  check('…with the lines around it and a marker under the place', /3 │ {3}"list": \[1, 2, 3,\]\n {2}│ {20}\^ here/.test(await f.locator('#errCtx').innerText()), await f.locator('#errCtx').innerText());
  await f.locator('#errRaw').click(); await P.settle();
  check('"Show it in the raw text" selects that character in the raw text', await f.evaluate(() => { const t = document.getElementById('rawText'); return document.activeElement === t && t.value.slice(t.selectionStart, t.selectionEnd) === ']'; }));
  check('…and the tree tools are switched off', await f.evaluate(() => document.getElementById('search').disabled && document.getElementById('expandBtn').disabled));
  await P.closeAll();
  for (const [name, text, want] of [['single.json', "{'a': 1}", /Line 1, column 2: Expected a key in double quotes, but found "'"/], ['comment.json', '{\n  // note\n  "a": 1\n}', /Line 2, column 3: .*Comments are not allowed|Line 2, column 3: Expected a key/], ['two.json', '{"a":1}\n{"b":2}', /Line 2, column 1: There is more after the end/], ['open.json', '{"a": [1, 2', /The file ends before the array is closed/]]) {
    await P.write(DOCS + '\\' + name, text);
    await P.ev(p => { PortDHost.openPath(p); }, DOCS + '\\' + name); await P.settle(450); f = await P.frame();
    check('error for ' + name + ': ' + want.source.slice(0, 50), want.test(await f.locator('#errMsg').innerText()), await f.locator('#errMsg').innerText());
    await P.closeAll();
  }

  section('Open, Paste, theme, and reloading');
  await P.icon('JSON Viewer').dblclick(); await P.settle(500); f = await P.frame();
  check('started from the desktop: the empty state, Open focused', await P.titles() === 'JSON Viewer' && await f.evaluate(() => document.activeElement.id) === 'openBig');
  await page.keyboard.press('Control+o'); await P.settle(250);
  check('Ctrl+O shows PortD\'s Open dialog listing only .json files', await P.ev(() => document.querySelector('.dlg h2').textContent) === 'JSON Viewer — Open JSON' && await P.ev(() => [...document.querySelectorAll('.dlg .brow')].every(r => /\.json$/.test(r.textContent))));
  await P.pickInDialog('store.json'); await P.settle(200);
  check('the chosen file opens', /store\.json - JSON Viewer/.test(await P.titles()) && await f.evaluate(() => __jv.doc.count) > 20);
  await f.locator('#pasteBtn').click(); await P.settle();
  await f.locator('#pasteText').fill('[{"id": 1, "ok": false}]');
  await f.locator('#pasteDlg .btn', { hasText: 'View' }).click(); await P.settle(200);
  check('Paste… views pasted text', await f.evaluate(() => __jv.doc.name) === 'Pasted text' && (await rows()).includes('ok: false'), await rows());
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(200);
  check('the theme can be set to dark, and is saved', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  await P.closeAll(); await H.reload(page);
  await P.openInFiles(DOCS, 'store.json'); f = await P.frame();
  check('after reloading PortD, the dark theme is kept and files still open by association', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && /store\.json - JSON Viewer/.test(await P.titles()));
  check('the dark theme colours the window', await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(26, 30, 38)');
  await f.locator('#themeBtn').click(); await P.settle(150);
  await P.closeAll();

  section('Odd files');
  await P.write(DOCS + '\\bin.json', 'data:application/json;base64,' + Buffer.from('\uFEFF{"ü": "ß"}').toString('base64'), 'dataurl');
  await P.openInFiles(DOCS, 'bin.json'); f = await P.frame();
  check('a file stored as binary is decoded as UTF-8, byte-order mark dropped', (await rows()).includes('ü: "ß"'), await rows());
  await P.closeAll();
  await P.write(DOCS + '\\deep.json', '['.repeat(20000) + ']'.repeat(20000));
  await P.openInFiles(DOCS, 'deep.json'); f = await P.frame();
  check('20,000 levels of nesting open without a crash', await f.evaluate(() => __jv.doc.count) === 20000);
  await P.closeAll();

  section('A large file: opened as you go');
  const big = JSON.stringify({ items: Array.from({ length: 200000 }, (_, i) => ({ id: i, name: 'item ' + i, tags: ['a', 'b'], ok: i % 2 === 0 })) });
  await P.write(DOCS + '\\big.json', big);
  const t0 = Date.now();
  await P.openInFiles(DOCS, 'big.json'); f = await P.frame();
  await f.waitForFunction(() => window.__jv && __jv.doc && __jv.doc.count > 0, null, { timeout: 30000 });
  note('a ' + (big.length / 1048576).toFixed(1) + ' MB file with ' + (await f.evaluate(() => __jv.doc.count)).toLocaleString('en-GB') + ' values opened in ' + (Date.now() - t0) + ' ms, including the Files double-click');
  await row('▸items').dblclick(); await P.settle();
  check('a 200,000-item array opens as groups of 100', (await rows()).includes('▸[0 … 99]') && await f.evaluate(() => __jv.flat.length) === 2002, await f.evaluate(() => __jv.flat.length));
  check('only a screenful of rows is in the page', await f.evaluate(() => document.querySelectorAll('#rows .trow').length) < 60);
  const t1 = Date.now();
  await f.locator('#search').fill('item 199999'); await f.locator('#search').press('Enter'); await P.settle(300);
  note('searching every value took about ' + (Date.now() - t1) + ' ms');
  check('search reaches an item in the last group and reveals it', await at() === '$.items[199999].name' && await f.locator('#hits').innerText() === '1 of 1', await at());
  await f.locator('#expandBtn').click(); await P.settle(500);
  check('Expand all stops at a sensible limit on a large file and says so', /Opened the first 50,000 values/.test(await f.locator('#toast').innerText()));
  await f.locator('#collapseBtn').click(); await P.settle();
  check('Collapse all closes everything', await f.evaluate(() => __jv.flat.length) === 2);
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in JSON Viewer', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  await c2.grantPermissions(['clipboard-read', 'clipboard-write']);
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  check('it opens with the empty state, following the system\'s dark theme', await sp.evaluate(() => !document.getElementById('empty').hidden && document.documentElement.dataset.theme === 'dark'));
  const tmpJson = path.join(H.tmp, 'outside.json'); fs.writeFileSync(tmpJson, STORE);
  const [chooser] = await Promise.all([sp.waitForEvent('filechooser'), sp.locator('#openBig').click()]);
  check('Open uses the browser\'s file picker, for .json', (await chooser.element().getAttribute('accept')) === '.json');
  await chooser.setFiles(tmpJson); await sp.waitForTimeout(300);
  check('the chosen file opens as a tree', await sp.title() === 'outside.json - JSON Viewer' && await sp.evaluate(() => __jv.flat.length) > 5);
  await sp.locator('#tree').press('Control+Shift+C'); await sp.waitForTimeout(200);
  check('copying works outside PortD (clipboard API)', await sp.evaluate(() => navigator.clipboard.readText()) === '$' && await sp.evaluate(() => Host.lastCopy) === 'clipboard API');
  await sp.locator('#themeBtn').click(); await sp.reload(); await sp.waitForTimeout(300);
  check('the theme choice is kept in localStorage across a reload', await sp.evaluate(() => document.documentElement.dataset.theme) === 'light');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
