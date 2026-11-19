/* Minesweeper, ported from the 0.x package to PortD 1.0 (package format 3). The game rules are unchanged from 0.x;
   added in the port: keyboard play, light and dark colours following the system (or chosen), Reset asking for a
   second click, and saving outside PortD in the browser's localStorage (through host.js). */
(() => {
  const LEVELS = { beginner:[9,9,10], intermediate:[16,16,40], expert:[30,16,99] };
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), wrap = $('wrap');

  let W, H, M, level = 'beginner', custom = [20,12,35];
  let mine, open, flag, adj, cells, started, over, revealed, timer = null, t0 = 0, secs = 0, flagMode = false;
  let best = {}, settings = { level: 'beginner', custom: [20,12,35], theme: 'auto' }, kc = 0;

  // ---- storage: P:\User\Config\minesweeper\settings.json and best.json (localStorage outside PortD)
  async function loadBest() { try { const t = await Host.loadData('best.json'); const b = t ? JSON.parse(t) : {}; return b && typeof b === 'object' ? b : {}; } catch { return {}; } }
  function saveBest() { Host.saveData('best.json', JSON.stringify(best)); }
  function saveSettings() { settings.level = level; settings.custom = custom; Host.saveSettings(settings); }

  function msg(t, ms = 2500) { const m = $('msg'); m.innerHTML = '<span></span>'; m.firstChild.textContent = t; clearTimeout(msg.h); msg.h = setTimeout(() => m.innerHTML = '', ms); }
  const pad3 = n => n < 0 ? '-' + String(Math.min(99, -n)).padStart(2, '0') : String(Math.min(999, n)).padStart(3, '0');
  const cap = s => s[0].toUpperCase() + s.slice(1);

  function newGame() {
    [W, H, M] = level === 'custom' ? custom : LEVELS[level];
    const N = W * H;
    mine = new Uint8Array(N); open = new Uint8Array(N); flag = new Uint8Array(N); adj = new Uint8Array(N);
    started = false; over = false; revealed = 0; secs = 0; kc = Math.min(kc, N - 1);
    clearInterval(timer); timer = null;
    $('face').textContent = '🙂';
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${W}, var(--s))`;
    boardEl.style.gridTemplateRows = `repeat(${H}, var(--s))`;
    boardEl.setAttribute('aria-rowcount', H); boardEl.setAttribute('aria-colcount', W);
    cells = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < N; i++) { const d = document.createElement('div'); d.className = 'c'; d.dataset.i = i; d.id = 'c' + i; d.setAttribute('role', 'gridcell'); frag.appendChild(d); cells.push(d); }
    boardEl.appendChild(frag);
    for (let i = 0; i < N; i++) draw(i);
    fit(); updCounters(); cursor(kc);
    Host.setTitle(`Minesweeper – ${cap(level)}`);
  }

  function fit() {
    if (!W) return;
    const s = Math.max(14, Math.min(40, Math.floor(Math.min((wrap.clientWidth - 16) / W, (wrap.clientHeight - 16) / H)) - 1));
    boardEl.style.setProperty('--s', s + 'px');
    boardEl.style.fontSize = Math.round(s * 0.58) + 'px';
  }
  new ResizeObserver(fit).observe(wrap);

  const nb = i => { const x = i % W, y = (i / W) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) r.push(ny * W + nx); } return r; };

  function plant(safe) {
    const N = W * H, banned = new Set([safe]);
    if (N - 9 >= M) nb(safe).forEach(j => banned.add(j)); // keep first click an opening when there is room
    const pool = []; for (let i = 0; i < N; i++) if (!banned.has(i)) pool.push(i);
    for (let k = 0; k < M && pool.length; k++) { const r = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[r]] = [pool[r], pool[k]]; mine[pool[k]] = 1; }
    for (let i = 0; i < N; i++) adj[i] = nb(i).reduce((a, j) => a + mine[j], 0);
    started = true; t0 = Date.now();
    timer = setInterval(() => { secs = Math.floor((Date.now() - t0) / 1000); $('time').textContent = pad3(secs); }, 250);
  }

  function reveal(i) {
    if (open[i] || flag[i] === 1) return;
    if (mine[i]) { lose(i); return; }
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      if (open[k] || flag[k] === 1) continue;
      open[k] = 1; flag[k] = 0; revealed++; draw(k);
      if (adj[k] === 0) nb(k).forEach(j => { if (!open[j] && !mine[j]) stack.push(j); });
    }
    if (revealed === W * H - M) win();
  }

  function chord(i) {
    const n = nb(i), f = n.filter(j => flag[j] === 1).length;
    if (f === adj[i]) n.forEach(j => { if (!over) reveal(j); });
  }

  function draw(i) {
    const d = cells[i];
    d.className = 'c' + (i === kc ? ' kc' : ''); d.textContent = '';
    let label;
    if (open[i]) { d.classList.add('o'); if (adj[i]) { d.textContent = adj[i]; d.classList.add('n' + adj[i]); } label = adj[i] ? String(adj[i]) : 'empty'; }
    else if (flag[i] === 1) { d.textContent = '🚩'; label = 'flagged'; }
    else if (flag[i] === 2) { d.textContent = '❓'; label = 'question mark'; }
    else label = 'hidden';
    d.setAttribute('aria-label', 'Row ' + ((i / W | 0) + 1) + ', column ' + (i % W + 1) + ': ' + label);
  }

  function updCounters() {
    let f = 0; for (let i = 0; i < flag.length; i++) if (flag[i] === 1) f++;
    $('mines').textContent = pad3(M - f);
    $('time').textContent = pad3(secs);
  }

  function lose(i) {
    over = true; clearInterval(timer);
    $('face').textContent = '😵';
    for (let k = 0; k < W * H; k++) {
      if (mine[k] && flag[k] !== 1) { cells[k].textContent = '💣'; cells[k].className = 'c o'; cells[k].setAttribute('aria-label', 'mine'); }
      else if (!mine[k] && flag[k] === 1) { cells[k].textContent = '❌'; cells[k].className = 'c o wrong'; cells[k].setAttribute('aria-label', 'wrong flag'); }
    }
    cells[i].classList.add('boom');
    msg('Boom! Press the face to try again.');
  }

  function win() {
    over = true; clearInterval(timer);
    secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
    $('face').textContent = '😎';
    for (let k = 0; k < W * H; k++) if (mine[k]) { flag[k] = 1; draw(k); }
    updCounters();
    if (level !== 'custom') {
      const prev = best[level];
      if (!prev || secs < prev.t) { best[level] = { t: secs, d: new Date().toISOString().slice(0, 10) }; saveBest(); msg(`New best time: ${secs}s!`, 4000); Host.notify(`new ${level} record, ${secs}s`); return; }
    }
    msg(`You win! ${secs}s`, 4000);
  }

  function toggleFlag(i) {
    if (open[i] || over) return;
    flag[i] = (flag[i] + 1) % 3; draw(i); updCounters();
  }

  function act(i, button) {
    if (over) return;
    if (button === 2 || (flagMode && button === 0 && !open[i])) { toggleFlag(i); return; }
    if (open[i]) { if (adj[i]) chord(i); return; }
    if (flag[i] === 1) return;
    if (!started) plant(i);
    reveal(i);
  }

  // ---- input: mouse + touch with long-press
  let press = null;
  boardEl.addEventListener('contextmenu', e => e.preventDefault());
  boardEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.c'); if (!c || over) return;
    const i = +c.dataset.i;
    cursor(i);
    if (!over) $('face').textContent = '😮';
    if (e.pointerType === 'touch') {
      press = { i, long: false, h: setTimeout(() => { press.long = true; toggleFlag(i); if (navigator.vibrate) navigator.vibrate(30); }, 420) };
    } else press = { i, button: e.button };
  });
  boardEl.addEventListener('pointerup', e => {
    if (!over) $('face').textContent = '🙂';
    if (!press) return;
    const p = press; press = null;
    const c = e.target.closest('.c');
    if (e.pointerType === 'touch') { clearTimeout(p.h); if (!p.long && c && +c.dataset.i === p.i) act(p.i, 0); return; }
    if (c && +c.dataset.i === p.i) act(p.i, p.button);
  });
  boardEl.addEventListener('pointercancel', () => { if (press && press.h) clearTimeout(press.h); press = null; if (!over) $('face').textContent = '🙂'; });

  // ---- keyboard (added in the port): a cursor on the board
  function cursor(i) {
    const old = cells[kc]; if (old) old.classList.remove('kc');
    kc = Math.max(0, Math.min(W * H - 1, i));
    cells[kc].classList.add('kc');
    boardEl.setAttribute('aria-activedescendant', 'c' + kc);
  }
  boardEl.addEventListener('keydown', e => {
    const x = kc % W, y = kc / W | 0;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (mv) { e.preventDefault(); cursor(Math.max(0, Math.min(H - 1, y + mv[1])) * W + Math.max(0, Math.min(W - 1, x + mv[0]))); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(kc, 0); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); if (!over) toggleFlag(kc); }
    else if (e.key === 'Home') { e.preventDefault(); cursor(y * W); }
    else if (e.key === 'End') { e.preventDefault(); cursor(y * W + W - 1); }
  });

  $('face').onclick = newGame;
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') { e.preventDefault(); closeDialogs(); newGame(); boardEl.focus(); }
    else if (e.key === 'F1') { e.preventDefault(); showDlg('helpDlg'); }
    else if (e.key === 'Escape') { const open = document.querySelector('.dlg.show'); if (open) { e.preventDefault(); (open.id === 'customDlg' ? $('cCancel') : open.querySelector('.pri')).click(); } }
  });
  $('flagMode').onclick = () => { flagMode = !flagMode; $('flagMode').classList.toggle('on', flagMode); $('flagMode').setAttribute('aria-pressed', String(flagMode)); };

  // ---- dialogs: focus goes in, Tab stays in, Esc closes, focus comes back
  let back = null;
  function showDlg(id) { back = document.activeElement; $(id).classList.add('show'); ($(id).querySelector('input') || $(id).querySelector('.pri')).focus(); }
  function hideDlg(id) { $(id).classList.remove('show'); if (back && back.focus) back.focus(); }
  function closeDialogs() { document.querySelectorAll('.dlg.show').forEach(d => d.classList.remove('show')); }
  document.querySelectorAll('.dlg').forEach(d => d.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...d.querySelectorAll('input, button')], i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }));

  $('level').onchange = () => {
    const v = $('level').value;
    if (v === 'custom') { $('cw').value = custom[0]; $('ch').value = custom[1]; $('cm').value = custom[2]; showDlg('customDlg'); return; }
    level = v; saveSettings(); newGame();
  };
  $('cCancel').onclick = () => { hideDlg('customDlg'); $('level').value = level; };
  $('cOk').onclick = () => {
    const w = Math.max(5, Math.min(40, +$('cw').value | 0)), h = Math.max(5, Math.min(30, +$('ch').value | 0));
    const m = Math.max(1, Math.min(w * h - 1, +$('cm').value | 0));
    custom = [w, h, m]; level = 'custom'; hideDlg('customDlg');
    saveSettings(); newGame();
  };
  $('customDlg').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('cOk').click(); } });

  let resetArmed = 0;
  function showBest() {
    const t = $('bestTbl'); t.innerHTML = '';
    for (const k of Object.keys(LEVELS)) {
      const r = t.insertRow(), b = best[k];
      r.insertCell().textContent = cap(k);
      r.insertCell().textContent = b ? b.t + ' s' : '—';
      r.insertCell().textContent = b ? b.d : '';
    }
    resetArmed = 0; $('bestReset').textContent = 'Reset'; $('bestReset').classList.remove('danger');
    if (!$('bestDlg').classList.contains('show')) showDlg('bestDlg');
  }
  $('bestBtn').onclick = showBest;
  $('bestClose').onclick = () => hideDlg('bestDlg');
  /* destructive: the first click asks, a second click within 3 seconds resets */
  $('bestReset').onclick = () => {
    if (Date.now() - resetArmed > 3000) { resetArmed = Date.now(); $('bestReset').textContent = 'Click again to reset'; $('bestReset').classList.add('danger'); return; }
    best = {}; saveBest(); showBest(); msg('Best times reset');
  };
  $('helpBtn').onclick = () => showDlg('helpDlg');
  $('helpClose').onclick = () => hideDlg('helpDlg');

  // ---- theme (added in the port)
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); saveSettings(); msg(THEMES[settings.theme][1], 1500); };

  // expose for testing
  window.__ms = { get state() { return { W, H, M, over, revealed, mine, open, flag, adj, started, level, kc }; }, act, newGame };

  (async () => {
    settings = await Host.loadSettings(settings);
    if (Array.isArray(settings.custom) && settings.custom.length === 3) custom = settings.custom.map(n => +n | 0);
    if (LEVELS[settings.level] || settings.level === 'custom') level = settings.level;
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    $('level').value = level;
    best = await loadBest();
    newGame();
    boardEl.focus();
  })();
})();
