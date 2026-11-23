/* Paint: tests in the real PortD 1.0.0, in headless Chrome, with real mouse, keyboard, touch and pen input
   (touch and pen go through Chrome's own input, so the page sees real touch and pen pointer events).
   Results are checked by reading pixels back from the picture.
   Run: node paint/test.js   (after node paint/build.js) */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const H = require('../build/harness');
const { section, check } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const DOCS = 'P:\\User\\Documents', CFG = 'P:\\User\\Config\\paint';

/* a PNG: a yellow box on blue, with a transparent corner if asked */
function png(w, h, clear) {
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * (w * 4 + 1) + 1 + x * 4, inBox = x >= w / 4 && x < w * 3 / 4 && y >= h / 4 && y < h * 3 / 4;
    rows.set(clear && x < 10 && y < 10 ? [0, 0, 0, 0] : inBox ? [250, 200, 40, 255] : [40, 90, 200, 255], i);
  }
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return (~c) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const GIF = Buffer.from('R0lGODlhAgACAIABAP8AAP///ywAAAAAAgACAAACAoRRADs=', 'base64'); // 2×2, red and white

(async () => {
  console.log('Paint tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile({ touch: true });
  const page = await H.openPortD(ctx), P = H.on(page);
  const cdp = await ctx.newCDPSession(page);
  let f;
  const launch = async () => { await P.icon('Paint').dblclick(); await P.settle(700); f = await P.frame(); await f.waitForFunction(() => window.__pt && (__pt.ready || !document.getElementById('restoreDlg').hidden)); };
  const px = (x, y) => f.evaluate(([x, y]) => __pt.pixel(x, y).join(','), [x, y]);
  const doc = () => f.evaluate(() => JSON.parse(JSON.stringify(__pt.doc)));
  const steps = () => f.evaluate(() => __pt.hist.undoList.length);
  const toast = () => f.locator('#toast').innerText();
  let B;
  const pt = (x, y) => { const z = B.z; return { x: B.x + (x + 0.5) * z, y: B.y + (y + 0.5) * z }; };
  const frameBox = async () => { await f.locator('#stage').evaluate(e => { e.scrollLeft = 0; e.scrollTop = 0; }); const b = await f.locator('#ov').boundingBox(); B = { x: b.x, y: b.y, z: await f.evaluate(() => __pt.zoom) }; };
  async function drag(x0, y0, x1, y1, o) {
    o = o || {}; const a = pt(x0, y0), b = pt(x1, y1);
    if (o.shift) await page.keyboard.down('Shift');
    await page.mouse.move(a.x, a.y); await page.mouse.down({ button: o.button || 'left' });
    await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up({ button: o.button || 'left' });
    if (o.shift) await page.keyboard.up('Shift');
    await P.settle(40);
  }
  const click = async (x, y, button) => { const a = pt(x, y); await page.mouse.click(a.x, a.y, { button: button || 'left' }); await P.settle(40); };
  const focusOv = () => f.evaluate(() => document.getElementById('ov').focus({ preventScroll: true }));
  const tool = async k => { await focusOv(); await page.keyboard.press(k); };
  const color = async (i, second) => { await f.locator('.sw').nth(i).click({ button: second ? 'right' : 'left' }); };
  const WHITE = '255,255,255,255', BLACK = '0,0,0,255', RED = '237,28,36,255', BLUE = '0,162,232,255', YELLOW = '255,242,0,255';

  await P.ev(([a, b, c]) => Promise.all([PortDHost.vfs.write('P:\\User\\Documents\\photo.png', 'data:image/png;base64,' + a, 'dataurl'), PortDHost.vfs.write('P:\\User\\Documents\\clear.png', 'data:image/png;base64,' + b, 'dataurl'), PortDHost.vfs.write('P:\\User\\Documents\\tiny.gif', 'data:image/gif;base64,' + c, 'dataurl')]), [png(160, 100).toString('base64'), png(40, 40, true).toString('base64'), GIF.toString('base64')]);

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names Paint 1.0.0, .png .jpg .jpeg .gif and 6 files', /Paint/.test(d) && /Version\s+1\.0\.0/.test(d) && /Can open\s+\.png, \.jpg, \.jpeg, \.gif/.test(d) && /Files\s+6 files, /.test(d), d);
  await P.press('Install');
  await page.locator('#notices .notice .btn', { hasText: /^Dismiss$/ }).click().catch(() => {});
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\paint') === 'js|icon.svg|index.html|manifest.json|style.css' && await P.icon('Paint').count() === 1);
  await P.closeAll();
  await launch();
  check('a new 800 × 600 white picture, fitted to the window, with the drawing area focused', (await doc()).w === 800 && (await doc()).h === 600 && await px(400, 300) === WHITE && await f.evaluate(() => document.activeElement.id) === 'ov' && /Untitled\.png - Paint/.test(await P.titles()));
  await f.locator('#zoomSel').selectOption('1'); await frameBox();

  section('Drawing with the mouse');
  await drag(20, 20, 120, 20);
  check('the pencil draws in the main colour (black)', await px(70, 20) === BLACK && await px(70, 30) === WHITE && await steps() === 1);
  await color(5, true);
  await drag(20, 40, 120, 40, { button: 'right' });
  check('the right button draws in the second colour (red, chosen with a right-click on the palette)', await px(70, 40) === RED);
  await tool('l'); await color(10);
  await drag(20, 60, 120, 64, { shift: true });
  check('Line with Shift snaps to straight (blue, along y = 60)', await px(118, 60) === BLUE && await px(60, 60) === BLUE);
  await tool('r');
  await drag(150, 20, 250, 100);
  check('Rectangle draws an outline', await px(150, 60) === BLUE && await px(200, 60) === WHITE);
  await f.locator('#filled').check(); await color(7);
  await drag(270, 20, 330, 60);
  check('Filled draws a solid rectangle', await px(300, 40) === YELLOW && await px(271, 21) === YELLOW);
  await tool('o');
  await drag(350, 20, 450, 100);
  check('Ellipse (filled) is solid in the middle and leaves the corners', await px(400, 60) === YELLOW && await px(352, 22) === WHITE);
  await f.locator('#filled').uncheck();
  await tool('f'); await color(8);
  await click(200, 60);
  check('Fill fills the inside of the rectangle (green) and not outside', await px(200, 60) === '34,177,76,255' && await px(170, 30) === '34,177,76,255' && await px(260, 60) === WHITE);
  await tool('e'); await f.evaluate(() => { document.getElementById('size').value = 12; document.getElementById('size').dispatchEvent(new Event('input')); });
  await drag(200, 40, 200, 80);
  check('the Eraser rubs out to white', await px(200, 60) === WHITE && await px(170, 30) === '34,177,76,255');
  await tool('i'); await click(300, 40);
  check('the Eyedropper picks a colour and goes back to the tool before', await f.evaluate(() => __pt.settings.c1) === '#fff200' && await f.evaluate(() => __pt.settings.tool) === 'eraser' && /Picked #FFF200/.test(await toast()));
  await tool('b'); await focusOv();
  await page.keyboard.press(']'); await page.keyboard.press(']');
  check('] makes the brush bigger (12, 14, 16), [ smaller', await f.evaluate(() => __pt.settings.size) === 16 && (await page.keyboard.press('['), await f.evaluate(() => __pt.settings.size)) === 14);
  await page.keyboard.press('x');
  check('X swaps the two colours', await f.evaluate(() => __pt.settings.c1) === '#ed1c24' && await f.evaluate(() => __pt.settings.c2) === '#fff200');

  section('Pen and touch');
  async function penStroke(x0, y0, x1, y1, force) {
    const a = pt(x0, y0), b = pt(x1, y1);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen', force });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10, button: 'left', buttons: 1, pointerType: 'pen', force });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen', force: 0 });
    await P.settle(50);
  }
  const thick = (x, y0, y1) => f.evaluate(([x, y0, y1]) => { let n = 0; for (let y = y0; y <= y1; y++) if (__pt.pixel(x, y).join() !== '255,255,255,255') n++; return n; }, [x, y0, y1]);
  await penStroke(500, 150, 600, 150, 1); await penStroke(500, 200, 600, 200, 0.1);
  const heavy = await thick(550, 135, 165), light = await thick(550, 185, 215);
  check('a pen draws thicker when pressed harder (pressure changes the width)', heavy >= 10 && light >= 1 && light < heavy / 2, [heavy, light]);
  const t0 = pt(500, 260), t1 = pt(650, 260), tp = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(t0.x, t0.y) });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(t0.x + (t1.x - t0.x) * i / 10, t0.y) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await P.settle(80);
  check('a finger draws too', await px(575, 260) === RED, await f.evaluate(() => { const o = []; for (let y = 230; y < 290; y += 2) for (let x = 480; x < 680; x += 10) if (__pt.pixel(x, y).join() !== '255,255,255,255') o.push(x + ':' + y); return o.join(' '); }));

  section('Drawing from the keyboard');
  await f.locator('#size').evaluate(e => { e.value = 1; e.dispatchEvent(new Event('input')); });
  await tool('l'); await focusOv();
  await page.keyboard.press('ArrowRight');
  check('arrow keys show a cursor in the middle of the picture', await f.evaluate(() => [__pt.kc.shown, __pt.kc.x, __pt.kc.y].join()) === 'true,401,300' && await f.locator('.kcursor').evaluate(e => !e.hidden), await f.evaluate(() => [__pt.kc.shown, __pt.kc.x, __pt.kc.y, document.activeElement.id].join()));
  await page.keyboard.press('Enter');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Enter'); await P.settle(50);
  check('Enter, arrows, Enter draws a line from the keyboard', await px(420, 300) === RED && await px(440, 300) === RED && /Done at 441, 300/.test(await f.locator('#say').textContent()));
  await page.keyboard.press('Enter'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Escape'); await P.settle(50);
  check('Esc cancels a line in progress', await px(441, 305) === WHITE && await f.evaluate(() => document.getElementById('ov').getContext('2d').getImageData(441, 305, 1, 1).data[3]) === 0, [await px(441, 305), await f.evaluate(() => document.getElementById('ov').getContext('2d').getImageData(441, 305, 1, 1).data.join()), await f.evaluate(() => [__pt.kc.x, __pt.kc.y, document.activeElement.id].join())]);
  await page.keyboard.press('b'); await page.keyboard.press('Enter'); await page.keyboard.press('Shift+ArrowUp'); await page.keyboard.press('Enter'); await P.settle(50);
  check('…and the pencil: pen down, move, pen up', await px(441, 305) === RED && await px(441, 300) === RED);

  section('Undo, redo and Clear');
  const before = await steps();
  await focusOv(); await page.keyboard.press('Control+z'); await P.settle(50);
  check('Ctrl+Z undoes the last step', await px(441, 305) === WHITE && await steps() === before - 1, [await px(441, 305), before, await steps()]);
  await page.keyboard.press('Control+y'); await P.settle(50);
  check('Ctrl+Y redoes it', await px(441, 305) === RED);
  await f.locator('#size').evaluate(e => { e.value = 2; e.dispatchEvent(new Event('input')); });
  for (let i = 0; i < 40; i++) await drag(20 + i * 5, 400, 20 + i * 5, 420);
  check('every stroke is a step; at most 50 are kept', await steps() === 50);
  for (let i = 0; i < 35; i++) await page.keyboard.press('Control+z');
  check('35 undos take back 35 strokes, in order', await px(20 + 4 * 5, 410) === RED && await px(20 + 5 * 5, 410) === WHITE);
  for (let i = 0; i < 35; i++) await page.keyboard.press('Control+Shift+z');
  check('…and Ctrl+Shift+Z brings them all back', await px(20 + 39 * 5, 410) === RED);
  await f.locator('#clearBtn').click(); await P.settle(100);
  check('Clear asks first, with Cancel focused', !(await f.locator('#confirmDlg').isHidden()) && await f.evaluate(() => document.activeElement.textContent) === 'Cancel');
  await page.keyboard.press('Escape');
  check('Esc keeps the picture', await px(70, 20) === BLACK);
  await f.locator('#clearBtn').click(); await f.locator('#confOk').click(); await P.settle(100);
  check('OK clears it to white', await px(70, 20) === WHITE && await px(300, 40) === WHITE);
  await focusOv(); await page.keyboard.press('Control+z'); await P.settle(100);
  check('…and Undo brings it all back', await px(70, 20) === BLACK && await px(300, 40) === YELLOW);

  section('Zoom and moving around');
  await page.keyboard.press('+'); await page.keyboard.press('+');
  check('+ zooms in (150%, then 200%) and pixels stay sharp from 200%', await f.evaluate(() => __pt.zoom) === 2 && await f.locator('#wrap').evaluate(e => e.classList.contains('pixels') && e.style.width) === '1600px');
  await page.keyboard.press('-');
  check('− zooms out', await f.evaluate(() => __pt.zoom) === 1.5);
  await page.keyboard.press('1');
  check('1 goes back to 100%', await f.evaluate(() => __pt.zoom) === 1);
  const r0 = await f.locator('#stage').boundingBox();
  await page.mouse.move(r0.x + 200, r0.y + 200); await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control'); await P.settle(100);
  check('Ctrl + mouse wheel zooms', await f.evaluate(() => __pt.zoom) === 1.25);
  const n0 = await steps(), s0 = await f.locator('#stage').evaluate(e => e.scrollLeft + ',' + e.scrollTop);
  await tool('h'); await page.mouse.move(r0.x + 300, r0.y + 300); await page.mouse.down(); await page.mouse.move(r0.x + 200, r0.y + 220, { steps: 5 }); await page.mouse.up();
  check('the Hand moves around the picture (and draws nothing)', await f.locator('#stage').evaluate(e => e.scrollLeft + ',' + e.scrollTop) !== s0 && await steps() === n0);
  await page.keyboard.press('0'); await tool('b');
  check('0 fits the picture to the window', await f.evaluate(() => __pt.zoom) < 1);
  await f.locator('#zoomSel').selectOption('1'); await frameBox();

  section('The tool and palette buttons, from the keyboard');
  await f.locator('#tools .tool[aria-checked=true]').focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  check('the tools are a group of choices: arrow keys pick the next', await f.evaluate(() => __pt.settings.tool) === 'rect' && await f.locator('#tools .tool[data-t=rect]').getAttribute('aria-checked') === 'true');
  await f.locator('.sw').first().focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  check('arrow keys move along the palette; Enter picks the main colour', await f.evaluate(() => __pt.settings.c1) === '#b5e61d');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Shift+Enter');
  check('Shift+Enter picks the second colour', await f.evaluate(() => __pt.settings.c2) === '#22b14c');

  section('Saving, and the working copy');
  await P.settle(1700);
  check('a working copy of the unsaved picture is kept in the data folder', await P.ls(CFG) === 'settings.json|work.json|work.png' && /^data:image\/png;base64,/.test(await P.read(CFG + '\\work.png')) && JSON.parse(await P.read(CFG + '\\work.json')).w === 800);
  check('the title and status show it is not saved', /^• Untitled\.png - Paint$/.test(await P.titles()) && /● Untitled\.png/.test(await f.locator('#docName').innerText()));
  await P.closeAll(); await launch();
  check('starting again offers to restore it, with a picture of it', !(await f.locator('#restoreDlg').isHidden()) && /a picture that was not saved: "Untitled\.png", 800 × 600/.test(await f.locator('#resMsg').innerText()) && await f.evaluate(() => document.getElementById('resImg').naturalWidth) === 800 && await f.evaluate(() => document.activeElement.textContent) === 'Restore it');
  await page.keyboard.press('Enter'); await P.settle(400);
  check('Restore brings it back, still marked as not saved', await px(70, 20) === BLACK && await px(300, 40) === YELLOW && (await doc()).dirty === true);
  await focusOv(); await page.keyboard.press('Control+s'); await P.settle(200);
  check('Ctrl+S on a new picture asks PNG or JPG first', !(await f.locator('#fmtDlg').isHidden()));
  await f.locator('#fmtDlg [data-act=png]').click(); await P.settle(300);
  check('…then PortD\'s Save dialog, with the name', await P.ev(() => document.querySelector('.dlg input.field').value) === 'Untitled.png');
  await P.ev(() => { const i = document.querySelector('.dlg input.field'); i.value = 'drawing'; i.dispatchEvent(new Event('input')); });
  await P.press('Save'); await P.settle(400);
  check('it is saved as a PNG; the working copy is removed', /^data:image\/png;base64,iVBOR/.test(await P.read(DOCS + '\\drawing.png')) && await P.ls(CFG) === 'settings.json' && (await doc()).dirty === false && /^Saved drawing\.png/.test(await toast()) && await P.titles() === 'drawing.png - Paint');
  await f.locator('#zoomSel').selectOption('1'); await frameBox(); await tool('b'); await drag(600, 400, 700, 400);
  await focusOv(); await page.keyboard.press('Control+s'); await P.settle(300);
  check('after that, Ctrl+S saves straight over the same file, with no dialog', await P.ev(() => !document.querySelector('.dlg')) && (await doc()).dirty === false);
  await P.closeAll();
  await P.rowMenu(DOCS, 'drawing.png'); await P.mi('Open with').hover(); await P.settle(250);
  const ow = await P.menuItems(1);
  await P.mi('Paint', 1).click(); await P.settle(800); f = await P.frame(); await f.waitForFunction(() => window.__pt && __pt.ready); await P.settle(200);
  check('Open with lists Paint for .png; the saved file opens with everything in it', ow.split('|').includes('Paint') && await px(70, 20) === BLACK && await px(650, 400) !== WHITE && (await doc()).name === 'drawing.png', [ow, await px(70, 20), await px(650, 400), (await doc()).name]);

  section('Opening pictures, JPG and GIF');
  await P.rowMenu(DOCS, 'photo.png'); await P.mi('Open with').hover(); await P.settle(250); await P.mi('Paint', 1).click(); await P.settle(800);
  check('opening another picture uses the same window (Paint opens in one window)', await page.locator('.win iframe[title*="Paint"]').count() === 1);
  check('…and opens it at its own size with its colours', (await doc()).w === 160 && (await doc()).h === 100 && await px(80, 50) === '250,200,40,255' && await px(5, 5) === '40,90,200,255');
  await f.locator('#zoomSel').selectOption('1'); await frameBox(); await tool('b');
  await drag(10, 10, 30, 10);
  await P.rowMenu(DOCS, 'clear.png'); await P.mi('Open with').hover(); await P.settle(250); await P.mi('Paint', 1).click(); await P.settle(500);
  check('with unsaved changes, opening another picture asks first', /Your changes to "photo\.png" have not been saved/.test(await f.locator('#confMsg').innerText()));
  await f.locator('#confOk').click(); await P.settle(400);
  check('a PNG with transparency keeps it, and the Eraser then rubs out to transparent', (await doc()).bg === 'transparent' && await px(2, 2) === '0,0,0,0');
  await f.locator('#zoomSel').selectOption('4'); await frameBox(); await tool('e');
  await f.evaluate(() => { document.getElementById('size').value = 4; document.getElementById('size').dispatchEvent(new Event('input')); });
  await drag(20, 20, 30, 20);
  check('…and the Eraser on a transparent picture rubs out to transparent', (await px(25, 20)).endsWith(',0'));
  await focusOv(); await page.keyboard.press('Control+Shift+s'); await P.settle(200);
  await f.locator('#fmtDlg [data-act=jpg]').click(); await P.settle(300);
  check('Save as JPG offers clear.jpg', await P.ev(() => document.querySelector('.dlg input.field').value) === 'clear.jpg');
  await P.press('Save'); await P.settle(400);
  check('…and saves a JPEG', /^data:image\/jpeg;base64,\/9j\//.test(await P.read(DOCS + '\\clear.jpg')) && (await doc()).fmt === 'jpg');
  await P.rowMenu(DOCS, 'tiny.gif'); await P.mi('Open with').hover(); await P.settle(250); await P.mi('Paint', 1).click(); await P.settle(500);
  check('a GIF opens (2 × 2), and will be saved as PNG', (await doc()).w === 2 && (await doc()).name === 'tiny.png' && (await doc()).path === null && await px(0, 0) === '255,0,0,255');

  await f.locator('#openBtn').click(); await P.settle(400); await P.pickInDialog('photo.png'); await P.settle(800);
  check('Open… (PortD\'s Open dialog) opens a picture', (await doc()).name === 'photo.png' && (await doc()).w === 160);
  const was = await P.read(DOCS + '\\photo.png');
  await f.locator('#zoomSel').selectOption('1'); await frameBox(); await tool('b'); await drag(10, 50, 60, 50);
  await focusOv(); await page.keyboard.press('Control+s'); await P.settle(400);
  check('…and Ctrl+S saves the change back into that same file, with no dialog', await P.ev(() => !document.querySelector('.dlg')) && /^Saved photo\.png/.test(await toast()) && await P.read(DOCS + '\\photo.png') !== was);

  section('New picture, theme, throwing away a working copy');
  await f.locator('#newBtn').click(); await P.settle(100);
  await f.locator('#newPreset').selectOption('custom'); await f.locator('#newW').fill('320'); await f.locator('#newH').fill('200');
  await f.locator('input[name=bg][value=transparent]').check(); await f.locator('#newOk').click(); await P.settle(300);
  check('New makes a picture of the size asked, here transparent', (await doc()).w === 320 && (await doc()).h === 200 && await px(100, 100) === '0,0,0,0' && await steps() === 0);
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(150);
  check('the theme button goes to light, then dark, and is saved', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark');
  await f.locator('#themeBtn').click();
  await f.locator('#zoomSel').selectOption('1'); await frameBox(); await tool('b'); await drag(10, 10, 100, 10);
  await f.evaluate(() => __pt.writeWork()); await P.settle(200);
  await P.closeAll(); await launch();
  await f.locator('#resDiscard').click(); await P.settle(100);
  check('Throw it away asks for a second click', await f.locator('#resDiscard').innerText() === 'Click again to throw it away' && !(await f.locator('#restoreDlg').isHidden()));
  await f.locator('#resDiscard').click(); await P.settle(300);
  check('a second click throws the working copy away and starts fresh', await P.ls(CFG) === 'settings.json' && (await doc()).w === 800 && /thrown away/.test(await toast()));
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Paint', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  await sp.waitForFunction(() => window.__pt && __pt.ready, null, { timeout: 8000 });
  const sb = await sp.locator('#ov').boundingBox();
  await sp.mouse.move(sb.x + 30, sb.y + 30); await sp.mouse.down(); await sp.mouse.move(sb.x + 200, sb.y + 30, { steps: 8 }); await sp.mouse.up();
  check('it draws and follows the system\'s dark theme', await sp.evaluate(() => __pt.hist.undoList.length === 1 && document.documentElement.dataset.theme === 'dark'));
  await sp.keyboard.press('Control+s'); await sp.locator('#fmtDlg [data-act=png]').waitFor();
  const [dl] = await Promise.all([sp.waitForEvent('download'), sp.click('#fmtDlg [data-act=png]')]);
  check('Save downloads a PNG', dl.suggestedFilename() === 'Untitled.png' && fs.readFileSync(await dl.path()).slice(1, 4).toString() === 'PNG');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
