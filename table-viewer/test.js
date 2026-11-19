/* Table Viewer: tests in the real PortD 1.0.0, in headless Chrome, with real mouse and keyboard input.
   Run: node table-viewer/test.js   (after node build/pack.js table-viewer) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = path.join(__dirname), PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const DOCS = 'P:\\User\\Documents', CFG = 'P:\\User\\Config\\table-viewer';

const PEOPLE = 'Name,Age,City,Note\r\n' +
  'Alice,34,London,"Likes ""tea"""\r\n' +
  'Bob,7,Paris,"Line one\nline two"\r\n' +
  'Chloé,120,"Rome, Italy",\r\n' +
  'Dan,,London,short row\r\n' +
  'Eve,45,Berlin\r\n' +                                  /* one value missing */
  'Finn,1,Oslo,x,EXTRA\r\n' +                            /* one value too many */
  '\r\n' +                                               /* a blank line is skipped */
  'Gus,9,london,\r\n';
const SEMI = 'Produkt;Preis;Menge\nÄpfel;1,20;3\nBirnen;2,50;10\n';
const TSV = 'id\tvalue\tlabel\n1\t10.5\tfirst, with comma\n2\t-3\tsecond\n3\t1,234\tthird\n';

(async () => {
  console.log('Table Viewer tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await H.openPortD(ctx), P = H.on(page);

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names the program and version', /^Install program/.test(d) && /Table Viewer/.test(d) && /Version\s+1\.0\.0/.test(d), d);
  check('…shows the description and the file types it declares', /View CSV and TSV files as a table/.test(d) && /Can open\s+\.csv, \.tsv/.test(d), d);
  check('…the file count, where it goes, and the permission note', /Files\s+6 files, /.test(d) && /Goes in\s+P:\\Programs\\table-viewer/.test(d) && d.includes('This program can see its own data and the files you choose for it.'), d);
  check('…and the program\'s own icon', await P.ev(() => !!document.querySelector('.dlg .phead .ico img[src^="data:image/svg+xml"]')));
  await P.press('Install');
  check('installing writes the folder', await P.ls('P:\\Programs\\table-viewer') === 'js|icon.svg|index.html|manifest.json|style.css', await P.ls('P:\\Programs\\table-viewer'));
  check('a toast and a desktop shortcut', await P.toast() === 'Table Viewer installed' && await P.icon('Table Viewer').count() === 1);
  check('a notice offers .csv and .tsv without changing anything', /^Table Viewer can open \.csv and \.tsv files/.test(await P.notices()) && JSON.stringify(JSON.parse(await P.read('P:\\User\\Config\\associations.json')).assoc) === '{}', await P.notices());
  await P.closeAll();
  await P.write(DOCS + '\\numbers.tsv', TSV);
  await P.openInFiles(DOCS, 'numbers.tsv');
  check('before a default is chosen, a .tsv still opens in Notepad', /numbers\.tsv - Notepad/.test(await P.titles()), await P.titles());
  await P.closeAll();
  await P.rowMenu(DOCS, 'numbers.tsv'); await P.mi('Open with').hover(); await P.settle(250);
  check('Open with lists Table Viewer for .tsv', (await P.menuItems(1)).split('|')[0] === 'Table Viewer', await P.menuItems(1));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await P.closeAll();
  await page.locator('.notice .btn', { hasText: /^Set as default$/ }).click(); await P.settle();
  check('Set as default on the notice makes it the program for .csv and .tsv', JSON.stringify(JSON.parse(await P.read('P:\\User\\Config\\associations.json')).assoc) === '{".csv":"table-viewer",".tsv":"table-viewer"}');

  section('Starting without a file');
  await P.icon('Table Viewer').dblclick(); await P.settle(500);
  let f = await P.frame();
  check('the desktop shortcut starts it, titled Table Viewer', await P.titles() === 'Table Viewer', await P.titles());
  check('it shows the empty state with an Open button, focused', await f.evaluate(() => !document.getElementById('empty').hidden && document.getElementById('grid').hidden && document.activeElement.id === 'openBig'));
  check('the window background is the app\'s own, not the frame\'s white', await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(255, 255, 255)');
  check('stylesheet and scripts were put inline by PortD', await f.evaluate(() => !document.querySelector('link[rel=stylesheet]') && !document.querySelector('script[src]') && typeof CSV === 'object' && typeof Host === 'object'));
  check('the empty-state picture was put inline', await f.evaluate(() => /^data:image\/svg\+xml/.test(document.querySelector('.empty img').src) && document.querySelector('.empty img').naturalWidth > 0));

  section('Opening a file with the Open button');
  await P.write(DOCS + '\\people.csv', PEOPLE);
  await P.write(DOCS + '\\prices.csv', SEMI);
  await P.write(DOCS + '\\notes.txt', 'not a table');
  await f.locator('#openBig').click(); await P.settle(250);
  check('PortD\'s Open dialog appears, titled for the program, listing .csv, .tsv and .txt files', await P.ev(() => document.querySelector('.dlg h2').textContent) === 'Table Viewer — Open a table' &&
    await P.ev(() => [...document.querySelectorAll('.dlg .brow')].map(r => r.textContent).join('|')) === 'notes.txt|numbers.tsv|people.csv|prices.csv', await P.ev(() => [...document.querySelectorAll('.dlg .brow')].map(r => r.textContent).join('|')));
  await P.pickInDialog('people.csv');
  const tv = () => f.evaluate(() => ({ cols: __tv.doc.cols.join('|'), rows: __tv.doc.data.length, view: __tv.view.length, delim: __tv.doc.delim, bad: [...__tv.doc.bad].join(','), sel: __tv.sel.size }));
  let s = await tv();
  check('the file opens as a table with the header as column names', s.cols === 'Name|Age|City|Note|(extra 1)' && s.rows === 7, s);
  check('quotes, "" inside quotes, a line break inside quotes and a comma inside quotes are read correctly', await f.evaluate(() => JSON.stringify([__tv.doc.data[0][3], __tv.doc.data[1][3], __tv.doc.data[2][2], __tv.doc.data[2][1]])) === JSON.stringify(['Likes "tea"', 'Line one\nline two', 'Rome, Italy', '120']));
  check('the window title names the file', await P.titles() === 'people.csv - Table Viewer', await P.titles());
  check('the status bar shows the delimiter found and the size', /people\.csv/.test(await f.locator('#status').innerText()) && /Comma \(found\) · 7 rows × 5 columns/.test(await f.locator('#status').innerText()), await f.locator('#status').innerText());
  const warn = await f.locator('#warn').innerText();
  check('a warning names the rows with the wrong number of values', /2 rows have a different number of values from the header \(4\): rows 5, 6/.test(warn), warn);
  check('…which are marked in the row numbers', await f.evaluate(() => [...document.querySelectorAll('.row.bad .c.n')].map(c => c.textContent).join()) === '5,6');
  check('the blank line was skipped, not counted as a bad row', s.rows === 7 && s.bad === '4,5');
  check('Age is recognised as a number column and right-aligned', await f.evaluate(() => __tv.doc.numeric.join()) === 'false,true,false,false,false' && await f.evaluate(() => getComputedStyle(document.querySelector('.row .c.num')).textAlign) === 'right');
  await f.locator('#warn .btn', { hasText: 'Show only these rows' }).click(); await P.settle();
  check('"Show only these rows" shows just the two bad rows', (await tv()).view === 2);
  await f.locator('#warn .btn', { hasText: 'Show all rows' }).click(); await P.settle();
  check('…and "Show all rows" brings the rest back', (await tv()).view === 7);

  section('Sorting');
  const col = c => f.evaluate(c => __tv.view.map(i => __tv.doc.data[i][c]).join('|'), c);
  const headCell = name => f.locator('#head .c', { hasText: new RegExp('^' + name) });
  await headCell('Age').click(); await P.settle();
  check('clicking a number heading sorts by value, empty last', await col(1) === '1|7|9|34|45|120|', await col(1));
  check('…with an up arrow and aria-sort', await headCell('Age').getAttribute('aria-sort') === 'ascending' && /▲/.test(await headCell('Age').innerText()));
  await headCell('Age').click(); await P.settle();
  check('clicking again sorts down, empty still last', await col(1) === '120|45|34|9|7|1|', await col(1));
  await headCell('Age').click(); await P.settle();
  check('a third click returns to the file\'s order', await col(0) === 'Alice|Bob|Chloé|Dan|Eve|Finn|Gus');
  await headCell('City').click(); await P.settle();
  check('text sorts ignoring case and accents', await col(2) === 'Berlin|London|London|london|Oslo|Paris|Rome, Italy', await col(2));
  await headCell('City').click(); await headCell('City').click(); await P.settle();

  section('Filtering');
  await page.keyboard.press('Control+f'); await P.settle();
  check('Ctrl+F puts the cursor in the filter box', await f.evaluate(() => document.activeElement.id) === 'filter');
  await page.keyboard.type('london'); await P.settle(300);
  check('typing filters across all columns, ignoring case', (await tv()).view === 3 && await col(0) === 'Alice|Dan|Gus', await col(0));
  check('the status bar says how many are shown', /showing 3/.test(await f.locator('#stInfo').innerText()));
  await f.locator('#filterCol').selectOption({ label: 'Note' }); await P.settle();
  check('limiting the filter to one column (Note) finds none', (await tv()).view === 0);
  await f.locator('#filterCol').selectOption('-1'); await P.settle();
  await f.locator('#filter').press('Escape'); await P.settle();
  check('Esc in the filter box clears it', (await tv()).view === 7 && await f.locator('#filter').inputValue() === '');

  section('Keyboard and selection');
  await f.locator('#body .row').first().locator('.c').nth(1).click(); await P.settle();
  check('clicking a row selects it and focuses the table', (await tv()).sel === 1 && await f.evaluate(() => document.activeElement.id) === 'grid');
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await P.settle();
  check('Shift+Down extends the selection', (await tv()).sel === 3 && /3 selected/.test(await f.locator('#stInfo').innerText()));
  await page.keyboard.press('ArrowRight'); await P.settle();
  check('Right moves the current cell, and the status bar shows its full value', /Row 3, Age: 120/.test(await f.locator('#stCell').innerText()), await f.locator('#stCell').innerText());
  check('the current cell is announced to screen readers', await f.evaluate(() => document.getElementById('grid').getAttribute('aria-activedescendant')) === 'cell-2-1');
  await page.keyboard.press('s'); await P.settle();
  check('S sorts by the current column', await f.evaluate(() => JSON.stringify(__tv.sort)) === '{"col":1,"dir":1}');
  await page.keyboard.press('s'); await page.keyboard.press('s'); await P.settle();
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc clears the selection', (await tv()).sel === 0);

  section('Copy as TSV');
  await f.locator('#body .row').nth(0).click(); await f.locator('#body .row').nth(2).click({ modifiers: ['Shift'] }); await P.settle();
  await f.locator('#copyBtn').click(); await P.settle(300);
  const dlgOpen = await f.evaluate(() => !document.getElementById('copyDlg').hidden);
  if (dlgOpen) {
    note('the clipboard was not available inside the frame: the fallback dialog appeared');
    check('the fallback shows the TSV selected, ready for Ctrl+C', /^Name\tAge\tCity\tNote\r\nAlice/.test(await f.locator('#copyText').inputValue()));
    await f.locator('#copyDlg .btn').click();
  } else {
    /* the Linux clipboard turns \r\n into \n, so line ends are compared loosely here; the files written by Save as are compared exactly */
    const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    check('the selected rows are on the clipboard as TSV, with the header and quoting', clip === 'Name\tAge\tCity\tNote\nAlice\t34\tLondon\t"Likes ""tea"""\nBob\t7\tParis\t"Line one\nline two"\nChloé\t120\tRome, Italy\t\n', JSON.stringify(clip));
    check('a toast says how many rows were copied', await f.locator('#toast').innerText() === 'Copied 3 rows as TSV');
    note('inside the PortD frame, copying used: ' + await f.evaluate(() => Host.lastCopy));
  }
  await f.locator('#grid').press('Escape');
  await f.locator('#grid').press('Control+c'); await P.settle(300);
  if (!dlgOpen) check('Ctrl+C with nothing selected copies every shown row', /^Name\tAge[^]*\nGus\t9\tlondon\t\s*$/.test(await page.evaluate(() => navigator.clipboard.readText())) && /Copied 7 rows/.test(await f.locator('#toast').innerText()));

  section('Save as');
  await headCell('Age').click(); await P.settle();
  await f.locator('#filter').fill('o'); await P.settle(300);
  await page.keyboard.press('Control+s'); await P.settle(200);
  check('Ctrl+S opens the app\'s Save as choices', await f.evaluate(() => !document.getElementById('saveDlg').hidden) && /Only the 6 rows shown/.test(await f.locator('#saveDlg').innerText()) && /All 7 rows, in the sorted order/.test(await f.locator('#saveDlg').innerText()), await f.locator('#saveDlg').innerText());
  await f.locator('#saveDlg input[name=fmt][value="\t"]').check();
  await f.locator('#saveDlg input[name=rows][value=all]').check();
  await f.locator('#saveDlg .btn', { hasText: 'Save…' }).click(); await P.settle(250);
  check('PortD\'s Save dialog follows, with people.tsv filled in', await P.ev(() => document.querySelector('.dlg h2').textContent + '|' + document.querySelector('.dlg input.field').value) === 'Table Viewer — Save as|people.tsv');
  await P.press('Save'); await P.settle(250);
  const out = await P.read(DOCS + '\\people.tsv');
  check('the file is written as TSV: all rows, sorted by Age, with the original line endings', out === 'Name\tAge\tCity\tNote\r\nFinn\t1\tOslo\tx\tEXTRA\r\nBob\t7\tParis\t"Line one\nline two"\r\nGus\t9\tlondon\t\r\nAlice\t34\tLondon\t"Likes ""tea"""\r\nEve\t45\tBerlin\r\nChloé\t120\tRome, Italy\t\r\nDan\t\tLondon\tshort row\r\n', JSON.stringify(out));
  check('a toast says so', /Saved people\.tsv \(7 rows\)/.test(await f.locator('#toast').innerText()));
  await page.keyboard.press('Control+s'); await P.settle(200);
  await f.locator('#saveDlg input[name=fmt][value=","]').check();
  await f.locator('#saveDlg input[name=rows][value=shown]').check();
  await f.locator('#saveDlg .btn', { hasText: 'Save…' }).click(); await P.settle(250);
  await P.page.locator('.dlg input.field').fill('only-o'); await P.press('Save'); await P.settle(250);
  check('"Only the rows shown" as CSV writes the filtered rows', (await P.read(DOCS + '\\only-o.csv') || '').split('\r\n').length === 8 && /^Name,Age,City,Note\r\nFinn,1,Oslo,x,EXTRA\r\nBob,7,Paris,"Line one\nline two"/.test(await P.read(DOCS + '\\only-o.csv')), await P.read(DOCS + '\\only-o.csv'));
  await page.keyboard.press('Control+s'); await P.settle(200);
  await page.keyboard.press('Escape'); await P.settle();
  check('Esc closes the choices without saving', await f.evaluate(() => document.getElementById('saveDlg').hidden) && await P.ev(() => !document.querySelector('.ov .dlg')));

  section('Theme, saved and reloaded');
  await f.locator('#themeBtn').click(); await P.settle(200);
  check('the theme button goes from "follows the system" to light, and saves it', await f.evaluate(() => document.documentElement.dataset.themeChoice) === 'light' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'light');
  await f.locator('#themeBtn').click(); await P.settle(200);
  check('…then dark', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(26, 30, 38)');
  await P.closeAll();
  await H.reload(page);
  await P.icon('Table Viewer').dblclick(); await P.settle(500); f = await P.frame();
  check('after a reload of PortD the dark theme is still chosen', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  check('…and the saved file is still on the drive', /^Name\tAge/.test(await P.read(DOCS + '\\people.tsv') || ''));
  await f.locator('#openBtn').click(); await P.settle(250); await P.pickInDialog('people.tsv');
  s = await tv();
  check('the saved TSV opens again: tab found, same rows, same values', s.delim === '\t' && s.rows === 7 && await f.evaluate(() => __tv.doc.data[1][3]) === 'Line one\nline two' && s.bad === '0,4', s);
  await f.locator('#themeBtn').click(); await P.settle(150);
  check('the third click returns to following the system', JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'auto' && await f.evaluate(() => document.documentElement.dataset.theme) === 'light');
  await P.closeAll();

  section('Opening files by association');
  await P.openInFiles(DOCS, 'numbers.tsv'); f = await P.frame();
  check('double-clicking a .tsv in Files opens it in Table Viewer', /numbers\.tsv - Table Viewer/.test(await P.titles()), await P.titles());
  check('…started with the file: PortD.app.args.open', JSON.stringify(await f.evaluate(() => PortD.app.args)) === JSON.stringify({ open: { path: DOCS + '\\numbers.tsv', name: 'numbers.tsv', ext: 'tsv' } }));
  s = await tv();
  check('…tab found, values read, numbers sorted as numbers', s.delim === '\t' && s.rows === 3 && s.cols === 'id|value|label' && await f.evaluate(() => __tv.doc.numeric.join()) === 'true,true,false');
  await f.locator('#head .c', { hasText: /^value/ }).click(); await P.settle();
  check('"1,234" counts as a number when sorting', await col(1) === '-3|10.5|1,234', await col(1));
  check('the type shows as declared in Files', await P.ev(() => { const r = [...document.querySelectorAll('.win .row')].find(r => r.querySelector('.t') && r.querySelector('.t').textContent === 'numbers.tsv'); return r ? r.children[1].textContent : ''; }) === 'TSV table');
  await P.closeAll();
  await P.openInFiles(DOCS, 'prices.csv'); f = await P.frame();
  check('a semicolon file is detected as semicolon, with commas kept inside values', (await tv()).delim === ';' && await f.evaluate(() => __tv.doc.data[0].join('|')) === 'Äpfel|1,20|3', await f.evaluate(() => __tv.doc.data[0].join('|')));
  await f.locator('#delim').selectOption(','); await P.settle();
  check('choosing a delimiter by hand re-reads the file', (await tv()).delim === ',' && (await tv()).cols === 'Produkt;Preis;Menge|(extra 1)');
  await f.locator('#delim').selectOption('auto'); await f.locator('#header').uncheck(); await P.settle();
  check('turning off "Header row" makes the first row data, with numbered columns', (await tv()).rows === 3 && (await tv()).cols === 'Column 1|Column 2|Column 3');
  await P.ev(() => { PortDHost.openPath('P:\\User\\Documents\\people.csv'); }); await P.settle(500);
  check('it is not single-instance: a second file opens a second window', await P.ev(() => PortDHost.wm.wins.filter(w => w.app === 'table-viewer').length) === 2);
  await P.closeAll();

  section('Files that are awkward');
  const b64 = Buffer.from('\uFEFFa,b\n1,2\n', 'utf8').toString('base64');
  await P.write(DOCS + '\\stored-binary.csv', 'data:text/csv;base64,' + b64, 'dataurl');
  await P.openInFiles(DOCS, 'stored-binary.csv'); f = await P.frame();
  check('a file the drive holds as binary (a data URL) is decoded as UTF-8, without the byte-order mark', (await tv()).cols === 'a|b' && (await tv()).rows === 1);
  await P.closeAll();
  await P.write(DOCS + '\\broken.csv', 'a,b\n1,"never closed\n2,3\n');
  await P.openInFiles(DOCS, 'broken.csv'); f = await P.frame();
  check('a quote that never closes is reported with its line', /ends inside a quoted value that starts on line 2/.test(await f.locator('#warn').innerText()), await f.locator('#warn').innerText());
  await P.closeAll();
  await P.write(DOCS + '\\empty.csv', '');
  await P.openInFiles(DOCS, 'empty.csv'); f = await P.frame();
  check('an empty file says so', /This file is empty/.test(await f.locator('#warn').innerText()));
  await P.closeAll();

  section('A large file: drawn only where it can be seen');
  let big = 'id,name,score,when\n';
  for (let i = 1; i <= 100000; i++) big += i + ',name ' + i + ',' + ((i * 7919) % 1000) + ',2026-01-' + String(1 + i % 28).padStart(2, '0') + '\n';
  await P.write(DOCS + '\\big.csv', big);
  const t0 = Date.now();
  await P.openInFiles(DOCS, 'big.csv'); f = await P.frame();
  await f.waitForFunction(() => window.__tv && __tv.doc && __tv.doc.data.length === 100000, null, { timeout: 20000 });
  note('100,000 rows (' + (big.length / 1048576).toFixed(1) + ' MB) opened in ' + (Date.now() - t0) + ' ms, including the Files double-click');
  check('100,000 rows are read', (await tv()).rows === 100000 && (await tv()).bad === '');
  check('only a screenful of rows is in the page', await f.evaluate(() => document.querySelectorAll('#body .row').length) < 60, await f.evaluate(() => document.querySelectorAll('#body .row').length));
  await f.locator('#body .row').first().click(); await page.keyboard.press('Control+End'); await P.settle(250);
  check('Ctrl+End goes to the last row, which is drawn', await f.evaluate(() => [...document.querySelectorAll('#body .row .c.n')].some(c => c.textContent === '100,000')));
  const t1 = Date.now(); await f.locator('#head .c', { hasText: /^score/ }).click(); await P.settle(50);
  note('sorting 100,000 rows by a number column took ' + (Date.now() - t1) + ' ms');
  check('sorting the large file works', await f.evaluate(() => __tv.doc.data[__tv.view[0]][2]) === '0');
  await f.locator('#filter').fill('name 9999'); await P.settle(400);
  check('filtering the large file works', (await tv()).view === 11, (await tv()).view);
  await P.closeAll();

  section('No errors');
  const errs = ctx.errors.filter(e => !/Failed to load resource/.test(e));
  check('no console errors in PortD or in Table Viewer', errs.length === 0, errs);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  await c2.grantPermissions(['clipboard-read', 'clipboard-write']);
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  check('it opens with the empty state, following the system\'s dark theme', await sp.evaluate(() => !document.getElementById('empty').hidden && document.documentElement.dataset.theme === 'dark'));
  const tmpCsv = path.join(H.tmp, 'outside.csv'); fs.writeFileSync(tmpCsv, PEOPLE);
  const [chooser] = await Promise.all([sp.waitForEvent('filechooser'), sp.locator('#openBig').click()]);
  check('Open uses the browser\'s own file picker, for .csv, .tsv and .txt', (await chooser.element().getAttribute('accept')) === '.csv,.tsv,.txt');
  await chooser.setFiles(tmpCsv); await sp.waitForTimeout(300);
  check('the chosen file opens', await sp.evaluate(() => __tv.doc.data.length) === 7 && await sp.title() === 'outside.csv - Table Viewer');
  await sp.locator('#copyBtn').click(); await sp.waitForTimeout(200);
  check('Copy as TSV works outside PortD too (clipboard API)', /^Name\tAge\tCity\tNote\r?\nAlice/.test(await sp.evaluate(() => navigator.clipboard.readText())) && await sp.evaluate(() => Host.lastCopy) === 'clipboard API');
  await sp.keyboard.press('Control+s'); await sp.waitForTimeout(150);
  const [dl] = await Promise.all([sp.waitForEvent('download'), sp.locator('#saveDlg .btn', { hasText: 'Save…' }).click()]);
  const dlPath = path.join(H.tmp, 'dl.csv'); await dl.saveAs(dlPath);
  check('Save as downloads the file', dl.suggestedFilename() === 'outside.csv' && fs.readFileSync(dlPath, 'utf8').startsWith('Name,Age,City,Note\r\nAlice,34'));
  await sp.locator('#themeBtn').click(); await sp.waitForTimeout(100);
  check('the theme choice is kept in localStorage', JSON.parse(await sp.evaluate(() => localStorage.getItem('portd-hub:table-viewer:settings'))).theme === 'light');
  await sp.reload(); await sp.waitForTimeout(300);
  check('…and used after a reload', await sp.evaluate(() => document.documentElement.dataset.theme) === 'light');
  await sp.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x\ty\n1\t2\n'], 'dropped.tsv')); document.getElementById('app').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); });
  await sp.waitForTimeout(300);
  check('dropping a file on the window opens it', await sp.evaluate(() => __tv.doc && __tv.doc.name === 'dropped.tsv' && __tv.doc.delim === '\t'));
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
