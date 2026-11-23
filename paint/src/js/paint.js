/* Paint: the drawing engine. Flood fill, the undo history (only the changed area of each step is kept), colours
   and shape helpers. No buttons here; app.js draws the window. Everything hangs off window.Paint. */
(function () {
  'use strict';
  const P = window.Paint = {};
  P.MAX_SIDE = 8192;
  P.PALETTE = ['#000000', '#7f7f7f', '#c3c3c3', '#ffffff', '#880015', '#ed1c24', '#ff7f27', '#fff200',
    '#22b14c', '#b5e61d', '#00a2e8', '#99d9ea', '#3f48cc', '#7092be', '#a349a4', '#ffaec9'];
  P.PALETTE_NAMES = ['Black', 'Grey', 'Light grey', 'White', 'Dark red', 'Red', 'Orange', 'Yellow', 'Green', 'Lime', 'Blue', 'Light blue', 'Indigo', 'Steel blue', 'Purple', 'Pink'];

  P.toRgba = function (hex, a) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a == null ? 255 : a]; };
  P.toHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

  /* a rectangle grown by m and clipped to the picture; null if empty */
  P.clip = function (x0, y0, x1, y1, m, w, h) {
    const x = Math.max(0, Math.floor(Math.min(x0, x1) - m)), y = Math.max(0, Math.floor(Math.min(y0, y1) - m));
    const X = Math.min(w, Math.ceil(Math.max(x0, x1) + m)), Y = Math.min(h, Math.ceil(Math.max(y0, y1) + m));
    return X > x && Y > y ? { x, y, w: X - x, h: Y - y } : null;
  };
  /* Shift: lines snap to 45°, boxes become squares */
  P.snapLine = function (x0, y0, x, y) {
    const dx = x - x0, dy = y - y0, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
    return [Math.round(x0 + Math.cos(a) * len), Math.round(y0 + Math.sin(a) * len)];
  };
  P.snapSquare = function (x0, y0, x, y) { const s = Math.max(Math.abs(x - x0), Math.abs(y - y0)); return [x0 + Math.sign(x - x0 || 1) * s, y0 + Math.sign(y - y0 || 1) * s]; };

  /* fills the area of similar colour around (x, y). tolerance: 0 to 255. Returns the changed rectangle or null */
  P.fill = function (img, x, y, rgba, tolerance) {
    const { width: w, height: h, data: d } = img;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    const i0 = (y * w + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]], tol = tolerance || 0;
    if (Math.abs(t[0] - rgba[0]) + Math.abs(t[1] - rgba[1]) + Math.abs(t[2] - rgba[2]) + Math.abs(t[3] - rgba[3]) === 0) return null;
    const near = i => Math.abs(d[i] - t[0]) <= tol && Math.abs(d[i + 1] - t[1]) <= tol && Math.abs(d[i + 2] - t[2]) <= tol && Math.abs(d[i + 3] - t[3]) <= tol;
    const seen = new Uint8Array(w * h), stack = [x, y];
    let minX = x, maxX = x, minY = y, maxY = y;
    while (stack.length) {
      const sy = stack.pop(); let sx = stack.pop();
      let p = sy * w + sx;
      while (sx >= 0 && !seen[p] && near(p * 4)) { sx--; p--; }
      sx++; p++;
      let up = false, down = false;
      while (sx < w && !seen[p] && near(p * 4)) {
        seen[p] = 1; const i = p * 4; d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = rgba[3];
        if (sx < minX) minX = sx; if (sx > maxX) maxX = sx; if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
        if (sy > 0) { const q = p - w; if (!seen[q] && near(q * 4)) { if (!up) { stack.push(sx, sy - 1); up = true; } } else up = false; }
        if (sy < h - 1) { const q = p + w; if (!seen[q] && near(q * 4)) { if (!down) { stack.push(sx, sy + 1); down = true; } } else down = false; }
        sx++; p++;
      }
    }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  };

  /* ---------- undo history ----------
     The history keeps a copy of the whole picture as it is now ("base"). Each step stores only the rectangle that
     changed, as it was before and after. Steps that change the size (or everything) store the whole picture. */
  P.History = function (ctx, max) {
    this.ctx = ctx; this.max = max || 50; this.maxBytes = 400 * 1048576;
    this.undoList = []; this.redoList = []; this.reset();
  };
  P.History.prototype.reset = function () {
    const c = this.ctx.canvas;
    this.base = this.ctx.getImageData(0, 0, c.width, c.height);
    this.undoList = []; this.redoList = [];
  };
  function crop(img, r) {
    const out = new ImageData(r.w, r.h), w = img.width;
    for (let row = 0; row < r.h; row++) out.data.set(img.data.subarray(((r.y + row) * w + r.x) * 4, ((r.y + row) * w + r.x + r.w) * 4), row * r.w * 4);
    return out;
  }
  function paste(img, part, x, y) {
    const w = img.width;
    for (let row = 0; row < part.height; row++) img.data.set(part.data.subarray(row * part.width * 4, (row + 1) * part.width * 4), ((y + row) * w + x) * 4);
  }
  const bytes = s => s.full ? s.before.data.length + s.after.data.length : s.before.data.length * 2;
  P.History.prototype.push = function (step) {
    this.undoList.push(step); this.redoList = [];
    let total = this.undoList.reduce((n, s) => n + bytes(s), 0);
    while (this.undoList.length > this.max || (total > this.maxBytes && this.undoList.length > 1)) total -= bytes(this.undoList.shift());
  };
  /* after drawing inside rectangle r: remember what was there before */
  P.History.prototype.record = function (r) {
    if (!r) return false;
    const after = this.ctx.getImageData(r.x, r.y, r.w, r.h), before = crop(this.base, r);
    const a = after.data, b = before.data; let same = true;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
    if (same) return false;
    this.push({ r, before, after });
    paste(this.base, after, r.x, r.y);
    return true;
  };
  /* after changing everything (clear, resize): the whole picture before and after */
  P.History.prototype.recordAll = function () {
    const c = this.ctx.canvas, after = this.ctx.getImageData(0, 0, c.width, c.height);
    this.push({ full: true, before: this.base, after });
    this.base = new ImageData(new Uint8ClampedArray(after.data), after.width, after.height);
  };
  P.History.prototype.apply = function (s, img) {
    const c = this.ctx.canvas;
    if (s.full) {
      if (c.width !== img.width || c.height !== img.height) { c.width = img.width; c.height = img.height; }
      this.ctx.putImageData(img, 0, 0);
      this.base = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
    } else { this.ctx.putImageData(img, s.r.x, s.r.y); paste(this.base, img, s.r.x, s.r.y); }
  };
  P.History.prototype.undo = function () { const s = this.undoList.pop(); if (!s) return null; this.apply(s, s.before); this.redoList.push(s); return s; };
  P.History.prototype.redo = function () { const s = this.redoList.pop(); if (!s) return null; this.apply(s, s.after); this.undoList.push(s); return s; };
  /* puts back the picture as it was after the last step (for cancelling a stroke in progress) */
  P.History.prototype.revert = function (r) { if (r) this.ctx.putImageData(crop(this.base, r), r.x, r.y); };
})();
