/* Solitaire (Klondike), ported from the 0.x package to PortD 1.0 (package format 3). The rules, scoring and
   statistics are unchanged from 0.x; added in the port: playing from the keyboard, a dark theme following the system,
   Reset stats asking for a second click, and saving outside PortD in localStorage (through host.js). */
(() => {
  const $ = id => document.getElementById(id);
  const table = $('table');
  const SUITS = ['♠','♥','♦','♣'], RANKS = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const NAMES = ['spades','hearts','diamonds','clubs'], RNAMES = ['','ace','2','3','4','5','6','7','8','9','10','jack','queen','king'];
  const isRed = c => c.s === 1 || c.s === 2;

  let G = null;          // { stock, waste, found[4], tab[7], draw, score, moves, elapsed, done, recycles }
  let undoStack = [], stats = {}, tick = null, lastTick = 0, L = null, autoRunning = false;
  let settings = { draw: 1, theme: 'auto' };
  const els = new Map(); // card id -> element
  const slots = {};

  // storage: P:\User\Config\solitaire\game.json, stats.json, settings.json (localStorage outside PortD)
  async function load(n, d) { try { const t = await Host.loadData(n); return t ? JSON.parse(t) : d; } catch { return d; } }
  function save(n, o) { Host.saveData(n, JSON.stringify(o)); }
  let saveH; function saveGame() { clearTimeout(saveH); saveH = setTimeout(() => save('game.json', G), 400); }
  function msg(t, ms = 2500) { const m = $('msg'); m.innerHTML = '<span></span>'; m.firstChild.textContent = t; clearTimeout(msg.h); msg.h = setTimeout(() => m.innerHTML = '', ms); }
  const fmt = s => { s = Math.floor(s); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };

  // ---------- game setup
  function deal(draw) {
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ id:s * 13 + r - 1, s, r, up:false });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const tab = [[],[],[],[],[],[],[]];
    for (let c = 0; c < 7; c++) for (let k = c; k < 7; k++) tab[k].push(deck.pop());
    tab.forEach(col => col[col.length - 1].up = true);
    return { stock:deck, waste:[], found:[[],[],[],[]], tab, draw, score:0, moves:0, elapsed:0, done:false, recycles:0 };
  }

  function newGame() {
    G = deal(+$('drawSel').value); undoStack = []; held = null;
    stats.played = (stats.played || 0) + 1; save('stats.json', stats);
    buildCards(); layout(true); saveGame(); startClock();
  }

  function snapshot() { undoStack.push(JSON.stringify(G)); if (undoStack.length > 500) undoStack.shift(); }
  function undo() { if (autoRunning || !undoStack.length || G.done) return; G = JSON.parse(undoStack.pop()); G.score = Math.max(0, G.score); G.moves++; held = null; layout(); saveGame(); }

  // ---------- rules
  const top = a => a[a.length - 1];
  function canFound(card, f) { const t = top(G.found[f]); return t ? (t.s === card.s && card.r === t.r + 1) : card.r === 1; }
  function canTab(card, c) { const t = top(G.tab[c]); return t ? (t.up && isRed(t) !== isRed(card) && card.r === t.r - 1) : card.r === 13; }

  // locate a card: { pile:'tab'|'waste'|'found'|'stock', idx, pos }
  function where(id) {
    for (let c = 0; c < 7; c++) { const p = G.tab[c].findIndex(x => x.id === id); if (p >= 0) return { pile:'tab', idx:c, pos:p }; }
    for (let f = 0; f < 4; f++) { const p = G.found[f].findIndex(x => x.id === id); if (p >= 0) return { pile:'found', idx:f, pos:p }; }
    let p = G.waste.findIndex(x => x.id === id); if (p >= 0) return { pile:'waste', idx:0, pos:p };
    p = G.stock.findIndex(x => x.id === id); return { pile:'stock', idx:0, pos:p };
  }
  const pileArr = (pile, idx) => pile === 'tab' ? G.tab[idx] : pile === 'found' ? G.found[idx] : pile === 'waste' ? G.waste : G.stock;

  // movable stack starting at card id (or null)
  function grab(id) {
    const w = where(id), arr = pileArr(w.pile, w.idx);
    if (w.pile === 'stock') return null;
    if (w.pile === 'tab') return arr[w.pos].up ? { from:w, cards:arr.slice(w.pos) } : null;
    return w.pos === arr.length - 1 ? { from:w, cards:[arr[w.pos]] } : null;
  }

  function legal(g, to) {
    const card = g.cards[0];
    if (to.pile === 'found') return g.cards.length === 1 && !(g.from.pile === 'found' && g.from.idx === to.idx) && canFound(card, to.idx);
    if (to.pile === 'tab') return !(g.from.pile === 'tab' && g.from.idx === to.idx) && canTab(card, to.idx);
    return false;
  }

  function move(g, to) {
    snapshot();
    const src = pileArr(g.from.pile, g.from.idx);
    src.splice(src.length - g.cards.length, g.cards.length);
    pileArr(to.pile, to.idx).push(...g.cards);
    // scoring (Windows standard)
    if (to.pile === 'found' && g.from.pile !== 'found') G.score += 10;
    if (to.pile === 'tab' && g.from.pile === 'waste') G.score += 5;
    if (to.pile === 'tab' && g.from.pile === 'found') G.score = Math.max(0, G.score - 15);
    if (g.from.pile === 'tab' && src.length && !top(src).up) { top(src).up = true; G.score += 5; }
    G.moves++;
    after();
  }

  function drawStock() {
    if (autoRunning || G.done) return;
    if (!G.stock.length) {
      if (!G.waste.length) return;
      snapshot();
      G.stock = G.waste.reverse().map(c => (c.up = false, c)); G.waste = [];
      G.recycles++; if (G.recycles > (G.draw === 1 ? 0 : 2)) G.score = Math.max(0, G.score - (G.draw === 1 ? 100 : 20));
    } else {
      snapshot();
      for (let k = 0; k < G.draw && G.stock.length; k++) { const c = G.stock.pop(); c.up = true; G.waste.push(c); }
    }
    G.moves++; held = null; after();
  }

  // best destination for a click/tap
  function autoMove(id) {
    const g = grab(id); if (!g) return false;
    if (g.cards.length === 1) for (let f = 0; f < 4; f++) if (legal(g, { pile:'found', idx:f })) { move(g, { pile:'found', idx:f }); return true; }
    // prefer a non-empty column, then an empty one (but don't shuffle a king between empty columns)
    const order = [...Array(7).keys()].sort((a, b) => (G.tab[a].length ? 0 : 1) - (G.tab[b].length ? 0 : 1));
    for (const c of order) {
      if (!G.tab[c].length && g.from.pile === 'tab' && g.from.pos === 0) continue;
      if (legal(g, { pile:'tab', idx:c })) { move(g, { pile:'tab', idx:c }); return true; }
    }
    return false;
  }

  function after() { layout(); saveGame(); checkWin(); }

  const canAutoFinish = () => !G.done && !G.stock.length && !G.waste.length && G.tab.every(col => col.every(c => c.up)) && G.tab.some(c => c.length);

  function autoFinish() {
    if (autoRunning || !canAutoFinish()) return; autoRunning = true;
    const step = () => {
      if (G.done) { autoRunning = false; return; }
      let moved = false;
      const srcs = [...G.tab.map((c, i) => ({ arr:c, from:{ pile:'tab', idx:i } })), { arr:G.waste, from:{ pile:'waste', idx:0 } }];
      let bestCard = null, bestSrc = null;
      for (const s of srcs) { const t = top(s.arr); if (t && (!bestCard || t.r < bestCard.r)) for (let f = 0; f < 4; f++) if (canFound(t, f)) { bestCard = t; bestSrc = s; break; } }
      if (bestCard) {
        for (let f = 0; f < 4; f++) if (canFound(bestCard, f)) { move({ from:{ ...bestSrc.from, pos:bestSrc.arr.length - 1 }, cards:[bestCard] }, { pile:'found', idx:f }); moved = true; break; }
      }
      if (moved && !G.done) setTimeout(step, 70); else autoRunning = false;
    };
    step();
  }

  function checkWin() {
    $('autoBtn').style.display = canAutoFinish() ? 'inline-block' : 'none';
    if (G.found.every(f => f.length === 13) && !G.done) {
      G.done = true; clearInterval(tick);
      const t = Math.round(G.elapsed);
      const bonus = t >= 30 ? Math.round(700000 / t) : 0; G.score += bonus;
      stats.won = (stats.won || 0) + 1;
      stats.streak = (stats.streak || 0) + 1; stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);
      const k = 'd' + G.draw; stats[k] = stats[k] || {};
      const recT = !stats[k].bestTime || t < stats[k].bestTime, recS = !stats[k].bestScore || G.score > stats[k].bestScore;
      if (recT) stats[k].bestTime = t; if (recS) stats[k].bestScore = G.score;
      save('stats.json', stats); saveGame(); updInfo();
      msg(`You win! ${fmt(t)}, score ${G.score}${recT || recS ? ' – new record!' : ''}`, 6000);
      say('You win! ' + fmt(t) + ', score ' + G.score);
      Host.notify(`won in ${fmt(t)} with ${G.score} points`);
      celebrate();
    }
  }

  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = [...els.values()];
    cards.forEach((el, n) => setTimeout(() => {
      el.classList.add('notrans');
      let x = parseFloat(el.style.left), y = parseFloat(el.style.top), vx = (Math.random() * 6 - 3) || 2, vy = -Math.random() * 6;
      const H = table.clientHeight - L.ch, Wd = table.clientWidth;
      const f = () => { vy += 0.6; x += vx; y += vy; if (y > H) { y = H; vy *= -0.75; } el.style.left = x + 'px'; el.style.top = y + 'px'; if (x > -L.cw && x < Wd && G.done) requestAnimationFrame(f); };
      f();
    }, n * 60));
  }

  // ---------- rendering
  function cardHTML(c) {
    const s = SUITS[c.s], r = RANKS[c.r];
    const mid = c.r > 10 ? `<div class="mid face"><span>${r}${s}</span></div>` : `<div class="mid"><span>${s}</span></div>`;
    return `<div class="tl">${r}<br>${s}</div>${mid}<div class="br">${r}<br>${s}</div>`;
  }
  function buildCards() {
    table.innerHTML = ''; els.clear();
    slots.stock = mkSlot('stock', '↻'); slots.waste = mkSlot('', '');
    slots.found = [0,1,2,3].map(() => mkSlot('', 'A'));
    slots.tab = [0,1,2,3,4,5,6].map(() => mkSlot('', 'K'));
    slots.stock.onclick = drawStock;
    const all = [...G.stock, ...G.waste, ...G.found.flat(), ...G.tab.flat()];
    for (const c of all) { const d = document.createElement('div'); d.dataset.id = c.id; d.className = 'card notrans'; table.appendChild(d); els.set(c.id, d); }
  }
  function mkSlot(cls, label) { const d = document.createElement('div'); d.className = 'slot ' + cls; d.textContent = label; d.setAttribute('aria-hidden', 'true'); table.appendChild(d); return d; }

  function computeLayout() {
    const W = table.clientWidth, H = table.clientHeight;
    const gap = Math.max(6, Math.min(16, W * 0.015));
    let cw = Math.min((W - gap * 8) / 7, (H - gap * 3) / 1.45 / 2.6);
    cw = Math.max(36, Math.floor(cw)); const ch = Math.round(cw * 1.42);
    const left = Math.max(gap, (W - (cw * 7 + gap * 6)) / 2);
    const colX = c => left + c * (cw + gap);
    const topY = gap, tabY = topY + ch + gap * 1.5;
    return { W, H, gap, cw, ch, colX, topY, tabY };
  }

  function place(el, x, y, z, card, extraCls = '') {
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.zIndex = z;
    el.style.width = L.cw + 'px'; el.style.height = L.ch + 'px';
    const want = (card.up ? 'card' + (isRed(card) ? ' red' : '') : 'card back') + extraCls;
    if (el.dataset.face !== String(card.up)) { el.innerHTML = card.up ? cardHTML(card) : ''; el.dataset.face = String(card.up); }
    const keep = el.classList.contains('notrans') ? ' notrans' : '';
    el.className = want + keep;
    el.style.fontSize = Math.round(L.cw * 0.2) + 'px';
    const mid = el.querySelector('.mid span'); if (mid) mid.style.fontSize = Math.round(L.cw * (card.r > 10 ? 0.36 : 0.55)) + 'px';
  }

  function tabOffsets(col) {
    // vertical offsets for a column, compressed to fit the table height
    const avail = L.H - L.tabY - L.ch - L.gap;
    let down = L.ch * 0.12, up = L.ch * 0.27;
    const nd = col.filter(c => !c.up).length, nu = Math.max(0, col.length - nd - 1);
    const need = nd * down + nu * up;
    if (need > avail && need > 0) { const k = Math.max(0.1, avail / need); down *= k; up *= k; }
    const ys = []; let y = 0;
    col.forEach((c, i) => { ys.push(y); y += c.up ? up : down; });
    return ys;
  }

  function layout(instant) {
    L = computeLayout();
    const sz = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = L.cw + 'px'; el.style.height = L.ch + 'px'; el.style.fontSize = Math.round(L.cw * 0.32) + 'px'; };
    sz(slots.stock, L.colX(0), L.topY); sz(slots.waste, L.colX(1), L.topY);
    slots.found.forEach((s, f) => sz(s, L.colX(3 + f), L.topY));
    slots.tab.forEach((s, c) => sz(s, L.colX(c), L.tabY));
    slots.stock.textContent = G.waste.length || G.stock.length ? '↻' : '';
    let z = 1;
    G.stock.forEach((c, i) => place(els.get(c.id), L.colX(0), L.topY, z++, c));
    const shown = G.draw === 3 ? 3 : 1, wl = G.waste.length;
    G.waste.forEach((c, i) => { const k = Math.max(0, i - (wl - shown)); place(els.get(c.id), L.colX(1) + k * L.cw * 0.28, L.topY, z++, c); });
    G.found.forEach((f, fi) => f.forEach(c => place(els.get(c.id), L.colX(3 + fi), L.topY, z++, c)));
    G.tab.forEach((col, ci) => { const ys = tabOffsets(col); col.forEach((c, i) => place(els.get(c.id), L.colX(ci), L.tabY + ys[i], 100 + i, c)); });
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(e => e.classList.remove('notrans'))));
    else els.forEach(e => e.classList.remove('notrans'));
    updInfo();
    $('autoBtn').style.display = canAutoFinish() ? 'inline-block' : 'none';
    showCursor();
  }

  function updInfo() { $('score').textContent = 'Score ' + G.score; $('moves').textContent = 'Moves ' + G.moves; $('time').textContent = fmt(G.elapsed); $('undoBtn').disabled = !undoStack.length || G.done; }

  function startClock() {
    clearInterval(tick); lastTick = Date.now();
    tick = setInterval(() => {
      const now = Date.now();
      if (!G.done && G.moves > 0 && document.visibilityState === 'visible') { G.elapsed += (now - lastTick) / 1000; $('time').textContent = fmt(G.elapsed); }
      lastTick = now;
    }, 500);
  }

  // ---------- drag & click
  let drag = null;
  table.addEventListener('pointerdown', e => {
    if (autoRunning || G.done) return;
    table.classList.remove('kb');
    const el = e.target.closest('.card'); if (!el) return;
    const id = +el.dataset.id, w = where(id);
    if (w.pile === 'stock') { drawStock(); return; }
    const g = grab(id); if (!g) return;
    e.preventDefault();
    const tEls = g.cards.map(c => els.get(c.id));
    drag = { g, els:tEls, sx:e.clientX, sy:e.clientY, moved:false, orig:tEls.map(x => [parseFloat(x.style.left), parseFloat(x.style.top), x.style.zIndex]), pid:e.pointerId };
    try { table.setPointerCapture(e.pointerId); } catch {}
  });
  table.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.els.forEach((x, i) => { x.classList.add('drag'); x.style.zIndex = 1000 + i; }); }
    drag.els.forEach((x, i) => { x.style.left = drag.orig[i][0] + dx + 'px'; x.style.top = drag.orig[i][1] + dy + 'px'; });
    highlightTarget();
  });
  function findTarget() {
    const el = drag.els[0], x = parseFloat(el.style.left), y = parseFloat(el.style.top);
    let best = null, bestA = 0;
    const consider = (to, rx, ry, rw, rh) => {
      const ox = Math.max(0, Math.min(x + L.cw, rx + rw) - Math.max(x, rx)), oy = Math.max(0, Math.min(y + L.ch, ry + rh) - Math.max(y, ry));
      const a = ox * oy; if (a > bestA && legal(drag.g, to)) { bestA = a; best = to; }
    };
    for (let f = 0; f < 4; f++) consider({ pile:'found', idx:f }, L.colX(3 + f), L.topY, L.cw, L.ch);
    for (let c = 0; c < 7; c++) {
      const col = G.tab[c], ys = tabOffsets(col), h = col.length ? ys[ys.length - 1] + L.ch : L.ch;
      consider({ pile:'tab', idx:c }, L.colX(c), L.tabY, L.cw, h);
    }
    return best;
  }
  function highlightTarget() {
    els.forEach(e => e.classList.remove('hl'));
    const t = findTarget(); if (!t) return;
    const t2 = top(pileArr(t.pile, t.idx)); if (t2) els.get(t2.id).classList.add('hl');
  }
  table.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    els.forEach(x => x.classList.remove('hl'));
    d.els.forEach(x => x.classList.remove('drag'));
    if (!d.moved) { if (!autoMove(d.g.cards[0].id)) { layout(); } return; }
    const t = findTarget_(d);
    if (t) move(d.g, t); else layout();
  });
  table.addEventListener('pointercancel', () => { if (drag) { drag.els.forEach(x => x.classList.remove('drag')); drag = null; layout(); } });
  function findTarget_(d) { const save = drag; drag = d; const t = findTarget(); drag = save; return t; }

  // ---------- keyboard play (added in the port)
  /* the cursor is on a pile: { pile: 'stock'|'waste'|'found'|'tab', idx, pos } (pos: which card in a column) */
  let kcur = { pile:'tab', idx:0, pos:-1 }, held = null;
  const cardName = c => RNAMES[c.r] + ' of ' + NAMES[c.s];
  const say = t => { $('say').textContent = ''; setTimeout(() => { $('say').textContent = t; }, 30); };
  const pileName = p => p.pile === 'tab' ? 'column ' + (p.idx + 1) : p.pile === 'found' ? 'foundation ' + (p.idx + 1) : p.pile;
  function firstUp(col) { const i = col.findIndex(c => c.up); return i < 0 ? col.length - 1 : i; }
  function clampCur() {
    if (kcur.pile === 'tab') { const col = G.tab[kcur.idx]; if (!col.length) kcur.pos = -1; else { if (kcur.pos < 0 || kcur.pos >= col.length) kcur.pos = col.length - 1; kcur.pos = Math.max(firstUp(col), kcur.pos); } }
  }
  function curEl() {
    const arr = pileArr(kcur.pile, kcur.idx);
    if (kcur.pile === 'tab' && kcur.pos >= 0 && arr[kcur.pos]) return els.get(arr[kcur.pos].id);
    if (kcur.pile !== 'tab' && arr.length) return els.get(top(arr).id);
    return kcur.pile === 'tab' ? slots.tab[kcur.idx] : kcur.pile === 'found' ? slots.found[kcur.idx] : slots[kcur.pile];
  }
  function showCursor() {
    if (!G) return;
    clampCur();
    table.querySelectorAll('.kc').forEach(e => e.classList.remove('kc'));
    table.querySelectorAll('.held').forEach(e => e.classList.remove('held'));
    if (held) for (const c of held.cards) { const e = els.get(c.id); if (e) e.classList.add('held'); }
    const el = curEl(); if (el) el.classList.add('kc');
  }
  function describe() {
    const arr = pileArr(kcur.pile, kcur.idx), c = kcur.pile === 'tab' ? arr[kcur.pos] : top(arr);
    let t = pileName(kcur) + ': ' + (c ? (c.up ? cardName(c) : 'face down') : 'empty');
    if (kcur.pile === 'stock') t = 'stock: ' + G.stock.length + ' cards' + (G.stock.length ? '' : G.waste.length ? ', press Enter to turn the waste over' : '');
    if (kcur.pile === 'tab' && c && kcur.pos < arr.length - 1) t += ', with ' + (arr.length - 1 - kcur.pos) + ' more on top';
    if (held) t += '. Holding ' + cardName(held.cards[0]) + (held.cards.length > 1 ? ' and ' + (held.cards.length - 1) + ' more' : '');
    say(t);
  }
  const TOPROW = ['stock', 'waste', null, 'found', 'found', 'found', 'found'];
  function key(e) {
    if (!G || autoRunning) return false;
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k)) {
      table.classList.add('kb');
      if (kcur.pile === 'tab') {
        const col = G.tab[kcur.idx];
        if (k === 'ArrowLeft' || k === 'ArrowRight') { kcur = { pile:'tab', idx:(kcur.idx + (k === 'ArrowRight' ? 1 : 6)) % 7, pos:-1 }; }
        else if (k === 'ArrowUp') { if (col.length && kcur.pos > firstUp(col)) kcur.pos--; else { const t = TOPROW[kcur.idx] || 'waste'; kcur = t === 'found' ? { pile:'found', idx:kcur.idx - 3 } : { pile:t, idx:0 }; } }
        else if (k === 'ArrowDown') { if (col.length && kcur.pos < col.length - 1) kcur.pos++; }
        else if (k === 'Home') kcur.pos = firstUp(col); else kcur.pos = col.length - 1;
      } else {
        const order = ['stock', 'waste', 'found0', 'found1', 'found2', 'found3'], cur = kcur.pile === 'found' ? 'found' + kcur.idx : kcur.pile;
        let i = order.indexOf(cur);
        if (k === 'ArrowLeft') i = (i + 5) % 6; else if (k === 'ArrowRight') i = (i + 1) % 6;
        if (k === 'ArrowDown') { kcur = { pile:'tab', idx:kcur.pile === 'stock' ? 0 : kcur.pile === 'waste' ? 1 : 3 + kcur.idx, pos:-1 }; }
        else if (k !== 'ArrowUp') { const o = order[i]; kcur = /^found/.test(o) ? { pile:'found', idx:+o.slice(5) } : { pile:o, idx:0 }; }
      }
      showCursor(); describe(); return true;
    }
    if (k === 'Enter') {
      table.classList.add('kb');
      if (held) { drop(); return true; }
      if (kcur.pile === 'stock') { drawStock(); describe(); return true; }
      const arr = pileArr(kcur.pile, kcur.idx), c = kcur.pile === 'tab' ? arr[kcur.pos] : top(arr);
      if (!c || !c.up) { say('Nothing to play here'); return true; }
      const name = cardName(c);
      if (autoMove(c.id)) { const w = where(c.id); say(name + ' moved to ' + pileName({ pile:w.pile, idx:w.idx })); } else say(name + ' cannot go anywhere');
      return true;
    }
    if (k === 'm' || k === 'M') {
      table.classList.add('kb');
      if (held) { drop(); return true; }
      const arr = pileArr(kcur.pile, kcur.idx), c = kcur.pile === 'tab' ? arr[kcur.pos] : top(arr);
      const g = c && kcur.pile !== 'stock' ? grab(c.id) : null;
      if (!g) { say('Nothing to pick up here'); return true; }
      held = g; showCursor(); say('Picked up ' + cardName(g.cards[0]) + (g.cards.length > 1 ? ' and ' + (g.cards.length - 1) + ' more' : '') + '. Move to another pile and press M or Enter to put them down, or Esc to cancel.');
      return true;
    }
    if (k === 'Escape' && held) { held = null; showCursor(); say('Put back'); return true; }
    if ((k === 'a' || k === 'A') && canAutoFinish()) { autoFinish(); return true; }
    return false;
  }
  function drop() {
    const g = held; held = null;
    const to = kcur.pile === 'tab' ? { pile:'tab', idx:kcur.idx } : kcur.pile === 'found' ? { pile:'found', idx:kcur.idx } : null;
    const ok = to && (where(g.cards[0].id).pile === g.from.pile) && legal(grab(g.cards[0].id) || g, to);
    if (ok) { move(grab(g.cards[0].id), to); kcur.pos = -1; showCursor(); say(cardName(g.cards[0]) + ' put on ' + pileName(to)); }
    else { showCursor(); say(cardName(g.cards[0]) + ' cannot go there'); }
  }
  table.addEventListener('focus', () => { if (G) { showCursor(); describe(); } });

  // ---------- controls
  let confirmAt = 0;
  $('newBtn').onclick = () => {
    if (G && !G.done && G.moves > 0 && Date.now() - confirmAt > 3000) { confirmAt = Date.now(); msg('Click New game again to abandon this game', 3000); return; }
    confirmAt = 0; if (G && !G.done && G.moves > 0) { stats.streak = 0; } newGame();
  };
  $('drawSel').onchange = () => { settings.draw = +$('drawSel').value; Host.saveSettings(settings); msg(`Draw ${$('drawSel').value} applies from the next game`); };
  $('undoBtn').onclick = undo;
  $('autoBtn').onclick = autoFinish;
  document.addEventListener('keydown', e => {
    if ($('infoDlg').classList.contains('show')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'F2') { e.preventDefault(); $('newBtn').click(); }
    else if (e.key === 'F1') { e.preventDefault(); showInfo(); }
    else if (e.key === ' ' && !/^(BUTTON|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); drawStock(); }
    else if (e.target === table && !e.ctrlKey && !e.altKey && !e.metaKey && key(e)) e.preventDefault();
  });
  let back = null, resetAt = 0;
  function showInfo() {
    const t = $('statTbl'); t.innerHTML = '';
    const row = (a, b) => { const r = t.insertRow(); r.insertCell().textContent = a; r.insertCell().textContent = b; };
    const pl = stats.played || 0, wn = stats.won || 0;
    row('Games played', pl); row('Games won', `${wn}${pl ? ` (${Math.round(wn / pl * 100)}%)` : ''}`);
    row('Current streak', stats.streak || 0); row('Best streak', stats.bestStreak || 0);
    for (const k of ['d1', 'd3']) { const s = stats[k] || {}; row(`Best (draw ${k[1]})`, s.bestTime ? `${fmt(s.bestTime)} · ${s.bestScore} pts` : '—'); }
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
  new ResizeObserver(() => { if (G && !drag && !G.done) layout(true); }).observe(table);

  // ---------- theme (added in the port; follows the system by default)
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); msg(THEMES[settings.theme][1], 1500); };

  window.__sol = { get G() { return G; }, set G(v) { G = v; undoStack = []; held = null; buildCards(); layout(true); }, autoMove, drawStock, layout, where, els, autoFinish, get cursor() { return kcur; }, get held() { return held; } };

  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    stats = await load('stats.json', {});
    if (settings.draw) $('drawSel').value = String(settings.draw);
    const g = await load('game.json', null);
    if (g && g.tab && !g.done) { G = g; $('drawSel').value = String(G.draw); buildCards(); layout(true); startClock(); msg('Resumed your last game'); }
    else newGame();
    Host.setTitle('Solitaire');
    table.focus();
  })();
})();
