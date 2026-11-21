/* Regex Tester: the window. Pattern and flags, test text with highlighted matches, the Matches, Replace and
   Cheat sheet panels, saved patterns, opening text files, and the last session kept as you type. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ta = $('text'), hl = $('hl'), patEl = $('pattern'), mList = $('mList');
  const num = n => n.toLocaleString('en-GB');
  const plural = (n, w, ws) => num(n) + ' ' + (n === 1 ? w : ws || w + 's');
  const TEXT_MAX = 5e6, SESSION_TEXT_MAX = 1e6;

  let settings = { theme: 'auto', live: true };
  let flags = 'g', tab = 'matches', saved = [];
  let res = null, cur = -1, names = [];

  /* ---------- helpers ---------- */
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2400); }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const visible = s => s.replace(/\n/g, '↵').replace(/\r/g, '␍').replace(/\t/g, '→');
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false;
    const focusables = () => [...ov.querySelectorAll('button, input, textarea')].filter(e => !e.disabled && e.offsetParent);
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
      ov.done = done;
    });
  }
  /* replaces the whole test text (Open, Load). Ctrl+Z in the text brings back what was there, as long as the new text
     has not been changed since. Kept by the program, because after PortD's Open dialog the browser's own undo
     does not see the change. */
  let undo = null;
  function setText(t) {
    undo = ta.value !== t ? { before: ta.value, after: t } : null;
    ta.value = t;
    ta.setSelectionRange(0, 0); ta.scrollTop = 0; ta.scrollLeft = 0;
    textChanged();
  }
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && undo && ta.value === undo.after) {
      e.preventDefault(); const b = undo.before; undo = null; ta.value = b; textChanged(); toast('The earlier text is back.');
    }
  });

  /* ---------- the session: kept as you type ---------- */
  let sessT = 0;
  function saveSession() { clearTimeout(sessT); sessT = setTimeout(writeSession, 500); }
  function writeSession() {
    clearTimeout(sessT); sessT = 0;
    const big = ta.value.length > SESSION_TEXT_MAX;
    Host.saveData('session.json', JSON.stringify({ v: 1, pattern: patEl.value, flags, text: big ? '' : ta.value, textTooBig: big, replacement: $('repl').value, tab }, null, 1));
  }
  addEventListener('pagehide', () => { if (sessT) writeSession(); });
  addEventListener('visibilitychange', () => { if (document.hidden && sessT) writeSession(); });

  /* ---------- status line ---------- */
  function status(kind, text) { const s = $('status'); s.className = 'status' + (kind ? ' ' + kind : ''); s.textContent = text; }

  /* ---------- running ---------- */
  let runT = 0;
  function schedule() { clearTimeout(runT); runT = setTimeout(() => run(false), 180); }
  function clearResults() { res = null; cur = -1; drawMarks(); drawList(); drawReplace(); $('mCount').textContent = ''; }
  function run(manual) {
    clearTimeout(runT);
    const p = patEl.value;
    const b = Rx.build(p, flags);
    patEl.classList.toggle('bad', !!b.error);
    if (!p) { clearResults(); status('', 'Type a pattern to see what it matches.'); return; }
    if (b.error) { clearResults(); status('err', 'This pattern has a mistake: ' + b.error); return; }
    Rx._flags = flags;
    const why = Rx.risky(p);
    if (!manual && !settings.live) { status('', 'Live is off. Press Run (Ctrl+Enter) to match.'); return; }
    if (why && !manual) { clearResults(); status('warn', 'Not run as you type: this pattern has ' + why + ', which can take so long on some text that PortD stops responding. Press Run (Ctrl+Enter) to try it anyway.'); return; }
    names = Rx.groupNames(p);
    res = Rx.run(b.re, ta.value, names);
    res.re = b.re;
    cur = -1;
    let note = '';
    if (res.stopped) note = 'Stopped after ' + (res.ms / 1000).toFixed(1) + ' s: ' + plural(res.count, 'match', 'matches') + ' found so far. ';
    else note = res.count ? plural(res.count, 'match', 'matches') + '. ' : 'No match. ';
    if (res.matches.length < res.count) note += 'The first ' + num(res.matches.length) + ' are shown. ';
    if (!flags.includes('g') && res.count) note += 'Turn on g to find them all. ';
    if (settings.live && res.ms > Rx.LIMIT.slow && !manual) { setLive(false); note += 'That took ' + (res.ms / 1000).toFixed(1) + ' s, so Live is now off: press Run (Ctrl+Enter) after changes.'; }
    status(res.stopped ? 'warn' : res.count ? 'ok' : '', note.trim());
    $('mCount').textContent = res.count ? (res.stopped ? num(res.count) + '+' : num(res.count)) : '0';
    drawMarks(); drawList(); drawReplace();
  }

  /* ---------- the highlight behind the text ---------- */
  function drawMarks() {
    const text = ta.value, frag = document.createDocumentFragment();
    let at = 0;
    if (res) res.matches.forEach((m, i) => {
      if (m.index < at) return;
      frag.append(text.slice(at, m.index));
      const mk = h('mark', (m.length ? 'm' + (i % 2) : 'z') + (i === cur ? ' cur' : ''), text.slice(m.index, m.index + m.length));
      mk.dataset.i = i; frag.append(mk); at = m.index + m.length;
    });
    frag.append(text.slice(at) + '\n ');
    hl.textContent = ''; hl.append(frag);
    syncScroll();
  }
  function syncScroll() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
  ta.addEventListener('scroll', syncScroll);

  /* ---------- the Matches list ---------- */
  function drawList() {
    mList.textContent = ''; mList.removeAttribute('aria-activedescendant');
    if (!res || !res.matches.length) { mList.append(h('div', 'none muted', !patEl.value ? 'Matches will be listed here.' : res ? 'No match in the test text.' : '')); return; }
    const frag = document.createDocumentFragment();
    res.matches.forEach((m, i) => {
      const row = h('div', 'mrow' + (i === cur ? ' on' : '')); row.id = 'm-' + i; row.dataset.i = i; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(i === cur));
      const top = h('div', 'mtop');
      top.append(h('b', null, '#' + (i + 1)), h('span', 'muted', ' at ' + num(m.index) + ', length ' + num(m.length)));
      row.append(top, h('div', 'mval mono', m.length ? visible(m.text) : '(empty match)'));
      for (const g of m.groups) {
        const gl = h('div', 'grp mono');
        gl.append(h('span', 'gn', (g.name ? g.name + ' ($' + g.n + ')' : '$' + g.n) + ': '), g.value === undefined ? h('span', 'muted', 'did not take part') : h('span', null, '"' + visible(g.value) + '"'));
        row.append(gl);
      }
      frag.append(row);
    });
    mList.append(frag);
  }
  function choose(i, focusText) {
    if (!res || !res.matches[i]) return;
    cur = i;
    for (const el of mList.querySelectorAll('.mrow.on')) { el.classList.remove('on'); el.setAttribute('aria-selected', 'false'); }
    const row = $('m-' + i); row.classList.add('on'); row.setAttribute('aria-selected', 'true'); row.scrollIntoView({ block: 'nearest' });
    mList.setAttribute('aria-activedescendant', row.id);
    for (const el of hl.querySelectorAll('mark.cur')) el.classList.remove('cur');
    const mk = hl.querySelector('mark[data-i="' + i + '"]'); if (mk) mk.classList.add('cur');
    const m = res.matches[i];
    if (focusText) { ta.focus(); ta.setSelectionRange(m.index, m.index + m.length); }
    else { const keep = document.activeElement; ta.setSelectionRange(m.index, m.index + m.length); if (keep && keep !== ta) keep.focus(); }
    revealInText(m.index);
  }
  /* scrolls the text so a position is in view: measured on the highlight copy, which has the same layout */
  function revealInText(index) {
    const mk = hl.querySelector('mark.cur'); if (!mk) return;
    const top = mk.offsetTop, left = mk.offsetLeft;
    if (top < ta.scrollTop || top > ta.scrollTop + ta.clientHeight - 24) ta.scrollTop = Math.max(0, top - ta.clientHeight / 3);
    if (left < ta.scrollLeft || left > ta.scrollLeft + ta.clientWidth - 40) ta.scrollLeft = Math.max(0, left - 40);
    syncScroll();
  }
  mList.addEventListener('click', e => { const r = e.target.closest('.mrow'); if (r) choose(+r.dataset.i, false); });
  mList.addEventListener('dblclick', e => { const r = e.target.closest('.mrow'); if (r) choose(+r.dataset.i, true); });
  mList.addEventListener('keydown', e => {
    if (!res || !res.matches.length) return;
    const n = res.matches.length, to = { ArrowDown: cur + 1, ArrowUp: cur < 0 ? 0 : cur - 1, Home: 0, End: n - 1, PageDown: cur + 8, PageUp: cur - 8 }[e.key];
    if (to !== undefined) { e.preventDefault(); choose(Math.max(0, Math.min(n - 1, to)), false); }
    else if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); choose(cur, true); }
  });
  mList.addEventListener('focus', () => { if (cur < 0 && res && res.matches.length) choose(0, false); });

  /* ---------- Replace ---------- */
  function drawReplace() {
    const out = $('rOut'), info = $('rInfo');
    if (!res) { out.textContent = ''; info.textContent = patEl.value ? 'Run the pattern to see the result.' : 'Type a pattern and a replacement.'; return; }
    if (res.stopped) { out.textContent = ''; info.textContent = 'Not shown: matching was stopped because it took too long.'; return; }
    try {
      const r = Rx.replace(res.re, ta.value, $('repl').value);
      out.textContent = r;
      info.textContent = res.count ? (flags.includes('g') ? 'Every match replaced (' + num(res.count) + ').' : 'The first match replaced. Turn on g to replace them all.') : 'No match, so nothing changed.';
    } catch (e) { out.textContent = ''; info.textContent = 'Could not replace: ' + e.message; }
  }
  $('repl').addEventListener('input', () => { drawReplace(); saveSession(); });
  $('copyBtn').onclick = async () => {
    const t = $('rOut').textContent;
    if (!res || res.stopped) { toast('There is no result to copy yet.'); return; }
    if (await Host.copy(t)) toast('Copied the result (' + plural(t.length, 'character') + ')');
    else { $('copyText').value = t; const p = dialog('copyDlg', '#copyText'); $('copyText').select(); await p; }
  };

  /* ---------- tabs ---------- */
  const TABS = ['matches', 'replace', 'cheat'];
  function setTab(t, focus) {
    tab = TABS.includes(t) ? t : 'matches';
    for (const x of TABS) { const b = $('tab-' + x), on = x === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('p-' + x).hidden = !on; }
    if (focus) $('tab-' + tab).focus();
    saveSession();
  }
  for (const x of TABS) $('tab-' + x).onclick = () => setTab(x);
  document.querySelector('.tabs').addEventListener('keydown', e => {
    const i = TABS.indexOf(tab), to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); setTab(TABS[(to + TABS.length) % TABS.length], true);
  });

  /* ---------- pattern, flags, text ---------- */
  function drawFlags() {
    for (const b of document.querySelectorAll('.flag')) b.setAttribute('aria-pressed', String(flags.includes(b.dataset.f)));
    $('flagText').textContent = flags;
  }
  for (const b of document.querySelectorAll('.flag')) b.onclick = () => {
    const f = b.dataset.f;
    flags = (flags.includes(f) ? flags.replace(f, '') : flags + f).split('').sort((a, c) => Rx.FLAGS.indexOf(a) - Rx.FLAGS.indexOf(c)).join('');
    drawFlags(); saveSession(); schedule();
  };
  patEl.addEventListener('input', () => { saveSession(); schedule(); });
  patEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); run(true); } });
  function textInfo() { const t = ta.value; $('textInfo').textContent = plural(t.length, 'character') + ' · ' + plural(t ? t.split('\n').length : 0, 'line'); }
  function textChanged() { textInfo(); saveSession(); if (res) { res = null; drawMarks(); } schedule(); }
  ta.addEventListener('input', textChanged);

  function setLive(on) {
    settings.live = on; Host.saveSettings(settings);
    $('liveBtn').setAttribute('aria-pressed', String(on));
    $('liveBtn').title = on ? 'Live: matching as you type (click to turn off)' : 'Live is off: press Run after changes (click to turn on)';
  }
  $('liveBtn').onclick = () => { setLive(!settings.live); toast(settings.live ? 'Live is on' : 'Live is off: press Run after changes'); if (settings.live) run(false); };
  $('runBtn').onclick = () => run(true);

  /* ---------- opening a file ---------- */
  function takeFile(f) {
    if (f.text.length > TEXT_MAX) { toast('"' + f.name + '" is too big: the test text can be up to 5 MB.', 5000); return; }
    setText(f.text.replace(/^﻿/, ''));
    Host.setTitle(f.name + ' - Regex Tester');
    toast('Opened ' + f.name + '. Ctrl+Z in the text brings back the earlier text.', 3500);
  }
  async function openFile() {
    try { const f = await Host.openFile({ title: 'Open a text file', types: ['.txt', '.log'] }); if (f) takeFile(f); }
    catch (e) { toast('Could not open the file: ' + e.message, 5000); }
  }
  async function openGiven(o) {
    try { takeFile(await Host.readPath(o.path, o.name)); }
    catch (e) { toast('Could not open "' + o.name + '": ' + e.message, 5000); }
  }
  $('openBtn').onclick = openFile;

  /* ---------- saved patterns ---------- */
  const writeSaved = () => Host.saveData('saved.json', JSON.stringify({ v: 1, patterns: saved }, null, 1));
  async function savePattern() {
    if (!patEl.value) { toast('Type a pattern first.'); patEl.focus(); return; }
    const name = $('saveName'), ok = $('saveOk'), warn = $('saveWarn');
    name.value = name.value || patEl.value.slice(0, 40);
    warn.hidden = true; ok.textContent = 'Save';
    let armed = false;
    ok.onclick = () => {
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      const i = saved.findIndex(s => s.name.toLowerCase() === n.toLowerCase());
      if (i >= 0 && !armed) { armed = true; warn.hidden = false; warn.textContent = 'A saved pattern is already called "' + saved[i].name + '". Press Replace it to overwrite it, or change the name.'; ok.textContent = 'Replace it'; return; }
      const entry = Rx.cleanSaved({ patterns: [{ name: n, pattern: patEl.value, flags, text: ta.value.slice(0, 100000), replacement: $('repl').value, saved: Date.now() }] })[0];
      if (i >= 0) saved[i] = entry; else saved.push(entry);
      saved.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      writeSaved(); $('saveDlg').done('saved');
      toast('Saved "' + n + '"');
    };
    name.oninput = () => { armed = false; warn.hidden = true; ok.textContent = 'Save'; };
    name.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } };
    const p = dialog('saveDlg', '#saveName'); name.select(); await p;
  }
  function drawSaved() {
    const box = $('savedList'); box.textContent = '';
    if (!saved.length) { box.append(h('p', 'muted', 'Nothing saved yet. Use Save pattern… to keep a pattern with its flags and text.')); return; }
    saved.forEach((s, i) => {
      const row = h('div', 'srow');
      const info = h('div', 'sinfo'); info.append(h('b', null, s.name), h('div', 'mono small muted', '/' + s.pattern + '/' + s.flags));
      const load = h('button', 'btn primary', 'Load'); load.setAttribute('aria-label', 'Load ' + s.name);
      const del = h('button', 'btn danger', 'Delete'); del.setAttribute('aria-label', 'Delete ' + s.name);
      load.onclick = () => { $('savedDlg').done('loaded'); loadSaved(s); };
      let t = 0;
      del.onclick = () => {
        if (!t) { del.textContent = 'Click again to delete'; t = setTimeout(() => { t = 0; del.textContent = 'Delete'; }, 3000); return; }
        clearTimeout(t); saved.splice(i, 1); writeSaved(); drawSaved(); toast('Deleted "' + s.name + '"');
        const first = $('savedList').querySelector('button') || $('savedDlg').querySelector('[data-act]'); first.focus();
      };
      row.append(info, load, del); box.append(row);
    });
  }
  function loadSaved(s) {
    patEl.value = s.pattern; flags = s.flags; drawFlags(); $('repl').value = s.replacement;
    if (s.text !== ta.value) setText(s.text);
    patEl.focus();
    saveSession(); run(false);
    toast('Loaded "' + s.name + '"' + (s.text ? '. Ctrl+Z in the text brings back the earlier text.' : ''), 3500);
  }
  $('saveBtn').onclick = savePattern;
  $('savedBtn').onclick = () => { drawSaved(); dialog('savedDlg', '#savedList button'); };

  /* ---------- theme ---------- */
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); toast(THEMES[settings.theme][1]); };

  /* ---------- keys ---------- */
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || document.querySelector('.ov:not([hidden])')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    let go = null;
    if (ctrl && !e.altKey && !e.shiftKey) go = { enter: () => run(true), o: openFile, s: savePattern }[k];
    else if (e.altKey && !ctrl) go = { 1: () => setTab('matches', true), 2: () => setTab('replace', true), 3: () => setTab('cheat', true), p: () => $('savedBtn').click() }[k];
    else if (e.key === 'F1') go = () => setTab('cheat', true);
    if (go) { e.preventDefault(); go(); }
  });

  /* ---------- start ---------- */
  (async () => {
    settings = await Host.loadSettings(settings);
    settings.live = settings.live !== false;
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme); setLive(settings.live);
    try { saved = Rx.cleanSaved(JSON.parse(await Host.loadData('saved.json') || '{}')); } catch (e) { saved = []; }
    let s = null;
    try { s = JSON.parse(await Host.loadData('session.json') || 'null'); } catch (e) { s = null; }
    if (s && typeof s === 'object') {
      patEl.value = typeof s.pattern === 'string' ? s.pattern : '';
      flags = Rx.cleanSaved({ patterns: [{ flags: s.flags }] })[0].flags;
      ta.value = typeof s.text === 'string' ? s.text : '';
      $('repl').value = typeof s.replacement === 'string' ? s.replacement : '';
      if (s.textTooBig) toast('The last test text was over 1 MB, so it was not kept.', 4000);
      setTab(s.tab);
    } else {
      patEl.value = '(?<year>\\d{4})-(?<month>\\d\\d)-(\\d\\d)';
      ta.value = 'Backups ran on 2026-11-02 and 2026-11-09.\nThe next one is due 2026-11-16.';
      $('repl').value = '$3/$<month>/$<year>';
    }
    drawFlags(); textInfo();
    Host.setTitle('Regex Tester');
    run(false);
    const start = Host.startFile();
    if (start) await openGiven(start);
    patEl.focus();
    window.__rx = { get res() { return res; }, get flags() { return flags; }, get cur() { return cur; }, get settings() { return settings; }, get saved() { return saved; }, writeSession, ready: true };
  })();
})();
