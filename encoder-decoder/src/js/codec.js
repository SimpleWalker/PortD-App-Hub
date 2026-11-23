/* Encoder-Decoder: the conversions, hashing and generators. No drawing here; app.js draws.
   Everything hangs off window.Codec. Functions throw an Error with a plain message when the input is wrong. */
(function () {
  'use strict';
  const C = window.Codec = {};
  const enc = new TextEncoder();
  C.utf8 = s => enc.encode(s);
  /* bytes to text: UTF-8, strictly; throws if the bytes are not valid UTF-8 */
  C.fromUtf8 = b => new TextDecoder('utf-8', { fatal: true }).decode(b);
  C.latin1 = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 255) throw new Error('"' + s[i] + '" (position ' + (i + 1) + ') is not a Latin-1 character. Choose UTF-8.'); b[i] = c; } return b; };
  C.fromLatin1 = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s; };
  C.hexOf = (b, sep) => Array.from(b, x => x.toString(16).padStart(2, '0')).join(sep || '');

  /* ---------- Base64 and Base64URL ---------- */
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  C.b64encode = function (bytes, url) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < bytes.length ? B64[n >> 6 & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    }
    return url ? s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : s;
  };
  /* decodes standard or URL-safe Base64; spaces and line breaks are ignored, '=' padding is optional */
  C.b64decode = function (text, url) {
    const s = text.replace(/[\s]/g, '');
    const bad = url ? /[^A-Za-z0-9\-_=]/ : /[^A-Za-z0-9+/=]/, m = bad.exec(s);
    if (m) {
      const hint = url && /[+/]/.test(m[0]) ? ' That looks like standard Base64: choose Base64 instead of Base64URL.' : !url && /[-_]/.test(m[0]) ? ' That looks like Base64URL: choose Base64URL.' : '';
      throw new Error('This is not valid ' + (url ? 'Base64URL' : 'Base64') + ': "' + m[0] + '" at position ' + (text.indexOf(m[0]) + 1) + ' is not allowed.' + hint);
    }
    const body = s.replace(/=+$/, '');
    if (body.includes('=')) throw new Error('This is not valid Base64: "=" can only come at the end.');
    if (body.length % 4 === 1) throw new Error('This is not valid Base64: it is one character too long or too short.');
    const out = new Uint8Array(Math.floor(body.length * 3 / 4));
    let o = 0, acc = 0, bits = 0;
    for (const ch of body) {
      acc = (acc << 6) | B64.indexOf(url ? (ch === '-' ? '+' : ch === '_' ? '/' : ch) : ch); bits += 6;
      if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
    }
    return out.subarray(0, o);
  };

  /* ---------- URL ---------- */
  C.urlEncode = (s, whole) => whole ? encodeURI(s) : encodeURIComponent(s);
  C.urlDecode = function (s, plus) {
    if (plus) s = s.replace(/\+/g, ' ');
    try { return decodeURIComponent(s); }
    catch (e) {
      const m = /%(?![0-9A-Fa-f]{2})|(%[0-9A-Fa-f]{2})+/.exec(s);
      throw new Error('This is not valid URL encoding' + (m ? ' near "' + s.slice(m.index, m.index + 9) + '"' : '') + ': every % must be followed by two hex digits that spell out UTF-8.');
    }
  };

  /* ---------- hex ---------- */
  C.hexDecode = function (text) {
    const s = text.replace(/0x/gi, '').replace(/[\s,:;-]/g, '');
    const m = /[^0-9a-fA-F]/.exec(s);
    if (m) throw new Error('This is not hex: "' + m[0] + '" is not 0-9 or a-f.');
    if (s.length % 2) throw new Error('This hex has an odd number of digits (' + s.length + '): each byte needs two.');
    const b = new Uint8Array(s.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(s.substr(i * 2, 2), 16);
    return b;
  };

  /* ---------- HTML entities ---------- */
  const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„', laquo: '«', raquo: '»', bull: '•', middot: '·', para: '¶', sect: '§',
    euro: '€', pound: '£', yen: '¥', cent: '¢', curren: '¤', deg: '°', plusmn: '±', times: '×', divide: '÷', micro: 'µ', frac12: '½', frac14: '¼',
    frac34: '¾', sup1: '¹', sup2: '²', sup3: '³', iexcl: '¡', iquest: '¿', shy: '­', ensp: ' ', emsp: ' ', thinsp: ' ',
    larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', check: '✓', hearts: '♥', ne: '≠', le: '≤', ge: '≥', infin: '∞', minus: '−', prime: '′',
    dagger: '†', Dagger: '‡', permil: '‰', zwj: '‍', zwnj: '‌', szlig: 'ß', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
    agrave: 'à', egrave: 'è', ograve: 'ò', acirc: 'â', ecirc: 'ê', ocirc: 'ô', auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', yuml: 'ÿ',
    ntilde: 'ñ', ccedil: 'ç', aring: 'å', aelig: 'æ', oslash: 'ø', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', Eacute: 'É', Ntilde: 'Ñ', Ccedil: 'Ç' };
  C.htmlEncode = function (s, all) {
    let out = s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    if (all) out = out.replace(/[^\x00-\x7f]/gu, c => '&#' + c.codePointAt(0) + ';');
    return out;
  };
  /* returns { text, unknown: [names not recognised, left as they were] } */
  C.htmlDecode = function (s) {
    const unknown = [];
    const text = s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (all, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : all;
      }
      if (Object.prototype.hasOwnProperty.call(NAMED, e)) return NAMED[e];
      if (!unknown.includes(e)) unknown.push(e);
      return all;
    });
    return { text, unknown };
  };

  /* ---------- JWT (read only: the signature is not checked) ---------- */
  C.jwt = function (token) {
    const t = token.trim().replace(/^Bearer\s+/i, '');
    const parts = t.split('.');
    if (parts.length === 5) throw new Error('This token has 5 parts, so it is encrypted (JWE). Only signed tokens (3 parts) can be read here.');
    if (parts.length !== 3) throw new Error('A JWT has 3 parts separated by dots; this has ' + parts.length + '.');
    const part = (p, what) => {
      let bytes, text;
      try { bytes = C.b64decode(p, true); } catch (e) { throw new Error('The ' + what + ' is not valid Base64URL.'); }
      try { text = C.fromUtf8(bytes); } catch (e) { throw new Error('The ' + what + ' is not UTF-8 text.'); }
      try { return JSON.parse(text); } catch (e) { throw new Error('The ' + what + ' is not valid JSON.'); }
    };
    const header = part(parts[0], 'header'), payload = part(parts[1], 'payload');
    return { header, payload, signature: parts[2], signed: parts[2].length > 0 };
  };
  /* the time claims, as { name, seconds, date } */
  C.jwtTimes = p => ['iat', 'nbf', 'exp', 'auth_time'].filter(k => typeof p[k] === 'number' && isFinite(p[k])).map(k => ({ name: k, seconds: p[k], date: new Date(p[k] * 1000) }));

  /* ---------- MD5 (plain JavaScript; not secure, offered only to check old checksums) ---------- */
  C.md5 = function (bytes) {
    const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
    const n = bytes.length, words = ((n + 8) >>> 6) + 1, M = new Uint32Array(words * 16);
    for (let i = 0; i < n; i++) M[i >> 2] |= bytes[i] << ((i % 4) * 8);
    M[n >> 2] |= 0x80 << ((n % 4) * 8);
    M[words * 16 - 2] = (n * 8) >>> 0; M[words * 16 - 1] = Math.floor(n / 0x20000000);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let w = 0; w < words * 16; w += 16) {
      let A = a0, B = b0, Cc = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & Cc) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & Cc); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ Cc ^ D; g = (3 * i + 5) % 16; }
        else { F = Cc ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[w + g]) >>> 0;
        A = D; D = Cc; Cc = B;
        const s = S[(i >> 4) * 4 + (i % 4)];
        B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + Cc) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16), dv = new DataView(out.buffer);
    [a0, b0, c0, d0].forEach((v, i) => dv.setUint32(i * 4, v, true));
    return out;
  };
  C.HASHES = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'MD5'];
  C.hash = async (alg, bytes) => alg === 'MD5' ? C.md5(bytes) : new Uint8Array(await crypto.subtle.digest(alg, bytes));

  /* ---------- random: crypto.getRandomValues only, with no bias ---------- */
  C.randomBelow = function (n) {
    const max = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
    for (;;) { crypto.getRandomValues(buf); if (buf[0] < max) return buf[0] % n; }
  };
  C.uuid = function () {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = C.hexOf(b);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  C.SETS = { upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!#$%&*+-=?@^_~.,:;()[]{}' };
  const LOOKALIKE = /[Il1O0o]/g;
  /* a password with at least one character from each chosen set; returns { text, bits } */
  C.password = function (o) {
    const sets = Object.keys(C.SETS).filter(k => o[k]).map(k => o.clear ? C.SETS[k].replace(LOOKALIKE, '') : C.SETS[k]);
    if (!sets.length) throw new Error('Choose at least one kind of character.');
    const len = Math.max(sets.length, Math.min(256, o.length | 0)), all = sets.join('');
    const chars = sets.map(s => s[C.randomBelow(s.length)]);
    while (chars.length < len) chars.push(all[C.randomBelow(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = C.randomBelow(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return { text: chars.join(''), bits: Math.round(len * Math.log2(all.length)) };
  };
  /* a passphrase from the word list; returns { text, bits } */
  C.passphrase = function (o) {
    const W = C.WORDS, n = Math.max(2, Math.min(20, o.words | 0));
    let words = [];
    for (let i = 0; i < n; i++) { let w = W[C.randomBelow(W.length)]; if (o.capital) w = w[0].toUpperCase() + w.slice(1); words.push(w); }
    let bits = n * Math.log2(W.length);
    if (o.digit) { const i = C.randomBelow(n); words[i] += C.randomBelow(10); bits += Math.log2(10 * n); }
    return { text: words.join(o.sep == null ? '-' : o.sep), bits: Math.round(bits) };
  };
  C.strength = bits => bits < 40 ? 'weak' : bits < 60 ? 'fair' : bits < 80 ? 'strong' : 'very strong';
})();
