/* PortD App Hub test harness, in the style of PortD's own suite (suite/run.js).
   Runs the real portd.html from file:// in headless Chrome (or Edge where installed) with a fresh browser profile,
   drives it with real mouse and keyboard input through Playwright, and reaches PortD only through the page and
   window.PortDHost. Usage from an app's test.js:  const H = require('../build/harness');  */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { pathToFileURL } = require('url');
/* Playwright: the PLAYWRIGHT environment variable, or the copy installed by `npm install`, or a shared copy */
const { chromium } = (() => {
  for (const m of [process.env.PLAYWRIGHT, 'playwright', '/opt/npm-tools/node_modules/playwright']) { if (!m) continue; try { return require(m); } catch (e) { /* try the next */ } }
  throw new Error('Playwright not found: run npm install in the repository folder, or set PLAYWRIGHT to its folder.');
})();

/* the browser: the BROWSER environment variable, else Edge, else Chrome, else Playwright's own Chromium */
const BROWSER = [process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));
/* the PortD build: PORTD as a version ("1.0.0") or a path, else the latest build in this folder (see versions.js) */
const V = require('./versions');
const PORTD = V.file(process.env.PORTD || V.LATEST);
if (!fs.existsSync(PORTD)) throw new Error('No PortD build at ' + PORTD + '. Builds here: ' + V.BUILDS.join(', '));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-test-'));
let dirs = 0;
const newDir = () => { const d = path.join(tmp, 'd' + ++dirs); fs.mkdirSync(d); return d; };

let pass = 0, fail = 0, group = '';
const failures = [];
function section(name) { group = name; console.log('\n' + name); }
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok    ' + name); }
  else { fail++; failures.push(group + ': ' + name); console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 700) : '')); }
}
function note(t) { console.log('  note  ' + t); }
function finish() {
  console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed' + (fail ? '\n\nFailed:\n' + failures.map(f => '  ' + f).join('\n') : ''));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
}

/* a fresh browser profile; ctx.errors collects console errors and page errors from PortD and every program frame */
async function profile(o = {}) {
  const ctx = await chromium.launchPersistentContext(newDir(), { executablePath: BROWSER, headless: true, viewport: o.viewport || { width: 1280, height: 800 }, hasTouch: !!o.touch, colorScheme: o.colorScheme || 'light', acceptDownloads: true });
  ctx.errors = [];
  ctx.watch = page => { page.on('console', m => { if (m.type() === 'error') ctx.errors.push(m.text()); }); page.on('pageerror', e => ctx.errors.push(String(e) + (process.env.STACKS ? ' @ ' + e.stack : ''))); return page; };
  return ctx;
}
/* PortD itself, opened from a copy in a folder of its own, with the first-run question and the backup reminder put away */
async function openPortD(ctx) {
  const dir = newDir(), file = path.join(dir, 'portd.html');
  fs.copyFileSync(PORTD, file);
  const page = ctx.watch(await ctx.newPage());
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => window.PortDHost, null, { timeout: 15000 });
  await firstRunAway(page);
  page.file = file;
  return page;
}
async function firstRunAway(page) {
  await page.waitForTimeout(120);
  await page.evaluate(async () => {
    const d = [...document.querySelectorAll('.dlg')].find(x => x.querySelector('h2') && x.querySelector('h2').textContent === 'What should PortD call you?');
    if (d) [...d.querySelectorAll('.btn')].find(b => b.textContent === 'Skip').click();
    PortDHost.wm.quiet = true; for (const w of PortDHost.wm.wins.slice()) await w.close(true); PortDHost.wm.quiet = false;
    if (document.activeElement) document.activeElement.blur();
  });
  await later(page);
}
const later = async page => { await page.waitForTimeout(80); await page.evaluate(() => { const b = [...document.querySelectorAll('#notices .notice .btn')].find(b => b.textContent === 'Later'); if (b) b.click(); }); };
const saved = page => page.waitForFunction(() => { const i = document.querySelector('#tray [data-tray=save]'); return i && i.dataset.status === 'saved'; }, null, { timeout: 10000 });
async function reload(page) { await saved(page); await page.reload(); await page.waitForFunction(() => window.PortDHost); await later(page); }

