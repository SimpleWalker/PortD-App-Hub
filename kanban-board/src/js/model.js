/* Kanban Board: the boards themselves. Making, cleaning up what is loaded, moving, archiving, filtering and the
   export file. No drawing here; app.js draws. Everything hangs off window.Kanban. */
(function () {
  'use strict';
  const K = window.Kanban = {};
  K.LABELS = [['red', 'Red'], ['orange', 'Orange'], ['yellow', 'Yellow'], ['green', 'Green'], ['blue', 'Blue'], ['purple', 'Purple']];
  const LABEL_KEYS = K.LABELS.map(l => l[0]);
  K.newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const str = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);
  const time = v => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(v) : 0);
  const isDate = v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && !isNaN(new Date(v + 'T00:00:00'));

  /* ---------- making and cleaning ---------- */
  K.card = function (o, now) {
    o = o && typeof o === 'object' ? o : {};
    now = now || Date.now();
    return {
      id: str(o.id, 40) || K.newId(),
      title: str(o.title, 300).trim() || 'Untitled card',
      notes: str(o.notes, 20000),
      due: isDate(o.due) ? o.due : '',
      label: LABEL_KEYS.includes(o.label) ? o.label : '',
      checklist: (Array.isArray(o.checklist) ? o.checklist : []).slice(0, 200).map(i => ({ id: str(i && i.id, 40) || K.newId(), text: str(i && i.text, 500), done: !!(i && i.done) })),
      created: time(o.created) || now,
      updated: time(o.updated) || time(o.created) || now
    };
  };
  K.column = (o) => ({ id: str(o && o.id, 40) || K.newId(), name: str(o && o.name, 80).trim() || 'Untitled', cards: (o && Array.isArray(o.cards) ? o.cards : []).slice(0, 2000).map(c => K.card(c)) });
  K.newBoard = name => ({ v: 1, id: K.newId(), name: str(name, 80).trim() || 'My board', columns: ['To do', 'Doing', 'Done'].map(n => K.column({ name: n })), archive: [] });
  /* a board as loaded from a file: anything missing or wrong is filled in, ids are made unique */
  K.cleanBoard = function (o) {
    o = o && typeof o === 'object' ? o : {};
    const b = { v: 1, id: str(o.id, 40) || K.newId(), name: str(o.name, 80).trim() || 'My board', columns: (Array.isArray(o.columns) ? o.columns : []).slice(0, 50).map(K.column), archive: [] };
    b.archive = (Array.isArray(o.archive) ? o.archive : []).slice(0, 5000).map(a => Object.assign(K.card(a), { from: str(a && a.from, 80), archived: time(a && a.archived) || Date.now() }));
    const ids = new Set();
    const uniq = x => { while (ids.has(x.id)) x.id = K.newId(); ids.add(x.id); };
    for (const c of b.columns) { uniq(c); c.cards.forEach(uniq); }
    b.archive.forEach(uniq);
    return b;
  };

  /* ---------- finding and moving ---------- */
  K.find = function (b, cardId) {
    for (const col of b.columns) { const i = col.cards.findIndex(c => c.id === cardId); if (i >= 0) return { col, i, card: col.cards[i] }; }
    return null;
  };
  /* moves a card to a column at an index (the index counts the cards there before the move); returns true if it moved */
  K.move = function (b, cardId, colId, index) {
    const at = K.find(b, cardId), to = b.columns.find(c => c.id === colId);
    if (!at || !to) return false;
    let i = Math.max(0, Math.min(index, to.cards.length));
    if (at.col === to && (i === at.i || i === at.i + 1)) return false;
    at.col.cards.splice(at.i, 1);
    if (at.col === to && i > at.i) i--;
    to.cards.splice(i, 0, at.card);
    at.card.updated = Date.now();
    return true;
  };
  K.archive = function (b, cardId) {
    const at = K.find(b, cardId); if (!at) return null;
    at.col.cards.splice(at.i, 1);
    b.archive.unshift(Object.assign(at.card, { from: at.col.name, archived: Date.now() }));
    return at;
  };
  /* back to the column it came from (by name), or the first column; returns the column */
  K.restore = function (b, cardId) {
    const i = b.archive.findIndex(c => c.id === cardId); if (i < 0) return null;
    const a = b.archive.splice(i, 1)[0];
    let col = b.columns.find(c => c.name === a.from) || b.columns[0];
    if (!col) { col = K.column({ name: 'To do' }); b.columns.push(col); }
    delete a.from; delete a.archived; a.updated = Date.now();
    col.cards.push(a);
    return col;
  };

  /* ---------- dates and filters ---------- */
  K.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  K.addDays = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /* 'overdue', 'today', 'soon' (within 7 days), 'later' or '' */
  K.dueState = function (c, today) {
    if (!c.due) return '';
    today = today || K.today();
    return c.due < today ? 'overdue' : c.due === today ? 'today' : c.due <= K.addDays(today, 7) ? 'soon' : 'later';
  };
  K.matches = function (c, f, today) {
    if (f.label && c.label !== f.label) return false;
    if (f.due) {
      const s = K.dueState(c, today);
      if (f.due === 'overdue' && s !== 'overdue') return false;
      if (f.due === 'today' && s !== 'today') return false;
      if (f.due === 'week' && !(s === 'today' || s === 'soon' || s === 'overdue')) return false;
      if (f.due === 'none' && c.due) return false;
    }
    if (f.q) {
      const hay = (c.title + '\n' + c.notes + '\n' + c.checklist.map(i => i.text).join('\n')).toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
    }
    return true;
  };
  K.progress = c => ({ done: c.checklist.filter(i => i.done).length, all: c.checklist.length });

  /* ---------- the export file ---------- */
  K.exportText = b => JSON.stringify({ format: 'portd-kanban', v: 1, exported: new Date().toISOString(), board: b }, null, 2);
  K.readExport = function (text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('This file is not valid JSON, so it is not a Kanban board.'); }
    if (!o || o.format !== 'portd-kanban' || !o.board || typeof o.board !== 'object') throw new Error('This JSON file is not a Kanban board. Only files made with Export board can be opened.');
    if (typeof o.v === 'number' && o.v > 1) throw new Error('This board was made by a newer version of Kanban Board.');
    return K.cleanBoard(o.board);
  };
  K.cardCount = b => b.columns.reduce((n, c) => n + c.cards.length, 0);
})();
