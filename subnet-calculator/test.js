/* Subnet Calculator: tests in the real PortD 1.0.0, in headless Chrome, with real mouse, keyboard and touch input.
   "In range?" answers are checked against Node's own net.BlockList; other expected values are worked out by hand.
   Run: node subnet-calculator/test.js   (after node subnet-calculator/build.js) */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net');
const H = require('../build/harness');
const { section, check } = H;
const APP = __dirname, PKG = fs.readdirSync(APP).find(f => f.endsWith('.portdapp'));
const CFG = 'P:\\User\\Config\\subnet-calculator';

(async () => {
  console.log('Subnet Calculator tests\n  package  ' + PKG + '\n  portd    ' + path.relative(path.join(__dirname, '..'), H.PORTD) + '\n  browser  ' + (H.BROWSER || 'Playwright Chromium'));
  const ctx = await H.profile({ touch: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await H.openPortD(ctx), P = H.on(page);
  const clip = () => page.evaluate(() => navigator.clipboard.readText());
  let f;
  const launch = async () => { await P.icon('Subnet Calculator').dblclick(); await P.settle(600); f = await P.frame(); await f.waitForFunction(() => window.__sc4 && __sc4.ready); };
  const type = async (sel, t) => { await f.locator(sel).fill(''); await f.locator(sel).focus(); await page.keyboard.insertText(t); await P.settle(250); };
  const facts = id => f.evaluate(id => Object.fromEntries([...document.querySelectorAll('#' + id + ' .facts tr')].map(r => [r.cells[0].textContent, r.cells[1].textContent])), id);
  const msg = id => f.locator('#' + id + '-msg').innerText();
  const active = () => f.evaluate(() => document.activeElement && document.activeElement.id);
  const toast = () => f.locator('#toast').innerText();

  section('Installing');
  const d = await P.offerInstall(path.join(APP, PKG));
  check('the confirmation names Subnet Calculator 1.0.0 and 6 files', /Subnet Calculator/.test(d) && /Version\s+1\.0\.0/.test(d) && /Files\s+6 files, /.test(d) && !/Can open/.test(d), d);
  await P.press('Install');
  check('installed, with a desktop shortcut', await P.ls('P:\\Programs\\subnet-calculator') === 'js|icon.svg|index.html|manifest.json|style.css' && await P.icon('Subnet Calculator').count() === 1);
  await P.closeAll();
  await launch();
  check('it opens on IPv4 with an example and the cursor in the address box', await active() === 'v4-in' && (await facts('v4-out')).Network === '192.168.10.0/26' && await P.titles() === 'Subnet Calculator');

  section('IPv4');
  await type('#v4-in', '10.1.2.3/22');
  let x = await facts('v4-out');
  check('10.1.2.3/22: network, broadcast, first and last host, usable hosts', x.Network === '10.1.0.0/22' && x.Broadcast === '10.1.3.255' && x['First host'] === '10.1.0.1' && x['Last host'] === '10.1.3.254' && x['Usable hosts'] === '1,022' && x['Addresses in all'] === '1,024', x);
  check('…masks, class, type and the number', x['Subnet mask'] === '255.255.252.0 (/22)' && x['Wildcard mask'] === '0.0.3.255' && x.Class === 'A' && x.Type === 'Private (RFC 1918)' && x['As a number'] === '167,838,211 (hex 0A010203)');
  check('it says where the address sits', /10\.1\.2\.3 is host 515 of this network/.test(await msg('v4')));
  const bits = await f.evaluate(() => [...document.querySelectorAll('#v4-out .bintab tr')].map(r => [r.cells[0].textContent, r.querySelectorAll('.nb').length, r.cells[1].getAttribute('aria-label')]));
  check('the binary view highlights exactly 22 network bits in each row and reads out the bits', bits.length === 4 && bits.every(b => b[1] === 22) && bits[1][2] === 'Mask in binary: 11111111 11111111 11111100 00000000', bits);
  await type('#v4-in', '10.1.2.3 255.255.252.0'); check('the mask can be typed after a space', (await facts('v4-out')).Network === '10.1.0.0/22');
  await type('#v4-in', '10.1.2.3/255.255.252.0'); check('…or after a slash', (await facts('v4-out')).Network === '10.1.0.0/22');
  const bad = [['10.1.2.300/8', /300 is too big; each of the 4 numbers is 0 to 255/], ['10.01.2.3/8', /"01" starts with 0\. Leave out leading zeros/], ['10.1.2.3 0.0.3.255', /looks like a wildcard mask\. The subnet mask for it is 255\.255\.252\.0 \(\/22\)/],
    ['10.1.2.3 255.0.255.0', /not a valid subnet mask: its 1s must all come first/], ['10.1.2.3/33', /\/33 is too big/], ['10.1.2', /needs 4 numbers separated by dots/], ['hello', /not an IPv4 address/]];
  const badOut = [];
  for (const [t, re] of bad) { await type('#v4-in', t); badOut.push(re.test(await msg('v4')) && await f.locator('#v4-in').getAttribute('aria-invalid') === 'true' && await f.locator('#v4-out').innerText() === ''); }
  check('mistakes get plain messages: too big, leading zero, wildcard mask, gappy mask, prefix too long, too few numbers', badOut.every(Boolean), badOut);
  await type('#v4-in', '192.168.1.5'); x = await facts('v4-out');
  check('an address with no prefix is a single address (/32), and it says so', x.Network === '192.168.1.5/32' && x['Usable hosts'] === '1 (a single address)' && /No prefix or mask was given/.test(await msg('v4')));
  await type('#v4-in', '192.168.1.5/31'); x = await facts('v4-out');
  check('/31 has 2 usable addresses (point-to-point) and no broadcast', x['First host'] === '192.168.1.4' && x['Last host'] === '192.168.1.5' && /^2 \(a point-to-point link/.test(x['Usable hosts']) && /none for \/31/.test(x.Broadcast));
  const kinds = [['8.8.8.8/24', 'Public'], ['100.64.1.1/10', 'Shared address space (carrier-grade NAT)'], ['169.254.9.9/16', 'Link-local (APIPA)'], ['203.0.113.7/24', 'Documentation (TEST-NET-3)'], ['239.1.1.1/8', 'Multicast'], ['127.0.0.1/8', 'Loopback']];
  const ko = [];
  for (const [t, k] of kinds) { await type('#v4-in', t); ko.push((await facts('v4-out')).Type === k); }
  check('types: public, carrier-grade NAT, link-local, documentation, multicast, loopback', ko.every(Boolean), ko);
  await type('#v4-in', '10.1.2.3/22');
  await page.keyboard.press('Alt+c'); await P.settle(150);
  check('Alt+C copies all the details as text', /^Address: 10\.1\.2\.3\nNetwork: 10\.1\.0\.0\/22\nBroadcast: 10\.1\.3\.255/.test(await clip()) && /^Copied/.test(await toast()));

  section('Split');
  await page.keyboard.press('Alt+2'); await P.settle(100);
  check('Alt+2 opens Split with the cursor in the network box', await active() === 'split-in');
  const rows = () => f.evaluate(() => [...document.querySelectorAll('#split-out tbody tr')].map(r => [...r.cells].map(c => c.textContent).join(' ')));
  let r = await rows();
  check('6 subnets of 10.20.0.0/22 become 8 of /25, and it explains why', r.length === 8 && r[0] === '1 10.20.0.0/25 10.20.0.1 10.20.0.126 10.20.0.127 126' && r[7] === '8 10.20.3.128/25 10.20.3.129 10.20.3.254 10.20.3.255 126' && /You asked for 6; subnets come in powers of two, so you get 8/.test(await msg('split')));
  await f.locator('#p-split .sbtn[data-v=prefix]').click(); await f.locator('#split-n').fill('26'); await P.settle(250);
  r = await rows();
  check('by new prefix /26: 16 subnets of 62 hosts', r.length === 16 && r[15] === '16 10.20.3.192/26 10.20.3.193 10.20.3.254 10.20.3.255 62' && /^16 subnets of \/26 \(62 usable hosts each\)/.test(await msg('split')));
  await f.locator('#p-split .btn', { hasText: 'Copy as text' }).click(); await P.settle(150);
  check('Copy as text gives one CIDR per line', (await clip()).split('\n').length === 16 && (await clip()).startsWith('10.20.0.0/26\n10.20.0.64/26'));
  await f.locator('#p-split .btn', { hasText: 'Copy as table' }).click(); await P.settle(150);
  check('Copy as table gives tab-separated rows with headings, for Excel', (await clip()).split('\n')[0] === '#\tNetwork\tFirst host\tLast host\tBroadcast\tUsable hosts' && (await clip()).split('\n')[1] === '1\t10.20.0.0/26\t10.20.0.1\t10.20.0.62\t10.20.0.63\t62');
  await f.locator('#split-n').fill('20'); await P.settle(250);
  check('a prefix shorter than the network\'s is explained', /must be the same as or longer than the network's \(\/22\)/.test(await msg('split')));
  await type('#split-in', '10.0.0.0/8'); await f.locator('#split-n').fill('24'); await P.settle(600);
  check('65,536 subnets: the first 1,024 are listed, and it says Copy gives all', (await rows()).length === 1024 && /The first 1,024 are shown here; Copy copies all 65,536/.test(await f.locator('#split-out').innerText()));
  await page.keyboard.press('Alt+c'); await P.settle(300);
  check('…and Copy does give all 65,536', (await clip()).split('\n').length === 65536 && (await clip()).endsWith('10.255.255.0/24'));
  await f.locator('#split-n').fill('30'); await P.settle(250);
  check('more than 65,536 is refused, plainly', /That makes 4,194,304 subnets; up to 65,536 can be listed/.test(await msg('split')));
  await type('#split-in', '10.20.1.77/22'); await f.locator('#split-n').fill('24'); await P.settle(250);
  check('a host address is taken as its network, and it says so', /Started from the network 10\.20\.0\.0\/22/.test(await msg('split')) && (await rows())[0].startsWith('1 10.20.0.0/24'));

  section('In range?');
  await page.keyboard.press('Alt+3'); await P.settle(100);
  const ranges = ['10.20.0.0/22', '10.20.4.0/24', '192.168.0.0/16', '10.20.3.1 - 10.20.3.9', '172.16.0.0 255.240.0.0', '8.8.8.8'];
  const bl = ranges.map(t => { const b = new net.BlockList(); const m = /^([\d.]+) - ([\d.]+)$/.exec(t); if (m) b.addRange(m[1], m[2]); else if (/ /.test(t)) b.addSubnet(t.split(' ')[0], 12); else if (t.includes('/')) b.addSubnet(t.split('/')[0], +t.split('/')[1]); else b.addAddress(t); return b; });
  await f.locator('#in-list').fill(ranges.join('\n') + '\nnot a range');
  const ips = ['10.20.3.15', '10.20.3.5', '10.20.4.255', '172.31.255.255', '172.32.0.0', '8.8.8.8', '11.0.0.0'];
  const agree = [];
  for (const ip of ips) {
    await type('#in-ip', ip);
    const got = await f.evaluate(() => [...document.querySelectorAll('#in-out li')].filter(l => !l.classList.contains('bad')).map(l => l.classList.contains('yes')));
    agree.push(JSON.stringify(got) === JSON.stringify(bl.map(b => b.check(ip, 'ipv4'))));
  }
  check('for 7 addresses, every yes/no agrees with Node\'s net.BlockList (CIDR, mask, start–end range, single address)', agree.every(Boolean), agree);
  check('a line that cannot be read is listed with the reason', /not a range\s*"not" is not an IPv4 address/.test(await f.locator('#in-out .bad').innerText()) && /1 line could not be read/.test(await msg('in')), [await f.locator('#in-out .bad').innerText(), await msg('in')]);
  await type('#in-ip', '10.20.3.5');
  check('the summary counts the ranges it is in', /^10\.20\.3\.5 is in 2 of the 6 ranges\./.test(await msg('in')));
  await page.keyboard.press('Alt+c'); await P.settle(100);
  check('Copy gives a plain list', (await clip()).split('\n').slice(0, 3).join('|') === '10.20.3.5|IN      10.20.0.0/22|NOT IN  10.20.4.0/24');

  section('Summarise');
  await page.keyboard.press('Alt+4'); await P.settle(100);
  await f.locator('#sum-in').fill('10.1.0.0/24, 10.1.1.0/24\n10.1.2.0/23\n10.1.4.0-10.1.4.255\n10.1.4.128/25\n10.0.0.1 - 10.0.0.6\n192.168.1.77/24\n# a comment\nrubbish'); await P.settle(300);
  check('neighbours and overlaps merge into the fewest blocks; an odd range becomes exact blocks', await f.locator('#sum-out').inputValue() === '10.0.0.1/32\n10.0.0.2/31\n10.0.0.4/31\n10.0.0.6/32\n10.1.0.0/22\n10.1.4.0/24\n192.168.1.0/24', await f.locator('#sum-out').inputValue());
  check('it counts in and out, and says what it did with a host address and a bad line', /^7 ranges in, 7 CIDR blocks out\. 1 entry was not on a network boundary/.test(await msg('sum')) && /1 line could not be read/.test(await msg('sum')) && /rubbish/.test(await f.locator('#p-sum .hits').innerText()));
  await f.locator('#sum-in').fill('10.0.0.0/25\n10.0.0.128/25'); await P.settle(300);
  check('two halves become the whole', await f.locator('#sum-out').inputValue() === '10.0.0.0/24');

  section('IPv6');
  await page.keyboard.press('Alt+5'); await P.settle(100);
  await type('#v6-in', '2001:0DB8:0000:0000:0001:0000:0000:0001/48');
  x = await facts('v6-out');
  check('compress (lower case, longest zero run as ::) and expand', x.Compressed === '2001:db8::1:0:0:1' && x.Expanded === '2001:0db8:0000:0000:0001:0000:0000:0001', x);
  check('prefix range: network, first and last address, how many, type', x.Network === '2001:db8::/48' && x['First address'] === '2001:0db8:0000:0000:0000:0000:0000:0000' && x['Last address'] === '2001:0db8:0000:ffff:ffff:ffff:ffff:ffff' && x.Addresses === '2^80 (about 1.21 × 10^24)' && x.Type === 'Documentation' && x['/64 networks inside'] === '65,536');
  check('the prefix part is highlighted (12 hex digits for /48)', await f.evaluate(() => document.querySelector('#v6-out .bintab tr .bits').querySelectorAll('.nb').length) === 12);
  await type('#v6-in', '1:0:0:2:0:0:0:3'); check('the longest run of zeros is the one compressed', (await facts('v6-out')).Compressed === '1:0:0:2::3' && /single address \(\/128\)/.test(await msg('v6')));
  await type('#v6-in', 'fe80::1%Ethernet 2/64'); check('a zone (%…) is explained and set aside', (await facts('v6-out')).Type === 'Link-local' && /The zone "%Ethernet 2" names a network adapter/.test(await msg('v6')));
  await type('#v6-in', '::ffff:192.0.2.1'); check('an IPv4-mapped address keeps its IPv4 form', (await facts('v6-out')).Compressed === '::ffff:192.0.2.1' && (await facts('v6-out')).Expanded === '0000:0000:0000:0000:0000:ffff:c000:0201');
  await type('#v6-in', '2001:db8::/120'); check('small ranges are counted exactly', (await facts('v6-out')).Addresses === '256');
  const bad6 = [['1::2::3', /"::" more than once/], ['12345::', /more than 4 hex digits/], ['2001:db8::/129', /\/129 is not a valid IPv6 prefix/], ['1:2:3', /has 3 groups; a full IPv6 address has 8/], ['gg::1', /only 0-9, a-f/]];
  const b6 = [];
  for (const [t, re] of bad6) { await type('#v6-in', t); b6.push(re.test(await msg('v6'))); }
  check('IPv6 mistakes get plain messages', b6.every(Boolean), b6);

  section('Keyboard, touch, theme and coming back later');
  await f.locator('#t-v6').focus(); await page.keyboard.press('ArrowLeft');
  check('arrow keys move along the tabs', await active() === 't-sum' && !(await f.locator('#p-sum').isHidden()));
  await f.locator('#t-split').tap(); await f.locator('#p-split .sbtn[data-v=count]').tap(); await P.settle(200);
  check('touch works on tabs and buttons', !(await f.locator('#p-split').isHidden()) && await f.locator('#p-split .sbtn[data-v=count]').getAttribute('aria-pressed') === 'true' && await f.locator('#split-n').getAttribute('aria-label') === 'How many subnets');
  await f.locator('#themeBtn').click(); await f.locator('#themeBtn').click(); await P.settle(150);
  check('the theme button goes to light, then dark', await f.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await f.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(26, 30, 38)');
  await P.settle(600);
  const st = JSON.parse(await P.read(CFG + '\\settings.json'));
  check('settings.json keeps each tool\'s last input, the tab and the theme', st.tab === 'split' && st.v4 === '10.1.2.3/22' && st.split.net === '10.20.1.77/22' && st.split.by === 'count' && st.v6 === 'gg::1' && st.theme === 'dark');
  await P.closeAll(); await H.reload(page); await launch();
  check('after a PortD reload: the same tab, inputs and results, still dark', await f.locator('#t-split').getAttribute('aria-selected') === 'true' && await f.locator('#split-in').inputValue() === '10.20.1.77/22' && (await facts('v4-out')).Network === '10.1.0.0/22' && await f.locator('#in-ip').inputValue() === '10.20.3.5' && await f.evaluate(() => document.documentElement.dataset.theme) === 'dark');
  await f.locator('#themeBtn').click();
  await P.closeAll();

  section('No errors');
  check('no console errors in PortD or in Subnet Calculator', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Outside PortD: the page opened straight from its folder');
  const c2 = await H.profile({ colorScheme: 'dark' });
  const sp = await H.openStandalone(c2, path.join(APP, 'src', 'index.html'));
  await sp.waitForFunction(() => window.__sc4 && __sc4.ready, null, { timeout: 8000 });
  await sp.fill('#v4-in', '172.16.5.4/20'); await sp.waitForTimeout(600);
  check('it works and follows the system\'s dark theme', await sp.evaluate(() => document.documentElement.dataset.theme === 'dark') && /172\.16\.0\.0\/20/.test(await sp.locator('#v4-out').innerText()));
  await sp.reload(); await sp.waitForFunction(() => window.__sc4 && __sc4.ready);
  check('the inputs are kept in the browser\'s storage', await sp.inputValue('#v4-in') === '172.16.5.4/20');
  check('no console errors outside PortD', c2.errors.length === 0, c2.errors);
  await c2.close();
  H.finish();
})().catch(e => { console.error('\nTEST CRASHED\n', e); process.exit(2); });
