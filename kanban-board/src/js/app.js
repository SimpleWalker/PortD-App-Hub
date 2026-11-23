/* Kanban Board: the window. Boards, columns and cards; drag and drop with pointer events (mouse, pen, touch),
   keyboard moves and a Move to menu; the card dialog that saves as you type; archive, import and export.
   Each board is saved on its own (boards/<id>.json) soon after every change. */
(function () {
  'use strict';
  const K = window.Kanban, $ = id => document.getElementById(id);
  const boardEl = $('board');
  const num = n => n.toLocaleString('en-GB');
  const plural = (n, w, ws) => num(n) + ' ' + (n === 1 ? w : ws || w + 's');

  let settings = { theme: 'auto', current: '' };
  let index = [];          // [{ id, name }]
  let B = null;            // the open board
  const filter = { q: '', label: '', due: '' };

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2400); }
  const say = t => { $('say').textContent = ''; setTimeout(() => { $('say').textContent = t; }, 30); };
  const labelName = k => (K.LABELS.find(l => l[0] === k) || [, ''])[1];
  const short = t => '"' + (t.length > 40 ? t.slice(0, 40) + '…' : t) + '"';
  const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  const DUE = { overdue: 'Overdue', today: 'Due today', soon: 'Due soon', later: 'Due' };

  /* dialogs: focus moves in, Tab stays inside, Esc closes, focus goes back */
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, input, textarea, select, [tabindex="0"]')].filter(e => !e.disabled && e.offsetParent);
    const f = first ? ov.querySelector(first) : focusables()[0]; if (f) f.focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); const to = (ov.onclose && ov.onclose()) || back; if (to && to.focus && document.contains(to)) to.focus(); else focusBoard(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b && ov.contains(b)) done(b.dataset.act); else if (e.target === ov) done('cancel'); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done('cancel'); }
        else if (e.key === 'Tab') { const f = focusables(), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
        e.stopPropagation();
      };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
      ov.done = done;
    });
  }
  async function askName(title, value, okLabel) {
    $('nameTitle').textContent = title; $('nameIn').value = value || ''; $('nameOk').textContent = okLabel || 'OK';
    $('nameIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('nameDlg').done('ok'); } };
    const p = dialog('nameDlg', '#nameIn'); $('nameIn').select();
    return (await p) === 'ok' ? $('nameIn').value.trim() : null;
  }
  async function confirmIt(title, msg, okLabel) {
    $('confTitle').textContent = title; $('confMsg').textContent = msg; $('confOk').textContent = okLabel;
    return (await dialog('confirmDlg', '[data-act=cancel]')) === 'ok';
  }

  /* ---------- a small pop-up menu: arrow keys, Enter, Esc ---------- */
  const menuEl = $('menu');
  let menuBack = null, menuAnchor = null;
  /* anchor: what the menu opens beside; back: what gets the keyboard when it closes (the anchor if not given) */
  function openMenu(anchor, items, back) {
    menuEl.textContent = ''; menuAnchor = anchor; menuBack = back || anchor;
    for (const it of items) {
      if (it === '-') { menuEl.append(h('div', { class: 'msep', role: 'separator' })); continue; }
      const b = h('button', { class: 'mi' + (it.danger ? ' danger' : ''), role: 'menuitem', tabindex: '-1', disabled: it.disabled || null }, it.label);
      b.onclick = () => { closeMenu(); it.run(); };
      menuEl.append(b);
    }
    menuEl.hidden = false;
    const r = anchor.getBoundingClientRect(), mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
    menuEl.style.left = Math.max(4, Math.min(innerWidth - mw - 4, r.left)) + 'px';
    menuEl.style.top = (r.bottom + mh + 4 > innerHeight ? Math.max(4, r.top - mh - 2) : r.bottom + 2) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    const first = menuEl.querySelector('.mi:not(:disabled)'); if (first) first.focus();
  }
  function closeMenu(keepFocus) {
    if (menuEl.hidden) return;
    menuEl.hidden = true;
    if (menuAnchor) menuAnchor.setAttribute('aria-expanded', 'false');
    if (menuBack && !keepFocus && document.contains(menuBack)) menuBack.focus();
  }
  menuEl.addEventListener('keydown', e => {
    const items = [...menuEl.querySelectorAll('.mi:not(:disabled)')], i = items.indexOf(document.activeElement);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
    e.stopPropagation();
  });
  document.addEventListener('pointerdown', e => { if (!menuEl.hidden && !menuEl.contains(e.target)) closeMenu(true); }, true);

  /* ---------- saving: each board to its own file, soon after every change ---------- */
  let saveT = 0, pending = false;
  function changed() { pending = true; clearTimeout(saveT); saveT = setTimeout(saveNow, 400); }
  async function saveNow() {
    clearTimeout(saveT); if (!pending || !B) return;
    pending = false;
    if (!await Host.saveData('boards/' + B.id + '.json', JSON.stringify(B, null, 1))) toast('Could not save the board.', 4000);
  }
  const saveIndex = () => Host.saveData('boards.json', JSON.stringify({ v: 1, boards: index }, null, 1));
  addEventListener('pagehide', () => { if (pending) saveNow(); });
  addEventListener('visibilitychange', () => { if (document.hidden && pending) saveNow(); });

  /* ---------- drawing the board ---------- */
  const filtering = () => !!(filter.q || filter.label || filter.due);
  function cardEl(c, col) {
    const p = K.progress(c), due = K.dueState(c, today);
    const bits = [c.title];
    if (c.label) bits.push(labelName(c.label) + ' label');
    if (c.due) bits.push((DUE[due] || 'Due') + ' ' + fmtDay(c.due));
    if (p.all) bits.push(p.done + ' of ' + p.all + ' checklist items done');
    if (c.notes) bits.push('has notes');
    const el = h('div', { class: 'card' + (c.label ? ' l-' + c.label : ''), tabindex: '0', role: 'listitem', 'data-id': c.id, 'aria-label': bits.join(', ') },
      h('div', { class: 'ctitle' }, c.title),
      (c.due || p.all || c.notes) ? h('div', { class: 'cmeta' },
        c.due ? h('span', { class: 'due ' + due }, (due === 'overdue' ? '⚠ ' : '') + fmtDay(c.due)) : null,
        p.all ? h('span', { class: 'prog' + (p.done === p.all ? ' full' : '') }, '☑ ' + p.done + '/' + p.all) : null,
        c.notes ? h('span', { class: 'notes', title: 'Has notes' }, '≡') : null) : null,
      h('button', { class: 'cmenu', 'aria-label': 'Actions for ' + c.title, 'aria-haspopup': 'menu', 'aria-expanded': 'false', tabindex: '-1', onclick: e => { e.stopPropagation(); cardMenu(c.id, e.currentTarget); } }, '⋯'));
    return el;
  }
  let today = K.today();
  function draw(focusId) {
    today = K.today();
    const keep = focusId || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.card') ? document.activeElement.closest('.card').dataset.id : null);
    const sx = boardEl.scrollLeft;
    boardEl.textContent = '';
    if (!B) return;
    let shownCount = 0, total = 0;
    B.columns.forEach((col, ci) => {
      const visible = col.cards.filter(c => K.matches(c, filter, today));
      shownCount += visible.length; total += col.cards.length;
      const list = h('div', { class: 'cards', role: 'list', 'aria-label': col.name, 'data-col': col.id });
      for (const c of visible) list.append(cardEl(c, col));
      if (!col.cards.length) list.append(h('div', { class: 'empty muted' }, 'No cards yet'));
      else if (!visible.length) list.append(h('div', { class: 'empty muted' }, 'None match the search or filters'));
      const head = h('div', { class: 'chead' },
        h('h2', { class: 'cname', title: 'Double-click to rename', ondblclick: () => renameColumn(col.id) }, col.name),
        h('span', { class: 'ccount', 'aria-label': plural(col.cards.length, 'card') }, filtering() ? visible.length + '/' + col.cards.length : String(col.cards.length)),
        h('button', { class: 'btn icon small', 'aria-label': 'Column actions for ' + col.name, 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: e => colMenu(col.id, e.currentTarget) }, '⋯'));
      const add = h('button', { class: 'addcard', 'data-col': col.id, onclick: () => addCard(col.id) }, '+ Add card');
      boardEl.append(h('section', { class: 'col', 'data-col': col.id, 'aria-label': 'Column ' + (ci + 1) + ' of ' + B.columns.length + ': ' + col.name }, head, list, add));
    });
    boardEl.append(h('button', { class: 'addcol', onclick: addColumn }, '+ Add column'));
    boardEl.scrollLeft = sx;
    $('archBtn').textContent = 'Archive' + (B.archive.length ? ' (' + B.archive.length + ')' : '');
    const fn = $('filterNote');
    fn.hidden = !filtering();
    if (filtering()) { fn.textContent = 'Showing ' + shownCount + ' of ' + plural(total, 'card') + '. '; fn.append(h('button', { class: 'linkbtn', onclick: () => clearFilters() }, 'Show all')); }
    if (keep) { const el = boardEl.querySelector('.card[data-id="' + keep + '"]'); if (el) el.focus({ preventScroll: false }); }
  }
  function drawBoards() {
    const s = $('boardSel'); s.textContent = '';
    for (const b of index) s.append(new Option(b.name, b.id));
    if (B) s.value = B.id;
    Host.setTitle(B ? B.name + ' - Kanban Board' : 'Kanban Board');
  }
  function focusBoard() { const c = boardEl.querySelector('.card') || boardEl.querySelector('.addcard'); if (c) c.focus(); }
  const focusCard = id => { const el = boardEl.querySelector('.card[data-id="' + id + '"]'); if (el) { el.focus(); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } };

  /* ---------- boards ---------- */
  async function openBoard(id) {
    if (pending) await saveNow();
    let b = null;
    const t = await Host.loadData('boards/' + id + '.json');
    if (t !== null) { try { b = K.cleanBoard(JSON.parse(t)); } catch (e) { b = null; } }
    if (!b) {
      if (t !== null) { await Host.saveData('boards/' + id + '-unreadable-' + Date.now() + '.json', t); toast('That board\'s file could not be read. It was kept under another name and an empty board started.', 7000); }
      const entry = index.find(x => x.id === id);
      b = K.newBoard(entry ? entry.name : 'My board'); b.id = id;
    }
    B = b; B.id = id;
    settings.current = id; Host.saveSettings(settings);
    clearFilters(true); drawBoards(); draw(); drawLabelFilter();
  }
  async function newBoard() {
    const name = await askName('New board', '', 'Make board');
    if (!name) return;
    const b = K.newBoard(name);
    index.push({ id: b.id, name: b.name }); await saveIndex();
    await Host.saveData('boards/' + b.id + '.json', JSON.stringify(b, null, 1));
    await openBoard(b.id); toast('Made the board "' + b.name + '"');
  }
  async function renameBoard() {
    const name = await askName('Rename board', B.name, 'Rename');
    if (!name || name === B.name) return;
    B.name = name.slice(0, 80); index.find(x => x.id === B.id).name = B.name;
    changed(); saveIndex(); drawBoards();
  }
  async function deleteBoard() {
    const n = K.cardCount(B) + B.archive.length;
    if (!await confirmIt('Delete board', 'Delete "' + B.name + '" and its ' + plural(n, 'card') + ' (archived ones too)? This cannot be undone. Use Export board first if you may want it back.', 'Delete board')) return;
    const gone = B;
    clearTimeout(saveT); pending = false;
    await Host.removeData('boards/' + gone.id + '.json');
    index = index.filter(x => x.id !== gone.id);
    if (!index.length) { const b = K.newBoard('My board'); index.push({ id: b.id, name: b.name }); await Host.saveData('boards/' + b.id + '.json', JSON.stringify(b, null, 1)); }
    await saveIndex();
    await openBoard(index[0].id);
    toast('Deleted the board "' + gone.name + '"');
  }
  async function exportBoard() {
    await saveNow();
    try {
      const f = await Host.saveFile({ title: 'Export board', name: B.name.replace(/[\\/:*?"<>|]/g, '_') + '.json', types: ['.json'], text: K.exportText(B), mime: 'application/json' });
      if (f) toast('Exported "' + B.name + '" to ' + f.name, 3000);
    } catch (e) { toast('Could not export: ' + e.message, 5000); }
  }
  async function offerImport(name, text) {
    let b;
    try { b = K.readExport(text); } catch (e) { toast(name + ': ' + e.message, 6000); return; }
    if (!await confirmIt('Open board', name + ' holds the board "' + b.name + '" with ' + plural(K.cardCount(b), 'card') + '. Add it as a new board? Your other boards stay as they are.', 'Add board')) return;
    b.id = K.newId();
    let nm = b.name, n = 2;
    while (index.some(x => x.name === nm)) nm = b.name + ' (' + n++ + ')';
    b.name = nm;
    index.push({ id: b.id, name: b.name }); await saveIndex();
    await Host.saveData('boards/' + b.id + '.json', JSON.stringify(b, null, 1));
    await openBoard(b.id); toast('Added the board "' + b.name + '"');
  }
  async function importBoard() {
    try { const f = await Host.openFile({ title: 'Import board', types: ['.json'] }); if (f) await offerImport(f.name, f.text); }
    catch (e) { toast(e.message, 4000); }
  }
  async function openGiven(o) {
    try { const f = await Host.readPath(o.path, o.name); await offerImport(f.name, f.text); }
    catch (e) { toast('Could not open "' + o.name + '": ' + e.message, 5000); }
  }
  $('boardSel').onchange = () => openBoard($('boardSel').value);
  $('boardMenuBtn').onclick = e => openMenu(e.currentTarget, [
    { label: 'New board…', run: newBoard }, { label: 'Rename board…', run: renameBoard }, '-',
    { label: 'Export board…', run: exportBoard }, { label: 'Import board…', run: importBoard }, '-',
    { label: 'Delete board…', danger: true, run: deleteBoard }]);

  /* ---------- columns ---------- */
  async function addColumn() {
    const name = await askName('New column', '', 'Add column');
    if (!name) return;
    const c = K.column({ name }); B.columns.push(c); changed(); draw();
    const el = boardEl.querySelector('.col[data-col="' + c.id + '"] .addcard'); if (el) { el.focus(); el.scrollIntoView({ inline: 'nearest' }); }
  }
  async function renameColumn(id) {
    const col = B.columns.find(c => c.id === id); if (!col) return;
    const name = await askName('Rename column', col.name, 'Rename');
    if (!name || name === col.name) return;
    col.name = name.slice(0, 80); changed(); draw();
  }
  function moveColumn(id, by) {
    const i = B.columns.findIndex(c => c.id === id), j = i + by;
    if (j < 0 || j >= B.columns.length) return;
    [B.columns[i], B.columns[j]] = [B.columns[j], B.columns[i]]; changed(); draw();
    const btn = boardEl.querySelector('.col[data-col="' + id + '"] .chead .btn'); if (btn) btn.focus();
    say(B.columns[j].name + ' is now column ' + (j + 1) + ' of ' + B.columns.length);
  }
  async function deleteColumn(id) {
    const col = B.columns.find(c => c.id === id); if (!col) return;
    const n = col.cards.length;
    if (!await confirmIt('Delete column', 'Delete the column "' + col.name + '"?' + (n ? ' Its ' + plural(n, 'card') + ' will go to the archive, where you can restore them.' : ''), 'Delete column')) return;
    for (const c of col.cards.slice()) K.archive(B, c.id);
    B.columns = B.columns.filter(c => c !== col); changed(); draw(); focusBoard();
    toast('Deleted the column "' + col.name + '"' + (n ? '; ' + plural(n, 'card') + ' archived' : ''), 3500);
  }
  function colMenu(id, anchor) {
    const i = B.columns.findIndex(c => c.id === id);
    openMenu(anchor, [{ label: 'Rename…', run: () => renameColumn(id) }, { label: 'Move left', disabled: i === 0, run: () => moveColumn(id, -1) }, { label: 'Move right', disabled: i === B.columns.length - 1, run: () => moveColumn(id, 1) }, '-', { label: 'Delete column…', danger: true, run: () => deleteColumn(id) }]);
  }
  $('addColBtn').onclick = addColumn;

  /* ---------- cards: adding, moving, archiving ---------- */
  async function addCard(colId) {
    const col = B.columns.find(c => c.id === colId) || B.columns[0];
    if (!col) { toast('Add a column first.'); return; }
    const title = await askName('New card in ' + col.name, '', 'Add card');
    if (!title) return;
    const c = K.card({ title }); col.cards.push(c); changed();
    if (filtering() && !K.matches(c, filter, today)) clearFilters(true);
    draw(c.id); say('Added ' + c.title + ' to ' + col.name);
  }
  function placeText(id) { const at = K.find(B, id); return at ? at.col.name + ', position ' + (at.i + 1) + ' of ' + at.col.cards.length : ''; }
  function moveCard(id, colId, index) {
    if (!K.move(B, id, colId, index)) return false;
    changed(); draw(id); focusCard(id);
    say('Moved ' + K.find(B, id).card.title + ' to ' + placeText(id));
    return true;
  }
  /* the index in the whole column for "before the visible card v", or the end of the visible cards */
  function indexBefore(col, visibleAfterId) {
    if (visibleAfterId) return col.cards.findIndex(c => c.id === visibleAfterId);
    const vis = col.cards.filter(c => K.matches(c, filter, today));
    return vis.length ? col.cards.indexOf(vis[vis.length - 1]) + 1 : col.cards.length;
  }
  function archiveCard(id) {
    const at = K.archive(B, id); if (!at) return;
    const sib = at.col.cards[at.i] || at.col.cards[at.i - 1];
    changed(); draw(sib ? sib.id : null);
    if (sib) focusCard(sib.id); else { const a = boardEl.querySelector('.addcard[data-col="' + at.col.id + '"]'); if (a) a.focus(); }
    toast('Archived ' + short(at.card.title) + '. Restore it from Archive.', 3000);
  }
  function cardMenu(id, anchor) {
    const at = K.find(B, id); if (!at) return;
    const items = [{ label: 'Open', run: () => openCard(id) }, '-'];
    for (const col of B.columns) if (col !== at.col) items.push({ label: 'Move to ' + col.name, run: () => moveCard(id, col.id, col.cards.length) });
    items.push({ label: 'Move to top', disabled: at.i === 0, run: () => moveCard(id, at.col.id, 0) }, { label: 'Move to bottom', disabled: at.i === at.col.cards.length - 1, run: () => moveCard(id, at.col.id, at.col.cards.length) }, '-', { label: 'Archive', run: () => archiveCard(id) });
    openMenu(anchor, items, boardEl.querySelector('.card[data-id="' + id + '"]'));
  }

  /* ---------- the card dialog: everything is saved as you type ---------- */
  let cardId = null;
  const cur = () => cardId && K.find(B, cardId);
  function touch() { const at = cur(); if (at) at.card.updated = Date.now(); changed(); }
  function drawLabels() {
    const box = $('cLabels'), c = cur().card; box.textContent = '';
    for (const [k, name] of [['', 'None']].concat(K.LABELS)) {
      const on = c.label === k;
      const b = h('button', { class: 'sw' + (k ? ' l-' + k : ' none'), role: 'radio', 'aria-checked': String(on), 'aria-label': name, title: name, tabindex: on ? '0' : '-1', 'data-k': k }, k ? '' : '∅');
      b.onclick = () => { c.label = k; touch(); drawLabels(); box.querySelector('[data-k="' + k + '"]').focus(); };
      box.append(b);
    }
  }
  $('cLabels').addEventListener('keydown', e => {
    const all = [...$('cLabels').children], i = all.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); all[(to + all.length) % all.length].click();
  });
  function drawDue() {
    const c = cur().card, s = K.dueState(c, K.today()), n = $('cDueNote');
    $('cDue').value = c.due; n.textContent = c.due ? (s === 'overdue' ? 'Overdue' : s === 'today' ? 'Due today' : fmtDay(c.due)) : '';
    n.className = 'chip ' + s;
  }
  function drawList() {
    const c = cur().card, ul = $('cList'), p = K.progress(c);
    ul.textContent = '';
    $('cProg').textContent = p.all ? p.done + ' of ' + p.all + ' done' : '';
    c.checklist.forEach((it, i) => {
      const box = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + (it.text || 'item ' + (i + 1)) }); box.checked = it.done;
      box.onchange = () => { it.done = box.checked; touch(); $('cProg').textContent = K.progress(c).done + ' of ' + c.checklist.length + ' done'; };
      const txt = h('input', { class: 'field grow', value: it.text, 'aria-label': 'Checklist item ' + (i + 1), autocomplete: 'off' });
      txt.oninput = () => { it.text = txt.value.slice(0, 500); touch(); };
      const del = h('button', { class: 'btn icon small', 'aria-label': 'Remove item ' + (it.text || i + 1), title: 'Remove this item' }, '×');
      del.onclick = () => { c.checklist.splice(i, 1); touch(); drawList(); const nx = ul.querySelectorAll('.field')[Math.min(i, c.checklist.length - 1)]; (nx || $('cNewItem')).focus(); };
      ul.append(h('li', { class: it.done ? 'done' : null }, box, txt, del));
    });
  }
  function drawMoveSel() {
    const at = cur(), s = $('cMove'); s.textContent = '';
    for (const col of B.columns) s.append(new Option(col.name, col.id));
    s.value = at.col.id;
  }
  async function openCard(id) {
    const at = K.find(B, id); if (!at) return;
    cardId = id;
    $('cTitle').value = at.card.title; $('cNotes').value = at.card.notes; $('cNewItem').value = '';
    drawLabels(); drawDue(); drawList(); drawMoveSel();
    $('cardDlg').onclose = () => { const a = cur(); if (a && !a.card.title.trim()) a.card.title = 'Untitled card'; cardId = null; draw(id); return boardEl.querySelector('.card[data-id="' + id + '"]'); };
    await dialog('cardDlg', '#cTitle');
  }
  $('cTitle').oninput = () => { const at = cur(); if (!at) return; at.card.title = $('cTitle').value.slice(0, 300); touch(); };
  $('cNotes').oninput = () => { const at = cur(); if (!at) return; at.card.notes = $('cNotes').value.slice(0, 20000); touch(); };
  $('cDue').onchange = $('cDue').oninput = () => { const at = cur(); if (!at) return; const v = $('cDue').value; at.card.due = /^\d{4}-\d\d-\d\d$/.test(v) ? v : ''; touch(); drawDue(); };
  $('cDueClear').onclick = () => { const at = cur(); if (!at) return; at.card.due = ''; touch(); drawDue(); $('cDue').focus(); };
  function addItem() {
    const at = cur(), t = $('cNewItem').value.trim(); if (!at || !t) return;
    at.card.checklist.push({ id: K.newId(), text: t.slice(0, 500), done: false }); $('cNewItem').value = '';
    touch(); drawList(); $('cNewItem').focus();
  }
  $('cNewItem').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } };
  $('cAddItem').onclick = addItem;
  $('cMove').onchange = () => { const at = cur(); if (!at) return; const col = B.columns.find(c => c.id === $('cMove').value); if (col && col !== at.col) { K.move(B, at.card.id, col.id, col.cards.length); changed(); say('Moved to ' + col.name); toast('Moved to ' + col.name); } };
  $('cArchive').onclick = () => { const id = cardId; $('cardDlg').done('archived'); archiveCard(id); };

  /* ---------- the archive ---------- */
  function drawArchive() {
    const box = $('archList'); box.textContent = '';
    if (!B.archive.length) { box.append(h('p', { class: 'muted' }, 'Nothing is archived. Archived cards are kept here until you restore or delete them.')); return; }
    for (const a of B.archive) {
      const del = h('button', { class: 'btn danger small', 'aria-label': 'Delete forever: ' + a.title }, 'Delete forever');
      let t = 0;
      del.onclick = () => {
        if (!t) { del.textContent = 'Click again to delete'; t = setTimeout(() => { t = 0; del.textContent = 'Delete forever'; }, 3000); return; }
        clearTimeout(t); B.archive = B.archive.filter(x => x !== a); changed(); drawArchive(); draw();
        toast('Deleted ' + short(a.title) + ' for good'); const f = box.querySelector('button'); (f || $('archDlg').querySelector('[data-act]')).focus();
      };
      const res = h('button', { class: 'btn small primary', 'aria-label': 'Restore ' + a.title }, 'Restore');
      res.onclick = () => { const col = K.restore(B, a.id); changed(); drawArchive(); draw(); toast('Restored ' + short(a.title) + ' to ' + col.name); const f = box.querySelector('button'); (f || $('archDlg').querySelector('[data-act]')).focus(); };
      box.append(h('div', { class: 'arow' }, h('div', { class: 'ainfo' }, h('b', null, a.title), h('div', { class: 'muted small' }, 'From ' + (a.from || '?') + ' · archived ' + new Date(a.archived).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))), res, del));
    }
  }
  $('archBtn').onclick = () => { drawArchive(); dialog('archDlg', '#archList button'); };
  $('helpBtn').onclick = () => dialog('helpDlg');

  /* ---------- search and filters ---------- */
  function drawLabelFilter() {
    const s = $('labelSel'), v = filter.label; s.textContent = '';
    s.append(new Option('All labels', ''));
    for (const [k, name] of K.LABELS) s.append(new Option(name, k));
    s.value = v;
  }
  function clearFilters(quiet) { filter.q = filter.label = filter.due = ''; $('search').value = ''; $('labelSel').value = ''; $('dueSel').value = ''; if (!quiet) { draw(); focusBoard(); } }
  let st = 0;
  $('search').addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => { filter.q = $('search').value.trim(); draw(); }, 120); });
  $('search').addEventListener('keydown', e => { if (e.key === 'Escape' && $('search').value) { e.preventDefault(); e.stopPropagation(); $('search').value = ''; filter.q = ''; draw(); } });
  $('labelSel').onchange = () => { filter.label = $('labelSel').value; draw(); };
  $('dueSel').onchange = () => { filter.due = $('dueSel').value; draw(); };

  /* ---------- keyboard on cards ---------- */
  boardEl.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('.card');
    if (!el || e.target !== el) return;
    const id = el.dataset.id, at = K.find(B, id); if (!at) return;
    const colEls = [...boardEl.querySelectorAll('.col')], ci = colEls.indexOf(el.closest('.col'));
    const vis = [...el.parentNode.querySelectorAll('.card')], vi = vis.indexOf(el);
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (k === 'Enter' || (k === ' ' && !ctrl)) { e.preventDefault(); openCard(id); }
    else if (k === 'Delete') { e.preventDefault(); archiveCard(id); }
    else if ((k === 'm' || k === 'M') && !ctrl && !e.altKey || (k === 'F10' && e.shiftKey) || k === 'ContextMenu') { e.preventDefault(); cardMenu(id, el.querySelector('.cmenu')); }
    else if (!ctrl && (k === 'ArrowDown' || k === 'ArrowUp')) { e.preventDefault(); const n = vis[vi + (k === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); }
    else if (!ctrl && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      for (let j = ci + (k === 'ArrowRight' ? 1 : -1); j >= 0 && j < colEls.length; j += k === 'ArrowRight' ? 1 : -1) { const cs = colEls[j].querySelectorAll('.card'); if (cs.length) { cs[Math.min(vi, cs.length - 1)].focus(); break; } }
    }
    else if (ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      const other = vis[vi + (k === 'ArrowDown' ? 1 : -1)];
      if (!other) { say(k === 'ArrowUp' ? 'Already at the top' : 'Already at the bottom'); return; }
      const oi = at.col.cards.findIndex(c => c.id === other.dataset.id);
      moveCard(id, at.col.id, k === 'ArrowDown' ? oi + 1 : oi);
    }
    else if (ctrl && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      const to = B.columns[B.columns.indexOf(at.col) + (k === 'ArrowRight' ? 1 : -1)];
      if (!to) { say('No column that way'); return; }
      const tv = to.cards.filter(c => K.matches(c, filter, today));
      moveCard(id, to.id, indexBefore(to, tv[vi] ? tv[vi].id : null));
    }
  });
  boardEl.addEventListener('click', e => { const el = e.target.closest('.card'); if (el && !e.target.closest('.cmenu') && !dragJustEnded) openCard(el.dataset.id); });

  /* ---------- drag and drop: pointer events, so mouse, pen and touch all work ---------- */
  let drag = null, dragJustEnded = false;
  const line = $('dropLine');
  boardEl.addEventListener('pointerdown', e => {
    const el = e.target.closest('.card');
    if (!el || e.button !== 0 || e.target.closest('.cmenu')) return;
    drag = { id: el.dataset.id, el, x: e.clientX, y: e.clientY, pid: e.pointerId, on: false, target: null };
  });
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.on = true;
      const r = drag.el.getBoundingClientRect();
      drag.dx = e.clientX - r.left; drag.dy = e.clientY - r.top;
      drag.ghost = drag.el.cloneNode(true); drag.ghost.className += ' ghost'; drag.ghost.removeAttribute('tabindex'); drag.ghost.setAttribute('aria-hidden', 'true');
      drag.ghost.style.width = r.width + 'px'; document.body.append(drag.ghost);
      drag.el.classList.add('dragging'); document.body.classList.add('dragmode');
      try { drag.el.setPointerCapture(e.pointerId); } catch (x) {}
    }
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.dx) + 'px'; drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
    /* scroll the board or the column when near an edge */
    const br = boardEl.getBoundingClientRect();
    if (e.clientX < br.left + 40) boardEl.scrollLeft -= 12; else if (e.clientX > br.right - 40) boardEl.scrollLeft += 12;
    /* where it would land */
    drag.ghost.style.display = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    drag.ghost.style.display = '';
    const colEl = under && under.closest('.col');
    if (!colEl) { drag.target = null; line.hidden = true; return; }
    const list = colEl.querySelector('.cards'), lr = list.getBoundingClientRect();
    if (e.clientY < lr.top + 30) list.scrollTop -= 10; else if (e.clientY > lr.bottom - 30) list.scrollTop += 10;
    const cards = [...list.querySelectorAll('.card:not(.dragging)')];
    let before = null;
    for (const c of cards) { const r = c.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = c; break; } }
    drag.target = { col: colEl.dataset.col, before: before ? before.dataset.id : null };
    const ref = before ? before.getBoundingClientRect() : cards.length ? cards[cards.length - 1].getBoundingClientRect() : null;
    line.hidden = false;
    line.style.left = (lr.left + 6) + 'px'; line.style.width = (lr.width - 12) + 'px';
    line.style.top = (ref ? (before ? ref.top - 4 : ref.bottom + 2) : lr.top + 6) + 'px';
  });
  function endDrag(drop) {
    if (!drag) return;
    const d = drag; drag = null;
    line.hidden = true; document.body.classList.remove('dragmode');
    if (!d.on) return;
    d.ghost.remove(); d.el.classList.remove('dragging');
    dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 50);
    if (drop && d.target) {
      const col = B.columns.find(c => c.id === d.target.col);
      if (col && !moveCard(d.id, col.id, indexBefore(col, d.target.before))) draw(d.id);
    } else draw(d.id);
  }
  addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pid) endDrag(true); });
  addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) endDrag(false); });
  addEventListener('keydown', e => { if (drag && drag.on && e.key === 'Escape') { e.preventDefault(); endDrag(false); say('Move cancelled'); } }, true);

  /* ---------- global keys ---------- */
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])') || !menuEl.hidden) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    let go = null;
    if (ctrl && !e.altKey && !e.shiftKey && k === 'f') go = () => { $('search').focus(); $('search').select(); };
    else if (e.altKey && !ctrl && k === 'n') go = () => { const c = document.activeElement && document.activeElement.closest && document.activeElement.closest('.col'); addCard(c ? c.dataset.col : (B.columns[0] || {}).id); };
    else if (e.altKey && !ctrl && k === 'a') go = () => $('archBtn').click();
    else if (e.key === 'F1') go = () => $('helpBtn').click();
    if (go) { e.preventDefault(); go(); }
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
    try { const o = JSON.parse(await Host.loadData('boards.json') || 'null'); index = o && Array.isArray(o.boards) ? o.boards.filter(b => b && typeof b.id === 'string' && /^[a-z0-9]{1,40}$/.test(b.id)).map(b => ({ id: b.id, name: String(b.name || 'My board').slice(0, 80) })) : []; } catch (e) { index = []; }
    if (!index.length) {
      const b = K.newBoard('My board');
      const c = (t, o) => K.card(Object.assign({ title: t }, o));
      b.columns[0].cards.push(c('Try dragging this card to Doing', { notes: 'Or select it and press Ctrl+→. Each card can have notes like these, a due date, a colour label and a checklist.', label: 'blue' }),
        c('A card with a checklist', { checklist: [{ text: 'Open the card (click or Enter)', done: true }, { text: 'Tick an item', done: false }, { text: 'Add your own', done: false }] }),
        c('Due soon', { due: K.addDays(K.today(), 2), label: 'orange' }));
      b.columns[2].cards.push(c('Archive me when you are done', { notes: 'Archived cards can be restored from Archive.', label: 'green' }));
      index = [{ id: b.id, name: b.name }];
      await Host.saveData('boards/' + b.id + '.json', JSON.stringify(b, null, 1)); await saveIndex();
    }
    await openBoard(index.some(b => b.id === settings.current) ? settings.current : index[0].id);
    focusBoard();
    Host.onOpenFile(openGiven);
    const start = Host.startFile();
    if (start) openGiven(start);
    window.__kb = { get B() { return B; }, get index() { return index; }, saveNow, filter, ready: true };
  })();
})();
