/* Zip Viewer: tests in the real PortD 1.0.0, in headless Chrome, with real mouse, keyboard and touch input.
   The archives are made with Python's zipfile module (see make-fixtures.py) and put on PortD's drive as binary files,
   as if dropped in from the computer. Extracted bytes are compared with the originals.
   Run: node zip-viewer/test.js   (after node zip-viewer/build.js) */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), os = require('os');
const H = require('../build/harness');
const { section, check } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const DOCS = 'P:\\User\\Documents', CFG = 'P:\\User\\Config\\zip-viewer';

(async () => {
  console.log('Zip Viewer tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const FX = fs.mkdtempSync(path.join(os.tmpdir(), 'zv-'));
  execFileSync('python3', [path.join(APP, 'make-fixtures.py'), FX]);
  const fx = n => fs.readFileSync(path.join(FX, n));
  const ctx = await H.profile({ touch: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await H.openPortD(ctx), P = H.on(page);
  let f;
  const put = (name, buf) => P.ev(([p, b]) => PortDHost.vfs.write(p, 'data:application/octet-stream;base64,' + b, 'dataurl'), [DOCS + '\\' + name, buf.toString('base64')]);
  const bytesOf = async p => { const d = await P.read(p); return /^data:/.test(d) ? Buffer.from(d.slice(d.indexOf(',') + 1), 'base64') : Buffer.from(d, 'utf8'); };
  const zipRead = (zip, name) => execFileSync('python3', ['-c', 'import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', path.join(FX, zip), name]);
  const rowsText = () => f.evaluate(() => [...document.querySelectorAll('#tree .row')].map(r => r.querySelector('.c-name').textContent).join('|'));
  const row = name => f.locator('#tree .row', { has: f.locator('.c-name', { hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
  const toast = () => f.locator('#toast').innerText();
  const details = () => f.locator('#details').innerText();
  const openWith = async (name, prog) => { await P.rowMenu(DOCS, name); await P.mi('Open with').hover(); await P.settle(250); const items = await P.menuItems(1); await P.mi(prog || 'Zip Viewer', 1).click(); await P.settle(900); f = await P.frame(); await f.waitForFunction(() => window.__zv && __zv.ready); return items; };
  const saveDlg = () => P.ev(() => { const d = document.querySelector('.dlg'); return d ? d.querySelector('h2').textContent + '|' + d.querySelector('input.field').value : ''; });

  for (const n of ['normal.zip', 'unsafe.zip', 'methods.zip', 'bomb.zip', 'huge.zip', 'enc.zip', 'corrupt.zip', 'cut.zip', 'true64.zip', 'report.docx']) await put(n, fx(n));
  await P.write(DOCS + '\\fake.zip', 'just some text, not a zip');

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names Zip Viewer 1.0.0, the five file types and 6 files', /Zip Viewer/.test(d) && /Version\s+1\.0\.0/.test(d) && /Can open\s+\.zip, \.docx, \.xlsx, \.pptx, \.jar/.test(d) && /Files\s+6 files, /.test(d), d);
  await P.press('Install');
  await page.locator('#notices .notice .btn', { hasText: /^Dismiss$/ }).click().catch(() => {});
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\zip-viewer') === 'js|icon.svg|index.html|manifest.json|style.css' && await P.icon('Zip Viewer').count() === 1);

  section('Opening an archive and browsing it');
  const items = await openWith('normal.zip');
  check('Open with lists Zip Viewer for .zip, and it opens the archive in its own window', items.split('|').includes('Zip Viewer') && /normal\.zip - Zip Viewer/.test(await P.titles()));
  check('the summary: 7 files in 4 folders, sizes, and the archive\'s comment', /normal\.zip · 7 files in 4 folders · 11 KB, packed \d+ B/.test(await f.locator('#info').innerText()) && /Comment: Made for the Zip Viewer test/.test(await f.locator('#info').innerText()), await f.locator('#info').innerText());
  check('the tree: folders first (A to Z), then files; small archives open their first level', await rowsText() === 'bin|blob.dat|docs|deep|notes.md|img|pixel.png|sun.png|readme.txt|Zoë – café.txt', await rowsText());
  check('each row has its size, packed size and date; folders add up their files', /^10 KB$/.test(await row('bin').locator('.c-size').innerText()) && /23 Nov 2026|\d{1,2} [A-Z][a-z]{2} \d{4}/.test(await row('readme.txt').locator('.c-date').innerText()) && await row('docs').getAttribute('aria-expanded') === 'true');
  check('the tree has the keyboard and the first row is chosen', await f.evaluate(() => document.activeElement.id) === 'tree' && await f.evaluate(() => __zv.cur) === 'dbin');

  section('Keyboard in the tree');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  check('↓ moves down the rows', await f.evaluate(() => __zv.cur) === 'ddocs');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await P.settle(100);
  check('→ goes into a folder, and opens a closed one', await f.evaluate(() => __zv.cur) === 'ddocs/deep' && await row('deep').getAttribute('aria-expanded') === 'true' && (await rowsText()).includes('deep|data.csv'));
  await page.keyboard.press('ArrowLeft'); await P.settle(100);
  check('← closes an open folder', await row('deep').getAttribute('aria-expanded') === 'false' && !(await rowsText()).includes('data.csv'));
  await page.keyboard.press('ArrowLeft');
  check('← again goes to the folder above', await f.evaluate(() => __zv.cur) === 'ddocs');
  await page.keyboard.press('Space'); await P.settle(100);
  check('Space ticks a folder: every file in it is ticked, and the button counts them', await f.evaluate(() => __zv.ticked.size) === 2 && await row('docs').getAttribute('aria-checked') === 'true' && await f.locator('#extractBtn').innerText() === 'Extract ticked (2)…');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await P.settle(100);
  check('…unticking one inside leaves the folder partly ticked', await row('docs').getAttribute('aria-checked') === 'mixed' && /partly ticked/.test(await row('docs').getAttribute('aria-label')));
  await page.keyboard.press('Control+a'); await P.settle(100);
  check('Ctrl+A ticks every file', await f.evaluate(() => __zv.ticked.size) === 7);
  await page.keyboard.press('Control+a'); await P.settle(100);
  check('…and again ticks none', await f.evaluate(() => __zv.ticked.size) === 0);

  section('Details and previews');
  await row('readme.txt').click(); await P.settle(300);
  check('a text file shows its details and its text', /Size\s+24 B/.test(await details()) && /Compression\s+deflate/.test(await details()) && await f.locator('#preview pre').innerText() === 'Hello zip!\nSecond line.\n');
  check('the checksum is checked', /✓ Checksum matches/.test(await f.locator('#crcNote').innerText()));
  await row('sun.png').click(); await P.settle(500);
  check('a picture is shown (120 × 80)', await f.evaluate(() => { const i = document.querySelector('#preview img'); return i && i.naturalWidth + 'x' + i.naturalHeight; }) === '120x80');
  await row('blob.dat').click(); await P.settle(300);
  check('a binary file shows its first bytes in hex instead', /No preview: this is not a text or picture file/.test(await details()) && (await f.locator('#preview pre.hex').innerText()).startsWith('00 01 02 03'));
  await row('docs').click(); await P.settle(100);
  check('a folder shows how many files and how big', /Files\s+2/.test(await details()) && /Extract this folder/.test(await details()));
  await page.keyboard.press('Control+f'); await page.keyboard.type('caf'); await P.settle(300);
  check('Ctrl+F searches names across all folders, with the match marked', await rowsText() === 'Zoë – café.txt' && await f.locator('#tree mark').innerText() === 'caf');
  await page.keyboard.press('Escape'); await P.settle(200);
  check('Esc clears the search', (await rowsText()).split('|').length === 10);

  section('Saving one file');
  await row('readme.txt').click(); await P.settle(200);
  await page.keyboard.press('Control+s'); await P.settle(300);
  check('Ctrl+S opens PortD\'s Save dialog with the file\'s name', await saveDlg() === 'Zip Viewer — Save readme.txt|readme.txt');
  await P.press('Save'); await P.settle(300);
  check('a text file is saved as text, exactly', await P.read(DOCS + '\\readme.txt') === 'Hello zip!\nSecond line.\n' && /^Saved readme\.txt/.test(await toast()));
  await row('sun.png').dblclick(); await P.settle(300); await P.press('Save'); await P.settle(400);
  check('double-clicking a file saves it too; a picture is saved byte for byte', (await bytesOf(DOCS + '\\sun.png')).equals(zipRead('normal.zip', 'img/sun.png')));
  await row('blob.dat').click(); await f.locator('#saveBtn').click(); await P.settle(300); await P.press('Save'); await P.settle(400);
  check('…and so is a binary file', (await bytesOf(DOCS + '\\blob.dat')).equals(zipRead('normal.zip', 'bin/blob.dat')));

  section('Extracting several files');
  await row('pixel.png').click(); await page.keyboard.press('Space'); await row('notes.md').click(); await page.keyboard.press('Space'); await P.settle(100);
  await f.locator('#extractBtn').click(); await P.settle(150);
  check('Extract ticked explains the two ways, since PortD has no folder picker', /Extract the ticked files: 2 files, .* in all\. PortD has no way for a program to save into a folder you choose/.test(await f.locator('#exMsg').innerText()) && /P:\\User\\Config\\zip-viewer\\Extracted\\normal/.test(await f.locator('#exAllMsg').innerText()));
  await f.locator('#exOne').click(); await P.settle(400);
  check('One by one: a Save dialog for the first…', /Save notes\.md|Save pixel\.png/.test(await saveDlg()));
  await P.press('Save'); await P.settle(400);
  check('…then for the second', /Save notes\.md|Save pixel\.png/.test(await saveDlg()));
  await P.press('Save'); await P.settle(400);
  check('both are saved', (await bytesOf(DOCS + '\\pixel.png')).equals(zipRead('normal.zip', 'img/pixel.png')) && await P.read(DOCS + '\\notes.md') === zipRead('normal.zip', 'docs/notes.md').toString() && /Saved all 2 files/.test(await toast()));
  await f.locator('#allBtn').click(); await P.settle(150);
  await f.locator('#exAll').click(); await P.settle(1500);
  check('Extract all, all at once: a summary with the folder path', /^Extracted 7 of 7 files into:/.test(await f.locator('#doneMsg').innerText()) && await f.locator('#donePath').innerText() === 'P:\\User\\Config\\zip-viewer\\Extracted\\normal');
  const EX = CFG + '\\Extracted\\normal';
  const same = [];
  for (const n of ['readme.txt', 'docs/notes.md', 'docs/deep/data.csv', 'img/pixel.png', 'img/sun.png', 'bin/blob.dat', 'Zoë – café.txt']) same.push((await bytesOf(EX + '\\' + n.replace(/\//g, '\\'))).equals(zipRead('normal.zip', n)));
  check('every file is there, in its folders, byte for byte', same.every(Boolean) && await P.ls(EX) === 'bin|docs|img|pixel.png|readme.txt|Zoë – café.txt'.replace('pixel.png|', ''), [same, await P.ls(EX)]);
  check('text files are written as text (Notepad can open them), the rest as binary', !/^data:/.test(await P.read(EX + '\\readme.txt')) && /^data:image\/png;base64,/.test(await P.read(EX + '\\img\\sun.png')));
  await f.locator('#doneCopy').click(); await P.settle(150);
  check('Copy the folder path copies it', await page.evaluate(() => navigator.clipboard.readText()) === 'P:\\User\\Config\\zip-viewer\\Extracted\\normal');
  await page.keyboard.press('Escape'); await P.settle(100);
  await f.locator('#allBtn').click(); await f.locator('#exAll').click(); await P.settle(1500);
  check('extracting again never overwrites: it goes into "normal (2)"', await f.locator('#donePath').innerText() === 'P:\\User\\Config\\zip-viewer\\Extracted\\normal (2)');
  await page.keyboard.press('Escape');
  await P.closeAll();

  section('Unsafe names stay inside the folder');
  await openWith('unsafe.zip');
  check('the summary warns that names tried to reach outside, and were made safe', /3 names tried to reach outside the archive's folder and were made safe/.test(await f.locator('#info').innerText()) && /1 name had characters PortD does not allow/.test(await f.locator('#info').innerText()));
  await f.locator('#search').fill('evil'); await P.settle(300); await f.locator('#tree').focus(); await page.keyboard.press('Home'); await P.settle(200);
  check('the entry says what it tried and where it will go instead', /tries to reach outside the archive's folder \("\.\.\/\.\.\/evil\.txt"\)\. When extracted it is saved as "evil\.txt"/.test(await details()));
  await f.locator('#search').fill(''); await P.settle(200);
  await f.locator('#allBtn').click(); await f.locator('#exAll').click(); await P.settle(1200);
  check('extracting keeps every file under Extracted\\unsafe, and says which names were changed', await P.ls(CFG + '\\Extracted\\unsafe') === 'a|etc|ok|Windows|evil.txt' && await P.exists(CFG + '\\Extracted\\unsafe\\ok\\bad_name_.txt') && await f.locator('#doneList li').count() === 3);
  check('nothing was written outside it', !(await P.exists('P:\\evil.txt')) && !(await P.exists('P:\\User\\evil.txt')) && !(await P.exists('P:\\etc')) && await P.ls(CFG) === 'Extracted');
  await page.keyboard.press('Escape'); await P.closeAll();

  section('What Zip Viewer cannot open, said plainly');
  await openWith('methods.zip');
  await row('bz.txt').click(); await P.settle(200);
  check('BZIP2 and LZMA entries are marked, and say why', /compressed with BZIP2, which Zip Viewer cannot open/.test(await details()) && await f.locator('#saveBtn').isDisabled() && /2 files cannot be opened here/.test(await f.locator('#info').innerText()) && await row('lz.txt').locator('.ic').innerText() === '⛔');
  await f.locator('#allBtn').click(); await f.locator('#exAll').click(); await P.settle(1000);
  check('extracting all extracts what it can and lists the rest', /^Extracted 1 of 3 files/.test(await f.locator('#doneMsg').innerText()) && await f.locator('#doneTitle').innerText() === 'Done, with problems' && /bz\.txt: It is compressed with BZIP2/.test(await f.locator('#doneList').innerText()));
  await page.keyboard.press('Escape'); await P.closeAll();
  await openWith('enc.zip'); await P.settle(200);
  check('an encrypted entry says it needs a password', /encrypted \(protected by a password\), which Zip Viewer cannot open/.test(await details()));
  await P.closeAll();
  await openWith('bomb.zip'); await P.settle(500);
  await f.locator('#saveBtn').click(); await P.settle(1500);
  check('a "zip bomb" (an entry that grows past the size it claims) is stopped and explained, before any Save dialog', /grows bigger than the 1000 B its list says, so it was stopped\. The archive may be damaged or made to fill up memory/.test(await toast()) && !(await P.ev(() => !!document.querySelector('.dlg h2'))));
  await P.closeAll();
  await openWith('huge.zip'); await f.locator('#saveBtn').click(); await P.settle(300);
  check('an entry over 64 MB is refused with the reason', /"big\.bin" would be 70 MB when unpacked; files in PortD can be at most 64 MB/.test(await toast()));
  await P.closeAll();
  await openWith('corrupt.zip'); await P.settle(400);
  check('damaged compressed data says so', /could not be unpacked: its compressed data is damaged|not where its list says/.test(await details()));
  await P.closeAll();
  await openWith('cut.zip'); await P.settle(200);
  check('a cut-off archive says it cannot be read, and why', /Could not open cut\.zip/.test(await f.locator('#empty').innerText()) && /cut short or damaged/.test(await f.locator('#empty').innerText()));
  await P.closeAll();
  await openWith('fake.zip'); await P.settle(200);
  check('a .zip that is really text is refused plainly', /PortD holds this file as text, so it is not a zip archive/.test(await f.locator('#empty').innerText()));
  await P.closeAll();

  section('ZIP64 and Office files');
  await openWith('true64.zip'); await row('readme.txt').click(); await P.settle(300);
  check('a ZIP64 archive is read (sizes and offsets from its ZIP64 fields)', await f.locator('#preview pre').innerText() === 'Hello zip!\nSecond line.\n' && /✓ Checksum matches/.test(await f.locator('#crcNote').innerText()));
  await P.closeAll();
  const it2 = await openWith('report.docx');
  check('Open with lists Zip Viewer for .docx; its parts are listed', it2.split('|').includes('Zip Viewer') && /\[Content_Types\]\.xml/.test(await rowsText()) && /word/.test(await rowsText()));
  await row('document.xml').click(); await P.settle(300);
  check('…and the XML inside can be read', /<w:document>Hello<\/w:document>/.test(await f.locator('#preview pre').innerText()));
  await P.closeAll();

  section('Opening with Ctrl+O, touch, theme');
  await P.icon('Zip Viewer').dblclick(); await P.settle(700); f = await P.frame(); await f.waitForFunction(() => window.__zv && __zv.ready);
  check('started on its own, it invites you to open an archive', /Open a \.zip file/.test(await f.locator('#empty').innerText()) && await f.evaluate(() => document.activeElement.id) === 'openBtn2');
  await page.keyboard.press('Control+o'); await P.settle(300); await P.pickInDialog('normal.zip'); await P.settle(600);
  check('Ctrl+O opens an archive through PortD\'s Open dialog', /normal\.zip/.test(await f.locator('#info').innerText()));
  await row('readme.txt').locator('.chk').tap(); await row('notes.md').tap(); await P.settle(200);
  check('touch: a tap on the box ticks, a tap on the row chooses', await row('readme.txt').getAttribute('aria-checked') === 'true' && await f.evaluate(() => __zv.cur).then(c => c.startsWith('f')) && /notes\.md/.test(await f.locator('#details h2').innerText()));
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(150);
  check('the theme button goes to light, then dark, and is saved', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark' && await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(26, 30, 38)');
  await f.locator('#themeBtn').click();
  await P.closeAll();
  check('the archive itself was never changed', (await bytesOf(DOCS + '\\normal.zip')).equals(fx('normal.zip')));

  section('No errors');
  check('no console errors in PortD or in Zip Viewer', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  await sp.waitForFunction(() => window.__zv && __zv.ready, null, { timeout: 8000 });
  const [fc] = await Promise.all([sp.waitForEvent('filechooser'), sp.click('#openBtn2')]); await fc.setFiles(path.join(FX, 'normal.zip')); await sp.waitForTimeout(600);
  check('it opens an archive from the computer and follows the system\'s dark theme', /7 files in 4 folders/.test(await sp.locator('#info').innerText()) && await sp.evaluate(() => document.documentElement.dataset.theme === 'dark'));
  await sp.locator('#tree .row', { hasText: 'readme.txt' }).click();
  const [dl] = await Promise.all([sp.waitForEvent('download'), sp.click('#saveBtn')]);
  check('Save file downloads it', dl.suggestedFilename() === 'readme.txt' && fs.readFileSync(await dl.path()).toString() === 'Hello zip!\nSecond line.\n');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  fs.rmSync(FX, { recursive: true, force: true });
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
