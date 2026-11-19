/* Table Viewer: the window. Reads a delimited file, shows it as a table drawn only where it can be seen, and lets the
   user sort, filter, select, copy and save it. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const grid = $('grid'), head = $('head'), body = $('body');
  const fmt = n => n.toLocaleString('en-GB');
  const plural = (n, w) => fmt(n) + ' ' + w + (n === 1 ? '' : 's');
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  let settings = { theme: 'auto' };
  let doc = null;           // the open file, see build()
  let view = [];            // indices into doc.data, in the order shown
  let sort = null;          // { col, dir: 1 | -1 }
  let filter = { q: '', col: -1, bad: false };
  let sel = new Set(), anchor = 0, cur = { r: 0, c: 0 };
  let RH = 28, NW = 50, colX = [0], totalW = 0;

  /* ---------- small helpers ---------- */
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2200); }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const extOf = name => { const m = /\.([^.\\/]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
  const stem = name => (name || 'table').replace(/\.[^.]+$/, '');
  const delimName = ch => (CSV.DELIMS.find(d => d.ch === ch) || { name: 'Custom' }).name;

  /* a dialog: resolves the data-act of the button pressed, 'cancel' on Esc; keeps Tab inside; gives focus back */
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, input, textarea, select')].filter(e => !e.disabled && e.offsetParent);
    (first ? ov.querySelector(first) : focusables()[0]).focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); if (back && back.focus) back.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b) done(b.dataset.act); else if (e.target === ov) done('cancel'); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done('cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const ok = ov.querySelector('[data-act=ok]'); if (ok) done('ok'); }
        e.stopPropagation();
      };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
    });
  }

  /* ---------- reading a file into a table ---------- */
  function build(file, delimChoice, header) {
    const text = file.text, ext = extOf(file.name);
    const delim = delimChoice === 'auto' ? CSV.sniff(text, ext) : delimChoice;
    const p = CSV.parse(text, delim);
    let rows = p.rows, lines = p.lines, names = null;
    if (header && rows.length) { names = rows[0]; rows = rows.slice(1); lines = lines.slice(1); }
    let expected = names ? names.length : 0;
    if (!names) { const counts = {}; rows.forEach(r => { counts[r.length] = (counts[r.length] || 0) + 1; }); expected = +(Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 0); }
    const bad = [];
    let ncols = expected;
    rows.forEach((r, i) => { if (r.length !== expected) bad.push(i); if (r.length > ncols) ncols = r.length; });
    const cols = [];
    for (let c = 0; c < ncols; c++) cols.push(names && c < names.length ? (names[c] === '' ? 'Column ' + (c + 1) : names[c]) : names ? '(extra ' + (c - names.length + 1) + ')' : 'Column ' + (c + 1));
    /* widths from the heading and the first rows; a column counts as numbers when most of its values are */
    const widths = [], numeric = [];
    for (let c = 0; c < ncols; c++) {
      let w = cols[c].length + 2, nums = 0, vals = 0;
      for (let i = 0; i < Math.min(rows.length, 400); i++) {
        const v = rows[i][c];
        if (v == null || v === '') continue;
        vals++; if (CSV.num(v) !== null) nums++;
        if (v.length > w) w = v.length;
      }
      widths.push(Math.max(56, Math.min(340, Math.round(w * 7.6 + 26))));
      numeric.push(vals > 0 && nums / vals >= 0.8);
    }
    return { name: file.name, path: file.path, text, ext, delim, auto: delimChoice === 'auto', header: !!names, names, cols, data: rows, lines, bad: new Set(bad), badList: bad,
      expected, unterminated: p.unterminated, eol: CSV.eol(text), widths, numeric };
  }

  async function open(file) {
    try {
      doc = build(file, 'auto', true);
    } catch (e) { toast('Could not read "' + file.name + '": ' + e.message, 4000); return; }
    $('delim').value = 'auto'; $('header').checked = true;
    sort = null; filter = { q: '', col: -1, bad: false }; $('filter').value = '';
    afterBuild(true);
    Host.setTitle(doc.name + ' - Table Viewer');
  }
  function rebuild() {
    if (!doc) return;
    const file = { name: doc.name, path: doc.path, text: doc.text };
    doc = build(file, $('delim').value, $('header').checked);
    sort = sort && sort.col < doc.cols.length ? sort : null;
    afterBuild(false);
  }
  function afterBuild(fresh) {
    for (const id of ['saveBtn', 'copyBtn', 'delim', 'header', 'filter', 'filterCol']) $(id).disabled = false;
    $('empty').hidden = true; grid.hidden = false;
    const fc = $('filterCol'), keep = filter.col;
    fc.textContent = ''; fc.append(new Option('All columns', '-1'));
    doc.cols.forEach((n, i) => fc.append(new Option(n, String(i))));
    filter.col = keep < doc.cols.length ? keep : -1; fc.value = String(filter.col);
    sel.clear(); anchor = 0; cur = { r: 0, c: 0 };
    if (fresh) { grid.scrollTop = 0; grid.scrollLeft = 0; }
    measure(); showWarnings(); applyView(); grid.focus({ preventScroll: true });
  }

  /* ---------- warnings about the file ---------- */
  function showWarnings() {
    const w = $('warn'); w.textContent = ''; w.hidden = true;
    const parts = [];
    if (doc.unterminated) parts.push('The file ends inside a quoted value that starts on line ' + fmt(doc.unterminated) + ', so the last row may be wrong.');
    if (doc.badList.length) {
      const n = doc.badList.length, list = doc.badList.slice(0, 8).map(i => fmt(i + 1)).join(', ') + (n > 8 ? ' …' : '');
      parts.push(plural(n, 'row') + ' ' + (n === 1 ? 'has' : 'have') + ' a different number of values from the ' + (doc.header ? 'header' : 'other rows') + ' (' + doc.expected + '): row' + (n === 1 ? ' ' : 's ') + list + '. Missing values are shown empty and extra ones in extra columns.');
    }
    if (!doc.data.length) parts.push(doc.text.trim() ? 'There are no rows below the header.' : 'This file is empty.');
    if (!parts.length) return;
    const msg = h('span', 'msg', '⚠ ' + parts.join(' '));
    w.append(msg);
    if (doc.badList.length) {
      const b = h('button', 'btn', filter.bad ? 'Show all rows' : 'Show only these rows');
      b.onclick = () => { filter.bad = !filter.bad; showWarnings(); applyView(); };
      w.append(b);
    }
    const x = h('button', 'btn', 'Dismiss'); x.onclick = () => { w.hidden = true; if (filter.bad) { filter.bad = false; applyView(); } grid.focus(); };
    w.append(x);
    w.hidden = false;
  }

  /* ---------- filter and sort ---------- */
  function applyView() {
    const q = filter.q.toLowerCase(), col = filter.col, data = doc.data;
    view = [];
    for (let i = 0; i < data.length; i++) {
      if (filter.bad && !doc.bad.has(i)) continue;
      if (q) {
        const r = data[i];
        let hit = false;
        if (col >= 0) hit = (r[col] || '').toLowerCase().includes(q);
        else for (let c = 0; c < r.length && !hit; c++) hit = r[c].toLowerCase().includes(q);
        if (!hit) continue;
      }
      view.push(i);
    }
    if (sort) {
      const c = sort.col, d = sort.dir, num = doc.numeric[c];
      const key = new Map();
      for (const i of view) { const v = data[i][c]; key.set(i, v == null || v === '' ? null : num ? CSV.num(v) : v); }
      view.sort((a, b) => {
        const x = key.get(a), y = key.get(b);
        if (x === null || y === null) return x === y ? a - b : x === null ? 1 : -1;      /* empty values last, either way */
        return (num ? x - y : collator.compare(x, y)) * d || a - b;
      });
    }
    cur.r = Math.min(cur.r, Math.max(0, view.length - 1));
    body.style.height = view.length * RH + 'px';
    grid.setAttribute('aria-rowcount', String(view.length + 1));
    drawHead(); render(); status();
  }
  function setSort(c) {
    if (!sort || sort.col !== c) sort = { col: c, dir: 1 };
    else if (sort.dir === 1) sort.dir = -1;
    else sort = null;
    applyView();
    toast(sort ? 'Sorted by ' + doc.cols[c] + (sort.dir === 1 ? ', up' : ', down') : 'Original order');
  }

  /* ---------- drawing: only the rows and columns in sight ---------- */
  function measure() {
    RH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rh')) || 28;
    NW = Math.max(44, String(doc.data.length).length * 8 + 22);
    colX = [0];
    for (const w of doc.widths) colX.push(colX[colX.length - 1] + w);
    totalW = NW + colX[colX.length - 1];
    head.style.width = body.style.width = totalW + 'px';
    grid.setAttribute('aria-colcount', String(doc.cols.length + 1));
  }
  function visibleCols() {
    const left = grid.scrollLeft, right = left + grid.clientWidth - NW;
    let c0 = 0; while (c0 < doc.cols.length - 1 && colX[c0 + 1] < left) c0++;
    let c1 = c0; while (c1 < doc.cols.length - 1 && colX[c1 + 1] < right) c1++;
    return [Math.max(0, c0 - 1), Math.min(doc.cols.length - 1, c1 + 1)];
  }
  function drawHead() {
    head.textContent = '';
    head.setAttribute('aria-rowindex', '1');
    const n = h('div', 'c n', '#'); n.style.width = NW + 'px'; n.setAttribute('role', 'columnheader'); head.append(n);
    doc.cols.forEach((name, c) => {
      const cell = h('div', 'c' + (doc.numeric[c] ? ' num' : ''));
      cell.style.width = doc.widths[c] + 'px';
      cell.setAttribute('role', 'columnheader'); cell.setAttribute('aria-colindex', String(c + 2));
      cell.setAttribute('aria-sort', sort && sort.col === c ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');
      cell.title = name + ' (click to sort)';
      cell.dataset.c = c;
      cell.append(document.createTextNode(name));
      if (sort && sort.col === c) cell.append(h('span', 'arrow', sort.dir === 1 ? '▲' : '▼'));
      const grip = h('span', 'grip'); grip.dataset.grip = c; cell.append(grip);
      head.append(cell);
    });
  }
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
  function render() {
    if (!doc) return;
    const top = grid.scrollTop, hh = head.offsetHeight, height = grid.clientHeight - hh;
    const r0 = Math.max(0, Math.floor(top / RH) - 5), r1 = Math.min(view.length - 1, Math.ceil((top + height) / RH) + 5);
    const [c0, c1] = doc.cols.length ? visibleCols() : [0, -1];
    const frag = document.createDocumentFragment(), data = doc.data;
    for (let r = r0; r <= r1; r++) {
      const i = view[r], row = data[i];
      const el = h('div', 'row' + (r % 2 ? ' alt' : '') + (sel.has(i) ? ' sel' : '') + (doc.bad.has(i) ? ' bad' : ''));
      el.style.top = r * RH + 'px'; el.style.width = totalW + 'px';
      el.dataset.r = r; el.setAttribute('role', 'row'); el.setAttribute('aria-rowindex', String(r + 2));
      if (sel.has(i)) el.setAttribute('aria-selected', 'true');
      const n = h('div', 'c n', fmt(i + 1)); n.style.width = NW + 'px'; n.setAttribute('role', 'rowheader');
      n.title = 'Row ' + fmt(i + 1) + ', line ' + fmt(doc.lines[i]) + ' of the file' + (doc.bad.has(i) ? ': ' + row.length + ' values, ' + doc.expected + ' expected' : '');
      el.append(n);
      if (c0 > 0) { const sp = h('div', 'spacer'); sp.style.width = colX[c0] + 'px'; el.append(sp); }
      for (let c = c0; c <= c1; c++) {
        const v = row[c], cell = h('div', 'c' + (doc.numeric[c] ? ' num' : '') + (c >= doc.expected && doc.header ? ' x' : ''), v == null ? '' : v);
        cell.style.width = doc.widths[c] + 'px';
        cell.dataset.c = c; cell.id = 'cell-' + r + '-' + c;
        cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-colindex', String(c + 2));
        if (v && v.length > 12) cell.title = v.length > 600 ? v.slice(0, 600) + '…' : v;
        if (r === cur.r && c === cur.c) cell.classList.add('cur');
        el.append(cell);
      }
      frag.append(el);
    }
    body.textContent = ''; body.append(frag);
    const active = document.getElementById('cell-' + cur.r + '-' + cur.c);
    if (active) grid.setAttribute('aria-activedescendant', active.id); else grid.removeAttribute('aria-activedescendant');
  }
  grid.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(() => { if (doc) schedule(); }).observe(grid);

  function status() {
    if (!doc) { $('stFile').textContent = ''; $('stInfo').textContent = ''; $('stCell').textContent = ''; return; }
    $('stFile').textContent = doc.name;
    $('stInfo').textContent = delimName(doc.delim) + (doc.auto ? ' (found)' : '') + ' · ' + plural(doc.data.length, 'row') + ' × ' + plural(doc.cols.length, 'column') +
      (view.length !== doc.data.length ? ' · showing ' + fmt(view.length) : '') + (sel.size ? ' · ' + fmt(sel.size) + ' selected' : '');
    const i = view[cur.r];
    $('stCell').textContent = i == null || !doc.cols.length ? '' : 'Row ' + fmt(i + 1) + ', ' + doc.cols[cur.c] + ': ' + ((doc.data[i][cur.c] || '').slice(0, 300) || '(empty)');
  }

  /* ---------- moving, selecting ---------- */
  function scrollToCur() {
    const hh = head.offsetHeight, y = cur.r * RH, top = grid.scrollTop, vis = grid.clientHeight - hh;
    if (y < top) grid.scrollTop = y; else if (y + RH > top + vis) grid.scrollTop = y + RH - vis;
    const x = colX[cur.c], w = doc.widths[cur.c] || 0, left = grid.scrollLeft, visW = grid.clientWidth - NW;
    if (x < left) grid.scrollLeft = x; else if (x + w > left + visW) grid.scrollLeft = Math.min(x, x + w - visW);
  }
  function moveTo(r, c, extend) {
    if (!view.length) return;
    cur.r = Math.max(0, Math.min(view.length - 1, r)); cur.c = Math.max(0, Math.min(doc.cols.length - 1, c));
    if (extend) selectRange(anchor, cur.r); else anchor = cur.r;
    scrollToCur(); render(); status();
  }
  function selectRange(a, b) { sel.clear(); for (let r = Math.min(a, b); r <= Math.max(a, b); r++) sel.add(view[r]); }
  function selectedRows() { return sel.size ? view.filter(i => sel.has(i)) : view.slice(); }

  body.addEventListener('pointerdown', e => {
    const rowEl = e.target.closest('.row'); if (!rowEl) return;
    const r = +rowEl.dataset.r, cellEl = e.target.closest('[data-c]'), i = view[r];
    if (cellEl) cur.c = +cellEl.dataset.c;
    cur.r = r;
    if (e.shiftKey) selectRange(anchor, r);
    else if (e.ctrlKey || e.metaKey) { if (sel.has(i)) sel.delete(i); else sel.add(i); anchor = r; }
    else { sel.clear(); sel.add(i); anchor = r; }
    grid.focus({ preventScroll: true });
    render(); status();
  });

  /* headings: click to sort, drag the edge to resize */
  let resizing = null;
  head.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-grip]');
    if (!g) return;
    e.preventDefault(); e.stopPropagation();
    const c = +g.dataset.grip;
    resizing = { c, x: e.clientX, w: doc.widths[c], moved: false };
    g.setPointerCapture(e.pointerId);
    g.onpointermove = ev => { resizing.moved = true; doc.widths[c] = Math.max(40, Math.min(1200, resizing.w + ev.clientX - resizing.x)); measure(); drawHead(); render(); };
    g.onpointerup = g.onpointercancel = () => { g.onpointermove = g.onpointerup = g.onpointercancel = null; setTimeout(() => { resizing = null; }, 0); };
  });
  head.addEventListener('click', e => {
    if (resizing || e.target.closest('[data-grip]')) return;
    const cell = e.target.closest('[data-c]'); if (!cell) return;
    cur.c = +cell.dataset.c; setSort(+cell.dataset.c); grid.focus({ preventScroll: true });
  });

  grid.addEventListener('keydown', e => {
    if (!doc || !view.length && !/^(Escape)$/.test(e.key)) return;
    const page = Math.max(1, Math.floor((grid.clientHeight - head.offsetHeight) / RH) - 1), ctrl = e.ctrlKey || e.metaKey;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown': moveTo(cur.r + 1, cur.c, e.shiftKey); break;
      case 'ArrowUp': moveTo(cur.r - 1, cur.c, e.shiftKey); break;
      case 'ArrowRight': moveTo(cur.r, cur.c + 1); break;
      case 'ArrowLeft': moveTo(cur.r, cur.c - 1); break;
      case 'PageDown': moveTo(cur.r + page, cur.c, e.shiftKey); break;
      case 'PageUp': moveTo(cur.r - page, cur.c, e.shiftKey); break;
      case 'Home': ctrl ? moveTo(0, cur.c, e.shiftKey) : moveTo(cur.r, 0); break;
      case 'End': ctrl ? moveTo(view.length - 1, cur.c, e.shiftKey) : moveTo(cur.r, doc.cols.length - 1); break;
      case ' ': { const i = view[cur.r]; if (sel.has(i)) sel.delete(i); else sel.add(i); anchor = cur.r; render(); status(); break; }
      case 'Escape': if (sel.size) { sel.clear(); render(); status(); } else if (filter.q) { $('filter').value = ''; filter.q = ''; applyView(); } else handled = false; break;
      default:
        if (ctrl && e.key.toLowerCase() === 'a') { sel = new Set(view); render(); status(); }
        else if (ctrl && e.key.toLowerCase() === 'c' && !window.getSelection().toString()) copy();
        else if (!ctrl && !e.altKey && e.key.toLowerCase() === 's') setSort(cur.c);
        else handled = false;
    }
    if (handled) e.preventDefault();
  });

  /* ---------- copy, save, open ---------- */
  async function copy() {
    if (!doc) return;
    const rows = selectedRows().map(i => doc.data[i]), out = (doc.header ? [doc.names] : []).concat(rows);
    const text = CSV.write(out, '\t', '\r\n');
    if (await Host.copy(text)) toast('Copied ' + plural(rows.length, 'row') + ' as TSV');
    else { $('copyText').value = text; const p = dialog('copyDlg', '#copyText'); $('copyText').select(); await p; }
  }
  async function saveAs() {
    if (!doc) return;
    const shown = view.length !== doc.data.length;
    $('rowsAll').textContent = 'All ' + plural(doc.data.length, 'row') + (sort ? ', in the sorted order' : '');
    $('rowsShown').textContent = 'Only the ' + plural(view.length, 'row') + ' shown';
    $('rowsSet').querySelector('[value=shown]').disabled = !shown;
    $('rowsSet').querySelector(shown ? '[value=shown]' : '[value=all]').checked = true;
    const def = doc.delim === '\t' ? '\t' : doc.delim === ';' ? ';' : ',';
    document.querySelector('#saveDlg [name=fmt][value="' + def + '"]').checked = true;
    if (await dialog('saveDlg', 'input[name=fmt]:checked') !== 'ok') return;
    const d = document.querySelector('#saveDlg [name=fmt]:checked').value, onlyShown = document.querySelector('#saveDlg [name=rows]:checked').value === 'shown';
    let order = view.slice();
    if (!onlyShown && shown) {           /* all rows, but keep the sort */
      const saved = filter; filter = { q: '', col: -1, bad: false }; applyView(); order = view.slice(); filter = saved; applyView();
    }
    const ext = d === '\t' ? '.tsv' : '.csv';
    const text = CSV.write((doc.header ? [doc.names] : []).concat(order.map(i => doc.data[i])), d, doc.eol);
    try {
      const f = await Host.saveFile({ title: 'Save as', name: stem(doc.name) + ext, types: [ext], text, mime: d === '\t' ? 'text/tab-separated-values' : 'text/csv' });
      if (f) { toast('Saved ' + f.name + ' (' + plural(order.length, 'row') + ')'); Host.notify('Saved ' + f.name); }
    } catch (e) { toast('Could not save: ' + e.message, 4000); }
  }
  async function openDialog() {
    try { const f = await Host.openFile({ title: 'Open a table', types: ['.csv', '.tsv', '.txt'] }); if (f) await open(f); }
    catch (e) { toast(e.message, 4000); }
  }

  /* ---------- toolbar ---------- */
  $('openBtn').onclick = $('openBig').onclick = openDialog;
  $('saveBtn').onclick = saveAs;
  $('copyBtn').onclick = copy;
  $('delim').onchange = rebuild;
  $('header').onchange = rebuild;
  let ft = 0;
  $('filter').addEventListener('input', () => { clearTimeout(ft); ft = setTimeout(() => { filter.q = $('filter').value; cur.r = 0; grid.scrollTop = 0; applyView(); }, 120); });
  $('filter').addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('filter').value) { e.preventDefault(); e.stopPropagation(); $('filter').value = ''; filter.q = ''; applyView(); }
    else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); clearTimeout(ft); filter.q = $('filter').value; applyView(); grid.focus(); }
  });
  $('filterCol').onchange = () => { filter.col = +$('filterCol').value; applyView(); };
  $('helpBtn').onclick = () => dialog('helpDlg');
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => {
    settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto';
    Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings);
    toast(THEMES[settings.theme][1]);
  };

  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])')) return;
    if (ctrl && !e.shiftKey && k === 'o') { e.preventDefault(); openDialog(); }
    else if (ctrl && !e.shiftKey && k === 's') { e.preventDefault(); saveAs(); }
    else if (ctrl && !e.shiftKey && k === 'f' && doc) { e.preventDefault(); $('filter').focus(); $('filter').select(); }
    else if (e.key === 'F1') { e.preventDefault(); dialog('helpDlg'); }
  });

  /* dropping a file on the window opens it */
  const app = $('app');
  app.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); (doc ? grid : $('empty')).classList.add('drop'); } });
  app.addEventListener('dragleave', e => { if (!app.contains(e.relatedTarget)) { grid.classList.remove('drop'); $('empty').classList.remove('drop'); } });
  app.addEventListener('drop', async e => {
    grid.classList.remove('drop'); $('empty').classList.remove('drop');
    const f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return;
    e.preventDefault(); open(await Host.readDropped(f));
  });

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    const start = Host.startFile();
    if (start) { try { await open(await Host.readPath(start.path, start.name)); } catch (e) { toast('Could not open "' + start.name + '": ' + e.message, 5000); } }
    else $('openBig').focus();
    Host.onOpenFile(async f => { try { await open(await Host.readPath(f.path, f.name)); } catch (e) { toast(e.message, 4000); } });
    window.__tv = { get doc() { return doc; }, get view() { return view; }, get sel() { return sel; }, get cur() { return cur; }, get sort() { return sort; } };
  })();
})();
