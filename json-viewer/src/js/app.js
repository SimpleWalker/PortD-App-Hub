/* JSON Viewer: the window. A tree that is opened as you go and drawn only where it can be seen, search with paths,
   copying values and paths, the raw text, and parse errors shown where they are. */
(function () {
  'use strict';
  const J = window.JSONV, $ = id => document.getElementById(id);
  const tree = $('tree'), rowsEl = $('rows');
  const fmt = n => n.toLocaleString('en-GB');
  const plural = (n, w, ws) => fmt(n) + ' ' + (n === 1 ? w : ws || w + 's');
  const size = n => n < 1024 ? n + ' bytes' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  const GROUP = 100, EXPAND_ALL_MAX = 50000;

  let settings = { theme: 'auto' };
  let doc = null;              // { name, path, text, root, count, error }
  let open = new WeakSet();    // containers shown open
  let groupsOpen = new WeakMap(); // container -> Set of group starts shown open
  let flat = [];               // the rows that can be seen, in order
  let cur = 0, RH = 24;
  let search = { q: '', hits: [], set: new Set(), at: -1, total: 0 };
  let rawMode = 'file';

  /* ---------- helpers ---------- */
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2200); }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, input, textarea, select')].filter(e => !e.disabled && e.offsetParent);
    (first ? ov.querySelector(first) : focusables()[0]).focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); if (back && back.focus) back.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b) done(b.dataset.act); else if (e.target === ov) done('cancel'); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done('cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        else if (e.key === 'Enter' && e.ctrlKey && ov.querySelector('[data-act=ok]')) { e.preventDefault(); done('ok'); }
        e.stopPropagation();
      };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
    });
  }
  async function copyText(text, what) {
    if (await Host.copy(text)) toast('Copied ' + what);
    else { $('copyText').value = text; const p = dialog('copyDlg', '#copyText'); $('copyText').select(); await p; }
  }
  const isBox = n => n.t === 'o' || n.t === 'a';
  const kids = n => n.t === 'o' ? n.keys.length : n.t === 'a' ? n.vals.length : 0;
  function preview(n, max) {
    switch (n.t) {
      case 's': return JSON.stringify(n.v.length > max ? n.v.slice(0, max) + '…' : n.v);
      case 'n': return n.v;
      case 'b': return String(n.v);
      case 'z': return 'null';
      case 'a': return '[ ' + plural(n.vals.length, 'item') + ' ]';
      case 'o': return '{ ' + plural(n.keys.length, 'key') + ' }';
    }
  }

  /* ---------- loading ---------- */
  function load(file) {
    const text = file.text;
    doc = { name: file.name, path: file.path, text, root: null, count: 0, error: null };
    open = new WeakSet(); groupsOpen = new WeakMap(); cur = 0;
    clearSearch(false);
    try {
      const r = J.parse(text);
      doc.root = r.root; doc.count = r.count;
    } catch (e) {
      if (!(e instanceof J.ParseError)) throw e;
      doc.error = { msg: e.message, pos: e.pos, at: J.where(text, e.pos) };
    }
    rawMode = 'file';
    for (const id of ['treeBtn', 'rawBtn']) $(id).disabled = false;
    for (const id of ['expandBtn', 'collapseBtn', 'search', 'prevBtn', 'nextBtn']) $(id).disabled = !doc.root;
    $('empty').hidden = true;
    Host.setTitle(doc.name + ' - JSON Viewer');
    if (doc.error) { showError(); return; }
    open.add(doc.root);
    if (doc.count < 2000 && isBox(doc.root)) (doc.root.vals).forEach(v => { if (isBox(v) && kids(v) <= 50) open.add(v); });
    dupWarning();
    showTree();
  }
  function dupWarning() {
    let n = 0;
    walk(doc.root, (node) => { if (node.dup) n += node.dup.size; });
    $('warn').hidden = !n;
    $('warn').textContent = n ? '⚠ ' + plural(n, 'key appears', 'keys appear') + ' twice in the same object. Both are shown, marked "duplicate"; most programs keep only the last one.' : '';
  }
  /* every node, depth first, without recursion: fn(node, parentInfo) */
  function walk(root, fn) {
    const st = [root];
    while (st.length) { const n = st.pop(); fn(n); if (isBox(n)) for (let i = n.vals.length - 1; i >= 0; i--) st.push(n.vals[i]); }
  }

  /* ---------- views ---------- */
  function setView(v) {
    $('treeBtn').setAttribute('aria-pressed', String(v === 'tree')); $('rawBtn').setAttribute('aria-pressed', String(v === 'raw'));
    tree.hidden = v !== 'tree'; $('raw').hidden = v !== 'raw'; $('error').hidden = v !== 'error';
    $('results').hidden = v !== 'tree' || !search.q;
    if (v === 'raw') showRaw();
    status();
  }
  function showTree() { setView('tree'); build(); render(); tree.focus({ preventScroll: true }); }
  function showError() {
    const e = doc.error, lines = doc.text.split('\n'), from = Math.max(0, e.at.line - 4), to = Math.min(lines.length, e.at.line + 2);
    $('errMsg').textContent = 'Line ' + fmt(e.at.line) + ', column ' + fmt(e.at.col) + ': ' + e.msg;
    const ctx = $('errCtx'); ctx.textContent = '';
    const w = String(to).length;
    for (let i = from; i < to; i++) {
      let line = lines[i].replace(/\r$/, ''), col0 = 0;
      if (line.length > 140) { col0 = i + 1 === e.at.line ? Math.max(0, e.at.col - 70) : 0; line = (col0 ? '…' : '') + line.slice(col0, col0 + 140) + '…'; }
      const span = h('span', i + 1 === e.at.line ? 'bad' : '', String(i + 1).padStart(w) + ' │ ' + line);
      ctx.append(span, '\n');
      if (i + 1 === e.at.line) ctx.append(h('span', null, ' '.repeat(w) + ' │ ' + ' '.repeat(e.at.col - 1 - col0 + (col0 ? 1 : 0)) + '^ here'), '\n');
    }
    $('warn').hidden = true;
    setView('error');
    $('errRaw').focus();
  }

  /* ---------- the tree: which rows can be seen ---------- */
  function build() {
    flat = [];
    const st = [{ node: doc.root, key: null, arr: false, depth: 0, path: '$', ptr: '' }];
    while (st.length) {
      const r = st.pop();
      flat.push(r);
      if (r.group) {
        if (!(groupsOpen.get(r.node) || new Set()).has(r.group[0])) continue;
        for (let i = r.group[1]; i >= r.group[0]; i--) st.push(child(r.node, i, r.depth + 1, r.path, r.ptr));
        continue;
      }
      if (!isBox(r.node) || !open.has(r.node)) continue;
      const n = kids(r.node);
      if (n > GROUP) {
        for (let g = Math.floor((n - 1) / GROUP) * GROUP; g >= 0; g -= GROUP) st.push({ node: r.node, group: [g, Math.min(n, g + GROUP) - 1], depth: r.depth + 1, path: r.path, ptr: r.ptr });
      } else for (let i = n - 1; i >= 0; i--) st.push(child(r.node, i, r.depth + 1, r.path, r.ptr));
    }
    rowsEl.style.height = flat.length * RH + 'px';
    cur = Math.min(cur, flat.length - 1);
  }
  function child(node, i, depth, path, ptr) {
    const arr = node.t === 'a', key = arr ? i : node.keys[i];
    return { node: node.vals[i], key, idx: i, arr, depth, parent: node, path: path + J.step(String(key), arr), ptr: ptr + J.pointerStep(key), dup: !arr && node.dup && node.dup.has(i) };
  }
  const isOpen = r => r.group ? (groupsOpen.get(r.node) || new Set()).has(r.group[0]) : isBox(r.node) && kids(r.node) > 0 && open.has(r.node);
  function toggle(r, want) {
    if (r.group) {
      const s = groupsOpen.get(r.node) || new Set(); groupsOpen.set(r.node, s);
      if (want === undefined ? !s.has(r.group[0]) : want) s.add(r.group[0]); else s.delete(r.group[0]);
    } else if (isBox(r.node)) { if (want === undefined ? !open.has(r.node) : want) open.add(r.node); else open.delete(r.node); }
    else return;
    build(); render();
  }
  /* opens everything below a node, up to a limit; returns false when it stopped at the limit */
  function openAll(node, on) {
    let n = 0;
    const st = [node];
    while (st.length) {
      const x = st.pop();
      if (!isBox(x)) continue;
      if (on) { open.add(x); n += kids(x); if (kids(x) > GROUP) { const s = new Set(); for (let g = 0; g < kids(x); g += GROUP) s.add(g); groupsOpen.set(x, s); } }
      else { open.delete(x); groupsOpen.delete(x); }
      if (on && n > EXPAND_ALL_MAX) return false;
      for (const v of x.vals) if (isBox(v)) st.push(v);
    }
    return true;
  }

  /* ---------- drawing ---------- */
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
  function marked(text, q, cls) {
    const span = h('span', cls);
    if (!q) { span.textContent = text; return span; }
    const low = text.toLowerCase(); let i = 0, j;
    while ((j = low.indexOf(q, i)) >= 0) { span.append(text.slice(i, j), h('mark', null, text.slice(j, j + q.length))); i = j + q.length; }
    span.append(text.slice(i));
    return span;
  }
  function render() {
    if (!doc || !doc.root || tree.hidden) return;
    const top = tree.scrollTop, height = tree.clientHeight;
    const r0 = Math.max(0, Math.floor(top / RH) - 5), r1 = Math.min(flat.length - 1, Math.ceil((top + height) / RH) + 5);
    const frag = document.createDocumentFragment(), q = search.q.toLowerCase(), curHit = search.hits[search.at];
    for (let i = r0; i <= r1; i++) {
      const r = flat[i], el = h('div', 'trow' + (i === cur ? ' cur' : ''));
      el.style.top = i * RH + 'px'; el.style.paddingLeft = (4 + r.depth * 16) + 'px';
      el.dataset.i = i; el.id = 'row-' + i;
      el.setAttribute('role', 'treeitem'); el.setAttribute('aria-level', String(r.depth + 1));
      if (i === cur) el.setAttribute('aria-selected', 'true');
      const box = r.group || (isBox(r.node) && kids(r.node) > 0);
      if (box) el.setAttribute('aria-expanded', String(isOpen(r)));
      el.append(h('span', 'tog', box ? (isOpen(r) ? '▾' : '▸') : ''));
      if (r.group) {
        el.append(h('span', 'grp', '[' + fmt(r.group[0]) + ' … ' + fmt(r.group[1]) + ']'));
      } else {
        if (r.key !== null) { el.append(r.arr ? h('span', 'muted', String(r.key)) : marked(r.key, q, 'k')); el.append(h('span', 'muted', ': ')); }
        else el.append(h('span', 'muted', doc.name + '  '));
        const n = r.node;
        if (isBox(n)) el.append(h('span', 'sum', !kids(n) ? (n.t === 'a' ? '[]' : '{}') : open.has(n) ? (n.t === 'a' ? '[' + kids(n) + ']' : '{' + kids(n) + '}') : preview(n)));
        else el.append(marked(preview(n, 300), q, n.t));
        if (n.t === 'n' && J.inexact(n.v)) el.append(h('span', 'flag', 'too large to be exact in most programs'));
        if (r.dup) el.append(h('span', 'flag', 'duplicate'));
        if (search.set.has(n) && curHit && curHit.node === n) el.classList.add('hitcur');
        if (n.t === 's' && n.v.length > 60) el.title = n.v.length > 2000 ? n.v.slice(0, 2000) + '…' : n.v;
      }
      frag.append(el);
    }
    rowsEl.textContent = ''; rowsEl.append(frag);
    tree.setAttribute('aria-activedescendant', 'row-' + cur);
    status();
  }
  tree.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(() => schedule()).observe(tree);

  function status() {
    if (!doc) return;
    $('stFile').textContent = doc.name;
    $('stInfo').textContent = size(doc.text.length) + (doc.root ? ' · ' + plural(doc.count, 'value') : doc.error ? ' · not valid JSON' : '');
    const r = flat[cur];
    $('stPath').textContent = !tree.hidden && r ? (r.group ? r.path + '[' + r.group[0] + '…' + r.group[1] + ']' : r.path) : '';
  }

  /* ---------- moving ---------- */
  function go(i, keepView) {
    if (!flat.length) return;
    cur = Math.max(0, Math.min(flat.length - 1, i));
    if (!keepView) {
      const y = cur * RH, top = tree.scrollTop, vis = tree.clientHeight;
      if (y < top) tree.scrollTop = y; else if (y + RH > top + vis) tree.scrollTop = y + RH - vis;
    }
    render();
  }
  function parentRow(i) { const d = flat[i].depth; for (let k = i - 1; k >= 0; k--) if (flat[k].depth < d) return k; return i; }
  rowsEl.addEventListener('pointerdown', e => {
    const el = e.target.closest('.trow'); if (!el) return;
    const i = +el.dataset.i;
    go(i, true); tree.focus({ preventScroll: true });
    if (e.button !== 0) return;
    /* rows are redrawn on every click, so a double-click is noticed here rather than by the dblclick event */
    const now = Date.now(), dbl = lastDown.i === i && now - lastDown.t < 450;
    lastDown = dbl ? { i: -1, t: 0 } : { i, t: now };
    if (e.target.classList.contains('tog') || dbl) toggle(flat[i]);
  });
  let lastDown = { i: -1, t: 0 };
  rowsEl.addEventListener('contextmenu', e => { const el = e.target.closest('.trow'); if (!el) return; e.preventDefault(); go(+el.dataset.i, true); showMenu(e.clientX, e.clientY); });

  tree.addEventListener('keydown', e => {
    if (!flat.length) return;
    const r = flat[cur], page = Math.max(1, Math.floor(tree.clientHeight / RH) - 1), ctrl = e.ctrlKey || e.metaKey;
    let done = true;
    if (e.key === 'ArrowDown') go(cur + 1);
    else if (e.key === 'ArrowUp') go(cur - 1);
    else if (e.key === 'PageDown') go(cur + page);
    else if (e.key === 'PageUp') go(cur - page);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(flat.length - 1);
    else if (e.key === 'ArrowRight') { if ((r.group || isBox(r.node)) && !isOpen(r)) toggle(r, true); else if (isOpen(r)) go(cur + 1); }
    else if (e.key === 'ArrowLeft') { if (isOpen(r)) toggle(r, false); else go(parentRow(cur)); }
    else if ((e.key === 'Enter' || e.key === ' ') && !ctrl) toggle(r);
    else if (e.key === '*') { if (!r.group && !openAll(r.node, true)) toast('Opened the first ' + fmt(EXPAND_ALL_MAX) + ' values'); build(); render(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'c') cmd('path');
    else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'c' && !window.getSelection().toString()) cmd('value');
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { const el = document.getElementById('row-' + cur), b = el ? el.getBoundingClientRect() : tree.getBoundingClientRect(); showMenu(b.left + 40, b.bottom); }
    else if (!ctrl && !e.altKey && e.key.toLowerCase() === 'r') setView('raw');
    else done = false;
    if (done) e.preventDefault();
  });

  /* ---------- copying, and the menu ---------- */
  function valueText(r) {
    try {
      if (r.group) return J.stringify({ t: 'a', vals: r.node.t === 'a' ? r.node.vals.slice(r.group[0], r.group[1] + 1) : [] }, 2);
      return r.node.t === 's' ? r.node.v : J.stringify(r.node, 2);
    } catch (e) { toast('This value is nested too deeply to copy as text.', 3500); return null; }
  }
  function cmd(c) {
    const r = flat[cur]; if (!r) return;
    if (c === 'value') { const t = valueText(r); if (t !== null) copyText(t, r.node.t === 's' ? 'the text' : 'the value'); }
    else if (c === 'path') copyText(r.path, 'the path ' + (r.path.length > 60 ? r.path.slice(0, 60) + '…' : r.path));
    else if (c === 'pointer') copyText(r.ptr || '', 'the JSON Pointer ' + (r.ptr || '(the whole document)'));
    else if (c === 'key') { if (r.key === null || r.group) toast('This item has no key'); else copyText(String(r.key), 'the key'); }
    else if (c === 'expand') { if (!r.group && !openAll(r.node, true)) toast('Opened the first ' + fmt(EXPAND_ALL_MAX) + ' values'); else if (r.group) toggle(r, true); build(); render(); }
    else if (c === 'collapse') { if (!r.group) openAll(r.node, false); else toggle(r, false); build(); render(); }
  }
  const menu = $('menu');
  function showMenu(x, y) {
    menu.hidden = false;
    const w = menu.offsetWidth, hh = menu.offsetHeight;
    menu.style.left = Math.max(4, Math.min(x, innerWidth - w - 4)) + 'px'; menu.style.top = Math.max(4, Math.min(y, innerHeight - hh - 4)) + 'px';
    menu.querySelector('button').focus();
  }
  function hideMenu(back) { if (menu.hidden) return; menu.hidden = true; if (back) tree.focus({ preventScroll: true }); }
  menu.addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (!b) return; hideMenu(true); cmd(b.dataset.cmd); });
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length].focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length].focus();
    else if (e.key === 'Home') items[0].focus();
    else if (e.key === 'End') items[items.length - 1].focus();
    else if (e.key === 'Escape' || e.key === 'Tab') hideMenu(true);
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) hideMenu(false); });

  /* ---------- search ---------- */
  function runSearch(q) {
    search = { q, hits: [], set: new Set(), at: -1, total: 0 };
    if (!q || !doc || !doc.root) { showResults(); render(); return; }
    const low = q.toLowerCase(), MAX = 5000;
    /* walk the whole document, keeping the chain of parents so a match can be revealed */
    const st = [{ node: doc.root, path: '$', up: null }];
    const chain = x => { const c = []; for (let e = x; e.up; e = e.up) c.unshift([e.up.node, e.idx]); return c; };
    while (st.length) {
      const x = st.pop(), n = x.node;
      const hit = (typeof x.key === 'string' && x.key.toLowerCase().includes(low)) || (n.t === 's' ? n.v.toLowerCase().includes(low) : !isBox(n) && preview(n).toLowerCase().includes(low));
      if (hit) {
        search.total++;
        if (search.hits.length < MAX) { search.hits.push({ node: n, path: x.path, chain: chain(x), key: x.key }); search.set.add(n); }
      }
      if (isBox(n)) for (let i = n.vals.length - 1; i >= 0; i--) {
        const arr = n.t === 'a', key = arr ? i : n.keys[i];
        st.push({ node: n.vals[i], key, idx: i, up: x, path: x.path + J.step(String(key), arr) });
      }
    }
    showResults();
    if (search.hits.length) gotoHit(0); else render();
  }
  function showResults() {
    const list = $('rlist'); list.textContent = '';
    $('results').hidden = !search.q || tree.hidden;
    $('hits').textContent = !search.q ? '' : search.total ? (search.at + 1) + ' of ' + fmt(search.total) : 'No matches';
    $('rcount').textContent = !search.q ? '' : plural(search.total, 'match', 'matches') + (search.total > search.hits.length ? ' (first ' + fmt(search.hits.length) + ' listed)' : '');
    const q = search.q.toLowerCase(), frag = document.createDocumentFragment();
    search.hits.slice(0, 1000).forEach((hit, k) => {
      const it = h('div', 'ritem'); it.dataset.k = k; it.setAttribute('role', 'option'); it.id = 'hit-' + k;
      it.append(marked(hit.path, q, 'rp'), marked(isBox(hit.node) ? preview(hit.node) : preview(hit.node, 120), q, 'rv'));
      frag.append(it);
    });
    if (search.hits.length > 1000) frag.append(h('div', 'ritem muted', 'Use ↑ and ↓ to step through the rest.'));
    list.append(frag);
  }
  function gotoHit(k) {
    if (!search.hits.length) return;
    search.at = (k + search.hits.length) % search.hits.length;
    const hit = search.hits[search.at];
    for (const [p, i] of hit.chain) {                 /* open each parent, and the group holding the child */
      open.add(p);
      if (kids(p) > GROUP) { const s = groupsOpen.get(p) || new Set(); s.add(Math.floor(i / GROUP) * GROUP); groupsOpen.set(p, s); }
    }
    build();
    const i = flat.findIndex(r => !r.group && r.node === hit.node && r.path === hit.path);
    if (i >= 0) { cur = i; tree.scrollTop = Math.max(0, i * RH - tree.clientHeight / 2); }
    render();
    $('hits').textContent = (search.at + 1) + ' of ' + fmt(search.total);
    for (const el of $('rlist').querySelectorAll('.ritem.on')) el.classList.remove('on');
    const it = document.getElementById('hit-' + search.at);
    if (it) { it.classList.add('on'); it.scrollIntoView({ block: 'nearest' }); $('rlist').setAttribute('aria-activedescendant', it.id); }
  }
  function clearSearch(redraw) { search = { q: '', hits: [], set: new Set(), at: -1, total: 0 }; $('search').value = ''; $('hits').textContent = ''; $('results').hidden = true; if (redraw) render(); }
  let st = 0;
  $('search').addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => runSearch($('search').value.trim()), 200); });
  $('search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(st); if ($('search').value.trim() !== search.q) runSearch($('search').value.trim()); else gotoHit(search.at + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if ($('search').value) clearSearch(true); else tree.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); tree.focus(); }
  });
  $('prevBtn').onclick = () => gotoHit(search.at - 1);
  $('nextBtn').onclick = () => gotoHit(search.at + 1);
  $('rlist').addEventListener('click', e => { const it = e.target.closest('[data-k]'); if (it) { gotoHit(+it.dataset.k); tree.focus({ preventScroll: true }); } });
  $('rlist').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); gotoHit(search.at + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); tree.focus(); }
  });
  $('rclose').onclick = () => { clearSearch(true); tree.focus(); };

  /* ---------- raw text ---------- */
  const raw = $('rawText'), gutter = $('gutter'), LH = 18;
  function showRaw() {
    let text = doc.text;
    if (rawMode === 'pretty' && doc.root) { try { text = J.stringify(doc.root, 2); } catch (e) { toast('Too deeply nested to format; showing it as in the file.', 3500); rawMode = 'file'; } }
    $('asFile').setAttribute('aria-pressed', String(rawMode === 'file')); $('asPretty').setAttribute('aria-pressed', String(rawMode === 'pretty'));
    $('asPretty').disabled = !doc.root;
    if (raw.value !== text) raw.value = text;
    raw.lines = 1; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) raw.lines++;
    $('rawInfo').textContent = plural(raw.lines, 'line') + ' · ' + size(text.length);
    numbers();
  }
  function numbers() {
    const first = Math.floor(raw.scrollTop / LH), count = Math.ceil(raw.clientHeight / LH) + 1, out = [];
    for (let k = first + 1; k <= Math.min(raw.lines, first + count); k++) out.push(k);
    gutter.textContent = out.join('\n'); gutter.style.paddingTop = (6 - raw.scrollTop % LH) + 'px';
  }
  raw.addEventListener('scroll', numbers, { passive: true });
  new ResizeObserver(() => { if (!$('raw').hidden) numbers(); }).observe(raw);
  raw.addEventListener('keydown', e => { if (e.key === 'Escape' && doc.root) { e.preventDefault(); showTree(); } });
  /* shows a character position in the raw text: scrolled to, and selected */
  function revealRaw(pos) {
    rawMode = 'file'; setView('raw');
    const at = J.where(doc.text, pos);
    raw.focus(); raw.setSelectionRange(pos, Math.min(doc.text.length, pos + 1));
    raw.scrollTop = Math.max(0, (at.line - 4) * LH);
    raw.scrollLeft = Math.max(0, (at.col - 40) * 7.2);
    numbers();
  }
  $('asFile').onclick = () => { rawMode = 'file'; showRaw(); };
  $('asPretty').onclick = () => { rawMode = 'pretty'; showRaw(); raw.scrollTop = 0; numbers(); };
  $('copyRaw').onclick = () => copyText(raw.value, plural(raw.lines, 'line'));
  $('errRaw').onclick = () => revealRaw(doc.error.pos);

  /* ---------- toolbar and keys ---------- */
  async function openDialog() {
    try { const f = await Host.openFile({ title: 'Open JSON', types: ['.json'] }); if (f) load(f); }
    catch (e) { toast(e.message, 4000); }
  }
  async function pasteDialog() {
    $('pasteText').value = '';
    if (await dialog('pasteDlg', '#pasteText') === 'ok' && $('pasteText').value.trim()) load({ name: 'Pasted text', path: null, text: $('pasteText').value });
  }
  $('openBtn').onclick = $('openBig').onclick = openDialog;
  $('pasteBtn').onclick = $('pasteBig').onclick = pasteDialog;
  $('treeBtn').onclick = () => { if (doc.root) showTree(); else showError(); };
  $('rawBtn').onclick = () => { setView('raw'); raw.focus(); };
  $('expandBtn').onclick = () => { if (!openAll(doc.root, true)) toast('Opened the first ' + fmt(EXPAND_ALL_MAX) + ' values: the file is large'); showTree(); };
  $('collapseBtn').onclick = () => { openAll(doc.root, false); open.add(doc.root); cur = 0; tree.scrollTop = 0; showTree(); };
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
    Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); toast(THEMES[settings.theme][1]);
  };
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])')) return;
    if (ctrl && !e.shiftKey && k === 'o') { e.preventDefault(); openDialog(); }
    else if (ctrl && !e.shiftKey && k === 'f' && doc && doc.root) { e.preventDefault(); if (tree.hidden) showTree(); $('search').focus(); $('search').select(); }
    else if (e.key === 'F3' && search.q) { e.preventDefault(); gotoHit(search.at + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'F1') { e.preventDefault(); dialog('helpDlg'); }
  });
  const app = $('app');
  app.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); $('main').classList.add('drop'); } });
  app.addEventListener('dragleave', e => { if (!app.contains(e.relatedTarget)) $('main').classList.remove('drop'); });
  app.addEventListener('drop', async e => { $('main').classList.remove('drop'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return; e.preventDefault(); load(await Host.readDropped(f)); });

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    RH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rh')) || 24;
    const start = Host.startFile();
    if (start) { try { load(await Host.readPath(start.path, start.name)); } catch (e) { toast('Could not open "' + start.name + '": ' + e.message, 5000); } }
    else $('openBig').focus();
    window.__jv = { get doc() { return doc; }, get flat() { return flat; }, get cur() { return cur; }, get search() { return search; } };
  })();
})();
