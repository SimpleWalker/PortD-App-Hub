/* Zip Viewer: the window. A folder tree of the archive, details and a preview of the chosen entry, and extracting:
   one file through the Save dialog, or several either one by one or all at once into Zip Viewer's own folder
   (a program can only write to its own folder or to a file the user picks: PortD has no folder picker). */
(function () {
  'use strict';
  const Z = window.Zip, $ = id => document.getElementById(id);
  const treeEl = $('tree');
  const num = n => n.toLocaleString('en-GB');
  const plural = (n, w, ws) => num(n) + ' ' + (n === 1 ? w : ws || w + 's');
  const ONE_BY_ONE_MAX = 30;

  let settings = { theme: 'auto' };
  let arc = null;                // { name, bytes, entries, tree, comment }
  let expanded = new Set(), ticked = new Set(), cur = null, rows = [], q = '';
  let preview = { seq: 0, url: null };

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2600); }
  const fmtDate = d => d ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const base = p => p.split('/').pop();
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return btoa(s); }
  function fromDataUrl(d) {
    const i = d.indexOf(','), head = d.slice(0, i);
    if (!/;base64$/i.test(head)) return new TextEncoder().encode(decodeURIComponent(d.slice(i + 1)));
    const s = atob(d.slice(i + 1)), out = new Uint8Array(s.length);
    for (let k = 0; k < s.length; k++) out[k] = s.charCodeAt(k);
    return out;
  }
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, [tabindex="0"]')].filter(e => !e.disabled && e.offsetParent);
    const f = first ? ov.querySelector(first) : focusables()[0]; if (f) f.focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); if (back && back.focus && document.contains(back)) back.focus(); else treeEl.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b && ov.contains(b) && !b.disabled) done(b.dataset.act); else if (e.target === ov && id !== 'progDlg') done('cancel'); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done(id === 'progDlg' ? 'stop' : 'cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        e.stopPropagation();
      };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
      ov.done = done;
    });
  }

  /* ---------- opening an archive ---------- */
  function show(name, bytes) {
    let r;
    try { r = Z.read(bytes); }
    catch (e) { showError(name, e.message); return; }
    arc = { name, bytes, entries: r.entries, tree: Z.tree(r.entries), comment: r.comment, zip64: r.zip64 };
    expanded = new Set(); ticked = new Set(); cur = null; q = ''; $('search').value = '';
    if (r.entries.length <= 300) for (const [k] of arc.tree.dirs) expanded.add(k);
    for (const id of ['saveBtn', 'extractBtn', 'allBtn', 'search']) $(id).disabled = false;
    Host.setTitle(name + ' - Zip Viewer');
    drawInfo(); drawTree();
    if (rows.length) choose(0);
    treeEl.focus();
  }
  function showError(name, msg) {
    arc = null; rows = []; treeEl.textContent = ''; $('info').textContent = '';
    for (const id of ['saveBtn', 'extractBtn', 'allBtn', 'search']) $(id).disabled = true;
    $('details').hidden = true; $('empty').hidden = false;
    $('empty').querySelector('h1').textContent = 'Could not open ' + name;
    $('empty').querySelector('p').textContent = msg;
    Host.setTitle('Zip Viewer');
    $('openBtn2').focus();
  }
  async function openFile() {
    try {
      if (Host.inPortD) {
        const r = await PortD.ui.openFile({ title: 'Open an archive', types: ['.zip', '.docx', '.xlsx', '.pptx', '.jar'] });
        if (r) await openPath(r);
      } else {
        const i = h('input', { type: 'file', accept: '.zip,.docx,.xlsx,.pptx,.jar' });
        i.onchange = async () => { const f = i.files[0]; if (f) show(f.name, new Uint8Array(await f.arrayBuffer())); };
        i.click();
      }
    } catch (e) { toast('Could not open the file: ' + e.message, 5000); }
  }
  async function openPath(o) {
    try {
      const d = await PortD.fs.read(o.path);
      if (typeof d !== 'string' || !/^data:/.test(d)) { showError(o.name, 'PortD holds this file as text, so it is not a zip archive (or it was changed into text).'); return; }
      show(o.name, fromDataUrl(d));
    } catch (e) { showError(o.name, e.message); }
  }
  $('openBtn').onclick = $('openBtn2').onclick = openFile;

  /* ---------- the summary line ---------- */
  function drawInfo() {
    const t = arc.tree, info = $('info'); info.textContent = '';
    const folders = (function count(n) { let c = 0; for (const d of n.dirs.values()) c += 1 + count(d); return c; })(t);
    info.append(h('b', null, arc.name), ' · ' + plural(t.count, 'file') + (folders ? ' in ' + plural(folders, 'folder') : '') + ' · ' + Z.size(t.size) + ', packed ' + Z.size(t.csize));
    const bad = arc.entries.filter(e => Z.problem(e)).length, unsafe = arc.entries.filter(e => e.unsafe).length, renamed = arc.entries.filter(e => e.renamed && !e.unsafe).length;
    if (bad) info.append(h('span', { class: 'warn' }, ' ⚠ ' + plural(bad, 'file') + ' cannot be opened here'));
    if (unsafe) info.append(h('span', { class: 'warn' }, ' ⚠ ' + plural(unsafe, 'name') + ' tried to reach outside the archive\'s folder and ' + (unsafe === 1 ? 'was' : 'were') + ' made safe'));
    if (renamed) info.append(h('span', { class: 'note' }, ' · ' + plural(renamed, 'name') + ' had characters PortD does not allow, replaced with _'));
    if (arc.comment) info.append(h('div', { class: 'comment' }, 'Comment: ' + arc.comment));
  }

  /* ---------- the tree ---------- */
  const sortName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
  function buildRows() {
    rows = [];
    if (!arc) return;
    if (q) {
      const ql = q.toLowerCase();
      for (const e of arc.entries) if (!e.dir && e.path.toLowerCase().includes(ql)) rows.push({ key: 'f' + e.index, kind: 'f', level: 1, e, label: e.path });
      rows.sort((a, b) => sortName(a.label, b.label));
      return;
    }
    (function walk(node, level) {
      for (const name of [...node.dirs.keys()].sort(sortName)) {
        const d = node.dirs.get(name);
        rows.push({ key: 'd' + d.path, kind: 'd', level, d, label: name });
        if (expanded.has(d.path)) walk(d, level + 1);
      }
      for (const e of node.files.slice().sort((a, b) => sortName(base(a.path), base(b.path)))) rows.push({ key: 'f' + e.index, kind: 'f', level, e, label: base(e.path) });
    })(arc.tree, 1);
  }
  const filesUnder = d => { const out = []; (function w(n) { out.push(...n.files); for (const c of n.dirs.values()) w(c); })(d); return out; };
  function tickState(r) {
    if (r.kind === 'f') return ticked.has(r.e.index) ? 'true' : 'false';
    const fs = filesUnder(r.d); if (!fs.length) return 'false';
    const n = fs.filter(e => ticked.has(e.index)).length;
    return n === 0 ? 'false' : n === fs.length ? 'true' : 'mixed';
  }
  function marked(text) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase()); if (i < 0) return text;
    return [text.slice(0, i), h('mark', null, text.slice(i, i + q.length)), text.slice(i + q.length)];
  }
  function drawTree() {
    buildRows();
    const frag = document.createDocumentFragment();
    rows.forEach((r, i) => {
      const st = tickState(r), isCur = r.key === cur;
      const prob = r.kind === 'f' && Z.problem(r.e), unsafe = r.kind === 'f' && r.e.unsafe;
      const label = r.label + (r.kind === 'd' ? ', folder, ' + plural(r.d.count, 'file') : ', ' + Z.size(r.e.usize)) + (prob ? ', cannot be opened here' : '') + (unsafe ? ', unsafe name made safe' : '') + (st === 'true' ? ', ticked' : st === 'mixed' ? ', partly ticked' : '');
      const row = h('div', { class: 'row' + (isCur ? ' cur' : '') + (prob ? ' bad' : ''), id: 'r-' + i, role: 'treeitem', 'aria-level': String(r.level), 'aria-selected': String(isCur), 'aria-checked': st, 'aria-label': label, 'data-i': String(i), style: '--lv:' + (r.level - 1) },
        h('span', { class: 'chk ' + st, 'aria-hidden': 'true', title: 'Tick to extract' }),
        h('span', { class: 'cell' },
          h('span', { class: 'tw', 'aria-hidden': 'true' }, r.kind === 'd' ? (expanded.has(r.d.path) ? '▾' : '▸') : ''),
          h('span', { class: 'ic', 'aria-hidden': 'true' }, r.kind === 'd' ? '📁' : prob ? '⛔' : unsafe ? '⚠' : Z.IMAGE[Z.ext(r.e.path)] ? '🖼' : '📄'),
          h('span', { class: 'c-name' }, marked(r.label))),
        h('span', { class: 'c-size' }, r.kind === 'd' ? Z.size(r.d.size) : Z.size(r.e.usize)),
        h('span', { class: 'c-pack' }, r.kind === 'd' ? Z.size(r.d.csize) : Z.size(r.e.csize)),
        h('span', { class: 'c-date' }, r.kind === 'f' ? fmtDate(r.e.date) : ''));
      if (r.kind === 'd') row.setAttribute('aria-expanded', String(expanded.has(r.d.path)));
      frag.append(row);
    });
    treeEl.textContent = '';
    if (!rows.length && arc) treeEl.append(h('div', { class: 'none muted' }, q ? 'No names contain "' + q + '".' : 'This archive is empty.'));
    treeEl.append(frag);
    const ci = rows.findIndex(r => r.key === cur);
    if (ci >= 0) treeEl.setAttribute('aria-activedescendant', 'r-' + ci); else treeEl.removeAttribute('aria-activedescendant');
    const n = ticked.size;
    $('extractBtn').textContent = n ? 'Extract ticked (' + n + ')…' : 'Extract ticked…';
    $('extractBtn').disabled = !arc || !n;
  }
  function choose(i, keepFocus) {
    const r = rows[i]; if (!r) return;
    cur = r.key;
    for (const el of treeEl.querySelectorAll('.row.cur')) { el.classList.remove('cur'); el.setAttribute('aria-selected', 'false'); }
    const el = $('r-' + i); el.classList.add('cur'); el.setAttribute('aria-selected', 'true'); el.scrollIntoView({ block: 'nearest' });
    treeEl.setAttribute('aria-activedescendant', el.id);
    $('saveBtn').disabled = r.kind !== 'f' || !!Z.problem(r.e);
    drawDetails(r);
  }
  const curIndex = () => rows.findIndex(r => r.key === cur);
  function toggleDir(r, open) {
    if (r.kind !== 'd') return;
    if (open === undefined) open = !expanded.has(r.d.path);
    if (open) expanded.add(r.d.path); else expanded.delete(r.d.path);
    drawTree();
  }
  function toggleTick(r) {
    const files = r.kind === 'f' ? [r.e] : filesUnder(r.d);
    const on = tickState(r) !== 'true';
    for (const e of files) on ? ticked.add(e.index) : ticked.delete(e.index);
    const i = curIndex(); drawTree(); if (i >= 0) treeEl.setAttribute('aria-activedescendant', 'r-' + i);
  }
  treeEl.addEventListener('click', e => {
    const row = e.target.closest('.row'); if (!row) return;
    const i = +row.dataset.i, r = rows[i];
    if (e.target.closest('.chk')) { choose(i); toggleTick(r); return; }
    if (e.target.closest('.tw') && r.kind === 'd') { choose(i); toggleDir(r); return; }
    choose(i);
  });
  treeEl.addEventListener('dblclick', e => {
    const row = e.target.closest('.row'); if (!row || e.target.closest('.chk')) return;
    const r = rows[+row.dataset.i];
    if (r.kind === 'd') toggleDir(r); else if (!Z.problem(r.e)) saveOne(r.e);
  });
  treeEl.addEventListener('keydown', e => {
    if (!rows.length) return;
    let i = curIndex(); const r = rows[i], page = Math.max(1, Math.floor(treeEl.clientHeight / 26) - 1);
    const k = e.key;
    const to = { ArrowDown: i + 1, ArrowUp: i < 0 ? 0 : i - 1, Home: 0, End: rows.length - 1, PageDown: i + page, PageUp: i - page }[k];
    if (to !== undefined) { e.preventDefault(); choose(Math.max(0, Math.min(rows.length - 1, to))); return; }
    if (!r) { if (k === ' ' || k === 'Enter') { e.preventDefault(); choose(0); } return; }
    if (k === 'ArrowRight') { e.preventDefault(); if (r.kind === 'd' && !expanded.has(r.d.path)) { toggleDir(r, true); choose(curIndex()); } else if (r.kind === 'd' && rows[i + 1] && rows[i + 1].level > r.level) choose(i + 1); }
    else if (k === 'ArrowLeft') {
      e.preventDefault();
      if (r.kind === 'd' && expanded.has(r.d.path)) { toggleDir(r, false); choose(curIndex()); }
      else for (let j = i - 1; j >= 0; j--) if (rows[j].level < r.level) { choose(j); break; }
    }
    else if (k === ' ') { e.preventDefault(); toggleTick(r); }
    else if (k === 'Enter') { e.preventDefault(); if (r.kind === 'd') { toggleDir(r); choose(curIndex()); } else if (!Z.problem(r.e)) saveOne(r.e); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') { e.preventDefault(); const all = arc.entries.filter(x => !x.dir); const on = ticked.size !== all.length; ticked = new Set(on ? all.map(x => x.index) : []); drawTree(); toast(on ? 'Ticked all ' + plural(all.length, 'file') : 'Nothing ticked'); }
  });
  treeEl.addEventListener('focus', () => { if (!cur && rows.length) choose(0); });

  /* ---------- details and preview ---------- */
  function drawDetails(r) {
    const box = $('details'); box.textContent = ''; box.hidden = false; $('empty').hidden = true;
    if (preview.url) { URL.revokeObjectURL(preview.url); preview.url = null; }
    const my = ++preview.seq;
    if (r.kind === 'd') {
      const fs = filesUnder(r.d);
      box.append(h('h2', null, '📁 ' + r.d.name), h('div', { class: 'path mono' }, r.d.path + '/'),
        h('table', { class: 'facts' }, h('tr', null, h('th', null, 'Files'), h('td', null, num(fs.length))), h('tr', null, h('th', null, 'Size'), h('td', null, Z.size(r.d.size))), h('tr', null, h('th', null, 'Packed'), h('td', null, Z.size(r.d.csize)))),
        h('div', { class: 'acts' }, h('button', { class: 'btn', disabled: !fs.length || null, onclick: () => extractList(fs, 'the folder "' + r.d.name + '"') }, 'Extract this folder…')));
      return;
    }
    const e = r.e, prob = Z.problem(e), ratio = e.usize ? Math.round(100 - e.csize / e.usize * 100) : 0;
    box.append(h('h2', null, base(e.path)), h('div', { class: 'path mono' }, e.name));
    if (e.unsafe) box.append(h('div', { class: 'warnbox' }, '⚠ This name tries to reach outside the archive\'s folder ("' + e.name + '"). When extracted it is saved as "' + e.path + '" instead.'));
    else if (e.renamed) box.append(h('div', { class: 'notebox' }, 'This name has characters PortD does not allow. When extracted it is saved as "' + e.path + '".'));
    if (prob) box.append(h('div', { class: 'warnbox' }, '⛔ ' + prob));
    const facts = [['Size', Z.size(e.usize) + (e.usize >= 1024 ? ' (' + num(e.usize) + ' bytes)' : '')], ['Packed', Z.size(e.csize) + (e.usize ? (ratio > 0 ? ' (' + ratio + '% smaller)' : ratio === 0 ? ' (no smaller)' : ' (a little bigger: it was already compact)') : '')], ['Compression', Z.methodName(e.method) + (e.encrypted ? ', encrypted' : '')], ['Modified', fmtDate(e.date) || 'not recorded'], ['CRC-32', e.crc.toString(16).padStart(8, '0').toUpperCase()]];
    if (e.comment) facts.push(['Comment', e.comment]);
    box.append(h('table', { class: 'facts' }, facts.map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, v)))));
    box.append(h('div', { class: 'acts' }, h('button', { class: 'btn primary', disabled: prob ? true : null, onclick: () => saveOne(e) }, 'Save file…'), h('span', { id: 'crcNote', class: 'muted small', role: 'status' })));
    const pv = h('div', { class: 'preview', id: 'preview', 'aria-label': 'Preview' });
    box.append(pv);
    if (prob) return;
    const ext = Z.ext(e.path), mime = Z.IMAGE[ext];
    if (mime) {
      if (e.usize > Z.LIMIT.image) { pv.append(h('p', { class: 'muted' }, 'Too big to preview (over ' + Z.size(Z.LIMIT.image) + ').')); return; }
      pv.append(h('p', { class: 'muted' }, 'Loading…'));
      Z.extract(arc.bytes, e).then(x => {
        if (my !== preview.seq) return;
        pv.textContent = '';
        preview.url = URL.createObjectURL(new Blob([x.bytes], { type: mime }));
        const img = h('img', { src: preview.url, alt: base(e.path), class: 'pimg' });
        img.onerror = () => { pv.textContent = ''; pv.append(h('p', { class: 'muted' }, 'This picture could not be shown.')); };
        pv.append(img); crcNote(x);
      }).catch(err => { if (my === preview.seq) { pv.textContent = ''; pv.append(h('div', { class: 'warnbox' }, err.message)); } });
      return;
    }
    pv.append(h('p', { class: 'muted' }, 'Loading…'));
    Z.extract(arc.bytes, e, Z.LIMIT.preview).then(x => {
      if (my !== preview.seq) return;
      pv.textContent = '';
      const head = x.bytes.subarray(0, 4096), nul = head.indexOf(0) >= 0;
      if (!Z.TEXT.has(ext) && nul) {
        pv.append(h('p', { class: 'muted' }, 'No preview: this is not a text or picture file. The first bytes, in hex:'), h('pre', { class: 'hex mono', tabindex: '0' }, Array.from(x.bytes.subarray(0, 256), b => b.toString(16).padStart(2, '0')).join(' ').replace(/((?:\S+ ){16})/g, '$1\n')));
      } else {
        pv.append(h('pre', { class: 'text mono', tabindex: '0', 'aria-label': 'Text of ' + base(e.path) }, new TextDecoder('utf-8').decode(x.bytes) || '(empty file)'));
        if (x.cut) pv.append(h('p', { class: 'muted small' }, 'The first ' + Z.size(Z.LIMIT.preview) + ' is shown. Save the file to see all of it.'));
      }
      crcNote(x);
    }).catch(err => { if (my === preview.seq) { pv.textContent = ''; pv.append(h('div', { class: 'warnbox' }, err.message)); } });
  }
  function crcNote(x) {
    const n = $('crcNote'); if (!n || x.crcOk === null) return;
    n.textContent = x.crcOk ? '✓ Checksum matches' : '⚠ Checksum does not match: this file is damaged in the archive';
    n.className = x.crcOk ? 'muted small' : 'bad small';
  }

  /* ---------- writing files out ---------- */
  function isUtf8(b) { try { new TextDecoder('utf-8', { fatal: true }).decode(b); return true; } catch (e) { return false; } }
  /* writes bytes to a path PortD allows (the picked file, or a path in our data folder): text files as text, the rest as binary */
  async function writeBytes(path, name, bytes) {
    const ext = Z.ext(name);
    if (Z.PORTD_TEXT.has(ext) && isUtf8(bytes)) await PortD.fs.write(path, new TextDecoder().decode(bytes).replace(/^\uFEFF/, ''));
    else await PortD.fs.write(path, 'data:' + (Z.IMAGE[ext] || 'application/octet-stream') + ';base64,' + b64(bytes), 'dataurl');
  }
  function download(name, bytes) {
    const url = URL.createObjectURL(new Blob([bytes])), a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  /* one file through the Save dialog. Returns 'saved', 'cancel' or an error message */
  async function saveOne(e, quiet) {
    let x;
    try { x = await Z.extract(arc.bytes, e); } catch (err) { if (!quiet) toast(err.message, 6000); return err.message; }
    const name = base(e.path) || 'file', ext = Z.ext(name);
    try {
      if (!Host.inPortD) { download(name, x.bytes); if (!quiet) toast('Downloaded ' + name); return 'saved'; }
      const r = await PortD.ui.saveFile({ title: 'Save ' + name, name, types: ext ? ['.' + ext] : [] });
      if (!r) return 'cancel';
      await writeBytes(r.path, name, x.bytes);
      if (!quiet) toast('Saved ' + r.name + (x.crcOk === false ? ' (⚠ its checksum did not match: it may be damaged)' : ''), 4000);
      return x.crcOk === false ? 'saved, but its checksum did not match (the file may be damaged)' : 'saved';
    } catch (err) { if (!quiet) toast('Could not save ' + name + ': ' + err.message, 6000); return err.message; }
  }
  $('saveBtn').onclick = () => { const r = rows[curIndex()]; if (r && r.kind === 'f') saveOne(r.e); };

  async function extractList(list, what) {
    list = list.filter(e => !e.dir);
    if (!list.length) return;
    if (list.length === 1) { await saveOne(list[0]); return; }
    const total = list.reduce((s, e) => s + e.usize, 0);
    const stem = arc.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'archive';
    $('exTitle').textContent = 'Extract ' + plural(list.length, 'file');
    $('exMsg').textContent = 'Extract ' + what + ': ' + plural(list.length, 'file') + ', ' + Z.size(total) + ' in all. PortD has no way for a program to save into a folder you choose, so pick one of these:';
    $('exAllMsg').textContent = Host.inPortD ? 'Into Zip Viewer\'s own folder, keeping the folders inside: ' + (PortD.app.dataDir || 'P:\\User\\Config\\zip-viewer') + '\\Extracted\\' + stem + '. From there, move them with Files.' : 'Not available outside PortD: use One by one (each file is downloaded).';
    $('exAll').disabled = !Host.inPortD;
    $('exOne').disabled = list.length > ONE_BY_ONE_MAX;
    $('exOne').querySelector('span').textContent = list.length > ONE_BY_ONE_MAX ? 'Up to ' + ONE_BY_ONE_MAX + ' files at a time: this is ' + list.length + '.' : 'A Save dialog for each file, so you choose where each one goes.';
    const act = await dialog('exDlg', Host.inPortD ? '#exAll' : '#exOne');
    if (act === 'folder') await toFolder(list, stem);
    else if (act === 'one') await oneByOne(list);
  }
  async function oneByOne(list) {
    const problems = []; let n = 0;
    for (let i = 0; i < list.length; i++) {
      const r = await saveOne(list[i], true);
      if (r === 'cancel') { toast('Stopped: ' + plural(n, 'file') + ' saved, ' + (list.length - i) + ' not.', 4000); break; }
      if (r === 'saved') n++; else { if (/^saved/.test(r)) n++; problems.push([list[i].path, r]); }
    }
    if (problems.length) done('Saved ' + n + ' of ' + plural(list.length, 'file'), '', problems);
    else if (n === list.length) toast('Saved all ' + plural(n, 'file'));
  }
  async function toFolder(list, stem) {
    let dir = 'Extracted/' + stem, k = 2;
    while (await PortD.fs.exists(dir)) dir = 'Extracted/' + stem + ' (' + k++ + ')';
    let stop = false;
    $('progBar').max = list.length; $('progBar').value = 0;
    const prog = dialog('progDlg', '#progStop'); prog.then(() => { stop = true; });
    const used = new Set(), problems = []; let n = 0;
    for (let i = 0; i < list.length && !stop; i++) {
      const e = list[i];
      $('progMsg').textContent = (i + 1) + ' of ' + list.length + ': ' + e.path; $('progBar').value = i;
      let rel = e.path, c = 2;
      while (used.has(rel.toLowerCase())) rel = e.path.replace(/(\.[^./]+)?$/, ' (' + c++ + ')$1');
      used.add(rel.toLowerCase());
      try {
        const x = await Z.extract(arc.bytes, e);
        await writeBytes(dir + '/' + rel, rel, x.bytes);
        n++;
        if (x.crcOk === false) problems.push([e.path, 'Saved, but its checksum did not match: it may be damaged.']);
        if (rel !== e.path) problems.push([e.path, 'Another file had the same name, so this one was saved as "' + rel + '".']);
        if (e.unsafe) problems.push([e.name, 'This name tried to reach outside the folder; saved as "' + rel + '".']);
      } catch (err) { problems.push([e.path, err.message]); }
    }
    if (!$('progDlg').hidden) $('progDlg').done('finished');
    const full = (PortD.app.dataDir || 'P:\\User\\Config\\zip-viewer') + '\\' + dir.replace(/\//g, '\\');
    done((stop && n < list.length ? 'Stopped. ' : '') + 'Extracted ' + n + ' of ' + plural(list.length, 'file') + ' into:', n ? full : '', problems);
  }
  async function done(msg, path, problems) {
    $('doneTitle').textContent = problems.some(p => !/^Saved, but|same name|reach outside/.test(p[1])) ? 'Done, with problems' : 'Done';
    $('doneMsg').textContent = msg; $('donePath').textContent = path; $('donePath').hidden = !path;
    $('doneCopy').hidden = !path;
    $('doneCopy').onclick = async () => { if (await Host.copy(path)) toast('Copied the folder path'); };
    const ul = $('doneList'); ul.textContent = '';
    for (const [n, m] of problems) ul.append(h('li', null, h('b', null, n), ': ' + m));
    if (path) $('doneMsg').append(' ', h('span', { class: 'muted' }, 'Open Files and go there to move them where you want.'));
    await dialog('doneDlg', '[data-act=close]');
  }
  $('extractBtn').onclick = () => extractList(arc.entries.filter(e => ticked.has(e.index)), 'the ticked files');
  $('allBtn').onclick = () => extractList(arc.entries, 'everything in ' + arc.name);

  /* ---------- search ---------- */
  let st = 0;
  $('search').addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => { q = $('search').value.trim(); drawTree(); if (rows.length && curIndex() < 0) choose(0); }, 120); });
  $('search').addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('search').value) { e.preventDefault(); $('search').value = ''; q = ''; drawTree(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); treeEl.focus(); if (curIndex() < 0 && rows.length) choose(0); }
  });

  /* ---------- keys ---------- */
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (!ctrl || e.altKey || e.shiftKey) return;
    if (k === 'o') { e.preventDefault(); openFile(); }
    else if (k === 's' && arc) { e.preventDefault(); $('saveBtn').click(); }
    else if (k === 'f' && arc) { e.preventDefault(); $('search').focus(); $('search').select(); }
  });

  /* ---------- theme ---------- */
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); toast(THEMES[settings.theme][1]); };

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    Host.setTitle('Zip Viewer');
    const start = Host.startFile();
    if (start) await openPath(start); else $('openBtn2').focus();
    window.__zv = { get arc() { return arc; }, get rows() { return rows; }, get cur() { return cur; }, get ticked() { return ticked; }, ready: true };
  })();
})();