/* helpers bound to one PortD page */
function on(page) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms = 120) => page.waitForTimeout(ms);
  const P = {
    page, ev, settle, esc,
    write: (p, d, enc) => ev(([p, d, enc]) => { PortDHost.vfs.write(p, d, enc ? { enc } : undefined); }, [p, d, enc]),
    read: p => ev(p => PortDHost.vfs.exists(p) ? PortDHost.vfs.read(p) : null, p),
    exists: p => ev(p => PortDHost.vfs.exists(p), p),
    ls: p => ev(p => PortDHost.vfs.exists(p) ? PortDHost.vfs.list(p).map(e => e.name).join('|') : 'MISSING', p),
    titles: () => ev(() => PortDHost.wm.wins.map(w => w.title).join('|')),
    toast: () => ev(() => { const t = document.querySelector('#toasts .toast:last-child'); return t ? t.firstChild.textContent : ''; }),
    dlg: () => ev(() => { const d = [...document.querySelectorAll('.ov .dlg')].pop(); return d ? d.innerText : null; }),
    notices: () => ev(() => [...document.querySelectorAll('#notices .notice')].map(n => n.innerText.replace(/\n+/g, ' / ')).join(' || ')),
    press: async label => { await page.locator('.ov:last-of-type .dlg .btn', { hasText: new RegExp('^' + esc(label) + '$') }).click(); await settle(160); },
    icon: name => page.locator('.dicon').filter({ has: page.locator('.lbl', { hasText: new RegExp('^' + esc(name) + '$') }) }),
    closeAll: async () => { await ev(async () => { for (const w of PortDHost.wm.wins.slice()) await w.close(true); }); await settle(); },
    settings: async tab => { await ev(tab => { PortDHost.launch('builtin:settings', { tab }); }, tab); await settle(180); },
    /* the frame of the active program window, once its script has run */
    frame: async (sel = '.win.active iframe') => { const el = await page.waitForSelector(sel, { timeout: 5000 }); const f = await el.contentFrame(); await f.waitForFunction(() => window.PortD && document.readyState === 'complete'); return f; },
    /* Settings > Programs > Install a program…, with the file given to the real file chooser; leaves the confirmation open */
    offerInstall: async file => {
      await P.settings('programs');
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.spane .btn', { hasText: /^Install a program…$/ }).click()]);
      await chooser.setFiles(file); await settle(300);
      return P.dlg();
    },
    /* PortD's own Open dialog, drawn by the page: go to a folder below the home folder and pick a file */
    pickInDialog: async (name, folder = 'Documents', button = 'Open') => {
      const where = await ev(() => document.querySelector('.dlg .bwhere span').textContent);
      if (!where.endsWith('\\' + folder)) { await page.locator('.dlg .bwhere button').click(); await settle(); await page.locator('.dlg .brow', { hasText: new RegExp('^' + esc(folder) + '$') }).dblclick(); await settle(); }
      if (name) await page.locator('.dlg .brow', { hasText: new RegExp('^' + esc(name) + '$') }).click();
      await P.press(button);
    },
    /* a Files window on a folder, and a double-click on one of its rows */
    openInFiles: async (folder, name) => {
      await ev(folder => { PortDHost.launch('builtin:files', { path: folder }); }, folder); await settle(250);
      await page.locator('.win.active .row').filter({ has: page.locator('.t', { hasText: new RegExp('^' + esc(name) + '$') }) }).dblclick(); await settle(400);
    },
    rowMenu: async (folder, name) => {
      await ev(folder => { PortDHost.launch('builtin:files', { path: folder }); }, folder); await settle(250);
      await page.locator('.win.active .row').filter({ has: page.locator('.t', { hasText: new RegExp('^' + esc(name) + '$') }) }).click({ button: 'right' }); await settle();
    },
    menuItems: (n = 0) => ev(n => { const m = document.querySelectorAll('.menu')[n]; return m ? [...m.querySelectorAll('.mi')].map(b => b.textContent).join('|') : null; }, n),
    mi: (label, n = 0) => page.locator('.menu >> nth=' + n).locator('.mi', { hasText: new RegExp('^' + esc(label) + '$') })
  };
  return P;
}
/* the program's own page opened straight from its src folder, outside PortD */
async function openStandalone(ctx, entry) {
  const page = ctx.watch(await ctx.newPage());
  await page.goto(pathToFileURL(entry).href);
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(200);
  return page;
}

module.exports = { BROWSER, PORTD, tmp, newDir, section, check, note, finish, profile, openPortD, reload, saved, later, on, openStandalone };
