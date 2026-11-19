/* Compare: the window. Two texts, from files or pasted; their differences side by side or unified, with changed
   words marked; and the differences as a unified diff to copy or save. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const out = $('out');
  const fmt = n => n.toLocaleString('en-GB');
  const plural = (n, w) => fmt(n) + ' ' + w + (n === 1 ? '' : 's');
  const stem = n => n.replace(/\.[^.]+$/, '');

  let settings = { theme: 'auto', layout: 'side', space: 'none', caseless: false, words: true, context: '3' };
  const sides = { a: { name: 'Left', path: null, loaded: null }, b: { name: 'Right', path: null, loaded: null } };
  const area = s => $(s === 'a' ? 'textA' : 'textB');
  let result = null, blocks = [], open = new Set(), at = -1;

  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2400); }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function dialog(id, first) {
    const ov = $(id), back = document.activeElement;
    ov.hidden = false; (first ? ov.querySelector(first) : ov.querySelector('button')).focus();
    return new Promise(resolve => {
      const done = act => { ov.hidden = true; ov.removeEventListener('click', onClick); ov.removeEventListener('keydown', onKey); if (back && back.focus) back.focus(); resolve(act); };
      const onClick = e => { const b = e.target.closest('[data-act]'); if (b) done(b.dataset.act); };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); done('cancel'); } else if (e.key === 'Tab') { e.preventDefault(); const f = [...ov.querySelectorAll('button, textarea')]; f[(f.indexOf(document.activeElement) + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); } e.stopPropagation(); };
      ov.addEventListener('click', onClick); ov.addEventListener('keydown', onKey);
    });
  }

  /* ---------- the two sides ---------- */
  /* a text box turns \r\n into \n; the file's own text is used for comparing while the box still shows it unchanged */
  const norm = t => t.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const textOf = s => sides[s].loaded !== null && area(s).value === norm(sides[s].loaded) ? sides[s].loaded.replace(/^\uFEFF/, '') : area(s).value;
  function setSide(s, f) {
    sides[s] = { name: f.name, path: f.path || null, loaded: f.text };
    area(s).value = f.text.replace(/^\uFEFF/, '');
    if (/\u0000/.test(f.text)) toast('"' + f.name + '" looks like a binary file, not text: the comparison may not mean much.', 4500);
    names();
  }
  function names() {
    for (const s of ['a', 'b']) {
      const x = sides[s], edited = x.loaded !== null && area(s).value !== norm(x.loaded);
      $(s === 'a' ? 'nameA' : 'nameB').textContent = (x.loaded === null ? (s === 'a' ? 'Left' : 'Right') : x.name) + (edited ? ' (edited)' : '');
      $(s === 'a' ? 'nameA' : 'nameB').title = x.path || '';
      const n = Diff.lines(area(s).value).lines.length;
      $(s === 'a' ? 'stA' : 'stB').textContent = (s === 'a' ? 'Left: ' : 'Right: ') + (x.loaded === null ? (n ? 'pasted text' : 'empty') : x.path || x.name) + (n ? ' · ' + plural(n, 'line') : '');
    }
  }
  const label = s => sides[s].loaded === null ? (s === 'a' ? 'Left text' : 'Right text') : sides[s].name;
  async function openSide(s) {
    try {
      const f = await Host.openFile({ title: 'Open for the ' + (s === 'a' ? 'left' : 'right') + ' side' });
      if (!f) return;
      setSide(s, f);
      if (area('a').value && area('b').value) run(); else area(s === 'a' ? 'b' : 'a').focus();
    } catch (e) { toast(e.message, 4000); }
  }
  for (const b of document.querySelectorAll('[data-open]')) b.onclick = () => openSide(b.dataset.open);
  for (const b of document.querySelectorAll('[data-clear]')) b.onclick = () => { const s = b.dataset.clear; sides[s] = { name: s === 'a' ? 'Left' : 'Right', path: null, loaded: null }; area(s).value = ''; names(); area(s).focus(); };
  $('textA').addEventListener('input', names); $('textB').addEventListener('input', names);
  $('swapBtn').onclick = () => { const t = sides.a; sides.a = sides.b; sides.b = t; const v = area('a').value; area('a').value = area('b').value; area('b').value = v; names(); if (!$('diff').hidden) run(); };
  for (const s of ['a', 'b']) {
    const el = document.querySelector('.side[data-side=' + s + ']');
    el.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('drop'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', async e => { el.classList.remove('drop'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return; e.preventDefault(); setSide(s, await Host.readDropped(f)); });
  }

  /* ---------- comparing ---------- */
  function tab(which) {
    $('texts').hidden = which !== 'texts'; $('diff').hidden = which !== 'diff';
    $('tabTexts').setAttribute('aria-selected', String(which === 'texts')); $('tabDiff').setAttribute('aria-selected', String(which === 'diff'));
  }
  function run() {
    const a = textOf('a'), b = textOf('b');
    if (!a && !b) { toast('Put a text on each side first: open a file or paste it in.'); tab('texts'); area('a').focus(); return; }
    result = Diff.compare(a, b, { space: settings.space, caseless: settings.caseless });
    blocks = Diff.blocks(result); open = new Set(); at = -1;
    $('toast').classList.remove('show');
    tab('diff'); draw(); out.focus({ preventScroll: true }); out.scrollTop = 0;
    Host.setTitle(sides.a.loaded !== null || sides.b.loaded !== null ? label('a') + ' ↔ ' + label('b') + ' - Compare' : 'Compare');
  }
  function draw() {
    if (!result) return;
    const ctx = settings.context === 'all' ? Infinity : +settings.context, side = settings.layout === 'side';
    const A = result.a.lines, B = result.b.lines, changes = blocks.filter(x => !x.same);
    out.className = 'out ' + (side ? 'side' : 'uni');
    out.textContent = '';
    /* summary and notes */
    const removed = changes.reduce((n, c) => n + c.del.length, 0), added = changes.reduce((n, c) => n + c.ins.length, 0);
    const sum = $('summary'); sum.textContent = '';
    if (!changes.length) sum.append('No differences');
    else sum.append(plural(changes.length, 'change') + ': ', h('b', 'del', '−' + fmt(removed)), ' ', plural(removed, 'line').replace(/^\S+ /, '') + ' removed, ', h('b', 'ins', '+' + fmt(added)), ' added');
    const notes = [];
    if (result.a.crlf !== result.b.crlf && A.length && B.length) notes.push('The two use different line endings (' + (result.a.crlf ? 'Windows' : 'Unix') + ' on the left, ' + (result.b.crlf ? 'Windows' : 'Unix') + ' on the right); that is not counted as a difference.');
    if (result.a.eol !== result.b.eol && A.length && B.length) notes.push('Only one of them ends with a line break, so their last lines count as different.');
    if (settings.space !== 'none' || settings.caseless) notes.push('Ignoring ' + [settings.space === 'all' ? 'all spaces' : settings.space === 'change' ? 'changes in spacing' : '', settings.caseless ? 'upper and lower case' : ''].filter(Boolean).join(' and ') + '.');
    if (result.rough) notes.push('These texts differ in so many places that the middle part is shown as one block rather than lined up line by line.');
    $('notes').textContent = notes.join(' '); $('notes').hidden = !notes.length;
    for (const id of ['prevBtn', 'nextBtn', 'copyBtn', 'saveBtn']) $(id).disabled = !changes.length;
    if (!changes.length) {
      out.append(h('div', 'same-msg', A.length || B.length ? (notes.length && /Ignoring/.test(notes.join()) ? 'The two texts are the same, ignoring what is set above.' : 'The two texts are the same.') : 'Both sides are empty.'));
      return;
    }
    const frag = document.createDocumentFragment();
    let ci = 0;
    const text = (cls, content, words) => {
      const t = h('div', 'tx ' + cls);
      if (words) for (const w of words) { if (w.c) t.append(h('span', 'w', w.t)); else t.append(w.t); }
      else if (content !== null) t.textContent = content;
      return t;
    };
    const row = cells => { const r = h('div', 'row'); r.append(...cells); return r; };
    const sameRow = (i, j) => side ? row([h('div', 'ln', String(i + 1)), text('a', A[i]), h('div', 'ln', String(j + 1)), text('b', B[j])])
      : row([h('div', 'ln', String(i + 1)), h('div', 'ln', String(j + 1)), h('div', 'sg', ' '), text('', A[i])]);
    blocks.forEach((bl, bi) => {
      if (bl.same) {
        const first = bi === 0, last = bi === blocks.length - 1, keep = open.has(bi) ? Infinity : ctx;
        const head = first ? 0 : keep, tail = last ? 0 : keep;
        if (bl.n <= head + tail + 1) { for (let k = 0; k < bl.n; k++) frag.append(sameRow(bl.a + k, bl.b + k)); return; }
        for (let k = 0; k < head; k++) frag.append(sameRow(bl.a + k, bl.b + k));
        const hidden = bl.n - head - tail, f = h('div', 'fold');
        f.append(h('span', null, '⋯ ' + plural(hidden, 'unchanged line') + ' (' + (bl.a + head + 1) + '–' + (bl.a + head + hidden) + ')'));
        const b = h('button', 'btn', 'Show'); b.onclick = () => { open.add(bi); const y = out.scrollTop; draw(); out.scrollTop = y; }; f.append(b);
        frag.append(f);
        for (let k = bl.n - tail; k < bl.n; k++) frag.append(sameRow(bl.a + k, bl.b + k));
        return;
      }
      const box = h('div', 'change'); box.dataset.i = ci++;
      const pairs = Math.max(bl.del.length, bl.ins.length), wd = [];
      for (let k = 0; k < pairs; k++) wd.push(settings.words && k < bl.del.length && k < bl.ins.length ? Diff.words(A[bl.del[k]], B[bl.ins[k]], { space: settings.space, caseless: settings.caseless }) : null);
      if (side) {
        for (let k = 0; k < pairs; k++) {
          const i = bl.del[k], j = bl.ins[k], w = wd[k];
          box.append(row([h('div', 'ln', i === undefined ? '' : String(i + 1)), i === undefined ? text('a gap', null) : text('a del', A[i], w && w.a),
            h('div', 'ln', j === undefined ? '' : String(j + 1)), j === undefined ? text('b gap', null) : text('b ins', B[j], w && w.b)]));
        }
      } else {
        bl.del.forEach((i, k) => box.append(row([h('div', 'ln del', String(i + 1)), h('div', 'ln del', ''), h('div', 'sg del', '−'), text('del', A[i], wd[k] && wd[k].a)])));
        bl.ins.forEach((j, k) => box.append(row([h('div', 'ln ins', ''), h('div', 'ln ins', String(j + 1)), h('div', 'sg ins', '+'), text('ins', B[j], wd[k] && wd[k].b)])));
      }
      frag.append(box);
    });
    out.append(frag);
    if (at >= 0) mark(at, false);
  }
  function mark(i, scroll) {
    const list = out.querySelectorAll('.change');
    if (!list.length) return;
    at = (i + list.length) % list.length;
    list.forEach(c => c.classList.remove('cur'));
    list[at].classList.add('cur');
    if (scroll) list[at].scrollIntoView({ block: 'start' });
    $('summary').title = 'Change ' + (at + 1) + ' of ' + list.length;
    if (scroll) toast('Change ' + (at + 1) + ' of ' + list.length, 1200);
  }

  /* ---------- the unified diff ---------- */
  function unified() {
    let a = label('a'), b = label('b');
    if (a === b) { a = 'a/' + a; b = 'b/' + b; }
    return Diff.unified(result, a, b, 3);
  }
  async function copyDiff() {
    if (!result || !blocks.some(x => !x.same)) return;
    const t = unified();
    if (await Host.copy(t)) toast('Copied the unified diff (' + plural(t.split('\n').length - 1, 'line') + ')');
    else { $('copyText').value = t; const p = dialog('copyDlg', '#copyText'); $('copyText').select(); await p; }
  }
  async function saveDiff() {
    if (!result || !blocks.some(x => !x.same)) return;
    try {
      const f = await Host.saveFile({ title: 'Save the differences', name: stem(label('a')) + ' vs ' + stem(label('b')) + '.diff', types: ['.diff', '.patch'], text: unified(), mime: 'text/x-diff' });
      if (f) toast('Saved ' + f.name);
    } catch (e) { toast('Could not save: ' + e.message, 4500); }
  }

  /* ---------- controls ---------- */
  $('compareBtn').onclick = run;
  $('tabDiff').onclick = run;
  $('tabTexts').onclick = () => { tab('texts'); area('a').focus(); };
  const setLayout = l => { settings.layout = l; $('sideBtn').setAttribute('aria-pressed', String(l === 'side')); $('uniBtn').setAttribute('aria-pressed', String(l === 'uni')); Host.saveSettings(settings); draw(); };
  $('sideBtn').onclick = () => setLayout('side'); $('uniBtn').onclick = () => setLayout('uni');
  $('space').onchange = () => { settings.space = $('space').value; Host.saveSettings(settings); if (!$('diff').hidden) run(); };
  $('caseless').onchange = () => { settings.caseless = $('caseless').checked; Host.saveSettings(settings); if (!$('diff').hidden) run(); };
  $('words').onchange = () => { settings.words = $('words').checked; Host.saveSettings(settings); draw(); };
  $('context').onchange = () => { settings.context = $('context').value; Host.saveSettings(settings); draw(); };
  $('prevBtn').onclick = () => mark(at - 1, true);
  $('nextBtn').onclick = () => mark(at + 1, true);
  $('copyBtn').onclick = copyDiff; $('saveBtn').onclick = saveDiff;
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
    if (document.querySelector('.ov:not([hidden])')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    let fn = null;
    if (ctrl && e.key === 'Enter') fn = run;
    else if (e.key === 'F7') fn = () => { if (!$('diff').hidden) mark(at + (e.shiftKey ? -1 : 1), true); };
    else if (ctrl && !e.shiftKey && k === 's') fn = () => { if (!$('diff').hidden) saveDiff(); else toast('Compare first, then save the differences.'); };
    else if (ctrl && e.shiftKey && k === 'c' && !$('diff').hidden) fn = copyDiff;
    else if (ctrl && !e.shiftKey && k === 'o') fn = () => openSide(area('a').value ? 'b' : 'a');
    else if (e.key === 'Escape' && !$('diff').hidden) fn = () => { tab('texts'); area('a').focus(); };
    else if (e.key === 'F1') fn = () => dialog('helpDlg');
    if (!fn) return;
    e.preventDefault(); fn();
  });

  /* a file opened with Compare goes to the empty side; when both are full, the right one moves left */
  async function arrive(f) {
    try {
      const file = await Host.readPath(f.path, f.name);
      if (!area('a').value) setSide('a', file);
      else if (!area('b').value) setSide('b', file);
      else { sides.a = sides.b; area('a').value = area('b').value; setSide('b', file); }
      if (area('a').value && area('b').value) run();
      else { tab('texts'); toast(file.name + ' is on the left. Now open or paste the text to compare it with.', 4000); area('b').focus(); }
    } catch (e) { toast(e.message, 4000); }
  }

  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    $('space').value = settings.space; $('caseless').checked = !!settings.caseless; $('words').checked = settings.words !== false; $('context').value = String(settings.context);
    $('sideBtn').setAttribute('aria-pressed', String(settings.layout !== 'uni')); $('uniBtn').setAttribute('aria-pressed', String(settings.layout === 'uni'));
    names();
    const start = Host.startFile();
    if (start) await arrive(start); else area('a').focus();
    Host.onOpenFile(arrive);
    window.__cmp = { get result() { return result; }, get blocks() { return blocks; }, get at() { return at; }, unified: () => result && unified() };
  })();
})();
