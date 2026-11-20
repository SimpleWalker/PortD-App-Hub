/* Snippets: the library. Cleaning up what is loaded, searching, sorting, and the export file.
   No drawing here; app.js draws. Everything hangs off window.Snippets. */
(function () {
  'use strict';
  const S = window.Snippets = {};
  const LIMIT = { title: 200, lang: 40, tag: 40, tags: 20, body: 200000, count: 5000 };

  S.newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  const time = v => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(v) : 0);

  /* tags: trimmed, without '#', no empties or repeats (case ignored), kept in the order given */
  S.cleanTags = function (v) {
    const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
    const out = [], seen = new Set();
    for (const t of list) {
      const x = str(t, LIMIT.tag).trim().replace(/^#+/, '').trim();
      if (x && !seen.has(x.toLowerCase())) { seen.add(x.toLowerCase()); out.push(x); }
      if (out.length >= LIMIT.tags) break;
    }
    return out;
  };

  /* one snippet, whatever was read: anything missing or the wrong type is filled in */
  S.clean = function (o, now) {
    o = o && typeof o === 'object' ? o : {};
    now = now || Date.now();
    return {
      id: str(o.id, 40) || S.newId(),
      title: str(o.title, LIMIT.title).trim() || 'Untitled',
      tags: S.cleanTags(o.tags),
      lang: str(o.lang, LIMIT.lang).trim(),
      body: str(o.body, LIMIT.body),
      pinned: o.pinned === true,
      created: time(o.created) || now,
      updated: time(o.updated) || time(o.created) || now,
      used: time(o.used)
    };
  };

  /* the library as saved: { v: 1, snippets: [...] }. Ids are made unique. */
  S.cleanLibrary = function (o) {
    const list = o && Array.isArray(o.snippets) ? o.snippets : Array.isArray(o) ? o : [];
    const out = [], ids = new Set();
    for (const x of list.slice(0, LIMIT.count)) {
      const s = S.clean(x);
      while (ids.has(s.id)) s.id = S.newId();
      ids.add(s.id); out.push(s);
    }
    return out;
  };
  S.toJSON = list => JSON.stringify({ v: 1, snippets: list }, null, 1);

  /* the file Export writes, and the only kind Import accepts */
  S.exportText = list => JSON.stringify({ format: 'portd-snippets', v: 1, exported: new Date().toISOString(), snippets: list }, null, 2);
  /* returns { snippets } or throws an Error with a plain message */
  S.readExport = function (text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('This file is not valid JSON, so it is not a Snippets library.'); }
    if (!o || o.format !== 'portd-snippets' || !Array.isArray(o.snippets)) throw new Error('This JSON file is not a Snippets library. Only files made with Export can be imported.');
    if (typeof o.v === 'number' && o.v > 1) throw new Error('This library was made by a newer version of Snippets.');
    return { snippets: S.cleanLibrary(o) };
  };
  /* adds imported snippets, skipping ones already there with the same title and text; returns how many were added */
  S.merge = function (list, incoming) {
    const have = new Set(list.map(s => s.title + '\u0000' + s.body)), ids = new Set(list.map(s => s.id));
    let added = 0;
    for (const s of incoming) {
      if (have.has(s.title + '\u0000' + s.body)) continue;
      const c = Object.assign({}, s);
      while (ids.has(c.id)) c.id = S.newId();
      ids.add(c.id); have.add(c.title + '\u0000' + c.body); list.push(c); added++;
    }
    return added;
  };

  /* search: every word must appear somewhere in the title, tags, language or text (case ignored) */
  S.words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
  S.matches = function (s, words) {
    if (!words.length) return true;
    const hay = (s.title + '\n' + s.tags.join(' ') + '\n' + s.lang + '\n' + s.body).toLowerCase();
    return words.every(w => hay.includes(w));
  };
  /* the snippets to list: filtered by tag and search, pinned first, then by title or by last used */
  S.view = function (list, o) {
    const words = S.words(o.q || ''), tag = (o.tag || '').toLowerCase();
    const by = o.sort === 'used'
      ? (a, b) => (b.used - a.used) || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
      : (a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) || a.created - b.created;
    return list.filter(s => (!tag || s.tags.some(t => t.toLowerCase() === tag)) && S.matches(s, words))
      .sort((a, b) => (b.pinned - a.pinned) || by(a, b));
  };
  /* every tag with how many snippets carry it, A to Z */
  S.tagCounts = function (list) {
    const m = new Map();
    for (const s of list) for (const t of s.tags) { const k = t.toLowerCase(), e = m.get(k); if (e) e.n++; else m.set(k, { name: t, n: 1 }); }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  };
  /* the first line of the text that holds a search word, for the list */
  S.hitLine = function (s, words) {
    if (!words.length) return '';
    const lines = s.body.split('\n');
    for (const l of lines) { const low = l.toLowerCase(); if (words.some(w => low.includes(w))) return l.trim().slice(0, 140); }
    return '';
  };

  /* a few harmless examples for a new library; the user can delete them */
  S.seeds = function () {
    const now = Date.now();
    return [
      { title: 'Largest files in a folder', tags: ['powershell', 'files'], lang: 'PowerShell',
        body: "Get-ChildItem -Path . -File -Recurse |\n  Sort-Object Length -Descending |\n  Select-Object -First 10 FullName, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }" },
      { title: 'Count events by hour', tags: ['kql', 'logs'], lang: 'KQL',
        body: 'MyTable\n| where TimeGenerated > ago(1d)\n| summarize Count = count() by bin(TimeGenerated, 1h)\n| order by TimeGenerated asc' },
      { title: 'My profile (Graph)', tags: ['graph'], lang: 'HTTP',
        body: 'GET /v1.0/me?$select=displayName,mail,jobTitle' },
      { title: 'Thanks, will follow up', tags: ['email'], lang: '',
        body: 'Hi,\n\nThanks for getting in touch. I have picked this up and will come back to you by the end of the day.\n\nKind regards' },
      { title: 'Welcome: how Snippets works', tags: ['example'], lang: '', pinned: true,
        body: 'Pick a snippet and press Copy (or Enter) to put its text on the clipboard.\nPress New to add your own, and Edit to change one.\nThese examples are only here to show you around: delete them whenever you like.' }
    ].map((s, i) => S.clean(Object.assign({ created: now + i, updated: now + i }, s), now));
  };
})();
