/* Markdown Editor: the window. Source, split and preview views; a formatting toolbar and shortcuts; pictures from the
   drive; links that can only open the web or email; Export as HTML; and drafts that survive a closed window. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const src = $('src'), prev = $('prev'), panes = $('panes');
  const P = window.PortD && typeof window.PortD === 'object' ? window.PortD : null;
  const IMG = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
  const PIC_TYPES = Object.keys(IMG).map(x => '.' + x);
  const WIN = Math.random().toString(36).slice(2, 10);          /* this window's draft name */

  let settings = { theme: 'auto', view: 'split' };
  /* the document: path is null for a new one; granted is whether this window may write to path */
  let file = { name: 'Untitled.md', path: null, granted: false, eol: '\n' }, saved = '', dirty = false;

  /* ---------- small helpers ---------- */
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2400); }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const extOf = n => { const m = /\.([^.\\/]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  const base = p => String(p).split(/[\\/]/).pop();
  const stem = n => n.replace(/\.[^.]+$/, '');
  /* drive paths */
  const Path = {
    norm(p) { const parts = []; for (const s of String(p).replace(/\//g, '\\').split('\\')) { if (!s || s === '.') continue; if (s === '..') { if (parts.length > 1) parts.pop(); } else parts.push(s); } return parts.join('\\'); },
    dir(p) { return p.slice(0, p.lastIndexOf('\\')); },
    abs(ref, from) { return /^[a-z]:[\\/]/i.test(ref) ? Path.norm(ref) : from ? Path.norm(Path.dir(from) + '\\' + ref) : null; },
    rel(target, from) {
      const a = Path.dir(from).split('\\'), b = target.split('\\');
      if (a[0].toLowerCase() !== b[0].toLowerCase()) return target.replace(/\\/g, '/');
      let k = 0; while (k < a.length && k < b.length - 1 && a[k].toLowerCase() === b[k].toLowerCase()) k++;
      return '../'.repeat(a.length - k) + b.slice(k).join('/');
    }
  };
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, input, textarea, select')].filter(e => !e.disabled && e.offsetParent);
    (first ? ov.querySelector(first) : focusables()[0]).focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); if (back && back.focus) back.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b) done(b.dataset.act); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done('cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && ov.querySelector('[data-act=ok]')) { e.preventDefault(); done('ok'); }
        e.stopPropagation();
      };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
    });
  }
  /* an in-app question: buttons [{ label, act, primary, danger }]; resolves the act, or 'cancel' */
  function ask(title, msg, buttons) {
    $('askTitle').textContent = title; $('askMsg').textContent = msg;
    const acts = $('askActs'); acts.textContent = '';
    for (const b of buttons) { const el = h('button', 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), b.label); el.dataset.act = b.act; acts.append(el); }
    return dialog('askDlg', '#askActs .primary');
  }

  /* ---------- the document ---------- */
  const text = () => src.value;
  function setDoc(t, f, isDirty) {
    file = Object.assign({ name: 'Untitled.md', path: null, granted: false, eol: '\n' }, f);
    file.eol = /\r\n/.test(t) ? '\r\n' : '\n';
    src.value = t.replace(/\r\n/g, '\n');
    saved = isDirty ? null : src.value; dirty = !!isDirty;
    src.setSelectionRange(0, 0); src.scrollTop = 0; prev.scrollTop = 0;
    changed(true);
  }
  function changed(now) {
    dirty = saved === null || src.value !== saved;
    const title = (dirty ? '*' : '') + file.name + ' - Markdown Editor';
    if (document.title !== title) Host.setTitle(title);
    $('stFile').textContent = file.path || file.name;
    $('stState').textContent = dirty ? 'Unsaved changes' : file.path ? 'Saved' : '';
    $('stState').classList.toggle('dirty', dirty);
    clearTimeout(changed.t);
    if (now) render(); else changed.t = setTimeout(render, 150);
    draftSoon();
    pos();
  }
  function pos() {
    const before = src.value.slice(0, src.selectionStart), line = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
    $('stPos').textContent = 'Line ' + line + ', column ' + col;
    const words = (src.value.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;
    $('stWords').textContent = words.toLocaleString('en-GB') + ' word' + (words === 1 ? '' : 's');
  }
  src.addEventListener('input', () => changed());
  src.addEventListener('keyup', pos); src.addEventListener('click', pos);

  async function confirmLeave(what) {
    if (!dirty) return true;
    const a = await ask('Save changes?', 'Save the changes to ' + file.name + ' before ' + what + '?', [{ label: 'Cancel', act: 'cancel' }, { label: "Don't save", act: 'discard', danger: true }, { label: 'Save', act: 'save', primary: true }]);
    if (a === 'save') return save();
    if (a === 'discard') { await Host.removeData('drafts/' + WIN + '.json'); return true; }
    return false;
  }
  async function newDoc() { if (await confirmLeave('starting a new document')) { setDoc('', {}); src.focus(); } }
  async function openDoc() {
    if (!await confirmLeave('opening another file')) return;
    try { const f = await Host.openFile({ title: 'Open', types: ['.md', '.markdown', '.txt'] }); if (f) { setDoc(f.text, { name: f.name, path: f.path, granted: !!f.path }); src.focus(); } }
    catch (e) { toast(e.message, 4000); }
  }
  const out = () => file.eol === '\r\n' ? src.value.replace(/\n/g, '\r\n') : src.value;
  async function save() {
    if (!file.path || !file.granted) return saveAs();
    try { await Host.writePath(file.path, out()); return didSave(); }
    catch (e) { toast('Could not save: ' + e.message, 5000); return false; }
  }
  async function saveAs() {
    try {
      const f = await Host.saveFile({ title: 'Save as', name: file.path ? file.name : (firstHeading() || 'Untitled') + '.md', types: ['.md', '.markdown'], text: out(), mime: 'text/markdown' });
      if (!f) return false;
      file.name = f.name; file.path = f.path; file.granted = !!f.path;
      return didSave();
    } catch (e) { toast('Could not save: ' + e.message, 5000); return false; }
  }
  async function didSave() {
    saved = src.value; changed(true); src.focus({ preventScroll: true });
    await Host.removeData('drafts/' + WIN + '.json');
    toast('Saved ' + file.name);
    return true;
  }
  const firstHeading = () => { const m = /^#{1,6}[ \t]+(.+?)[ \t#]*$/m.exec(src.value); return m ? m[1].replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) : ''; };

  /* ---------- drafts: unsaved work kept in the data folder, because a window can be closed without asking ---------- */
  let draftT = 0;
  function draftSoon() { clearTimeout(draftT); draftT = setTimeout(writeDraft, 800); }
  async function writeDraft() {
    if (!dirty) { await Host.removeData('drafts/' + WIN + '.json'); return; }
    await Host.saveData('drafts/' + WIN + '.json', JSON.stringify({ win: WIN, name: file.name, path: file.path, text: src.value, eol: file.eol, time: Date.now(), alive: Date.now() }));
  }
  setInterval(() => { if (dirty) writeDraft(); }, 5000);         /* the heartbeat: a draft whose window is gone stops being refreshed */
  addEventListener('pagehide', () => { if (dirty) writeDraft(); });
  async function orphanDrafts() {
    const list = [];
    for (const n of await Host.listData('drafts')) {
      if (!/\.json$/.test(n) || n === WIN + '.json') continue;
      try { const d = JSON.parse(await Host.loadData('drafts/' + n)); if (d && typeof d.text === 'string' && Date.now() - d.alive > 15000) list.push(Object.assign(d, { file: n })); } catch (e) { /* unreadable: leave it */ }
    }
    return list.sort((a, b) => b.time - a.time);
  }
  async function offerRecovery(prefer) {
    const list = await orphanDrafts();
    if (!list.length) return;
    const d = list.find(x => prefer && x.path && x.path.toLowerCase() === prefer.toLowerCase()) || list[0];
    const b = $('banner'); b.textContent = '';
    const when = new Date(d.time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    b.append(h('span', 'msg', 'Unsaved changes to ' + (d.path || d.name) + ' from ' + when + ' were kept when its window closed.' + (list.length > 1 ? ' (' + (list.length - 1) + ' more after this one.)' : '')));
    const rec = h('button', 'btn primary', 'Recover'), dis = h('button', 'btn', 'Discard');
    rec.onclick = async () => {
      if (dirty && !await confirmLeave('recovering the other changes')) return;
      const same = file.path && d.path && file.path.toLowerCase() === d.path.toLowerCase() && file.granted;
      setDoc(d.text, { name: d.name, path: d.path, granted: same }, true);
      file.eol = d.eol || '\n';
      await Host.removeData('drafts/' + d.file); b.hidden = true;
      toast(same || !d.path ? 'Recovered. Save to keep it.' : 'Recovered. Save will ask where, as this window was not given ' + d.name + '.', 4500);
      writeDraft(); offerRecovery();
    };
    dis.onclick = async () => { await Host.removeData('drafts/' + d.file); b.hidden = true; toast('Discarded'); offerRecovery(); };
    b.append(rec, dis); b.hidden = false;
  }

  /* ---------- pictures ----------
     The editor may read only files it is given. A picture chosen in its Open dialog (or saved by it) is kept in its
     data folder, under the path the text names, so it shows again next time and goes into exported HTML. */
  const pics = new Map();       /* lower-case drive path -> data URL, or 'none' when not kept */
  const hash = s => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(16).padStart(8, '0'); };
  const picKey = p => 'pictures/' + hash(p.toLowerCase()) + '.json';
  function toDataUrl(d, name) { return /^data:/.test(d) ? d : 'data:' + (IMG[extOf(name)] || 'image/svg+xml') + ';base64,' + btoa(unescape(encodeURIComponent(d))); }
  async function keepPicture(path, url) { pics.set(path.toLowerCase(), url); if (url.length < 6 * 1048576) await Host.saveData(picKey(path), JSON.stringify({ path, url })); }
  async function loadKept(path) {
    const k = path.toLowerCase();
    if (pics.has(k)) return pics.get(k);
    pics.set(k, 'loading');
    let url = 'none';
    try { const d = await Host.loadData(picKey(path)); if (d) { const j = JSON.parse(d); if (j.path.toLowerCase() === k) url = j.url; } } catch (e) { url = 'none'; }
    pics.set(k, url);
    return url;
  }
  function picRef(s) { let r = s; try { r = decodeURI(s); } catch (e) { /* keep as written */ } return r; }
  /* the element the preview shows for ![alt](src) */
  function image(srcRef, alt, title) {
    const ref = picRef(srcRef);
    if (/^data:image\//i.test(ref)) { const i = h('img'); i.src = ref; i.alt = alt; return i; }
    const box = h('span', 'pic');
    if (/^(https?:)?\/\//i.test(ref)) { box.append('🖼 ' + (alt || 'Picture') + ': pictures from the web cannot be shown, because PortD programs have no network.'); return box; }
    const path = P ? Path.abs(ref, file.path) : null;
    if (!P) { box.append('🖼 ' + (alt || ref) + ': pictures on the PortD drive show only inside PortD.'); return box; }
    if (!path) { box.append('🖼 ' + (alt || ref) + ': save the document first, so the picture\'s place can be worked out.'); return box; }
    const k = path.toLowerCase(), url = pics.get(k);
    if (url && url !== 'none' && url !== 'loading') { const i = h('img'); i.src = url; i.alt = alt; if (title) i.title = title; return i; }
    if (url === undefined) loadKept(path).then(() => render());
    box.append('🖼 ' + base(path) + (url === 'none' ? ' has not been shared with the editor.' : ''));
    if (url === 'none') {
      const b = h('button', 'btn', 'Show picture…');
      b.onclick = async () => {
        try {
          const f = await P.ui.openFile({ title: 'Find ' + base(path), types: PIC_TYPES });
          if (!f) return;
          await keepPicture(path, toDataUrl(await P.fs.read(f.path), f.name)); render();
          if (f.path.toLowerCase() !== k) toast('Showing ' + f.name + ' for ' + base(path));
        } catch (e) { toast(e.message, 4000); }
      };
      box.append(b);
    }
    return box;
  }
  function refFor(path) { const r = file.path ? Path.rel(path, file.path) : path.replace(/\\/g, '/'); return /[\s()<>]/.test(r) ? '<' + r + '>' : r; }
  async function insertPicture() {
    if (!P) { toast('Inside PortD this picks a picture from the drive. Here, drop a picture on the text instead.', 4000); return; }
    try {
      const a = src.selectionStart, b = src.selectionEnd;
      const f = await P.ui.openFile({ title: 'Insert a picture', types: PIC_TYPES });
      if (!f) return;
      await keepPicture(f.path, toDataUrl(await P.fs.read(f.path), f.name));
      src.focus(); src.setSelectionRange(a, b);
      insert('![' + stem(f.name) + '](' + refFor(f.path) + ')');
      src.focus();
    } catch (e) { toast(e.message, 4000); }
  }
  /* a picture dropped or pasted from the computer: saved on the drive (asking where), then linked */
  async function pictureFromComputer(blob, name) {
    const url = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    if (!P) { insert('![' + stem(name) + '](' + url + ')'); toast('Outside PortD the picture is put into the text itself.'); return; }
    const a = src.selectionStart, b = src.selectionEnd;
    const f = await P.ui.saveFile({ title: 'Save the picture on the drive', name, types: ['.' + (extOf(name) || 'png')] });
    if (!f) return;
    await P.fs.write(f.path, url, 'dataurl');
    await keepPicture(f.path, url);
    src.focus(); src.setSelectionRange(a, b);
    insert('![' + stem(f.name) + '](' + refFor(f.path) + ')');
  }
  src.addEventListener('paste', e => {
    const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(x => x.kind === 'file' && /^image\//.test(x.type));
    if (!it) return;
    e.preventDefault();
    pictureFromComputer(it.getAsFile(), 'pasted picture.' + (it.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg'));
  });
  $('app').addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  $('app').addEventListener('drop', async e => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    if (/^image\//.test(f.type) || IMG[extOf(f.name)]) { src.focus(); pictureFromComputer(f, f.name); return; }
    if (await confirmLeave('opening ' + f.name)) { const d = await Host.readDropped(f); setDoc(d.text, { name: d.name }); }
  });

  /* ---------- the preview ---------- */
  let tree = [];
  function render() {
    tree = MD.parse(src.value);
    const frag = MD.toDOM(tree, document, { image });
    prev.textContent = '';
    if (!src.value.trim()) prev.append(h('p', 'empty', 'The preview shows here as you write.'));
    prev.append(frag);
  }
  prev.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    e.preventDefault();
    const kind = a.dataset.kind, href = a.dataset.href;
    if (kind === 'web') Host.openUrl(href).catch(err => toast(err.message, 4000));
    else if (kind === 'anchor') { const t = prev.querySelector('[id="' + CSS.escape(decodeURIComponent(href.slice(1))) + '"]'); if (t) t.scrollIntoView({ block: 'start' }); else toast('There is no heading "' + href.slice(1) + '" in this document'); }
    else if (kind === 'file') toast('This links to a file on the drive (' + href + '). Open it from Files.', 4000);
  });
  /* the preview follows the source's scrolling */
  src.addEventListener('scroll', () => { if (settings.view !== 'split') return; const r = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight); prev.scrollTop = r * (prev.scrollHeight - prev.clientHeight); }, { passive: true });

  /* ---------- export ---------- */
  async function exportHtml() {
    const refs = [];
    (function walk(nodes) { for (const n of nodes) { if (n.t === 'img') refs.push(n.src); for (const k of ['c', 'items', 'head', 'rows']) if (Array.isArray(n[k])) walk(n[k].flat ? n[k].flat(2) : n[k]); } })(tree);
    if (P) for (const r of refs) { const p = Path.abs(picRef(r), file.path); if (p) await loadKept(p); }
    let missing = 0;
    const body = MD.toHTML(tree, { image: r => {
      const ref = picRef(r);
      if (/^data:image\//i.test(ref)) return ref;
      const p = P ? Path.abs(ref, file.path) : null, u = p && pics.get(p.toLowerCase());
      if (u && u !== 'none' && u !== 'loading') return u;
      missing++; return null;
    } });
    const title = MD.title(tree) || stem(file.name);
    const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + MD.escape(title) + '</title>\n<style>\n' + EXPORT_CSS + '</style>\n</head>\n<body>\n<article>\n' + body + '</article>\n</body>\n</html>\n';
    try {
      const f = await Host.saveFile({ title: 'Export as HTML', name: stem(file.name) + '.html', types: ['.html'], text: html, mime: 'text/html' });
      if (f) toast('Exported ' + f.name + (missing ? '. ' + missing + ' picture' + (missing > 1 ? 's were' : ' was') + ' not shared with the editor and left out.' : ''), missing ? 5000 : 2500);
    } catch (e) { toast('Could not export: ' + e.message, 5000); }
  }
  const EXPORT_CSS = 'body{margin:0;background:#fff;color:#1d2330;font:16px/1.6 "Segoe UI",system-ui,sans-serif}\narticle{max-width:46em;margin:0 auto;padding:24px 20px 48px}\nh1,h2{border-bottom:1px solid #d5dae2;padding-bottom:.2em}\ncode{font:.88em ui-monospace,Consolas,monospace;background:#eef1f5;padding:.1em .35em;border-radius:4px}\npre{background:#eef1f5;padding:10px 12px;border-radius:6px;overflow:auto}\npre code{background:none;padding:0}\nblockquote{margin:.8em 0;padding:0 1em;border-left:4px solid #c3cad6;color:#535c6c}\nimg{max-width:100%}\ntable{border-collapse:collapse}\nth,td{border:1px solid #d5dae2;padding:4px 10px}\nth{background:#f3f5f8}\nli.task{list-style:none;margin-left:-1.3em}\n.missing{color:#8a1c1c;font-style:italic}\n@media (prefers-color-scheme:dark){body{background:#1a1e26;color:#e6e9ef}code,pre{background:#262c38}th{background:#232833}a{color:#8fb6ff}}\n';

  /* ---------- editing commands ---------- */
  /* replaces the selection, keeping the browser's own undo */
  function insert(t, selFrom, selTo) {
    src.focus();
    const start = src.selectionStart;
    if (!document.execCommand('insertText', false, t)) src.setRangeText(t, src.selectionStart, src.selectionEnd, 'end');
    if (selFrom !== undefined) src.setSelectionRange(start + selFrom, start + (selTo === undefined ? selFrom : selTo));
    changed();
  }
  function wrap(mark, placeholder) {
    const a = src.selectionStart, b = src.selectionEnd, v = src.value, sel = v.slice(a, b);
    if (sel && sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= mark.length * 2) { insert(sel.slice(mark.length, -mark.length), 0, sel.length - 2 * mark.length); return; }
    if (v.slice(a - mark.length, a) === mark && v.slice(b, b + mark.length) === mark) { src.setSelectionRange(a - mark.length, b + mark.length); insert(sel, 0, sel.length); return; }
    const body = sel || placeholder;
    insert(mark + body + mark, mark.length, mark.length + body.length);
  }
  /* applies a change to each whole line in the selection */
  function lines(fn) {
    const v = src.value, a = v.lastIndexOf('\n', src.selectionStart - 1) + 1;
    let b = v.indexOf('\n', Math.max(src.selectionEnd - (src.selectionEnd > src.selectionStart && v[src.selectionEnd - 1] === '\n' ? 1 : 0), src.selectionStart)); if (b < 0) b = v.length;
    const ls = v.slice(a, b).split('\n'), next = fn(ls);
    src.setSelectionRange(a, b);
    const t = next.join('\n');
    insert(t, 0, t.length);
  }
  const LIST = /^(\s*)([-*+]|\d+[.)])(\s+\[[ xX]\])?\s+/;
  function prefix(kind) {
    lines(ls => {
      const has = l => kind === 'quote' ? /^\s*>\s?/.test(l) : kind === 'ul' ? /^\s*[-*+]\s+(?!\[[ xX]\])/.test(l) : kind === 'ol' ? /^\s*\d+[.)]\s+/.test(l) : /^\s*[-*+]\s+\[[ xX]\]\s+/.test(l);
      const all = ls.filter(l => l.trim()).every(has);
      let n = 0;
      return ls.map(l => {
        if (!l.trim() && ls.length > 1) return l;
        if (all) return kind === 'quote' ? l.replace(/^(\s*)>\s?/, '$1') : l.replace(LIST, '$1');
        const ind = /^\s*/.exec(l)[0], body = kind === 'quote' ? l.replace(/^\s*/, '') : l.replace(LIST, '').replace(/^\s*/, '');
        if (kind === 'quote') return ind + '> ' + body;
        return ind + (kind === 'ul' ? '- ' : kind === 'ol' ? (++n) + '. ' : '- [ ] ') + body;
      });
    });
  }
  function heading() {
    lines(ls => ls.map(l => { const m = /^(#{1,6})\s+/.exec(l), n = m ? m[1].length : 0, body = l.replace(/^#{1,6}\s+/, ''); return n >= 3 ? body : '#'.repeat(n + 1) + ' ' + body; }));
  }
  async function link() {
    const a = src.selectionStart, b = src.selectionEnd, sel = src.value.slice(a, b), isUrl = /^(https?:\/\/|mailto:|www\.)/i.test(sel);
    $('linkText').value = isUrl ? '' : sel; $('linkUrl').value = isUrl ? sel : ''; $('linkErr').textContent = '';
    for (;;) {
      if (await dialog('linkDlg', isUrl || !sel ? (isUrl ? '#linkText' : '#linkText') : '#linkUrl') !== 'ok') { src.focus(); return; }
      let url = $('linkUrl').value.trim(); const label = $('linkText').value.trim() || url;
      if (/^www\./i.test(url)) url = 'https://' + url;
      if (!url) { $('linkErr').textContent = 'Enter an address.'; continue; }
      if (MD.safeUrl(url).kind === 'blocked') { $('linkErr').textContent = 'Only web (https://…), email (mailto:…) and #heading links can be followed in the preview.'; continue; }
      src.setSelectionRange(a, b);
      insert('[' + label.replace(/[[\]]/g, '\\$&') + '](' + (/[\s()]/.test(url) ? '<' + url + '>' : url) + ')');
      return;
    }
  }
  const CMDS = {
    bold: () => wrap('**', 'bold text'), italic: () => wrap('*', 'italic text'), strike: () => wrap('~~', 'struck text'), code: () => wrap('`', 'code'),
    heading, ul: () => prefix('ul'), ol: () => prefix('ol'), task: () => prefix('task'), quote: () => prefix('quote'), link, picture: insertPicture,
    table: () => { const lead = src.selectionStart && src.value[src.selectionStart - 1] !== '\n' ? '\n\n' : ''; insert(lead + '| Column 1 | Column 2 |\n| --- | --- |\n| Text | Text |\n', lead.length + 2, lead.length + 10); },
    codeblock: () => { const sel = src.value.slice(src.selectionStart, src.selectionEnd), lead = src.selectionStart && src.value[src.selectionStart - 1] !== '\n' ? '\n' : ''; insert(lead + '```\n' + (sel || 'code') + '\n```\n', lead.length + 4, lead.length + 4 + (sel || 'code').length); },
    hr: () => { const lead = src.selectionStart && src.value[src.selectionStart - 1] !== '\n' ? '\n' : ''; insert(lead + '\n---\n\n'); }
  };
  $('fmtBar').addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b) CMDS[b.dataset.cmd](); });

  /* keys inside the text: lists continue on Enter, Tab indents list items, Esc lets Tab leave */
  let escaped = false;
  src.addEventListener('keydown', e => {
    if (e.key === 'Escape') { escaped = true; return; }
    if (e.key === 'Tab' && escaped) { escaped = false; return; }
    escaped = false;
    const v = src.value, a = src.selectionStart, ls = v.lastIndexOf('\n', a - 1) + 1, line = v.slice(ls, v.indexOf('\n', a) < 0 ? v.length : v.indexOf('\n', a));
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && src.selectionStart === src.selectionEnd) {
      const m = /^(\s*)([-*+]|(\d+)([.)]))(\s+\[[ xX]\])?(\s+)/.exec(line) || /^(\s*)(>)()()()(\s?)/.exec(line);
      if (!m) return;
      e.preventDefault();
      if (line.slice(m[0].length).trim() === '' && a === ls + line.length) { src.setSelectionRange(ls, a); if (!document.execCommand('delete')) src.setRangeText('', ls, a, 'end'); src.setSelectionRange(ls, ls); changed(); return; }        /* an empty item ends the list */
      const marker = m[2] === '>' ? '> ' : m[1] + (m[3] ? (+m[3] + 1) + m[4] : m[2]) + (m[5] ? ' [ ]' : '') + m[6];
      insert('\n' + marker);
      return;
    }
    if (e.key === 'Tab' && LIST.test(line)) {
      e.preventDefault();
      lines(l => l.map(x => !LIST.test(x) ? x : e.shiftKey ? x.replace(/^ {1,2}|^\t/, '') : '  ' + x));
    }
  });

  /* ---------- views, theme, keys ---------- */
  function setView(v) {
    settings.view = v; panes.className = 'panes ' + v;
    for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
    Host.saveSettings(settings);
    (v === 'preview' ? prev : src).focus({ preventScroll: true });
  }
  for (const b of document.querySelectorAll('[data-view]')) b.onclick = () => setView(b.dataset.view);
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); toast(THEMES[settings.theme][1]); };
  $('newBtn').onclick = newDoc; $('openBtn').onclick = openDoc; $('saveBtn').onclick = save; $('saveAsBtn').onclick = saveAs; $('exportBtn').onclick = exportHtml;
  $('helpBtn').onclick = () => dialog('helpDlg');
  document.addEventListener('keydown', e => {
    if (document.querySelector('.ov:not([hidden])')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), digit = /^Digit(\d)$/.exec(e.code || '');
    let run = null;
    if (ctrl && !e.shiftKey && !e.altKey) run = { o: openDoc, s: save, b: CMDS.bold, i: CMDS.italic, k: CMDS.link, e: CMDS.code }[k];
    else if (ctrl && e.shiftKey && !e.altKey) run = k === 's' ? saveAs : k === 'h' ? CMDS.heading : k === 'e' ? () => setView({ source: 'split', split: 'preview', preview: 'source' }[settings.view]) : digit ? { 7: CMDS.ol, 8: CMDS.ul, 9: CMDS.task }[digit[1]] : null;
    else if (e.key === 'F1') run = () => dialog('helpDlg');
    if (!run) return;
    e.preventDefault();
    if (/^(bold|italic|link|code|heading)$/.test(run.name) || [CMDS.bold, CMDS.italic, CMDS.code, CMDS.heading, CMDS.ol, CMDS.ul, CMDS.task, CMDS.link].includes(run)) { if (settings.view === 'preview') setView('split'); }
    run();
  });

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    setView(settings.view in { source: 1, split: 1, preview: 1 } ? settings.view : 'split');
    const start = Host.startFile();
    if (start) {
      try { const f = await Host.readPath(start.path, start.name); setDoc(f.text, { name: f.name, path: f.path, granted: true }); }
      catch (e) { setDoc('', {}); toast('Could not open "' + start.name + '": ' + e.message, 5000); }
    } else setDoc('', {});
    src.focus();
    offerRecovery(start && start.path);
    window.__md = { get file() { return file; }, get dirty() { return dirty; }, get pics() { return pics; }, WIN, writeDraft };
  })();
})();
