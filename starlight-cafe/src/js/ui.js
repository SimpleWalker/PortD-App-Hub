// Starlight Café – drawing the game and handling input.
// Added in the PortD 1.0 port: light/dark theme (follows the system by default), keyboard use
// (tabs, moon, dialogs), labels for screen readers. Game rules and the save format are unchanged.
(function () {
  const $ = id => document.getElementById(id);
  let S = null;                 // game state
  let lastTick = Date.now();
  let dirty = true;             // friend list needs rebuilding
  let friendRefs = new Map();   // id -> { lvl, cost, btn, max, prod }
  let settings = { theme: 'auto' };

  // ---------- helpers
  function toast(text, ms = 2200) {
    const t = $('toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms);
  }
  const starsStr = n => '★'.repeat(n);
  const hearts = b => b ? '♥'.repeat(Math.min(b, 10)) : '';
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function img(path, alt = '') { const i = new Image(); i.src = SC.asset(path); i.alt = alt; i.draggable = false; return i; }
  function save() { S.lastSeen = Date.now(); return SC.storage.save(S); }

  // ---------- tabs
  const tabBtns = [...document.querySelectorAll('.tabs button')];
  function selectTab(name, focus) {
    const b = tabBtns.find(x => x.dataset.tab === name); if (!b) return;
    tabBtns.forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('show', t.id === 'tab-' + name));
    if (name === 'album') renderAlbum();
    if (name === 'quests') renderQuests();
    if (name === 'wish') renderWish();
    if (focus) b.focus();
  }
  tabBtns.forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  // arrow keys move along the tab bar
  document.querySelector('.tabs').addEventListener('keydown', e => {
    const i = tabBtns.indexOf(document.activeElement); if (i < 0) return;
    const n = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabBtns.length - 1 }[e.key];
    if (n === undefined) return;
    e.preventDefault(); selectTab(tabBtns[(n + tabBtns.length) % tabBtns.length].dataset.tab, true);
  });

  // ---------- header + per-tick updates
  function renderTop() {
    $('stars').textContent = SC.fmt(S.stars);
    $('gems').textContent = SC.fmt(S.gems);
    $('income').textContent = '+' + SC.fmt(SC.income(S)) + '/s';
    $('wishDot').classList.toggle('show', S.gems >= SC.BANNER.singleCost);
    $('questDot').classList.toggle('show', SC.dailyReady(S) || SC.milestoneState(S).some(m => m.ready));
  }

  // ---------- café
  function renderFriends() {
    const box = $('friends'); box.innerHTML = ''; friendRefs.clear();
    const ids = Object.keys(S.owned).sort((a, b) => {
      const ra = SC.RARITY[SC.byId[a].rarity].stars, rb = SC.RARITY[SC.byId[b].rarity].stars;
      return rb - ra || S.owned[a].since - S.owned[b].since;
    });
    for (const id of ids) {
      const c = SC.byId[id], r = SC.RARITY[c.rarity];
      const card = el('div', 'friend'); card.style.setProperty('--rc', r.color);
      const pic = el('button', 'pic'); pic.type = 'button'; pic.setAttribute('aria-label', 'About ' + c.name); pic.appendChild(img(c.art, '')); pic.onclick = () => showDetail(id);
      const info = el('div', 'info');
      info.innerHTML = `<div class="name">${c.name} <span class="rarity">${starsStr(r.stars)}</span></div>
        <div class="meta"><span data-k="lvl"></span> · <span data-k="prod"></span> <span class="hearts" data-k="bond"></span></div>`;
      const acts = el('div', 'acts');
      const up = el('button', 'btn pri'); up.onclick = () => { if (SC.levelUp(S, id)) { updateFriends(); renderTop(); } };
      const max = el('button', 'btn', 'Max'); max.title = 'Buy as many levels as you can afford'; max.setAttribute('aria-label', 'Max levels for ' + c.name);
      max.onclick = () => { const n = SC.levelMax(S, id); if (n) { toast(`${c.name} +${n} level${n > 1 ? 's' : ''}!`); updateFriends(); renderTop(); } };
      acts.append(up, max); info.appendChild(acts);
      card.append(pic, info); box.appendChild(card);
      friendRefs.set(id, { lvl: info.querySelector('[data-k=lvl]'), prod: info.querySelector('[data-k=prod]'), bond: info.querySelector('[data-k=bond]'), up, max });
    }
    dirty = false; updateFriends();
  }
  function updateFriends() {
    for (const [id, r] of friendRefs) {
      const c = SC.byId[id], o = S.owned[id], cost = SC.levelCost(c, o);
      r.lvl.textContent = 'Lv ' + o.level;
      r.prod.textContent = '✨' + SC.fmt(SC.power(c, o)) + '/s';
      r.bond.textContent = hearts(o.bond);
      r.up.innerHTML = `Level up ✨${SC.fmt(cost)}`; r.up.setAttribute('aria-label', `Level up ${c.name} for ${SC.fmt(cost)} stars`);
      r.up.disabled = S.stars < cost; r.max.disabled = S.stars < cost;
    }
  }

  // moon tapping
  function tapMoon(x, y) {
    const n = SC.tap(S);
    const f = el('div', 'floater', '+' + SC.fmt(n) + '✨'); f.setAttribute('aria-hidden', 'true');
    f.style.left = (x - 20 + (Math.random() * 30 - 15)) + 'px'; f.style.top = (y - 20) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 900);
    const m = $('moon'); m.classList.add('pop'); setTimeout(() => m.classList.remove('pop'), 80);
    renderTop(); updateFriends();
  }
  $('moon').addEventListener('pointerdown', e => tapMoon(e.clientX, e.clientY));
  // keyboard: Space or Enter on the focused moon (a held key does not repeat)
  $('moon').addEventListener('keydown', e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); });
  $('moon').addEventListener('click', e => {
    if (e.detail !== 0) return; // mouse and touch already tapped on pointerdown
    const r = $('moon').getBoundingClientRect(); tapMoon(r.left + r.width / 2, r.top + r.height / 3);
  });

  // ---------- dialogs: focus moves in, Tab stays inside, Escape closes, focus returns
  let returnFocus = null;
  function openOverlay(id, focusId) {
    if (!document.querySelector('.overlay.show')) returnFocus = document.activeElement;
    $(id).classList.add('show'); setTimeout(() => $(focusId).focus(), 0);
  }
  function closeOverlay(id) {
    $(id).classList.remove('show');
    if (!document.querySelector('.overlay.show') && returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }
  document.addEventListener('keydown', e => {
    const ov = document.querySelector('.overlay.show');
    if (ov) {
      if (e.key === 'Escape') { e.preventDefault(); ov.id === 'results' ? closeResults() : closeOverlay('detail'); }
      else if (e.key === 'Tab') {
        const f = [...ov.querySelectorAll('button')].filter(b => !b.disabled && b.offsetParent);
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        else if (i < 0) { e.preventDefault(); f[0].focus(); }
      }
      return;
    }
    // 1–4 switch tabs
    if (!e.ctrlKey && !e.altKey && !e.metaKey && /^[1-4]$/.test(e.key)) { e.preventDefault(); selectTab(tabBtns[+e.key - 1].dataset.tab, true); }
  });

  // ---------- wish
  function renderWish() {
    const f = SC.byId[SC.BANNER.rateUp];
    $('featuredArt').src = SC.asset(f.art);
    $('bannerName').textContent = SC.BANNER.name;
    $('bannerDesc').innerHTML = `Featured: <b>${f.name}</b>, ${f.title} ${starsStr(5)}<br>Half of all SSR wishes are ${f.name}!`;
    $('pity').textContent = SC.BANNER.pity - S.pity;
    $('wish1').disabled = S.gems < SC.BANNER.singleCost;
    $('wish10').disabled = S.gems < SC.BANNER.tenCost;
  }
  function doWish(n) {
    const res = SC.wish(S, n);
    if (!res) { toast('Not enough gems – try the Quests tab!'); return; }
    save(); dirty = true; renderTop(); renderWish();
    showResults(res);
  }
  $('wish1').onclick = () => doWish(1);
  $('wish10').onclick = () => doWish(10);

  let revealTimers = [];
  function showResults(res) {
    const box = $('resultCards'); box.innerHTML = ''; box.classList.toggle('single', res.length === 1);
    revealTimers.forEach(clearTimeout); revealTimers = [];
    res.forEach((r, i) => {
      const c = r.char, rc = SC.RARITY[c.rarity];
      const card = el('button', 'rcard ' + c.rarity); card.type = 'button'; card.style.setProperty('--rc', rc.color);
      const back = el('div', 'back'); const cap = img('assets/capsule.svg'); back.appendChild(cap);
      const face = el('div', 'face');
      face.appendChild(img(c.art, c.name));
      face.appendChild(el('b', null, c.name));
      face.appendChild(el('small', null, starsStr(rc.stars)));
      const note = r.kind === 'new' ? 'NEW' : r.kind === 'bond' ? 'Bond ' + r.bond : '+' + r.gems + '💎';
      const badge = el('span', 'badge', note); if (r.kind !== 'new') badge.style.background = r.kind === 'bond' ? '#ff9ec7' : '#6b8cff';
      face.appendChild(badge);
      card.setAttribute('aria-label', `${c.name}, ${rc.label}, ${r.kind === 'new' ? 'new friend' : r.kind === 'bond' ? 'bond ' + r.bond : r.gems + ' gems'}`);
      card.append(back, face);
      card.onclick = () => card.classList.add('open');
      box.appendChild(card);
      revealTimers.push(setTimeout(() => card.classList.add('open'), 450 + i * (res.length === 1 ? 0 : 260)));
    });
    openOverlay('results', 'resultsClose');
    const best = res.find(r => r.char.rarity === 'SSR');
    if (best) Host.notify(`✨ ${best.char.name} joined your café!`); // PortD puts the program name in front
  }
  function closeResults() { revealTimers.forEach(clearTimeout); closeOverlay('results'); if (dirty) renderFriends(); }
  $('resultsSkip').onclick = () => document.querySelectorAll('.rcard').forEach(c => c.classList.add('open'));
  $('resultsClose').onclick = closeResults;

  // ---------- album + detail
  function renderAlbum() {
    const box = $('album'); box.innerHTML = '';
    $('albumCount').textContent = `${SC.ownedCount(S)} / ${SC.CHARACTERS.length}`;
    for (const c of SC.CHARACTERS) {
      const own = S.owned[c.id], rc = SC.RARITY[c.rarity];
      const a = el(own ? 'button' : 'div', 'acard' + (own ? '' : ' locked')); a.style.setProperty('--rc', rc.color);
      if (own) { a.type = 'button'; a.setAttribute('aria-label', `${c.name}, ${rc.label}, level ${own.level}`); }
      else { a.setAttribute('role', 'img'); a.setAttribute('aria-label', `Not met yet, ${rc.label}`); }
      a.appendChild(img(c.art, ''));
      a.appendChild(el('b', null, own ? c.name : '???'));
      a.appendChild(el('span', 'rarity', starsStr(rc.stars)));
      if (own) a.onclick = () => showDetail(c.id);
      box.appendChild(a);
    }
  }
  function showDetail(id) {
    const c = SC.byId[id], o = S.owned[id], rc = SC.RARITY[c.rarity];
    document.querySelector('.detailCard').style.setProperty('--rc', rc.color);
    $('dArt').src = SC.asset(c.art);
    $('dRarity').style.setProperty('--rc', rc.color);
    $('dRarity').textContent = starsStr(rc.stars) + ' ' + rc.label;
    $('dName').textContent = c.name; $('dTitle').textContent = c.title; $('dQuote').textContent = '“' + c.quote + '”';
    const days = Math.max(0, Math.floor((Date.now() - o.since) / 864e5));
    $('dStats').innerHTML = `<span>Level</span><span>${o.level}</span><span>Bond</span><span>${o.bond} / ${SC.BALANCE.maxBond} ${hearts(o.bond)}</span>
      <span>Stars per second</span><span>${SC.fmt(SC.power(c, o))}</span><span>Friends for</span><span>${days} day${days === 1 ? '' : 's'}</span>`;
    openOverlay('detail', 'dClose');
  }
  $('dClose').onclick = () => closeOverlay('detail');
  $('detail').addEventListener('click', e => { if (e.target.id === 'detail') closeOverlay('detail'); });

  // ---------- quests
  function renderQuests() {
    const ready = SC.dailyReady(S);
    $('daily').disabled = !ready; $('daily').textContent = ready ? `Claim 💎 ${SC.BALANCE.dailyGems}` : 'Come back tomorrow ♥';
    $('shopPrice').textContent = SC.fmt(SC.shopPrice(S)); $('shop').disabled = S.stars < SC.shopPrice(S);
    const box = $('milestones'); box.innerHTML = '';
    const list = SC.milestoneState(S).sort((a, b) => (b.ready - a.ready) || (a.done - b.done));
    for (const m of list) {
      const row = el('div', 'ms' + (m.done ? ' done' : ''));
      row.appendChild(el('span', null, m.done ? '✅' : m.ready ? '🎀' : '⬜'));
      row.appendChild(el('span', 'txt', m.text));
      row.appendChild(el('span', 'reward', '💎 ' + m.gems));
      if (m.ready) { const b = el('button', 'btn small pri', 'Claim'); b.onclick = () => { const g = SC.claimMilestone(S, m.id); toast(`+${g} 💎`); save(); renderQuests(); renderTop(); }; row.appendChild(b); }
      box.appendChild(row);
    }
    const st = $('stats');
    st.innerHTML = '';
    [['Stars earned', SC.fmt(S.lifetime)], ['Wishes made', S.pulls], ['Moon taps', S.taps], ['Friends', `${SC.ownedCount(S)} / ${SC.CHARACTERS.length}`],
     ['Café opened', new Date(S.created).toLocaleDateString()]].forEach(([a, b]) => { st.appendChild(el('span', null, a)); st.appendChild(el('span', null, String(b))); });
  }
  $('daily').onclick = () => { const g = SC.claimDaily(S); if (g) { toast(`Daily gift: +${g} 💎`); save(); renderQuests(); renderTop(); } };
  $('shop').onclick = () => { if (SC.buyGems(S)) { toast(`+${SC.BALANCE.shopGems} 💎`); renderQuests(); renderTop(); updateFriends(); } };
  let resetAt = 0;
  $('reset').onclick = async () => {
    if (Date.now() - resetAt > 3000) { resetAt = Date.now(); toast('Click again to erase your café and start over'); return; }
    await SC.storage.wipe(); S = SC.newState(); save(); renderFriends(); renderTop(); renderQuests(); toast('A fresh start ♥');
  };

  // ---------- theme (added in the port; follows the system by default)
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); toast(THEMES[settings.theme][1], 1500); };

  // ---------- loop
  function loop() {
    const now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (dt > 120) { const off = SC.offline(S, now); if (off) toast(`While you were away (${SC.fmtTime(off.secs)}): +${SC.fmt(off.earned)} ✨`, 4000); }
    else if (dt > 0) SC.tick(S, dt);
    if (dirty) renderFriends(); else updateFriends();
    renderTop();
    if ($('tab-quests').classList.contains('show')) { $('shop').disabled = S.stars < SC.shopPrice(S); }
    if ($('tab-wish').classList.contains('show')) { $('wish1').disabled = S.gems < SC.BANNER.singleCost; $('wish10').disabled = S.gems < SC.BANNER.tenCost; }
  }

  // ---------- start
  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    const loaded = await SC.storage.load();
    S = loaded ? SC.repair(loaded) : SC.newState();
    const off = loaded ? SC.offline(S) : null;
    renderFriends(); renderTop(); renderWish();
    if (!loaded) toast('Welcome to Starlight Café! Mochi is here to help ♥', 3500);
    else if (off) toast(`Welcome back! Your friends earned ✨${SC.fmt(off.earned)} in ${SC.fmtTime(off.secs)}`, 4500);
    lastTick = Date.now();
    setInterval(loop, 200);
    setInterval(save, 5000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
    window.addEventListener('pagehide', save);
    Host.setTitle('Starlight Café');
    window.__sc = { get S() { return S; }, set S(v) { S = v; dirty = true; }, showResults, renderQuests, selectTab, get settings() { return settings; }, ready: true };
  })();
})();
