/* Compare: finding differences. Myers' algorithm on lines (and on words inside changed lines), and writing a
   unified diff. No DOM code here. */
(function () {
  'use strict';
  const D = window.Diff = {};
  const MAX_EDITS = 3000;           /* past this many line edits in one place, the rest is shown as one block */

  /* the shortest edit script between two int arrays; [[op, ai, bi], …] with op 0 same, 1 removed, 2 added; null past max */
  D.myers = function (A, B, max) {
    const n = A.length, m = B.length, off = max + 1, V = new Int32Array(2 * max + 3), trace = [];
    for (let d = 0; d <= max; d++) {
      const lo = Math.max(0, off - d - 1);
      trace.push({ lo, v: V.slice(lo, off + d + 2) });
      for (let k = -d; k <= d; k += 2) {
        let x = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? V[off + k + 1] : V[off + k - 1] + 1, y = x - k;
        while (x < n && y < m && A[x] === B[y]) { x++; y++; }
        V[off + k] = x;
        if (x >= n && y >= m) return back(trace, n, m, off);
      }
    }
    return null;
  };
  function back(trace, n, m, off) {
    const ops = [];
    let x = n, y = m;
    for (let d = trace.length - 1; d >= 0; d--) {
      const t = trace[d], v = k => t.v[off + k - t.lo], k = x - y;
      const pk = k === -d || (k !== d && v(k - 1) < v(k + 1)) ? k + 1 : k - 1, px = v(pk), py = px - pk;
      while (x > px && y > py) { x--; y--; ops.push([0, x, y]); }
      if (d > 0) { if (x === px) { y--; ops.push([2, x, y]); } else { x--; ops.push([1, x, y]); } }
      x = px; y = py;
    }
    return ops.reverse();
  }

  /* splits text into lines; eol says whether the text ends with a line break, crlf whether it uses Windows endings */
  D.lines = function (text) {
    const crlf = /\r\n/.test(text), t = text.replace(/\r\n?/g, '\n'), eol = t.endsWith('\n');
    const lines = t === '' ? [] : (eol ? t.slice(0, -1) : t).split('\n');
    return { lines, eol, crlf };
  };

  /* line differences between two texts. o: { space: 'all' | 'change' | 'none' (which white space to ignore), caseless } */
  D.compare = function (aText, bText, o) {
    o = o || {};
    const A = D.lines(aText), B = D.lines(bText), ids = new Map();
    const key = s => {
      if (o.space === 'all') s = s.replace(/\s+/g, '');
      else if (o.space === 'change') s = s.replace(/\s+/g, ' ').trim();
      if (o.caseless) s = s.toLowerCase();
      let id = ids.get(s); if (id === undefined) ids.set(s, id = ids.size); return id;
    };
    const ka = A.lines.map(key), kb = B.lines.map(key);
    /* a last line without a line break differs from one with it */
    if (A.eol !== B.eol && ka.length && kb.length) { if (!A.eol) ka[ka.length - 1] = -1; if (!B.eol) kb[kb.length - 1] = -2; }
    /* the common start and end are taken off first */
    let s = 0; while (s < ka.length && s < kb.length && ka[s] === kb[s]) s++;
    let e = 0; while (e < ka.length - s && e < kb.length - s && ka[ka.length - 1 - e] === kb[kb.length - 1 - e]) e++;
    const ma = ka.slice(s, ka.length - e), mb = kb.slice(s, kb.length - e);
    let mid = D.myers(ma, mb, Math.min(MAX_EDITS, ma.length + mb.length)), rough = false;
    if (!mid) { rough = true; mid = []; for (let i = 0; i < ma.length; i++) mid.push([1, i, 0]); for (let j = 0; j < mb.length; j++) mid.push([2, ma.length, j]); }
    const ops = [];
    for (let i = 0; i < s; i++) ops.push([0, i, i]);
    for (const [op, x, y] of mid) ops.push([op, x + s, y + s]);
    for (let i = 0; i < e; i++) ops.push([0, ka.length - e + i, kb.length - e + i]);
    return { a: A, b: B, ops, rough };
  };

  /* the result as blocks: { same: true, a, b, n } or { same: false, del: [a lines], ins: [b lines] } */
  D.blocks = function (r) {
    const out = [];
    let cur = null;
    for (const op of r.ops) {
      if (op[0] === 0) { if (cur && cur.same) cur.n++; else out.push(cur = { same: true, a: op[1], b: op[2], n: 1 }); }
      else {
        if (!cur || cur.same) out.push(cur = { same: false, del: [], ins: [] });
        (op[0] === 1 ? cur.del : cur.ins).push(op[0] === 1 ? op[1] : op[2]);
      }
    }
    return out;
  };

  /* word differences inside a changed line: [{ t: text, c: changed }] for each side, or null when they share too little */
  const TOK = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
  D.words = function (a, b, o) {
    if (a.length + b.length > 4000) return null;
    const ta = a.match(TOK) || [], tb = b.match(TOK) || [], ids = new Map();
    const k = t => { if (o && o.caseless) t = t.toLowerCase(); if (o && o.space !== 'none' && /^\s+$/.test(t)) t = ' '; let id = ids.get(t); if (id === undefined) ids.set(t, id = ids.size); return id; };
    const ops = D.myers(ta.map(k), tb.map(k), 400);
    if (!ops) return null;
    const ra = [], rb = [];
    let same = 0;
    const add = (r, t, c) => { const last = r[r.length - 1]; if (last && last.c === c) last.t += t; else r.push({ t, c }); };
    for (const [op, x, y] of ops) {
      if (op === 0) { add(ra, ta[x], false); add(rb, tb[y], false); if (/\S/.test(ta[x])) same += ta[x].length; }
      else if (op === 1) add(ra, ta[x], true);
      else add(rb, tb[y], true);
    }
    if (same < 0.3 * Math.max(a.replace(/\s/g, '').length, b.replace(/\s/g, '').length)) return null;      /* mostly different: mark the whole line */
    return { a: ra, b: rb };
  };

  /* a unified diff, with ctx lines of context */
  D.unified = function (r, aName, bName, ctx) {
    ctx = ctx === undefined ? 3 : ctx;
    const A = r.a, B = r.b, ops = r.ops, out = ['--- ' + aName, '+++ ' + bName];
    const changes = [];
    ops.forEach((op, i) => { if (op[0] !== 0) changes.push(i); });
    if (!changes.length) return '';
    let i = 0;
    while (i < changes.length) {
      let from = Math.max(0, changes[i] - ctx), to = Math.min(ops.length - 1, changes[i] + ctx), j = i;
      while (j + 1 < changes.length && changes[j + 1] - ctx <= to + 1) { j++; to = Math.min(ops.length - 1, changes[j] + ctx); }
      const body = [];
      let aStart = null, bStart = null, aLen = 0, bLen = 0;
      for (let k = from; k <= to; k++) {
        const [op, x, y] = ops[k];
        if (aStart === null) { aStart = x; bStart = y; }
        if (op === 0) { body.push(' ' + A.lines[x]); aLen++; bLen++; if (x === A.lines.length - 1 && !A.eol) body.push('\\ No newline at end of file'); }
        else if (op === 1) { body.push('-' + A.lines[x]); aLen++; if (x === A.lines.length - 1 && !A.eol) body.push('\\ No newline at end of file'); }
        else { body.push('+' + B.lines[y]); bLen++; if (y === B.lines.length - 1 && !B.eol) body.push('\\ No newline at end of file'); }
      }
      const range = (start, len) => (len === 0 ? start : start + 1) + (len === 1 ? '' : ',' + len);
      out.push('@@ -' + range(aStart, aLen) + ' +' + range(bStart, bLen) + ' @@', ...body);
      i = j + 1;
    }
    return out.join('\n') + '\n';
  };
})();
