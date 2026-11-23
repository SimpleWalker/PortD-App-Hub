/* Subnet Calculator: the arithmetic. IPv4 addresses are unsigned 32-bit numbers; IPv6 addresses are BigInts.
   No drawing here; app.js draws. Everything hangs off window.IP. Functions throw an Error with a plain message. */
(function () {
  'use strict';
  const IP = window.IP = {};
  const u32 = n => n >>> 0;

  /* ---------- IPv4 ---------- */
  IP.parse4 = function (s, what) {
    const t = String(s).trim(), name = what || 'address';
    if (!t) throw new Error('Type an ' + name + '.');
    const parts = t.split('.');
    if (parts.length !== 4) throw new Error('"' + t + '" is not an IPv4 ' + name + ': it needs 4 numbers separated by dots, like 192.168.1.10.');
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      if (!/^\d+$/.test(p)) throw new Error('"' + t + '" is not an IPv4 ' + name + ': "' + p + '" is not a number.');
      if (p.length > 1 && p[0] === '0') throw new Error('"' + t + '": "' + p + '" starts with 0. Leave out leading zeros (some systems read them as octal).');
      const v = +p;
      if (v > 255) throw new Error('"' + t + '": ' + v + ' is too big; each of the 4 numbers is 0 to 255.');
      n = n * 256 + v;
    }
    return n;
  };
  IP.fmt4 = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  IP.maskOf = p => p === 0 ? 0 : u32(0xffffffff << (32 - p));
  /* a dotted mask to its prefix; explains wildcard masks and masks with gaps */
  IP.prefixOfMask = function (m, text) {
    for (let p = 0; p <= 32; p++) if (IP.maskOf(p) === m) return p;
    const inv = u32(~m);
    for (let p = 0; p <= 32; p++) if (IP.maskOf(p) === inv) throw new Error('"' + text + '" looks like a wildcard mask. The subnet mask for it is ' + IP.fmt4(inv) + ' (/' + p + ').');
    throw new Error('"' + text + '" is not a valid subnet mask: its 1s must all come first, with no gaps (like 255.255.252.0).');
  };
  /* "10.1.2.3/22", "10.1.2.3 255.255.252.0", "10.1.2.3/255.255.252.0" or "10.1.2.3" → { addr, prefix, assumed } */
  IP.parseCidr4 = function (s) {
    const t = String(s).trim().replace(/\s*\/\s*/, '/');
    if (!t) throw new Error('Type an address with its prefix, like 10.1.2.3/22.');
    let a, b;
    if (t.includes('/')) [a, b] = t.split('/', 2);
    else { const sp = t.split(/\s+/); if (sp.length > 2) { IP.parse4(sp[0]); throw new Error('"' + t + '": type one address and one mask, like 10.1.2.3 255.255.252.0.'); } [a, b] = sp; }
    const addr = IP.parse4(a);
    if (b === undefined) return { addr, prefix: 32, assumed: true };
    if (/^\d+$/.test(b)) {
      const p = +b;
      if (p > 32) throw new Error('/' + b + ' is too big: an IPv4 prefix is 0 to 32.');
      return { addr, prefix: p };
    }
    return { addr, prefix: IP.prefixOfMask(IP.parse4(b, 'mask'), b) };
  };

  const RANGES = [
    ['0.0.0.0', 8, 'This network (not usable as an address)'],
    ['10.0.0.0', 8, 'Private (RFC 1918)'], ['172.16.0.0', 12, 'Private (RFC 1918)'], ['192.168.0.0', 16, 'Private (RFC 1918)'],
    ['100.64.0.0', 10, 'Shared address space (carrier-grade NAT)'], ['127.0.0.0', 8, 'Loopback'], ['169.254.0.0', 16, 'Link-local (APIPA)'],
    ['192.0.0.0', 24, 'IETF protocol assignments'], ['192.0.2.0', 24, 'Documentation (TEST-NET-1)'], ['198.51.100.0', 24, 'Documentation (TEST-NET-2)'],
    ['203.0.113.0', 24, 'Documentation (TEST-NET-3)'], ['198.18.0.0', 15, 'Benchmark testing'], ['224.0.0.0', 4, 'Multicast'],
    ['255.255.255.255', 32, 'Limited broadcast'], ['240.0.0.0', 4, 'Reserved']
  ].map(([a, p, name]) => ({ net: IP.parse4(a), prefix: p, name }));
  /* the most specific special range the address is in, or Public */
  IP.kind4 = function (a) {
    let best = null;
    for (const r of RANGES) if (u32(a & IP.maskOf(r.prefix)) === r.net && (!best || r.prefix > best.prefix)) best = r;
    return best ? best.name : 'Public';
  };
  IP.class4 = a => { const o = a >>> 24; return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D (multicast)' : 'E (reserved)'; };

  /* everything about one network */
  IP.info4 = function (addr, prefix) {
    const mask = IP.maskOf(prefix), net = u32(addr & mask), bc = u32(net | ~mask), size = 2 ** (32 - prefix);
    let first, last, usable;
    if (prefix === 32) { first = last = net; usable = 1; }
    else if (prefix === 31) { first = net; last = bc; usable = 2; }
    else { first = net + 1; last = bc - 1; usable = size - 2; }
    return { addr, prefix, mask, wildcard: u32(~mask), net, bc, size, first, last, usable, cls: IP.class4(addr), kind: IP.kind4(addr), netKind: IP.kind4(net) };
  };
  IP.bits4 = n => n.toString(2).padStart(32, '0');

  /* equal subnets: by a new prefix, or by a count (rounded up to a power of two) */
  IP.split4 = function (net, prefix, o) {
    let np;
    if (o.by === 'count') {
      const c = Math.floor(o.count);
      if (!(c >= 1)) throw new Error('Type how many subnets you need (1 or more).');
      np = prefix + Math.ceil(Math.log2(c));
      if (np > 32) throw new Error('/' + prefix + ' can be split into at most ' + (2 ** (32 - prefix)).toLocaleString('en-GB') + ' subnets.');
    } else {
      np = Math.floor(o.prefix);
      if (!(np >= 0 && np <= 32)) throw new Error('The new prefix must be 0 to 32.');
      if (np < prefix) throw new Error('The new prefix (/' + np + ') must be the same as or longer than the network\'s (/' + prefix + ').');
    }
    const n = 2 ** (np - prefix);
    if (n > 65536) throw new Error('That makes ' + n.toLocaleString('en-GB') + ' subnets; up to 65,536 can be listed.');
    const step = 2 ** (32 - np), list = [];
    for (let i = 0; i < n; i++) list.push(IP.info4(u32(net + i * step), np));
    return { prefix: np, list };
  };

  /* a line of a range list: "10.0.0.0/8", "10.0.0.0 255.0.0.0", "10.0.0.1-10.0.0.9", or a single address → { start, end, text } */
  IP.range4 = function (line) {
    const t = line.trim();
    const m = /^([\d.]+)\s*(?:-|–|to)\s*([\d.]+)$/i.exec(t);
    if (m) {
      const a = IP.parse4(m[1]), b = IP.parse4(m[2]);
      if (b < a) throw new Error('"' + t + '": the range ends before it starts.');
      return { start: a, end: b, text: t };
    }
    const c = IP.parseCidr4(t), i = IP.info4(c.addr, c.prefix);
    return { start: i.net, end: i.bc, text: t, cidr: true, aligned: i.net === c.addr };
  };
  /* reads a list (lines, commas or semicolons); returns { ok: [...], bad: [{ text, error }] } */
  IP.readList = function (text, read) {
    const ok = [], bad = [];
    for (const raw of text.split(/[\n,;]+/)) {
      const t = raw.replace(/#.*$/, '').trim();
      if (!t) continue;
      try { ok.push(read(t)); } catch (e) { bad.push({ text: t, error: e.message }); }
    }
    return { ok, bad };
  };
  /* the fewest CIDR blocks that cover exactly the given ranges */
  IP.summarise4 = function (ranges) {
    const sorted = ranges.map(r => [r.start, r.end]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), merged = [];
    for (const [s, e] of sorted) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e); else merged.push([s, e]);
    }
    const out = [];
    for (let [s, e] of merged) {
      while (s <= e) {
        let p = 32;
        while (p > 0) { const q = p - 1, size = 2 ** (32 - q); if (s % size !== 0 || s + size - 1 > e) break; p = q; }
        out.push({ net: s, prefix: p });
        s += 2 ** (32 - p);
      }
    }
    return { blocks: out, merged: merged.length };
  };

  /* ---------- IPv6 (BigInt) ---------- */
  const B = BigInt, ALL = (1n << 128n) - 1n;
  IP.parse6 = function (s) {
    let t = String(s).trim(), zone = '';
    if (!t) throw new Error('Type an IPv6 address, like 2001:db8::1/64.');
    t = t.replace(/^\[|\]$/g, '');
    const zi = t.indexOf('%');
    if (zi >= 0) { zone = t.slice(zi + 1); t = t.slice(0, zi); }
    if (/[^0-9a-fA-F:.]/.test(t)) throw new Error('"' + s.trim() + '" is not an IPv6 address: only 0-9, a-f, colons (and dots for an IPv4 ending) are allowed.');
    let tail = [];
    const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(t);
    if (v4) { const n = IP.parse4(v4[1]); tail = [(n >>> 16).toString(16), (n & 0xffff).toString(16)]; t = t.slice(0, -v4[1].length) + (t.endsWith(':' + v4[1]) ? '' : ''); if (t.endsWith(':') && !t.endsWith('::')) t = t.slice(0, -1); }
    const dbl = t.split('::');
    if (dbl.length > 2) throw new Error('"' + s.trim() + '" has "::" more than once; it may appear only once.');
    const side = x => x === '' ? [] : x.split(':');
    let head = side(dbl[0]), rest = dbl.length === 2 ? side(dbl[1]) : [];
    if (dbl.length === 1) { head = head.concat(tail); } else rest = rest.concat(tail);
    for (const g of head.concat(rest)) {
      if (g === '') throw new Error('"' + s.trim() + '" has an empty group (two colons in a row are only allowed once, as "::").');
      if (g.length > 4) throw new Error('"' + s.trim() + '": the group "' + g + '" has more than 4 hex digits.');
    }
    const count = head.length + rest.length;
    if (dbl.length === 1 && count !== 8) throw new Error('"' + s.trim() + '" has ' + count + ' groups; a full IPv6 address has 8 (or use "::" for a run of zeros).');
    if (dbl.length === 2 && count > 7) throw new Error('"' + s.trim() + '" has too many groups for "::" to stand for any.');
    const groups = dbl.length === 2 ? head.concat(Array(8 - count).fill('0'), rest) : head;
    let n = 0n;
    for (const g of groups) n = (n << 16n) | B(parseInt(g, 16));
    return { n, zone };
  };
  IP.parseCidr6 = function (s) {
    const t = String(s).trim();
    const i = t.lastIndexOf('/');
    if (i < 0) { const a = IP.parse6(t); return { n: a.n, zone: a.zone, prefix: 128, assumed: true }; }
    const ps = t.slice(i + 1).trim();
    if (!/^\d+$/.test(ps) || +ps > 128) throw new Error('/' + ps + ' is not a valid IPv6 prefix: it is 0 to 128.');
    const a = IP.parse6(t.slice(0, i));
    return { n: a.n, zone: a.zone, prefix: +ps };
  };
  IP.groups6 = n => { const g = []; for (let i = 7; i >= 0; i--) g.push(Number((n >> B(i * 16)) & 0xffffn)); return g; };
  IP.expand6 = n => IP.groups6(n).map(x => x.toString(16).padStart(4, '0')).join(':');
  /* RFC 5952: lower case, no leading zeros, the longest run of two or more zero groups as "::" (the first if tied) */
  IP.compress6 = function (n) {
    const g = IP.groups6(n).map(x => x.toString(16));
    let bs = -1, bl = 0;
    for (let i = 0; i < 8;) { if (g[i] !== '0') { i++; continue; } let j = i; while (j < 8 && g[j] === '0') j++; if (j - i > bl) { bs = i; bl = j - i; } i = j; }
    if (bl < 2) return g.join(':');
    return g.slice(0, bs).join(':') + '::' + g.slice(bs + bl).join(':');
  };
  IP.mask6 = p => p === 0 ? 0n : (ALL << B(128 - p)) & ALL;
  const R6 = [['::', 128, 'Unspecified'], ['::1', 128, 'Loopback'], ['::ffff:0:0', 96, 'IPv4-mapped'], ['64:ff9b::', 96, 'IPv4/IPv6 translation'],
    ['100::', 64, 'Discard only'], ['2001:db8::', 32, 'Documentation'], ['2001::', 32, 'Teredo'], ['2002::', 16, '6to4'], ['fc00::', 7, 'Unique local (private)'],
    ['fe80::', 10, 'Link-local'], ['ff00::', 8, 'Multicast'], ['2000::', 3, 'Global unicast (public)']].map(([a, p, name]) => ({ n: IP.parse6(a).n, prefix: p, name }));
  IP.kind6 = function (n) {
    let best = null;
    for (const r of R6) if ((n & IP.mask6(r.prefix)) === r.n && (!best || r.prefix > best.prefix)) best = r;
    return best ? best.name : 'Reserved';
  };
  IP.info6 = function (n, prefix) {
    const mask = IP.mask6(prefix), net = n & mask, last = net | (~mask & ALL);
    return { n, prefix, net, last, size: 1n << B(128 - prefix), kind: IP.kind6(n) };
  };
  /* 2^k addresses in words: exact up to 2^53, otherwise as a power of two with an approximate number */
  IP.size6 = function (size, prefix) {
    const k = 128 - prefix;
    if (k <= 53) return size.toLocaleString('en-GB');
    return '2^' + k + ' (about ' + Number(size).toExponential(2).replace('e+', ' × 10^') + ')';
  };
})();
