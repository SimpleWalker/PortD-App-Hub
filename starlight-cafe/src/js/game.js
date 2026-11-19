// Starlight Café – game rules. No DOM code here; ui.js draws the state.
window.SC = window.SC || {};

SC.byId = Object.fromEntries(SC.CHARACTERS.map(c => [c.id, c]));
SC.ownedCount = s => Object.keys(s.owned).length;
SC.today = () => new Date().toISOString().slice(0, 10);

SC.newState = function () {
  return {
    v: 1, created: Date.now(), lastSeen: Date.now(),
    stars: 0, gems: SC.BALANCE.startGems, lifetime: 0,
    taps: 0, pulls: 0, pity: 0, shopBought: 0,
    lastDaily: null, claimed: {},
    owned: { mochi: { level: 1, bond: 0, since: Date.now() } } // a starter friend
  };
};

// Fill in anything missing from an older or hand-edited save.
SC.repair = function (s) {
  const d = SC.newState();
  for (const k of Object.keys(d)) if (s[k] === undefined || s[k] === null && k !== 'lastDaily') s[k] = d[k];
  for (const id of Object.keys(s.owned)) if (!SC.byId[id]) delete s.owned[id];
  if (!Object.keys(s.owned).length) s.owned = d.owned;
  for (const k of ['stars', 'gems', 'lifetime']) if (!isFinite(s[k]) || s[k] < 0) s[k] = 0;
  return s;
};

// ---------- production
SC.power = function (c, o) {
  const r = SC.RARITY[c.rarity];
  return r.base * o.level * (1 + SC.BALANCE.bondBonus * o.bond);
};
SC.income = s => Object.entries(s.owned).reduce((sum, [id, o]) => sum + SC.power(SC.byId[id], o), 0);
SC.levelCost = (c, o) => Math.ceil(SC.RARITY[c.rarity].levelCost * Math.pow(SC.BALANCE.levelGrowth, o.level - 1));

SC.earn = function (s, n) { s.stars += n; s.lifetime += n; };

SC.tick = function (s, dt) { SC.earn(s, SC.income(s) * dt); s.lastSeen = Date.now(); };

SC.tap = function (s) {
  const n = SC.BALANCE.tapBase + SC.income(s) * SC.BALANCE.tapShareOfIncome;
  SC.earn(s, n); s.taps++;
  return n;
};

SC.levelUp = function (s, id) {
  const o = s.owned[id]; if (!o) return false;
  const cost = SC.levelCost(SC.byId[id], o);
  if (s.stars < cost) return false;
  s.stars -= cost; o.level++;
  return true;
};
// Level up as many times as affordable; returns how many levels were bought.
SC.levelMax = function (s, id) { let n = 0; while (n < 1000 && SC.levelUp(s, id)) n++; return n; };

// ---------- offline earnings
SC.offline = function (s, now = Date.now()) {
  const secs = Math.max(0, Math.min((now - (s.lastSeen || now)) / 1000, SC.BALANCE.offlineCapHours * 3600));
  if (secs < 60) return null;
  const earned = SC.income(s) * secs * SC.BALANCE.offlineRate;
  SC.earn(s, earned); s.lastSeen = now;
  return { secs, earned };
};

// ---------- wishes (gacha)
SC.rollRarity = function (s, guaranteeSR) {
  if (s.pity >= SC.BANNER.pity - 1) return 'SSR';
  const R = SC.RARITY, roll = Math.random() * (R.R.weight + R.SR.weight + R.SSR.weight);
  let rarity = roll < R.SSR.weight ? 'SSR' : roll < R.SSR.weight + R.SR.weight ? 'SR' : 'R';
  if (guaranteeSR && rarity === 'R') rarity = 'SR';
  return rarity;
};
SC.rollCharacter = function (rarity) {
  const pool = SC.CHARACTERS.filter(c => c.rarity === rarity);
  if (rarity === 'SSR' && SC.BANNER.rateUp && Math.random() < SC.BANNER.featuredShare) return SC.byId[SC.BANNER.rateUp];
  return pool[Math.floor(Math.random() * pool.length)];
};

// Returns an array of results, or null if not enough gems.
SC.wish = function (s, count) {
  const cost = count === 10 ? SC.BANNER.tenCost : SC.BANNER.singleCost * count;
  if (s.gems < cost) return null;
  s.gems -= cost;
  const results = [];
  for (let i = 0; i < count; i++) {
    const lastOfTen = count === 10 && i === 9 && !results.some(r => r.char.rarity !== 'R');
    const rarity = SC.rollRarity(s, lastOfTen);
    const c = SC.rollCharacter(rarity);
    s.pulls++;
    s.pity = rarity === 'SSR' ? 0 : s.pity + 1;
    const o = s.owned[c.id];
    let kind, gems = 0;
    if (!o) { s.owned[c.id] = { level: 1, bond: 0, since: Date.now() }; kind = 'new'; }
    else if (o.bond < SC.BALANCE.maxBond) { o.bond++; kind = 'bond'; }
    else { gems = SC.BALANCE.overflowGems * SC.RARITY[c.rarity].stars; s.gems += gems; kind = 'gems'; }
    results.push({ char: c, kind, gems, bond: s.owned[c.id].bond });
  }
  return results;
};

// ---------- shop, daily gift, milestones
SC.shopPrice = s => Math.ceil(SC.BALANCE.shopBasePrice * Math.pow(SC.BALANCE.shopGrowth, s.shopBought));
SC.buyGems = function (s) {
  const p = SC.shopPrice(s); if (s.stars < p) return false;
  s.stars -= p; s.gems += SC.BALANCE.shopGems; s.shopBought++; return true;
};
SC.dailyReady = s => s.lastDaily !== SC.today();
SC.claimDaily = function (s) { if (!SC.dailyReady(s)) return 0; s.lastDaily = SC.today(); s.gems += SC.BALANCE.dailyGems; return SC.BALANCE.dailyGems; };

SC.milestoneState = s => SC.MILESTONES.map(m => ({ ...m, done: !!s.claimed[m.id], ready: !s.claimed[m.id] && m.test(s) }));
SC.claimMilestone = function (s, id) {
  const m = SC.MILESTONES.find(x => x.id === id);
  if (!m || s.claimed[id] || !m.test(s)) return 0;
  s.claimed[id] = Date.now(); s.gems += m.gems; return m.gems;
};

// ---------- number formatting
SC.fmt = function (n) {
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1; while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return (n < 100 ? n.toFixed(n < 10 ? 2 : 1) : Math.floor(n)) + units[u];
};
SC.fmtTime = function (secs) {
  const h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
