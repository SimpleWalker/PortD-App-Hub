/* Paint: the window. Tools, colours, drawing with pointer events (mouse, pen with pressure, touch) and from the
   keyboard, zoom and pan, undo and redo, files, and the working copy kept in the data folder so unsaved work
   survives the window being closed. */
(function () {
  'use strict';
  const P = window.Paint, $ = id => document.getElementById(id);
  const cv = $('cv'), ov = $('ov'), wrap = $('wrap'), stage = $('stage');
  let ctx = cv.getContext('2d', { willReadFrequently: true }), octx = ov.getContext('2d');
  const hist = new P.History(ctx, 50);
  const ZOOMS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
  const TOOLS = [
    ['pencil', 'b', 'Pencil', '<path d="M3 13l1-4 7-7 3 3-7 7z M9 4l3 3"/>'],
    ['line', 'l', 'Line', '<path d="M3 13L13 3"/>'],
    ['rect', 'r', 'Rectangle', '<rect x="2.5" y="4" width="11" height="8"/>'],
    ['ellipse', 'o', 'Ellipse', '<ellipse cx="8" cy="8" rx="5.5" ry="4"/>'],
    ['fill', 'f', 'Fill', '<path d="M3 8l5-5 5 5-5 5z M13 10c0 1.5 1 2 1 3a1 1 0 0 1-2 0c0-1 1-1.5 1-3z"/>'],
    ['eraser', 'e', 'Eraser', '<path d="M2 11l6-6 5 5-3 3H5z M5.5 7.5l5 5"/>'],
    ['picker', 'i', 'Eyedropper', '<path d="M10 2l4 4-2 2-4-4z M9 5l-6 6v2h2l6-6"/>'],
    ['hand', 'h', 'Hand (move around)', '<path d="M5 8V4a1 1 0 0 1 2 0v3V3a1 1 0 0 1 2 0v4V4a1 1 0 0 1 2 0v5c0 3-2 5-4 5S4 13 3 10l-1-2a1 1 0 0 1 2-1z"/>']
  ];
  const SVG = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">';

  let settings = { theme: 'auto', tool: 'pencil', size: 4, filled: false, c1: '#000000', c2: '#ffffff' };
  let doc = { w: 800, h: 600, name: 'Untitled.png', path: null, fmt: 'png', bg: 'white', dirty: false, granted: false };
  let zoom = 1, act = null, kc = { x: 0, y: 0, shown: false }, spaceDown = false, pan = null;

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2400); }
  const say = t => { $('say').textContent = ''; setTimeout(() => { $('say').textContent = t; }, 30); };
  const saveSettings = () => Host.saveSettings(settings);
  function dialog(id, first) {
    const ov2 = $(id), back = document.activeElement;
    ov2.hidden = false;
    const focusables = () => [...ov2.querySelectorAll('button, input, select')].filter(e => !e.disabled && e.offsetParent && !(e.type === 'radio' && !e.checked));
    const f = first ? ov2.querySelector(first) : focusables()[0]; if (f) f.focus();
    return new Promise(resolve => {
      const done = act => { ov2.hidden = true; ov2.removeEventListener('click', onClick); ov2.removeEventListener('keydown', onKey); if (back && back.focus && document.contains(back)) back.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b && ov2.contains(b)) done(b.dataset.act); else if (e.target === ov2 && id !== 'restoreDlg') done('cancel'); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done(id === 'restoreDlg' ? 'restore' : 'cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        e.stopPropagation();
      };
      ov2.addEventListener('click', onClick); ov2.addEventListener('keydown', onKey);
      ov2.done = done;
    });
  }
  async function confirmIt(title, msg, okLabel) {
    $('confTitle').textContent = title; $('confMsg').textContent = msg; $('confOk').textContent = okLabel;
    return (await dialog('confirmDlg', '[data-act=cancel]')) === 'ok';
  }

  /* ---------- the document ---------- */
  function drawStatus() {
    $('dims').textContent = doc.w + ' × ' + doc.h;
    $('docName').textContent = (doc.dirty ? '● ' : '') + doc.name;
    $('docName').title = doc.dirty ? 'Changed since it was last saved (a working copy is kept)' : '';
    Host.setTitle((doc.dirty ? '• ' : '') + doc.name + ' - Paint');
    $('undoBtn').disabled = !hist.undoList.length; $('redoBtn').disabled = !hist.redoList.length;
  }
  function changed() { doc.dirty = true; drawStatus(); scheduleWork(); }
  function setSize(w, h) { cv.width = ov.width = w; cv.height = ov.height = h; doc.w = w; doc.h = h; ctx = cv.getContext('2d', { willReadFrequently: true }); octx = ov.getContext('2d'); hist.ctx = ctx; }
  const fileFmt = name => /\.jpe?g$/i.test(name) ? 'jpg' : /\.png$/i.test(name) ? 'png' : /\.gif$/i.test(name) ? 'gif' : 'png';

  /* ---------- zoom and pan ---------- */
  function setZoom(z, cx, cy) {
    z = Math.max(0.05, Math.min(8, z));
    const r = stage.getBoundingClientRect();
    if (cx == null) { cx = r.left + stage.clientWidth / 2; cy = r.top + stage.clientHeight / 2; }
    const ix = (stage.scrollLeft + cx - r.left - wrap.offsetLeft) / zoom, iy = (stage.scrollTop + cy - r.top - wrap.offsetTop) / zoom;
    zoom = z;
    const W = Math.round(doc.w * z) + 'px', H = Math.round(doc.h * z) + 'px';
    for (const c of [cv, ov]) { c.style.width = W; c.style.height = H; }
    wrap.style.width = W; wrap.style.height = H;
    wrap.classList.toggle('pixels', z >= 2);
    stage.scrollLeft = ix * z + wrap.offsetLeft - (cx - r.left); stage.scrollTop = iy * z + wrap.offsetTop - (cy - r.top);
    const sel = $('zoomSel');
    if (![...sel.options].some(o => +o.value === z)) { for (const o of [...sel.options]) if (o.dataset.fit) o.remove(); sel.prepend(h('option', { value: z, 'data-fit': '1' }, Math.round(z * 100) + '%')); }
    sel.value = String(z);
    drawCursor();
  }
  function fit() { const z = Math.min((stage.clientWidth - 24) / doc.w, (stage.clientHeight - 24) / doc.h, 8); setZoom(Math.max(0.05, Math.floor(z * 100) / 100)); }
  function zoomStep(dir) { const i = ZOOMS.findIndex(z => z >= zoom - 1e-6); const next = dir > 0 ? ZOOMS.find(z => z > zoom + 1e-6) : [...ZOOMS].reverse().find(z => z < zoom - 1e-6); if (next) setZoom(next); else if (i < 0 && dir < 0) setZoom(ZOOMS[ZOOMS.length - 1]); }
  for (const z of ZOOMS) $('zoomSel').append(h('option', { value: z }, Math.round(z * 100) + '%'));
  $('zoomSel').onchange = () => setZoom(+$('zoomSel').value);
  $('zoomIn').onclick = () => zoomStep(1); $('zoomOut').onclick = () => zoomStep(-1); $('fitBtn').onclick = fit;
  stage.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX, e.clientY); }, { passive: false });

  /* ---------- drawing ---------- */
  const at = e => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]; };
  function eraseStyle(g) { if (doc.bg === 'transparent') { g.globalCompositeOperation = 'destination-out'; g.strokeStyle = g.fillStyle = '#000'; } else { g.globalCompositeOperation = 'source-over'; g.strokeStyle = g.fillStyle = '#ffffff'; } }
  /* a pencil or eraser segment: small sizes are stamped pixel by pixel (crisp), bigger ones are round strokes */
  function segment(x0, y0, x1, y1, w) {
    ctx.save();
    if (act.tool === 'eraser') eraseStyle(ctx); else { ctx.strokeStyle = ctx.fillStyle = act.color; }
    if (w <= 2) {
      let ax = Math.floor(x0), ay = Math.floor(y0); const bx = Math.floor(x1), by = Math.floor(y1);
      const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1; let err = dx + dy;
      for (;;) { ctx.fillRect(ax - (w > 1 ? 1 : 0), ay - (w > 1 ? 1 : 0), w, w); if (ax === bx && ay === by) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; ax += sx; } if (e2 <= dx) { err += dx; ay += sy; } }
    } else {
      ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + (x0 === x1 && y0 === y1 ? 0.01 : 0), y1); ctx.stroke();
    }
    ctx.restore();
    const b = act.box, m = w / 2 + 2;
    b[0] = Math.min(b[0], x0 - m, x1 - m); b[1] = Math.min(b[1], y0 - m, y1 - m); b[2] = Math.max(b[2], x0 + m, x1 + m); b[3] = Math.max(b[3], y0 + m, y1 + m);
  }
  function shape(g, a, x1, y1) {
    let x0 = a.x0, y0 = a.y0;
    if (a.shift) [x1, y1] = a.tool === 'line' ? P.snapLine(x0, y0, x1, y1) : P.snapSquare(x0, y0, x1, y1);
    const w = settings.size, odd = w % 2 ? 0.5 : 0;
    g.save(); g.strokeStyle = g.fillStyle = a.color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'miter';
    g.beginPath();
    if (a.tool === 'line') { g.moveTo(Math.floor(x0) + odd, Math.floor(y0) + odd); g.lineTo(Math.floor(x1) + odd, Math.floor(y1) + odd); g.stroke(); }
    else {
      const l = Math.floor(Math.min(x0, x1)), t = Math.floor(Math.min(y0, y1)), W = Math.floor(Math.abs(x1 - x0)) + 1, H = Math.floor(Math.abs(y1 - y0)) + 1;
      if (a.tool === 'rect') { if (settings.filled) g.fillRect(l, t, W, H); else g.strokeRect(l + w / 2, t + w / 2, Math.max(0, W - w), Math.max(0, H - w)); }
      else { g.ellipse(l + W / 2, t + H / 2, Math.max(0.5, W / 2 - (settings.filled ? 0 : w / 2)), Math.max(0.5, H / 2 - (settings.filled ? 0 : w / 2)), 0, 0, Math.PI * 2); settings.filled ? g.fill() : g.stroke(); }
    }
    g.restore();
    return P.clip(x0, y0, x1, y1, w + 2, doc.w, doc.h);
  }
  function begin(x, y, btn, pressure, shift) {
    const tool = settings.tool, color = btn === 2 ? settings.c2 : settings.c1;
    if (tool === 'fill') {
      const img = ctx.getImageData(0, 0, doc.w, doc.h), r = P.fill(img, x, y, P.toRgba(color), 32);
      if (r) { ctx.putImageData(img, 0, 0, r.x, r.y, r.w, r.h); if (hist.record(r)) { changed(); say('Filled'); } }
      return;
    }
    if (tool === 'picker') {
      const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= doc.w || yi >= doc.h) return;
      const d = ctx.getImageData(xi, yi, 1, 1).data, hex = d[3] === 0 ? (doc.bg === 'transparent' ? '#ffffff' : '#ffffff') : P.toHex(d[0], d[1], d[2]);
      setColor(btn === 2 ? 'c2' : 'c1', hex); toast('Picked ' + hex.toUpperCase()); say('Picked ' + hex);
      setTool(settings.prevTool && settings.prevTool !== 'picker' ? settings.prevTool : 'pencil');
      return;
    }
    act = { tool, color, x0: x, y0: y, lx: x, ly: y, box: [x, y, x, y], shift, pressure };
    if (tool === 'pencil' || tool === 'eraser') segment(x, y, x, y, width(pressure));
    else preview(x, y);
  }
  const width = p => p && p !== 0.5 ? Math.max(1, Math.round(settings.size * (0.25 + 0.75 * p))) : settings.size;
  function preview(x, y) { octx.clearRect(0, 0, ov.width, ov.height); act.last = [x, y]; shape(octx, act, x, y); }
  function move(x, y, pressure, shift) {
    if (!act) return;
    act.shift = shift;
    if (act.tool === 'pencil' || act.tool === 'eraser') { segment(act.lx, act.ly, x, y, width(pressure)); act.lx = x; act.ly = y; }
    else preview(x, y);
  }
  function end(x, y) {
    if (!act) return;
    const a = act; act = null;
    let r;
    if (a.tool === 'pencil' || a.tool === 'eraser') r = P.clip(a.box[0], a.box[1], a.box[2], a.box[3], 1, doc.w, doc.h);
    else { octx.clearRect(0, 0, ov.width, ov.height); r = shape(ctx, a, x, y); }
    if (hist.record(r)) changed();
    drawCursor();
  }
  function cancel() {
    if (!act) return;
    const a = act; act = null;
    if (a.tool === 'pencil' || a.tool === 'eraser') hist.revert(P.clip(a.box[0], a.box[1], a.box[2], a.box[3], 1, doc.w, doc.h));
    octx.clearRect(0, 0, ov.width, ov.height); drawCursor();
    say('Cancelled');
  }

  /* pointer: left and right buttons draw (right uses the second colour); middle, Space+drag and the Hand move around */
  ov.addEventListener('contextmenu', e => e.preventDefault());
  ov.addEventListener('pointerdown', e => {
    ov.focus({ preventScroll: true }); kc.shown = false; drawCursor();
    if (e.button === 1 || spaceDown || settings.tool === 'hand') { pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, id: e.pointerId }; ov.setPointerCapture(e.pointerId); ov.classList.add('panning'); e.preventDefault(); return; }
    if (e.button !== 0 && e.button !== 2) return;
    if (act) { cancel(); return; }
    ov.setPointerCapture(e.pointerId);
    const [x, y] = at(e);
    begin(x, y, e.button, e.pointerType === 'pen' ? e.pressure : 0, e.shiftKey);
    if (act) act.pid = e.pointerId;
    e.preventDefault();
  });
  ov.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    $('pos').textContent = x >= 0 && y >= 0 && x < doc.w && y < doc.h ? Math.floor(x) + ', ' + Math.floor(y) : '';
    if (pan && e.pointerId === pan.id) { stage.scrollLeft = pan.sl - (e.clientX - pan.x); stage.scrollTop = pan.st - (e.clientY - pan.y); return; }
    if (!act || e.pointerId !== act.pid) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const c of (evs.length ? evs : [e])) { const [cx, cy] = at(c); move(cx, cy, c.pointerType === 'pen' ? c.pressure : 0, e.shiftKey); }
  });
  const up = e => {
    if (pan && e.pointerId === pan.id) { pan = null; ov.classList.remove('panning'); return; }
    if (act && e.pointerId === act.pid) { const [x, y] = at(e); act.shift = e.shiftKey; end(x, y); }
  };
  ov.addEventListener('pointerup', up);
  ov.addEventListener('pointercancel', e => { if (pan && e.pointerId === pan.id) { pan = null; ov.classList.remove('panning'); } else if (act && e.pointerId === act.pid) cancel(); });
  ov.addEventListener('pointerleave', () => { $('pos').textContent = ''; });

  /* the keyboard: arrows move a cursor, Enter puts the pen down and lifts it */
  const kcur = h('div', { class: 'kcursor', 'aria-hidden': 'true' }); wrap.append(kcur);
  function drawCursor() {
    kcur.hidden = !kc.shown;
    if (!kc.shown) return;
    kcur.style.left = (kc.x + 0.5) * zoom + 'px'; kcur.style.top = (kc.y + 0.5) * zoom + 'px';
    $('pos').textContent = kc.x + ', ' + kc.y;
  }
  ov.addEventListener('keydown', e => {
    const k = e.key, d = e.shiftKey ? 10 : 1;
    const dir = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[k];
    if (dir && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (!kc.shown) { kc.shown = true; if (!kc.placed) { kc.x = Math.floor(doc.w / 2); kc.y = Math.floor(doc.h / 2); kc.placed = true; } }
      kc.x = Math.max(0, Math.min(doc.w - 1, kc.x + dir[0])); kc.y = Math.max(0, Math.min(doc.h - 1, kc.y + dir[1]));
      move(kc.x, kc.y, 0, false); drawCursor();
      const r = stage.getBoundingClientRect(), px = wrap.offsetLeft + (kc.x + 0.5) * zoom, py = wrap.offsetTop + (kc.y + 0.5) * zoom;
      if (px < stage.scrollLeft + 20 || px > stage.scrollLeft + r.width - 20) stage.scrollLeft = px - r.width / 2;
      if (py < stage.scrollTop + 20 || py > stage.scrollTop + r.height - 20) stage.scrollTop = py - r.height / 2;
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (!kc.shown) { kc.shown = true; if (!kc.placed) { kc.x = Math.floor(doc.w / 2); kc.y = Math.floor(doc.h / 2); kc.placed = true; } drawCursor(); return; }
      if (act) { end(kc.x, kc.y); say((settings.tool === 'pencil' || settings.tool === 'eraser' ? 'Pen up' : 'Done') + ' at ' + kc.x + ', ' + kc.y); }
      else { begin(kc.x, kc.y, e.shiftKey ? 2 : 0, 0, false); if (act) say('Pen down at ' + kc.x + ', ' + kc.y + '. Move with the arrows, Enter to finish.'); }
      return;
    }
    if (k === 'Escape' && act) { e.preventDefault(); e.stopPropagation(); cancel(); }
  });
  ov.addEventListener('blur', () => { if (act && act.pid == null) end(kc.x, kc.y); kc.shown = false; drawCursor(); });

  /* ---------- tools, size, colours ---------- */
  function setTool(t) {
    if (!TOOLS.some(x => x[0] === t)) t = 'pencil';
    if (act) cancel();
    if (t === 'picker' && settings.tool !== 'picker') settings.prevTool = settings.tool;
    settings.tool = t; saveSettings();
    for (const b of $('tools').children) { const on = b.dataset.t === t; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    ov.dataset.tool = t;
    $('filled').closest('label').classList.toggle('dim', !(t === 'rect' || t === 'ellipse'));
  }
  for (const [id, key, label, path] of TOOLS) {
    const b = h('button', { class: 'tool', role: 'radio', 'data-t': id, 'aria-label': label, title: label + ' (' + key.toUpperCase() + ')' });
    b.innerHTML = SVG + path + '</svg>';
    b.onclick = () => setTool(id);
    $('tools').append(b);
  }
  $('tools').addEventListener('keydown', e => {
    const all = [...$('tools').children], i = all.findIndex(b => b.dataset.t === settings.tool);
    const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); const n = all[(to + all.length) % all.length]; setTool(n.dataset.t); n.focus();
  });
  function setSizeVal(v) { settings.size = Math.max(1, Math.min(64, v | 0)); $('size').value = settings.size; $('sizeOut').textContent = settings.size; saveSettings(); }
  $('size').oninput = () => setSizeVal(+$('size').value);
  $('filled').onchange = () => { settings.filled = $('filled').checked; saveSettings(); };
  function setColor(slot, hex) { settings[slot] = hex; $(slot).style.background = hex; $(slot).setAttribute('aria-label', (slot === 'c1' ? 'Main colour ' : 'Second colour ') + hex.toUpperCase()); saveSettings(); }
  let pickSlot = 'c1';
  for (const slot of ['c1', 'c2']) $(slot).onclick = () => { pickSlot = slot; $('picker').value = settings[slot]; $('picker').click(); };
  $('picker').oninput = () => setColor(pickSlot, $('picker').value);
  $('swapBtn').onclick = swapColors;
  function swapColors() { const a = settings.c1; setColor('c1', settings.c2); setColor('c2', a); say('Colours swapped'); }
  P.PALETTE.forEach((hex, i) => {
    const b = h('button', { class: 'sw', style: 'background:' + hex, title: P.PALETTE_NAMES[i] + ' (right-click for the second colour)', 'aria-label': P.PALETTE_NAMES[i], tabindex: i ? '-1' : '0' });
    b.onclick = e => { setColor(e.shiftKey ? 'c2' : 'c1', hex); say(P.PALETTE_NAMES[i] + (e.shiftKey ? ' as the second colour' : ' as the main colour')); };
    b.oncontextmenu = e => { e.preventDefault(); setColor('c2', hex); say(P.PALETTE_NAMES[i] + ' as the second colour'); };
    $('palette').append(b);
  });
  $('palette').addEventListener('keydown', e => {
    const all = [...$('palette').children], i = all.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + 8, ArrowUp: i - 8, Home: 0, End: all.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); all[i].tabIndex = -1; const n = all[(to + all.length) % all.length]; n.tabIndex = 0; n.focus();
  });

  /* ---------- undo, redo, clear ---------- */
  function undo() { if (act) cancel(); const s = hist.undo(); if (!s) return; if (s.full) syncSize(); changed(); say('Undone'); }
  function redo() { const s = hist.redo(); if (!s) return; if (s.full) syncSize(); changed(); say('Redone'); }
  function syncSize() { if (ov.width !== cv.width || ov.height !== cv.height) { ov.width = cv.width; ov.height = cv.height; doc.w = cv.width; doc.h = cv.height; setZoom(zoom); } }
  $('undoBtn').onclick = undo; $('redoBtn').onclick = redo;
  async function clearAll() {
    if (!await confirmIt('Clear the picture', 'Clear the whole picture to ' + (doc.bg === 'transparent' ? 'transparent' : 'white') + '? You can bring it back with Undo.', 'Clear')) return;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    if (doc.bg === 'transparent') ctx.clearRect(0, 0, doc.w, doc.h); else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, doc.w, doc.h); }
    ctx.restore(); hist.recordAll(); changed(); toast('Cleared. Ctrl+Z brings it back.');
  }
  $('clearBtn').onclick = clearAll;

  /* ---------- the working copy: unsaved work kept in the data folder ---------- */
  let workT = 0;
  function scheduleWork() { clearTimeout(workT); workT = setTimeout(writeWork, 1500); }
  async function writeWork() {
    clearTimeout(workT); workT = 0;
    if (!doc.dirty) return;
    const url = cv.toDataURL('image/png'), meta = JSON.stringify({ v: 1, name: doc.name, fmt: doc.fmt, bg: doc.bg, w: doc.w, h: doc.h, time: Date.now() }, null, 1);
    try {
      if (Host.inPortD) await PortD.fs.write('work.png', url, 'dataurl'); else if (!await Host.saveData('work.png', url)) return;
      await Host.saveData('work.json', meta);
    } catch (e) { toast('Could not keep a working copy: ' + e.message, 5000); }
  }
  async function dropWork() { clearTimeout(workT); workT = 0; await Host.removeData('work.json'); await Host.removeData('work.png'); }
  addEventListener('visibilitychange', () => { if (document.hidden && doc.dirty) writeWork(); });
  addEventListener('pagehide', () => { if (doc.dirty) writeWork(); });

  /* ---------- new, open, save ---------- */
  async function loadUrl(name, url, path) {
    const img = new Image();
    try { img.src = url; await img.decode(); }
    catch (e) { toast('"' + name + '" could not be opened: it is not a picture this browser can read.', 6000); return false; }
    if (img.naturalWidth > P.MAX_SIDE || img.naturalHeight > P.MAX_SIDE) { toast('"' + name + '" is ' + img.naturalWidth + ' × ' + img.naturalHeight + '; Paint can open pictures up to ' + P.MAX_SIDE + ' on each side.', 6000); return false; }
    if (act) cancel();
    setSize(img.naturalWidth, img.naturalHeight);
    ctx.clearRect(0, 0, doc.w, doc.h); ctx.drawImage(img, 0, 0);
    const fmt = fileFmt(name);
    let clear = false;
    if (fmt !== 'jpg') { const d = ctx.getImageData(0, 0, doc.w, doc.h).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { clear = true; break; } }
    doc = { w: doc.w, h: doc.h, name: fmt === 'gif' ? name.replace(/\.gif$/i, '.png') : name, path: fmt === 'gif' ? null : path, fmt: fmt === 'gif' ? 'png' : fmt, bg: clear ? 'transparent' : 'white', dirty: false, granted: !!path && fmt !== 'gif' };
    hist.reset(); kc.placed = false; octx.clearRect(0, 0, ov.width, ov.height);
    fit(); drawStatus();
    return true;
  }
  async function guard(what) {
    if (!doc.dirty) return true;
    return confirmIt(what, 'Your changes to "' + doc.name + '" have not been saved, and will be lost. Save first if you want to keep them.', what === 'Open a picture' ? 'Open without saving' : 'Continue without saving');
  }
  async function openPath(o) {
    if (!await guard('Open a picture')) return;
    try {
      const d = await PortD.fs.read(o.path);
      if (typeof d !== 'string' || !/^data:image\//.test(d)) { toast('"' + o.name + '" is not stored as a picture, so it cannot be opened.', 6000); return; }
      if (await loadUrl(o.name, d, o.path)) { await dropWork(); toast('Opened ' + o.name + (/\.gif$/i.test(o.name) ? ' (the first frame; it will be saved as PNG)' : '')); }
    } catch (e) { toast('Could not open "' + o.name + '": ' + e.message, 6000); }
  }
  async function openFile() {
    if (Host.inPortD) {
      if (!await guard('Open a picture')) return;
      const was = doc.dirty; doc.dirty = false;
      let r = null; try { r = await PortD.ui.openFile({ title: 'Open a picture', types: ['.png', '.jpg', '.jpeg', '.gif'] }); } finally { doc.dirty = was; }
      if (r) { doc.dirty = false; await openPath(r); }
      return;
    }
    if (!await guard('Open a picture')) return;
    const i = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif' });
    i.onchange = () => { const f = i.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = async () => { if (await loadUrl(f.name, rd.result, null)) { await dropWork(); toast('Opened ' + f.name); } }; rd.readAsDataURL(f); };
    i.click();
  }
  function flat() {
    const c = document.createElement('canvas'); c.width = doc.w; c.height = doc.h;
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, doc.w, doc.h); g.drawImage(cv, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  }
  async function writeTo(path, name, fmt) {
    if (act) end(act.lx, act.ly);
    const url = fmt === 'jpg' ? flat() : cv.toDataURL('image/png');
    await PortD.fs.write(path, url, 'dataurl');
    doc.path = path; doc.name = name; doc.fmt = fmt; doc.granted = true; doc.dirty = false;
    await dropWork(); drawStatus();
    toast('Saved ' + name);
  }
  async function save() {
    if (Host.inPortD && doc.path && doc.granted) { try { await writeTo(doc.path, doc.name, doc.fmt); } catch (e) { toast('Could not save: ' + e.message, 6000); } return; }
    return saveAs();
  }
  async function saveAs() {
    const fmt = await dialog('fmtDlg', '[data-act=' + doc.fmt + ']');
    if (fmt !== 'png' && fmt !== 'jpg') return;
    const stem = doc.name.replace(/\.[^.]+$/, '') || 'Untitled', name = stem + '.' + fmt;
    try {
      if (!Host.inPortD) {
        const url = fmt === 'jpg' ? flat() : cv.toDataURL('image/png'), a = h('a', { href: url, download: name });
        document.body.append(a); a.click(); a.remove(); doc.name = name; doc.fmt = fmt; doc.dirty = false; await dropWork(); drawStatus(); toast('Downloaded ' + name); return;
      }
      const r = await PortD.ui.saveFile({ title: 'Save picture', name, types: fmt === 'png' ? ['.png'] : ['.jpg', '.jpeg'] });
      if (r) await writeTo(r.path, r.name, fmt);
    } catch (e) { toast('Could not save: ' + e.message, 6000); }
  }
  $('openBtn').onclick = openFile; $('saveBtn').onclick = save; $('saveAsBtn').onclick = saveAs;

  /* New picture */
  $('newPreset').onchange = () => { const v = $('newPreset').value; if (v !== 'custom') { const [w, hh] = v.split('x'); $('newW').value = w; $('newH').value = hh; } else $('newW').focus(); };
  for (const id of ['newW', 'newH']) $(id).oninput = () => { $('newPreset').value = [...$('newPreset').options].some(o => o.value === $('newW').value + 'x' + $('newH').value) ? $('newW').value + 'x' + $('newH').value : 'custom'; };
  async function newPicture() {
    $('newWarn').hidden = !doc.dirty;
    $('newWarn').textContent = doc.dirty ? 'Your changes to "' + doc.name + '" have not been saved, and will be lost.' : '';
    $('newOk').textContent = doc.dirty ? 'Make it without saving' : 'Make it';
    if (await dialog('newDlg', '#newPreset') !== 'ok') return;
    const w = Math.round(+$('newW').value), hh = Math.round(+$('newH').value);
    if (!(w >= 1 && w <= P.MAX_SIDE && hh >= 1 && hh <= P.MAX_SIDE)) { toast('The width and height must be 1 to ' + P.MAX_SIDE + '.', 4000); return; }
    const bg = document.querySelector('input[name=bg]:checked').value;
    if (act) cancel();
    setSize(w, hh);
    if (bg === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, hh); }
    doc = { w, h: hh, name: 'Untitled.png', path: null, fmt: 'png', bg, dirty: false, granted: false };
    hist.reset(); kc.placed = false; await dropWork(); fit(); drawStatus();
    toast('New ' + w + ' × ' + hh + ' picture');
  }
  $('newBtn').onclick = newPicture;
  $('helpBtn').onclick = () => dialog('helpDlg');

  /* ---------- keys ---------- */
  addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; ov.classList.remove('grab'); } });
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])')) return;
    const t = e.target, typing = t.matches && t.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea');
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    let go = null;
    if (ctrl && !e.altKey) go = { z: e.shiftKey ? redo : undo, y: redo, o: e.shiftKey ? null : openFile, s: e.shiftKey ? saveAs : save }[k];
    else if (e.altKey && !ctrl && k === 'n') go = newPicture;
    else if (e.key === 'F1') go = () => $('helpBtn').click();
    else if (!typing && !e.altKey) {
      const tool = TOOLS.find(x => x[1] === k);
      if (tool) go = () => { setTool(tool[0]); say(tool[2]); };
      else go = { '[': () => setSizeVal(settings.size - (settings.size > 10 ? 2 : 1)), ']': () => setSizeVal(settings.size + (settings.size >= 10 ? 2 : 1)), x: swapColors, '+': () => zoomStep(1), '=': () => zoomStep(1), '-': () => zoomStep(-1), '0': fit, '1': () => setZoom(1) }[e.key === 'X' ? 'x' : e.key];
      if (e.key === ' ' && t !== ov && !(t.matches && t.matches('button'))) { e.preventDefault(); spaceDown = true; ov.classList.add('grab'); return; }
    }
    if (go) { e.preventDefault(); go(); }
  });

  /* ---------- theme ---------- */
  const TSVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [TSVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [TSVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [TSVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); saveSettings(); toast(THEMES[settings.theme][1]); };

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    if (!/^#[0-9a-f]{6}$/i.test(settings.c1)) settings.c1 = '#000000';
    if (!/^#[0-9a-f]{6}$/i.test(settings.c2)) settings.c2 = '#ffffff';
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    setTool(settings.tool); setSizeVal(settings.size); $('filled').checked = !!settings.filled; setColor('c1', settings.c1); setColor('c2', settings.c2);
    setSize(800, 600); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 800, 600); hist.reset();
    fit(); drawStatus();
    window.__pt = { get doc() { return doc; }, get settings() { return settings; }, get zoom() { return zoom; }, hist, get kc() { return kc; }, writeWork, pixel: (x, y) => [...ctx.getImageData(x, y, 1, 1).data], ready: false };
    /* unsaved work from last time? */
    let meta = null, url = null;
    try { meta = JSON.parse(await Host.loadData('work.json') || 'null'); } catch (e) { meta = null; }
    if (meta) { try { url = Host.inPortD ? await PortD.fs.read('work.png') : await Host.loadData('work.png'); } catch (e) { url = null; } }
    if (meta && typeof url === 'string' && /^data:image\/png/.test(url)) {
      $('resMsg').textContent = 'Paint kept a copy of a picture that was not saved: "' + (meta.name || 'Untitled.png') + '", ' + meta.w + ' × ' + meta.h + ', from ' + new Date(meta.time || Date.now()).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) + '.';
      $('resImg').src = url;
      let armed = 0;
      $('resDiscard').textContent = 'Throw it away';
      $('resDiscard').onclick = () => { if (!armed) { $('resDiscard').textContent = 'Click again to throw it away'; armed = setTimeout(() => { armed = 0; $('resDiscard').textContent = 'Throw it away'; }, 3000); return; } clearTimeout(armed); $('restoreDlg').done('discard'); };
      const choice = await dialog('restoreDlg', '[data-act=restore]');
      if (choice === 'restore' && await loadUrl(String(meta.name || 'Untitled.png'), url, null)) {
        doc.fmt = meta.fmt === 'jpg' ? 'jpg' : 'png'; doc.bg = meta.bg === 'transparent' ? 'transparent' : doc.bg; doc.dirty = true; drawStatus();
        toast('Restored. Save it to keep it.', 3500);
      } else if (choice === 'discard') { await dropWork(); toast('The unsaved picture was thrown away.'); }
    } else if (meta) await dropWork();
    Host.onOpenFile(openPath);
    const start = Host.startFile();
    if (start) await openPath(start);
    ov.focus({ preventScroll: true });
    window.__pt.ready = true;
  })();
})();
