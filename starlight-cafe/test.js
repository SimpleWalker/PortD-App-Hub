/* Starlight Café: tests in the real PortD 1.0.0, in headless Chrome, with real mouse, keyboard and touch input.
   Run: node starlight-cafe/test.js   (after node starlight-cafe/build.js) */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('../build/harness');
const { section, check, note } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const CFG = 'P:\\User\\Config\\starlight-cafe';

(async () => {
  console.log('Starlight Café tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile({ touch: true });
  const page = await H.openPortD(ctx), P = H.on(page);
  let f;
  const S = () => f.evaluate(() => JSON.parse(JSON.stringify(__sc.S)));
  const set = fn => f.evaluate(fn);
  const toast = () => f.locator('#toast').innerText();
  /* the next values of Math.random, then back to normal */
  const rig = seq => f.evaluate(seq => { const q = seq.slice(), r = Math.random.orig || Math.random; Math.random = () => q.length ? q.shift() : r(); Math.random.orig = r; }, seq);
  const open = id => f.evaluate(id => document.getElementById(id).classList.contains('show'), id);
  const active = () => f.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className));
  const launch = async () => { await P.icon('Starlight Café').dblclick(); await P.settle(800); f = await P.frame(); await f.waitForFunction(() => window.__sc && __sc.ready); };

  section('Installing the ported package');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('PortD 1.0 accepts the format 3 package: Starlight Café 1.0.0, 23 files', /^Install program/.test(d) && /Starlight Café/.test(d) && /Version\s+1\.0\.0/.test(d) && /cute idle gacha/.test(d) && /Files\s+23 files, /.test(d), d);
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\starlight-cafe') === 'assets|js|index.html|manifest.json|style.css' && (await P.ls('P:\\Programs\\starlight-cafe\\assets\\chars')).split('|').length === 13 && await P.icon('Starlight Café').count() === 1, await P.ls('P:\\Programs\\starlight-cafe'));
  await P.closeAll();

  section('A new café');
  await launch();
  let s = await S();
  check('it starts with 300 gems, no stars and Mochi as the starter friend', s.gems === 300 && s.stars < 2 && Object.keys(s.owned).join() === 'mochi' && s.owned.mochi.level === 1);
  check('a welcome message, and the window is titled Starlight Café', /Welcome to Starlight Café/.test(await toast()) && await P.titles() === 'Starlight Café');
  const pics = await f.evaluate(() => ({ logo: document.querySelector('.logo').src.slice(0, 22), mochi: document.querySelector('.friend .pic img').src.slice(0, 22), w: document.querySelector('.friend .pic img').naturalWidth, bg: getComputedStyle(document.body).backgroundImage.slice(0, 30) }));
  check('pictures load inside PortD: the logo and background are inlined, portraits come from PortD.assets', pics.logo === 'data:image/svg+xml;bas' && pics.mochi.startsWith('data:image/svg') && pics.w > 0 && /url\("data:image\/svg/.test(pics.bg), pics);
  check('it follows the system theme (light here)', await f.evaluate(() => document.documentElement.dataset.theme === 'light' && document.documentElement.dataset.themeChoice === 'auto'));

  section('Tapping the moon and earning stars');
  for (let i = 0; i < 5; i++) await f.locator('#moon').click({ force: true }); // it floats up and down, so it is never 'stable'
  s = await S();
  check('5 mouse clicks on the moon are 5 taps, each at least 1 star', s.taps === 5 && s.lifetime >= 5, [s.taps, s.lifetime]);
  check('each tap shows a floating +stars', await f.evaluate(() => document.querySelectorAll('.floater').length) >= 1);
  await f.locator('#moon').focus();
  await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
  check('the focused moon taps with Space or Enter; a held key counts once', (await S()).taps === 8, (await S()).taps);
  const box = await f.locator('#moon').boundingBox(); // already in page coordinates
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await P.settle(100);
  check('a touch tap on the moon counts once', (await S()).taps === 9, (await S()).taps);
  const st0 = (await S()).stars; await P.settle(1300);
  check('Mochi brews about 1 star a second, shown as +1/s', (await S()).stars - st0 > 0.9 && (await S()).stars - st0 < 2.5 && await f.locator('#income').innerText() === '+1/s');

  section('Levelling up');
  await set(() => { __sc.S.stars = 100; }); await P.settle(300);
  const up = f.locator('.friend .acts .btn.pri');
  check('the level-up button shows its price and has a spoken label', /Level up ✨15/.test(await up.innerText()) && await up.getAttribute('aria-label') === 'Level up Mochi for 15 stars');
  await up.click(); s = await S();
  check('Level up costs 15 stars and raises Mochi to level 2 (2 stars a second)', s.owned.mochi.level === 2 && s.stars < 86 && s.stars > 84 && /Lv 2/.test(await f.locator('.friend .meta').innerText()));
  await f.locator('.friend .acts .btn', { hasText: /^Max$/ }).click(); s = await S();
  check('Max buys as many levels as the stars allow (3 more here: 18 + 20 + 23 stars)', s.owned.mochi.level === 5 && /Mochi \+3 levels!/.test(await toast()), [s.owned.mochi.level, await toast()]);
  await set(() => { __sc.S.stars = 0; }); await P.settle(300);
  check('with too few stars, the buttons are greyed', await up.isDisabled());

  section('Wishes');
  await page.keyboard.press('2'); await P.settle(200);
  check('key 2 opens the Wish tab, and the tab bar says so', await open('tab-wish') && await f.locator('#tb-wish').getAttribute('aria-selected') === 'true');
  check('the banner shows Aurora and the pity count (60)', /Featured: Aurora, Princess of Stars/.test(await f.locator('#bannerDesc').innerText()) && await f.locator('#pity').innerText() === '60' && await f.evaluate(() => document.getElementById('featuredArt').src.startsWith('data:image/svg')));
  check('with 300 gems, Wish ×1 is ready and Wish ×10 is greyed', !(await f.locator('#wish1').isDisabled()) && await f.locator('#wish10').isDisabled());
  await rig([0.5, 0.0]); // an R, the first in the list: Mochi again
  await f.locator('#wish1').click(); await P.settle(800);
  s = await S();
  check('Wish ×1 costs 100 gems; a duplicate Mochi raises her bond to 1', s.gems === 200 && s.pulls === 1 && s.pity === 1 && s.owned.mochi.bond === 1);
  check('the results open with focus on OK, and the card is labelled for screen readers', await open('results') && await active() === 'resultsClose' && await f.locator('.rcard').getAttribute('aria-label') === 'Mochi, R, bond 1');
  check('the card turns over on its own', await f.evaluate(() => document.querySelector('.rcard').classList.contains('open')) && /Bond 1/.test(await f.locator('.rcard .badge').innerText()));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  check('Tab stays inside the results', await f.evaluate(() => !!document.activeElement.closest('#results')));
  await page.keyboard.press('Escape'); await P.settle(200);
  check('Esc closes the results and focus goes back to Wish ×1', !(await open('results')) && await active() === 'wish1');

  await set(() => { __sc.S.gems = 1000; }); await P.settle(300);
  await rig(Array(20).fill(0.99)); // nine Rs (Peach), then the tenth must be SR or better
  await f.locator('#wish10').click(); await P.settle(300);
  s = await S();
  check('Wish ×10 costs 1000 gems and the tenth is lifted to SR when the first nine are all R', s.gems === 0 && s.pulls === 11 && s.owned.peach && s.owned.peach.bond === 8 && s.owned.rin && s.owned.rin.level === 1, Object.keys(s.owned));
  check('ten cards, and Reveal all turns them all over at once', await f.locator('.rcard').count() === 10);
  await f.locator('#resultsSkip').click();
  check('…all ten open', await f.evaluate(() => document.querySelectorAll('.rcard.open').length) === 10 && /NEW/.test(await f.locator('.rcard >> nth=0').innerText()) && /NEW/.test(await f.locator('.rcard >> nth=9').innerText()));
  await f.locator('#resultsClose').click(); await P.settle(200);
  check('OK closes, and the café now lists Mochi, Rin and Peach (rarest first)', await f.evaluate(() => [...document.querySelectorAll('.friend .name')].map(n => n.firstChild.textContent.trim()).join()) === 'Rin,Mochi,Peach');

  await set(() => { __sc.S.gems = 100; __sc.S.pity = 59; __sc.selectTab('wish'); }); await P.settle(300);
  check('the pity counter says 1 wish to go', await f.locator('#pity').innerText() === '1');
  await rig([0.9, 0.2]); // any roll: pity gives an SSR; under one half gives the featured friend
  await f.locator('#wish1').click(); await P.settle(900);
  s = await S();
  check('the 60th wish without an SSR is an SSR, and here Aurora; pity starts again', !!s.owned.aurora && s.pity === 0, s.pity);
  check('an SSR is announced through PortD once, without the name twice', await P.toast() === 'Starlight Café: ✨ Aurora joined your café!', await P.toast());
  await page.keyboard.press('Enter'); await P.settle(200);
  check('Enter on OK closes the results', !(await open('results')));

  await set(() => { __sc.S.gems = 100; __sc.S.owned.mochi.bond = 10; }); await P.settle(300);
  await rig([0.5, 0.0]);
  await f.locator('#wish1').click(); await P.settle(800);
  s = await S();
  check('a friend at full bond (10) turns into gems instead: +75 for an R', s.gems === 75 && s.owned.mochi.bond === 10 && /\+75💎/.test(await f.locator('.rcard .badge').innerText()));
  await page.keyboard.press('Escape');
  await P.settle(300);
  check('with too few gems for a wish, the button is greyed', await f.locator('#wish1').isDisabled() && (await S()).gems === 75);

  section('Album and friend details');
  await page.keyboard.press('3'); await P.settle(200);
  check('key 3 opens the Album: 4 / 13 met', await open('tab-album') && await f.locator('#albumCount').innerText() === '4 / 13');
  check('friends not met yet are shadows marked ???, labelled "Not met yet"', await f.locator('.acard.locked').count() === 9 && await f.evaluate(() => [...document.querySelectorAll('.acard.locked b')].every(b => b.textContent === '???')) && await f.locator('.acard.locked >> nth=0').getAttribute('aria-label') === 'Not met yet, R');
  const aur = f.locator('button.acard', { hasText: 'Aurora' });
  await aur.focus(); await page.keyboard.press('Enter'); await P.settle(200);
  check('Enter on a met friend opens the details: name, title, quote, level and bond', await open('detail') && await f.locator('#dName').innerText() === 'Aurora' && await f.locator('#dTitle').innerText() === 'Princess of Stars' && /The whole sky/.test(await f.locator('#dQuote').innerText()) && /Level\s+1/.test(await f.locator('#dStats').innerText()) && await active() === 'dClose');
  await page.keyboard.press('Escape'); await P.settle(150);
  check('Esc closes the details and focus goes back to the album card', !(await open('detail')) && await f.evaluate(() => document.activeElement.textContent.includes('Aurora')));
  await page.keyboard.press('1'); await P.settle(200);
  await f.locator('.friend .pic >> nth=0').click(); await P.settle(150);
  check('clicking a portrait in the café also opens the details', await open('detail') && await f.locator('#dName').innerText() === 'Aurora');
  await f.locator('#detail').click({ position: { x: 5, y: 5 } }); await P.settle(150);
  check('clicking outside the card closes it', !(await open('detail')));
  await f.locator('#tb-cafe').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  check('arrow keys move along the tab bar', await open('tab-album') && await active() === 'tb-album');
  await page.keyboard.press('End');
  check('…and End goes to Quests', await open('tab-quests'));

  section('Quests: daily gift, gem shop, milestones');
  check('the Quests tab has a dot while there is something to claim', await f.evaluate(() => document.getElementById('questDot').classList.contains('show')));
  await f.locator('#daily').click(); await P.settle(150);
  s = await S();
  check('the daily gift gives 150 gems once a day', s.gems === 225 && /Daily gift: \+150/.test(await toast()) && await f.locator('#daily').isDisabled() && /Come back tomorrow/.test(await f.locator('#daily').innerText()));
  await set(() => { __sc.S.stars = 500; __sc.renderQuests(); }); await P.settle(300);
  await f.locator('#shop').click(); await P.settle(150);
  s = await S();
  check('the gem shop trades 200 stars for 25 gems, and the price goes up to 216', s.gems === 250 && s.stars < 300 + 3 * 62 && s.shopBought === 1 && await f.locator('#shopPrice').innerText() === '216');
  check('milestones already reached can be claimed: Befriend… not yet, Meet an SSR friend yes', await f.locator('.ms', { hasText: 'Meet an SSR friend' }).locator('button').count() === 1 && await f.locator('.ms', { hasText: 'Befriend 5 characters' }).locator('button').count() === 0);
  await f.locator('.ms', { hasText: 'Meet an SSR friend' }).locator('button').click(); await P.settle(150);
  s = await S();
  check('claiming gives its gems once and ticks it', s.gems === 350 && !!s.claimed.firstSSR && /\+100 💎/.test(await toast()) && /✅/.test(await f.locator('.ms', { hasText: 'Meet an SSR friend' }).innerText()));
  check('stats list stars earned, wishes, taps and friends', /Wishes made\s+13/.test(await f.locator('#stats').innerText()) && /Moon taps\s+9/.test(await f.locator('#stats').innerText()) && /Friends\s+4 \/ 13/.test(await f.locator('#stats').innerText()), await f.locator('#stats').innerText());

  section('Saving, and coming back later');
  await f.evaluate(() => SC.storage.save(__sc.S));
  const saved = JSON.parse(await P.read(CFG + '\\save.json'));
  check('the café is saved to P:\\User\\Config\\starlight-cafe\\save.json in the 0.x format (v 1)', saved.v === 1 && saved.gems === 350 && !!saved.owned.aurora && saved.taps === 9);
  await P.settle(5300);
  check('it also saves on its own every 5 seconds', JSON.parse(await P.read(CFG + '\\save.json')).lastSeen > saved.lastSeen);
  await f.evaluate(() => { window.__still = 1; });
  await P.ev(() => PortDHost.launch('starlight-cafe')); await P.settle(500);
  check('starting it again while it is open brings back the same window (single instance)', await page.locator('.win').count() === 1 && await f.evaluate(() => window.__still) === 1);
  await P.closeAll();
  // an hour away: Aurora (35/s) + Rin (6) + Peach with bond 8 (1 × 3 = 3) + Mochi level 5 with bond 10 (5 × 3.5 = 17.5) = 61.5/s, half while away
  const away = JSON.parse(await P.read(CFG + '\\save.json')); away.lastSeen = Date.now() - 3600e3; away.stars = 0;
  await P.write(CFG + '\\save.json', JSON.stringify(away));
  await H.reload(page);
  await launch();
  s = await S();
  check('after closing it and reloading PortD, the café is resumed', s.gems === 350 && !!s.owned.aurora && s.owned.mochi.level === 5);
  check('an hour away earns half the income: 61.5/s × 3600 s ÷ 2 = 110,700 stars, with a welcome back message', s.stars > 110500 && s.stars < 111500 && /Welcome back! Your friends earned ✨110K in 1h 0m/.test(await toast()), [s.stars, await toast()]);
  // in one step: the game's 200 ms timer moves lastSeen on
  await f.evaluate(() => { __sc.S.lastSeen = Date.now() - 30 * 3600e3; window.__off = SC.offline(__sc.S).secs; });
  check('time away counts for at most 8 hours', await f.evaluate(() => window.__off) === 8 * 3600);

  section('Starting over');
  await page.keyboard.press('4'); await P.settle(150);
  await f.locator('#reset').click(); await P.settle(150);
  check('Start over asks for a second click and keeps the save', /Click again to erase/.test(await toast()) && JSON.parse(await P.read(CFG + '\\save.json')).owned.aurora);
  await P.settle(3200);
  await f.locator('#reset').click(); await P.settle(150);
  check('a second click after more than 3 seconds only asks again', /Click again to erase/.test(await toast()) && !!(await S()).owned.aurora);
  await f.locator('#reset').click(); await P.settle(400);
  s = await S();
  check('two clicks in a row start a fresh café, and it is saved', s.gems === 300 && Object.keys(s.owned).join() === 'mochi' && /A fresh start/.test(await toast()) && Object.keys(JSON.parse(await P.read(CFG + '\\save.json')).owned).join() === 'mochi');

  section('Theme');
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(200);
  check('the theme button goes to light, then dark, and is saved', await f.evaluate(() => document.documentElement.dataset.theme === 'dark') && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'dark' && await f.locator('#themeBtn').getAttribute('aria-label') === 'Theme: dark');
  check('dark colours: dark page, light text', await f.evaluate(() => getComputedStyle(document.body).color) === 'rgb(243, 230, 246)' && /rgb\(43, 29, 61\)/.test(await f.evaluate(() => getComputedStyle(document.body).backgroundImage)));
  await f.locator('#themeBtn').click(); await P.settle(100);
  check('…and back to following the system', await f.evaluate(() => document.documentElement.dataset.theme === 'light') && JSON.parse(await P.read(CFG + '\\settings.json')).theme === 'auto');
  await P.closeAll();

  section('A save from Starlight Café 0.x');
  // exactly the shape the 0.x game wrote (SC.newState in 0.x is unchanged), with an unknown friend and a bad number mixed in
  await P.write(CFG + '\\save.json', JSON.stringify({ v: 1, created: 1700000000000, lastSeen: Date.now(), stars: 'x', gems: 1234, lifetime: 5e4, taps: 77, pulls: 20, pity: 20, shopBought: 3, lastDaily: '2020-01-01', claimed: { pulls10: 1 }, owned: { mochi: { level: 9, bond: 2, since: 1700000000000 }, luna: { level: 3, bond: 0, since: 1700000000000 }, ghost: { level: 1, bond: 0, since: 1 } } }));
  await launch();
  s = await S();
  check('is loaded as before: gems, friends, counters kept; unknown friends and bad numbers repaired', s.gems === 1234 && s.owned.mochi.level === 9 && s.owned.luna.level === 3 && !s.owned.ghost && s.stars < 60 && s.taps === 77 && s.pity === 20, s);
  check('…and the daily gift is ready again', await f.evaluate(() => document.getElementById('questDot').classList.contains('show')));
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Starlight Café', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark', touch: true });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  await sp.waitForFunction(() => window.__sc && __sc.ready, null, { timeout: 8000 });
  check('it runs, follows the system\'s dark theme, and the portraits load from the folder', await sp.evaluate(() => document.documentElement.dataset.theme === 'dark' && document.querySelector('.friend .pic img').naturalWidth > 0 && document.querySelector('.friend .pic img').getAttribute('src') === 'assets/chars/mochi.svg'));
  await sp.locator('#moon').tap({ force: true }); await sp.locator('#moon').tap({ force: true }); await sp.waitForTimeout(100);
  check('touch taps on the moon count', await sp.evaluate(() => __sc.S.taps) === 2);
  await sp.evaluate(() => SC.storage.save(__sc.S));
  await sp.reload(); await sp.waitForFunction(() => window.__sc && __sc.ready);
  check('the café is kept in localStorage (starlight-cafe-save, as in 0.x) and resumed', await sp.evaluate(() => __sc.S.taps === 2 && !!localStorage.getItem('starlight-cafe-save')));
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
