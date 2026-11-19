/* Sudoku, ported from the 0.x package to PortD 1.0 (package format 3). The puzzles and rules are unchanged from 0.x;
   added in the port: a theme button (the system's light or dark by default, as before), screen reader labels,
   Reset stats asking for a second click, and saving outside PortD in localStorage (through host.js). */
(() => {
  const $ = id => document.getElementById(id);
  const gridEl = $('grid'), wrap = $('wrap');
  const TARGET = { easy:40, medium:32, hard:27, expert:24 };
  const ROW = i => (i / 9) | 0, COL = i => i % 9, BOX = i => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
  const PEERS = Array.from({ length:81 }, (_, i) => { const s = new Set(); for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j); return [...s]; });

  // ---------- solver / generator (bitmask backtracking)
  function solve(g, limit = 2, randomize = false) {
    const a = g.slice(); let count = 0, first = null;
    const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (a[i]) { const b = 1 << a[i]; if ((rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]) & b) return { count:0 }; rows[ROW(i)] |= b; cols[COL(i)] |= b; boxes[BOX(i)] |= b; }
    function rec() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) if (!a[i]) {
        const m = ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]) & 0x3FE;
        let n = 0, x = m; while (x) { x &= x - 1; n++; }
        if (n < bestN) { best = i; bestMask = m; bestN = n; if (n <= 1) break; }
      }
      if (best < 0) { count++; if (!first) first = a.slice(); return count >= limit; }
      if (!bestN) return false;
      const ds = []; for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) ds.push(d);
      if (randomize) shuffle(ds);
      const r = ROW(best), c = COL(best), bx = BOX(best);
      for (const d of ds) {
        const b = 1 << d; a[best] = d; rows[r] |= b; cols[c] |= b; boxes[bx] |= b;
        if (rec()) return true;
        rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b; a[best] = 0;
      }
      return false;
    }
    rec();
    return { count, solution:first };
  }
  function shuffle(x) { for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

  function generateOnce(target) {
    const sol = solve(new Array(81).fill(0), 1, true).solution;
    const puzzle = sol.slice();
    let clues = 81;
    const tryRemove = pair => {
      if (clues <= target || pair.some(k => !puzzle[k])) return;
      const saved = pair.map(k => puzzle[k]);
      pair.forEach(k => puzzle[k] = 0);
      if (solve(puzzle, 2).count !== 1) pair.forEach((k, n) => puzzle[k] = saved[n]);
      else clues -= pair.length;
    };
    // symmetric pairs first (nicer looking), then single cells to get sparser
    for (const i of shuffle([...Array(41).keys()])) tryRemove(i === 40 ? [40] : [i, 80 - i]);
    for (const i of shuffle([...Array(81).keys()])) tryRemove([i]);
    return { puzzle, solution:sol, clues };
  }
  function generate(diff) {
    const target = TARGET[diff], t0 = performance.now();
    let best = null;
    do { const g = generateOnce(target); if (!best || g.clues < best.clues) best = g; }
    while (best.clues > target && performance.now() - t0 < 1500);
    return best;
  }

  // ---------- state
  let S = null;            // { diff, puzzle, solution, values, notes(bitmask), mistakes, elapsed, done }
  let sel = -1, notesMode = false, autoCheck = true, paused = false, undo = [], tick = null, lastTick = 0;
  let stats = {}, settings = { theme: 'auto' };
  const cells = [];

  // storage: P:\User\Config\sudoku\game.json, stats.json, settings.json (localStorage outside PortD)
  async function load(name, def) { try { const t = await Host.loadData(name); return t ? JSON.parse(t) : def; } catch { return def; } }
  let saveH = null;
  function save(name, obj) { Host.saveData(name, JSON.stringify(obj)); }
  function saveGame() { clearTimeout(saveH); saveH = setTimeout(() => save('game.json', { ...S, autoCheck }), 400); }
  function msg(t, ms = 2500) { const m = $('msg'); m.innerHTML = '<span></span>'; m.firstChild.textContent = t; clearTimeout(msg.h); msg.h = setTimeout(() => m.innerHTML = '', ms); }

  function build() {
    for (let i = 0; i < 81; i++) {
      const d = document.createElement('div'); d.className = 'c'; d.dataset.i = i; d.id = 'c' + i; d.setAttribute('role', 'gridcell');
      if (COL(i) === 2 || COL(i) === 5) d.classList.add('br');
      if (ROW(i) === 2 || ROW(i) === 5) d.classList.add('bb');
      if (ROW(i) === 8) d.classList.add('lastrow');
      gridEl.appendChild(d); cells.push(d);
    }
    for (let n = 1; n <= 9; n++) { const b = document.createElement('button'); b.dataset.n = n; b.innerHTML = n + '<small></small>'; b.setAttribute('aria-label', 'Enter ' + n); $('pad').appendChild(b); }
  }

  function fit() {
    const s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    gridEl.style.width = gridEl.style.height = s + 'px';
    gridEl.style.fontSize = Math.round(s / 9 * 0.55) + 'px';
    gridEl.style.setProperty('--nf', Math.round(s / 9 * 0.24) + 'px');
    for (const c of cells) { const n = c.querySelector('.notes'); if (n) n.style.fontSize = Math.max(8, Math.round(s / 9 * 0.24)) + 'px'; }
  }
  new ResizeObserver(fit).observe(wrap);

  function render() {
    const v = S.values, selVal = sel >= 0 ? v[sel] : 0;
    const counts = new Array(10).fill(0);
    const nf = Math.max(8, Math.round(parseInt(gridEl.style.width || 300) / 9 * 0.24)) + 'px';
    for (let i = 0; i < 81; i++) {
      const c = cells[i], val = v[i];
      if (val && val === S.solution[i]) counts[val]++;
      let cls = 'c' + (COL(i) === 2 || COL(i) === 5 ? ' br' : '') + (ROW(i) === 2 || ROW(i) === 5 ? ' bb' : '') + (ROW(i) === 8 ? ' lastrow' : '');
      cls += S.puzzle[i] ? ' g' : (val ? ' u' : '');
      if (sel >= 0 && i !== sel && PEERS[sel].includes(i)) cls += ' peer';
      if (selVal && val === selVal && i !== sel) cls += ' same';
      if (i === sel) cls += ' sel';
      let wrong = false;
      if (val && !S.puzzle[i]) {
        const conflict = PEERS[i].some(j => v[j] === val);
        if (conflict || (autoCheck && val !== S.solution[i])) { cls += ' err'; wrong = true; }
      }
      c.className = cls;
      if (val) c.textContent = val;
      else if (S.notes[i]) {
        let h = '<div class="notes" style="font-size:' + nf + '">';
        for (let n = 1; n <= 9; n++) h += `<span${S.notes[i] & (1 << n) && n === selVal ? ' class="hl"' : ''}>${S.notes[i] & (1 << n) ? n : ''}</span>`;
        c.innerHTML = h + '</div>';
      } else c.textContent = '';
      const notes = []; for (let n = 1; n <= 9; n++) if (S.notes[i] & (1 << n)) notes.push(n);
      c.setAttribute('aria-label', 'Row ' + (ROW(i) + 1) + ', column ' + (COL(i) + 1) + ': ' + (val ? val + (S.puzzle[i] ? ', given' : wrong ? ', wrong' : '') : notes.length ? 'notes ' + notes.join(' ') : 'empty'));
    }
    if (sel >= 0) gridEl.setAttribute('aria-activedescendant', 'c' + sel); else gridEl.removeAttribute('aria-activedescendant');
    for (const b of $('pad').children) { const n = +b.dataset.n, left = 9 - counts[n]; b.classList.toggle('done', left <= 0); b.querySelector('small').textContent = left > 0 ? left : ''; }
    $('notesBtn').classList.toggle('on', notesMode); $('notesBtn').setAttribute('aria-pressed', String(notesMode));
    $('checkBtn').classList.toggle('on', autoCheck); $('checkBtn').setAttribute('aria-pressed', String(autoCheck));
    $('mistakes').textContent = autoCheck ? `Mistakes: ${S.mistakes}` : '';
    $('time').textContent = fmt(S.elapsed);
  }
  const fmt = s => { s = Math.floor(s); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };

  function startClock() {
    clearInterval(tick); lastTick = Date.now();
    tick = setInterval(() => {
      const now = Date.now();
      if (!paused && !S.done && document.visibilityState === 'visible') { S.elapsed += (now - lastTick) / 1000; $('time').textContent = fmt(S.elapsed); if (Math.floor(S.elapsed) % 10 === 0) saveGame(); }
      lastTick = now;
    }, 500);
  }

  function newGame(diff) {
    msg('Generating puzzle…', 800);
    setTimeout(() => {
      const g = generate(diff);
      S = { diff, puzzle:g.puzzle, solution:g.solution, values:g.puzzle.slice(), notes:new Array(81).fill(0), mistakes:0, elapsed:0, done:false };
      sel = -1; undo = []; paused = false; $('paused').style.display = 'none'; $('pauseBtn').textContent = '⏸';
      stats[diff] = stats[diff] || { played:0, won:0, best:null }; stats[diff].played++; save('stats.json', stats);
      Host.setTitle('Sudoku – ' + diff[0].toUpperCase() + diff.slice(1));
      render(); saveGame(); startClock();
    }, 20);
  }

  function push() { undo.push({ values:S.values.slice(), notes:S.notes.slice(), sel }); if (undo.length > 300) undo.shift(); }

  function input(n) {
    if (sel < 0 || S.done || paused || S.puzzle[sel]) return;
    if (notesMode) {
      if (S.values[sel]) return;
      push(); S.notes[sel] ^= (1 << n);
    } else {
      if (S.values[sel] === n) return;
      push();
      S.values[sel] = n; S.notes[sel] = 0;
      PEERS[sel].forEach(j => S.notes[j] &= ~(1 << n));
      if (n !== S.solution[sel] && autoCheck) S.mistakes++;
    }
    render(); saveGame(); checkWin();
  }
  function erase() { if (sel < 0 || S.done || S.puzzle[sel] || (!S.values[sel] && !S.notes[sel])) return; push(); S.values[sel] = 0; S.notes[sel] = 0; render(); saveGame(); }
  function doUndo() { const u = undo.pop(); if (!u || S.done) return; S.values = u.values; S.notes = u.notes; sel = u.sel; render(); saveGame(); }
  function hint() {
    if (S.done || paused) return;
    let i = sel >= 0 && S.values[sel] !== S.solution[sel] ? sel : -1;
    if (i < 0) { const wrong = []; for (let k = 0; k < 81; k++) if (S.values[k] !== S.solution[k]) wrong.push(k); if (!wrong.length) return; i = wrong[Math.floor(Math.random() * wrong.length)]; }
    push(); S.values[i] = S.solution[i]; S.notes[i] = 0; PEERS[i].forEach(j => S.notes[j] &= ~(1 << S.solution[i]));
    sel = i; render(); cells[i].classList.add('hint'); saveGame(); checkWin();
  }
  function checkWin() {
    for (let i = 0; i < 81; i++) if (S.values[i] !== S.solution[i]) return;
    S.done = true; clearInterval(tick);
    const st = stats[S.diff] = stats[S.diff] || { played:1, won:0, best:null };
    st.won++; const t = Math.round(S.elapsed); const rec = st.best == null || t < st.best; if (rec) st.best = t;
    save('stats.json', stats); saveGame();
    sel = -1; render();
    msg(`Solved in ${fmt(t)}${rec ? ' – new best!' : ''}`, 5000);
    Host.notify(`${S.diff} solved in ${fmt(t)}`);
  }

  function setPaused(p) { if (S.done) return; paused = p; $('paused').style.display = p ? 'flex' : 'none'; $('pauseBtn').textContent = p ? '▶' : '⏸'; $('pauseBtn').setAttribute('aria-label', p ? 'Continue' : 'Pause'); }

  // ---------- events
  gridEl.addEventListener('pointerdown', e => { const c = e.target.closest('.c'); if (!c || paused) return; sel = +c.dataset.i; render(); });
  $('pad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) input(+b.dataset.n); });
  $('eraseBtn').onclick = erase;
  $('undoBtn').onclick = doUndo;
  $('hintBtn').onclick = hint;
  $('notesBtn').onclick = () => { notesMode = !notesMode; render(); };
  $('checkBtn').onclick = () => { autoCheck = !autoCheck; render(); saveGame(); };
  const inProgress = () => !S.done && S.values.some((v, i) => v && !S.puzzle[i]);
  $('newBtn').onclick = () => { if (inProgress() && !confirmNew()) return; newGame($('diff').value); };
  $('diff').onchange = () => { if (inProgress()) { msg(`Difficulty set – click New game to start a ${$('diff').value} puzzle`, 3000); return; } newGame($('diff').value); };
  $('pauseBtn').onclick = () => setPaused(!paused);
  $('paused').onclick = () => setPaused(false);
  let confirmAt = 0;
  function confirmNew() { if (Date.now() - confirmAt < 3000) return true; confirmAt = Date.now(); msg('Click New game again to abandon this puzzle', 3000); return false; }

  let back = null, resetAt = 0;
  function showInfo() {
    const t = $('statTbl'); t.innerHTML = '<tr><td></td><td>Played</td><td>Won</td><td>Best</td></tr>';
    for (const k of Object.keys(TARGET)) { const s = stats[k] || {}; const r = t.insertRow(); [k[0].toUpperCase() + k.slice(1), s.played || 0, s.won || 0, s.best != null ? fmt(s.best) : '—'].forEach(x => r.insertCell().textContent = x); }
    resetAt = 0; $('statReset').textContent = 'Reset stats'; $('statReset').classList.remove('danger');
    if (!$('infoDlg').classList.contains('show')) { back = document.activeElement; $('infoDlg').classList.add('show'); $('infoClose').focus(); }
  }
  function hideInfo() { $('infoDlg').classList.remove('show'); if (back && back.focus) back.focus(); }
  $('menuBtn').onclick = showInfo;
  $('infoClose').onclick = hideInfo;
  /* destructive: the first click asks, a second click within 3 seconds resets */
  $('statReset').onclick = () => {
    if (Date.now() - resetAt > 3000) { resetAt = Date.now(); $('statReset').textContent = 'Click again to reset'; $('statReset').classList.add('danger'); return; }
    stats = {}; save('stats.json', stats); showInfo(); msg('Statistics reset');
  };
  $('infoDlg').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); hideInfo(); }
    else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === $('infoClose') ? $('statReset') : $('infoClose')).focus(); }
    e.stopPropagation();
  });

  document.addEventListener('keydown', e => {
    if (!S || $('infoDlg').classList.contains('show')) return;
    const onControl = /^(BUTTON|SELECT)$/.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
    if (e.key === 'F1') { e.preventDefault(); showInfo(); return; }
    if (e.key === ' ' && !onControl) { e.preventDefault(); setPaused(!paused); return; }
    if (paused || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) { input(+e.key); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { erase(); return; }
    if (e.key.toLowerCase() === 'n') { notesMode = !notesMode; render(); return; }
    if (e.key.toLowerCase() === 'h') { hint(); return; }
    const mv = { ArrowUp:-9, ArrowDown:9, ArrowLeft:-1, ArrowRight:1 }[e.key];
    if (mv && !(onControl && e.target.tagName === 'SELECT')) { e.preventDefault(); if (sel < 0) sel = 0; else { const r = ROW(sel), c = COL(sel); if (mv === -9) sel = ((r + 8) % 9) * 9 + c; else if (mv === 9) sel = ((r + 1) % 9) * 9 + c; else if (mv === -1) sel = r * 9 + (c + 8) % 9; else sel = r * 9 + (c + 1) % 9; } render(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S) saveGame(); });

  // ---------- theme (added in the port; follows the system by default, as 0.x did)
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); msg(THEMES[settings.theme][1], 1500); };

  window.__sd = { get S() { return S; }, solve, generate, input, select:i => { sel = i; render(); } };

  build();
  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    stats = await load('stats.json', {});
    const g = await load('game.json', null);
    if (g && Array.isArray(g.values) && g.values.length === 81 && !g.done) {
      S = g; autoCheck = g.autoCheck !== false; delete S.autoCheck;
      $('diff').value = S.diff; render(); startClock(); fit(); render();
      Host.setTitle('Sudoku – ' + S.diff[0].toUpperCase() + S.diff.slice(1));
      msg('Resumed your last game');
    } else { fit(); newGame('easy'); }
    gridEl.focus();
  })();
})();
