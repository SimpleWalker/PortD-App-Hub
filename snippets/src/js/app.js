/* Snippets: the window. The list with search, tag filter and sort; the chosen snippet with Copy, Edit, Duplicate,
   Pin and Delete; editing that saves as you type; Import and Export of the whole library. */
(function () {
  'use strict';
  const S = window.Snippets, $ = id => document.getElementById(id);
  const listEl = $('list');
  const plural = (n, w, ws) => n.toLocaleString('en-GB') + ' ' + (n === 1 ? w : ws || w + 's');

  let settings = { theme: 'auto', sort: 'title', tag: '' };
  let lib = [];               // every snippet
  let shown = [];             // the ones in the list, in order
  let sel = null;             // id of the chosen snippet
  let editing = false;

  /* ---------- helpers ---------- */
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2200); }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const byId = id => lib.find(s => s.id === id) || null;
  const short = t => '"' + (t.length > 40 ? t.slice(0, 40) + '…' : t) + '"';
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, input, textarea, select')].filter(e => !e.disabled && e.offsetParent);
    (first ? ov.querySelector(first) : focusables()[0]).focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); if (back && back.focus && document.contains(back)) back.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b) done(b.dataset.act); else if (e.target === ov) done('cancel'); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done('cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        e.stopPropagation();
      };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
      dialog.done = done;
    });
  }
  /* a button that must be pressed twice within 3 seconds; returns true on the second press */
  const armed = new Map();
  function second(key, btn, label, idle) {
    if (armed.get(key)) { clearTimeout(armed.get(key)); armed.delete(key); if (btn) btn.textContent = idle; return true; }
    if (btn) btn.textContent = label;
    armed.set(key, setTimeout(() => { armed.delete(key); if (btn) btn.textContent = idle; }, 3000));
    return false;
  }
  function disarm(key, btn, idle) { if (armed.has(key)) { clearTimeout(armed.get(key)); armed.delete(key); if (btn) btn.textContent = idle; } }

  /* ---------- saving: the library is written soon after every change ---------- */
  let saveT = 0, savePending = false;
  function saveSoon(now) { savePending = true; clearTimeout(saveT); saveT = setTimeout(saveNow, now ? 0 : 400); }
  async function saveNow() {
    clearTimeout(saveT); if (!savePending) return;
    savePending = false;
    if (!await Host.saveData('library.json', S.toJSON(lib))) toast('Could not save the library.', 4000);
  }
  addEventListener('pagehide', () => { if (savePending) saveNow(); });
  addEventListener('visibilitychange', () => { if (document.hidden && savePending) saveNow(); });

  /* ---------- the list ---------- */
  function marked(text, words) {
    const span = h('span');
    if (!words.length) { span.textContent = text; return span; }
    const low = text.toLowerCase(), marks = [];
    for (const w of words) { let i = 0, j; while ((j = low.indexOf(w, i)) >= 0) { marks.push([j, j + w.length]); i = j + w.length; } }
    marks.sort((a, b) => a[0] - b[0]);
    let at = 0;
    for (const [a, b] of marks) { if (a < at) continue; span.append(text.slice(at, a), h('mark', null, text.slice(a, b))); at = b; }
    span.append(text.slice(at));
    return span;
  }
  function when(t) {
    if (!t) return 'never used';
    const d = Date.now() - t, m = 60000, hr = 60 * m, day = 24 * hr;
    if (d < m) return 'used just now';
    if (d < hr) return 'used ' + plural(Math.floor(d / m), 'minute') + ' ago';
    if (d < day) return 'used ' + plural(Math.floor(d / hr), 'hour') + ' ago';
    if (d < 30 * day) return 'used ' + plural(Math.floor(d / day), 'day') + ' ago';
    return 'used ' + new Date(t).toLocaleDateString('en-GB', { dateStyle: 'medium' });
  }
  function renderList(keepScroll) {
    const q = $('search').value.trim(), words = S.words(q);
    shown = S.view(lib, { q, tag: settings.tag, sort: settings.sort });
    const top = listEl.scrollTop, frag = document.createDocumentFragment();
    for (const s of shown) {
      const it = h('div', 'item' + (s.id === sel ? ' on' : '')); it.id = 'opt-' + s.id; it.dataset.id = s.id;
      it.setAttribute('role', 'option'); it.setAttribute('aria-selected', String(s.id === sel));
      const t = h('div', 't'); if (s.pinned) t.append(h('span', 'pin', '★ ')); t.append(marked(s.title, words)); it.append(t);
      const sub = h('div', 'sub muted');
      const bits = [s.lang, s.tags.map(x => '#' + x).join(' ')].filter(Boolean);
      sub.textContent = bits.join(' · ') || ' ';
      it.append(sub);
      const hit = S.hitLine(s, words);
      if (hit) { const m = marked(hit, words); m.className = 'hit'; it.append(m); }
      if (s.pinned) it.setAttribute('aria-label', s.title + ', pinned');
      frag.append(it);
    }
    listEl.textContent = ''; listEl.append(frag);
    if (keepScroll) listEl.scrollTop = top;
    listEl.setAttribute('aria-activedescendant', sel && shown.some(s => s.id === sel) ? 'opt-' + sel : '');
    $('count').textContent = shown.length === lib.length ? plural(lib.length, 'snippet') : shown.length + ' of ' + plural(lib.length, 'snippet');
  }
  function renderTags() {
    const sel0 = settings.tag, tags = S.tagCounts(lib), box = $('tagSel');
    box.textContent = '';
    box.append(new Option('All tags', ''));
    for (const t of tags) box.append(new Option('#' + t.name + ' (' + t.n + ')', t.name));
    if (sel0 && !tags.some(t => t.name.toLowerCase() === sel0.toLowerCase())) settings.tag = '';
    const cur = tags.find(t => t.name.toLowerCase() === settings.tag.toLowerCase());
    box.value = cur ? cur.name : '';
    const langs = $('langs'); langs.textContent = '';
    for (const l of [...new Set(lib.map(s => s.lang).filter(Boolean))].sort()) langs.append(new Option(l));
  }
  function scrollToSel() { const el = sel && document.getElementById('opt-' + sel); if (el) el.scrollIntoView({ block: 'nearest' }); }

  /* ---------- the chosen snippet ---------- */
  function renderDetail() {
    const s = byId(sel);
    $('view').hidden = !s || editing; $('edit').hidden = !s || !editing; $('empty').hidden = !!s;
    if (!s) {
      $('emptyTitle').textContent = lib.length ? 'No snippet chosen' : 'Your library is empty';
      $('emptyMsg').textContent = lib.length ? (shown.length ? 'Pick one from the list, or press New.' : 'Nothing matches. Clear the search or the tag to see everything.') : 'Press New to add your first snippet, or Import to bring in a library.';
      return;
    }
    if (editing) return;
    $('vTitle').textContent = s.title;
    const meta = $('vMeta'); meta.textContent = '';
    if (s.lang) meta.append(h('span', 'lang', s.lang));
    for (const t of s.tags) { const b = h('button', 'tag', '#' + t); b.title = 'Show only #' + t; b.onclick = () => setTag(t); meta.append(b); }
    meta.append(h('span', 'muted', when(s.used) + ' · ' + plural(s.body.split('\n').length, 'line')));
    $('vBody').textContent = s.body;
    $('pinBtn').setAttribute('aria-pressed', String(s.pinned)); $('pinBtn').textContent = s.pinned ? 'Unpin' : 'Pin';
    disarm('del', $('delBtn'), 'Delete');
  }
  function select(id, focusList) {
    if (editing && id !== sel) stopEdit();
    sel = id;
    for (const el of listEl.querySelectorAll('.item.on')) { el.classList.remove('on'); el.setAttribute('aria-selected', 'false'); }
    const el = id && document.getElementById('opt-' + id);
    if (el) { el.classList.add('on'); el.setAttribute('aria-selected', 'true'); listEl.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
    renderDetail();
    if (focusList) listEl.focus({ preventScroll: true });
  }
  function refresh() { renderTags(); renderList(true); renderDetail(); scrollToSel(); }

  /* ---------- actions ---------- */
  async function copy(s) {
    s = s || byId(sel); if (!s) return;
    s.used = Date.now(); saveSoon();
    if (await Host.copy(s.body)) toast('Copied ' + short(s.title));
    else { $('copyText').value = s.body; const p = dialog('copyDlg', '#copyText'); $('copyText').select(); await p; }
    renderList(true); renderDetail();
  }
  function clearFilters() { $('search').value = ''; setTag('', true); }
  function add(s) { lib.push(s); saveSoon(true); }
  function newSnippet() {
    const s = S.clean({ title: 'New snippet' });
    clearFilters(); add(s); sel = s.id; refresh(); startEdit(true);
  }
  function duplicate() {
    const s = byId(sel); if (!s) return;
    const c = S.clean(Object.assign({}, s, { id: S.newId(), title: s.title + ' (copy)', pinned: false, used: 0, created: Date.now(), updated: Date.now() }));
    add(c); sel = c.id; refresh();
    toast('Made a copy: ' + short(c.title));
  }
  function togglePin() {
    const s = byId(sel); if (!s) return;
    s.pinned = !s.pinned; s.updated = Date.now(); saveSoon(true); refresh();
    toast(s.pinned ? 'Pinned to the top' : 'Unpinned');
  }
  function del(fromKey) {
    const s = byId(sel); if (!s) return;
    if (!second('del', $('delBtn'), 'Click again to delete', 'Delete')) { if (fromKey) toast('Press Delete again to delete ' + short(s.title), 3000); return; }
    const i = shown.findIndex(x => x.id === s.id);
    lib = lib.filter(x => x !== s); saveSoon(true);
    const next = shown[i + 1] || shown[i - 1];
    sel = next && next.id !== s.id ? next.id : null;
    editing = false; refresh(); listEl.focus({ preventScroll: true });
    toast('Deleted ' + short(s.title));
  }
  function setTag(t, quiet) { settings.tag = t || ''; $('tagSel').value = t || ''; Host.saveSettings(settings); if (!quiet) filtered(); }

  /* ---------- editing: every change is saved as you type ---------- */
  function startEdit(isNew) {
    const s = byId(sel); if (!s) return;
    editing = true; renderDetail();
    $('eTitle').value = s.title; $('eTags').value = s.tags.join(', '); $('eLang').value = s.lang; $('eBody').value = s.body;
    $('eState').textContent = 'Changes are saved as you type.';
    $('eTitle').focus(); if (isNew) $('eTitle').select();
  }
  function stopEdit() {
    if (!editing) return;
    const s = byId(sel);
    if (s) { s.title = $('eTitle').value.trim() || 'Untitled'; s.tags = S.cleanTags($('eTags').value); }
    editing = false; saveSoon(true); refresh();
  }
  function edited() {
    const s = byId(sel); if (!s) return;
    s.title = $('eTitle').value.trim().slice(0, 200) || 'Untitled';
    s.tags = S.cleanTags($('eTags').value);
    s.lang = $('eLang').value.trim().slice(0, 40);
    s.body = $('eBody').value;
    s.updated = Date.now();
    saveSoon(); renderList(true);
    $('eState').textContent = 'Saved.';
  }
  for (const id of ['eTitle', 'eTags', 'eLang', 'eBody']) $(id).addEventListener('input', edited);
  $('eTags').addEventListener('change', () => renderTags());
  $('edit').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopEdit(); $('editBtn').focus(); }
    else if (e.key === 'Tab') {
      if (e.target.id === 'eBody' && !e.shiftKey && !e.ctrlKey && !tabOut) { e.preventDefault(); $('eBody').setRangeText('\t', $('eBody').selectionStart, $('eBody').selectionEnd, 'end'); edited(); }
      tabOut = false;
    }
  });
  /* Tab types a tab in the text; Ctrl+M first lets the next Tab move on (as in Windows text boxes) */
  let tabOut = false;
  $('eBody').addEventListener('keydown', e => { if (e.ctrlKey && e.key.toLowerCase() === 'm') { e.preventDefault(); tabOut = true; toast('Next Tab moves on'); } }, true);
  $('doneBtn').onclick = () => { stopEdit(); $('editBtn').focus(); };

  /* ---------- import and export ---------- */
  async function offerImport(name, text) {
    let got;
    try { got = S.readExport(text); }
    catch (e) { toast(name + ': ' + e.message, 6000); return; }
    const n = got.snippets.length;
    $('impMsg').textContent = name + ' holds ' + plural(n, 'snippet') + '. Your library has ' + plural(lib.length, 'snippet') + '.';
    $('impWarn').hidden = true;
    const rep = $('impReplace'); rep.textContent = 'Replace my library'; rep.disabled = !n;
    let armedRep = false;
    rep.onclick = e => {
      if (!armedRep && lib.length) { e.stopPropagation(); armedRep = true; rep.textContent = 'Click again to replace'; $('impWarn').hidden = false; $('impWarn').textContent = 'Replacing deletes the ' + plural(lib.length, 'snippet') + ' in your library now. Export it first if you may want them back.'; setTimeout(() => { armedRep = false; rep.textContent = 'Replace my library'; }, 3000); }
    };
    const act = await dialog('importDlg', '.dlg [data-act=add]');
    if (act === 'add') {
      const added = S.merge(lib, got.snippets); saveSoon(true); refresh();
      toast('Added ' + plural(added, 'snippet') + (n - added ? ' (' + (n - added) + ' already there)' : ''), 3500);
    } else if (act === 'replace') {
      lib = got.snippets; sel = null; editing = false; clearFilters(); saveSoon(true); refresh();
      toast('Your library now has the ' + plural(n, 'snippet') + ' from ' + name, 3500);
    }
  }
  async function importFile() {
    try { const f = await Host.openFile({ title: 'Import snippets', types: ['.json'] }); if (f) await offerImport(f.name, f.text); }
    catch (e) { toast(e.message, 4000); }
  }
  async function exportFile() {
    if (editing) stopEdit();
    try {
      const f = await Host.saveFile({ title: 'Export snippets', name: 'snippets.json', types: ['.json'], text: S.exportText(lib), mime: 'application/json' });
      if (f) toast('Exported ' + plural(lib.length, 'snippet') + ' to ' + f.name, 3000);
    } catch (e) { toast('Could not export: ' + e.message, 5000); }
  }
  async function openGiven(o) {
    try { const f = await Host.readPath(o.path, o.name); await offerImport(f.name, f.text); }
    catch (e) { toast('Could not open "' + o.name + '": ' + e.message, 5000); }
  }

  /* ---------- wiring ---------- */
  listEl.addEventListener('click', e => { const it = e.target.closest('.item'); if (it) select(it.dataset.id, true); });
  listEl.addEventListener('dblclick', e => { const it = e.target.closest('.item'); if (it) copy(byId(it.dataset.id)); });
  listEl.addEventListener('keydown', e => {
    if (!shown.length) return;
    const i = shown.findIndex(s => s.id === sel), page = Math.max(1, Math.floor(listEl.clientHeight / 52) - 1);
    const to = { ArrowDown: i + 1, ArrowUp: i < 0 ? 0 : i - 1, Home: 0, End: shown.length - 1, PageDown: i + page, PageUp: i - page }[e.key];
    if (to !== undefined) { e.preventDefault(); select(shown[Math.max(0, Math.min(shown.length - 1, to))].id, true); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Enter' && sel) { e.preventDefault(); copy(); }
    else if (e.key === 'Delete' && sel) { e.preventDefault(); del(true); }
    else if (e.key.toLowerCase() === 'p' && sel) { e.preventDefault(); togglePin(); }
  });
  listEl.addEventListener('focus', () => { if (!sel && shown.length) select(shown[0].id); });
  let st = 0;
  /* a search that hides the chosen snippet chooses its first result instead */
  function filtered() { renderList(); if (!shown.some(s => s.id === sel)) select(shown.length ? shown[0].id : null); else renderDetail(); }
  $('search').addEventListener('input', () => { clearTimeout(st); st = setTimeout(filtered, 120); });
  $('search').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if ($('search').value) { $('search').value = ''; filtered(); } else listEl.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); clearTimeout(st); renderList(); if (shown.length) select((shown.find(s => s.id === sel) || shown[0]).id, true); }
  });
  $('tagSel').addEventListener('change', () => setTag($('tagSel').value));
  $('sortSel').addEventListener('change', () => { settings.sort = $('sortSel').value; Host.saveSettings(settings); renderList(); scrollToSel(); });
  $('newBtn').onclick = newSnippet;
  $('copyBtn').onclick = () => copy();
  $('editBtn').onclick = () => startEdit();
  $('dupBtn').onclick = duplicate;
  $('pinBtn').onclick = togglePin;
  $('delBtn').onclick = () => del(false);
  $('importBtn').onclick = importFile;
  $('exportBtn').onclick = exportFile;
  $('helpBtn').onclick = () => dialog('helpDlg');

  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); toast(THEMES[settings.theme][1]); };

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    let run = null;
    if (ctrl && !e.shiftKey && !e.altKey) run = { f: () => { if (editing) stopEdit(); $('search').focus(); $('search').select(); }, d: () => { if (editing) stopEdit(); duplicate(); }, enter: () => { if (editing) stopEdit(); copy(); } }[k];
    else if (e.altKey && !ctrl && k === 'n') run = newSnippet;
    else if (e.key === 'F2' && sel && !editing) run = () => startEdit();
    else if (e.key === 'F1') run = () => dialog('helpDlg');
    if (!run) return;
    e.preventDefault(); run();
  });

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    if (settings.sort !== 'used') settings.sort = 'title';
    if (typeof settings.tag !== 'string') settings.tag = '';
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    $('sortSel').value = settings.sort;
    const saved = await Host.loadData('library.json');
    if (saved === null) { lib = S.seeds(); saveSoon(true); }
    else {
      try { lib = S.cleanLibrary(JSON.parse(saved)); }
      catch (e) {
        lib = [];
        await Host.saveData('library-unreadable-' + Date.now() + '.json', saved);   /* keep what was there; never overwrite it silently */
        toast('The library file could not be read. It was kept as library-unreadable-….json and a new one started.', 7000);
      }
    }
    Host.setTitle('Snippets');
    refresh();
    if (shown.length) select(shown[0].id);
    listEl.focus({ preventScroll: true });
    Host.onOpenFile(openGiven);
    const start = Host.startFile();
    if (start) openGiven(start);
    window.__sn = { get lib() { return lib; }, get sel() { return sel; }, get shown() { return shown; }, get editing() { return editing; }, saveNow, ready: true };
  })();
})();
