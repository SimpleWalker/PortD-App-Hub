/* Zip Viewer: reading archives. The central directory is parsed here (with ZIP64 fields); entries are read with
   stored (0) or deflate (8), deflate through the browser's DecompressionStream('deflate-raw'). Nothing is ever written
   to the archive. No drawing here; app.js draws. Everything hangs off window.Zip. Errors are plain-language Errors. */
(function () {
  'use strict';
  const Z = window.Zip = {};
  Z.LIMIT = { entry: 64 * 1048576, preview: 1048576, image: 16 * 1048576 };
  const METHODS = { 0: 'stored', 1: 'Shrink', 6: 'Implode', 8: 'deflate', 9: 'Deflate64', 12: 'BZIP2', 14: 'LZMA', 93: 'Zstandard', 95: 'XZ', 96: 'JPEG', 97: 'WavPack', 98: 'PPMd', 99: 'AES encryption' };
  Z.methodName = m => METHODS[m] || 'method ' + m;

  /* old zip tools wrote names in the DOS code page 437 */
  const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  const cp437 = b => { let s = ''; for (const x of b) s += x < 128 ? String.fromCharCode(x) : CP437[x - 128]; return s; };
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  const nameOf = (b, flagUtf8) => { if (flagUtf8) try { return utf8.decode(b); } catch (e) { /* fall through */ } try { return /[\x80-\xff]/.test(String.fromCharCode(...b.subarray(0, 4096))) ? utf8.decode(b) : cp437(b); } catch (e) { return cp437(b); } };

  /* MS-DOS date and time to a Date (local time, as zip tools write it); null if unset */
  function dosDate(d, t) {
    if (!d) return null;
    const dt = new Date(1980 + (d >> 9), ((d >> 5) & 15) - 1, d & 31, t >> 11, (t >> 5) & 63, (t & 31) * 2);
    return isNaN(dt) ? null : dt;
  }

  /* a safe relative path for writing: forward slashes, no drive, no leading slash, no "." or ".." parts,
     and each part a name PortD accepts. Returns { path, changed, unsafe } */
  Z.safePath = function (name) {
    let unsafe = false;
    let p = name.replace(/\\/g, '/');
    if (/^[a-zA-Z]:/.test(p)) { p = p.slice(2); unsafe = true; }
    if (p.startsWith('/')) unsafe = true;
    const parts = [];
    for (let seg of p.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') { unsafe = true; continue; }
      seg = seg.replace(/[:*?"<>|\x00-\x1f]/g, '_').replace(/^ +/, '_').replace(/[ .]+$/, m => '_'.repeat(m.length)).slice(0, 120);
      if (seg === '__proto__') seg = '_proto_';
      parts.push(seg);
    }
    const path = parts.join('/');
    return { path, unsafe, changed: unsafe || path !== p.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/') };
  };

  /* reads the list of entries. bytes: Uint8Array of the whole archive.
     Returns { entries: [...], comment, zip64 } */
  Z.read = function (bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), n = bytes.length;
    const u16 = o => dv.getUint16(o, true), u32 = o => dv.getUint32(o, true), u64 = o => dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296;
    if (n < 22) throw new Error('This file is too small to be a zip archive.');
    let eocd = -1;
    for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) if (u32(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error(u32(0) === 0x04034b50 ? 'This zip archive is cut short or damaged: its list of contents is missing.' : 'This is not a zip archive.');
    let count = u16(eocd + 10), cdSize = u32(eocd + 12), cdOff = u32(eocd + 16), zip64 = false;
    const comment = nameOf(bytes.subarray(eocd + 22, eocd + 22 + u16(eocd + 20)), true);
    if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || u32(loc) !== 0x07064b50) throw new Error('This is a ZIP64 archive whose extra directory is missing, so Zip Viewer cannot read it.');
      const z = u64(loc + 8);
      if (z + 56 > n || u32(z) !== 0x06064b50) throw new Error('This ZIP64 archive is damaged: its extra directory cannot be found.');
      count = u64(z + 32); cdSize = u64(z + 40); cdOff = u64(z + 48); zip64 = true;
    }
    if (u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0) throw new Error('This archive is one part of a split (multi-part) zip. Zip Viewer can only read whole archives.');
    if (cdOff + cdSize > n) throw new Error('This zip archive is cut short or damaged: its list of contents points past the end of the file.');
    const entries = [];
    let p = cdOff;
    for (let k = 0; k < count; k++) {
      if (p + 46 > n || u32(p) !== 0x02014b50) throw new Error('This zip archive is damaged: entry ' + (k + 1) + ' of ' + count + ' in its list of contents is not readable.');
      const flags = u16(p + 8), method = u16(p + 10), nl = u16(p + 28), xl = u16(p + 30), cl = u16(p + 32);
      let csize = u32(p + 20), usize = u32(p + 24), off = u32(p + 42);
      const raw = nameOf(bytes.subarray(p + 46, p + 46 + nl), flags & 0x800);
      /* the ZIP64 extra field holds the real values of those set to 0xffffffff, in this order */
      for (let x = p + 46 + nl, end = x + xl; x + 4 <= end;) {
        const id = u16(x), len = u16(x + 2);
        if (id === 0x0001) { let q = x + 4; if (usize === 0xffffffff) { usize = u64(q); q += 8; } if (csize === 0xffffffff) { csize = u64(q); q += 8; } if (off === 0xffffffff) { off = u64(q); } zip64 = true; }
        x += 4 + len;
      }
      const isDir = raw.endsWith('/') || raw.endsWith('\\');
      const safe = Z.safePath(raw);
      entries.push({
        index: k, name: raw, path: safe.path, unsafe: safe.unsafe, renamed: safe.changed, dir: isDir,
        method, encrypted: !!(flags & 1), csize, usize, offset: off, crc: u32(p + 16),
        date: dosDate(u16(p + 14), u16(p + 12)), comment: nameOf(bytes.subarray(p + 46 + nl + xl, p + 46 + nl + xl + cl), flags & 0x800)
      });
      p += 46 + nl + xl + cl;
    }
    return { entries, comment, zip64 };
  };

  /* why an entry cannot be opened, or '' */
  Z.problem = function (e) {
    if (e.dir) return '';
    if (e.encrypted || e.method === 99) return 'It is encrypted (protected by a password), which Zip Viewer cannot open.';
    if (e.method !== 0 && e.method !== 8) return 'It is compressed with ' + Z.methodName(e.method) + ', which Zip Viewer cannot open (only stored and deflate).';
    return '';
  };

  /* CRC-32, to check what comes out */
  const T = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[i] = c >>> 0; }
  Z.crc32 = function (b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  /* the bytes of one entry. limit: stop after this many bytes (for previews).
     Returns { bytes, cut: true if stopped at the limit, crcOk: true/false/null (null when cut) }.
     Throws if the entry claims one size and grows past it, or grows past Z.LIMIT.entry. */
  Z.extract = async function (bytes, e, limit) {
    const why = Z.problem(e); if (why) throw new Error(why);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (e.offset + 30 > bytes.length || dv.getUint32(e.offset, true) !== 0x04034b50) throw new Error('The archive is damaged: the data for "' + e.name + '" is not where its list says.');
    const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
    if (start + e.csize > bytes.length) throw new Error('The archive is cut short: "' + e.name + '" runs past the end of the file.');
    const packed = bytes.subarray(start, start + e.csize);
    const cap = Math.min(limit || Infinity, Z.LIMIT.entry);
    if (!limit && e.usize > Z.LIMIT.entry) throw new Error('"' + e.name + '" would be ' + Z.size(e.usize) + ' when unpacked; files in PortD can be at most ' + Z.size(Z.LIMIT.entry) + '.');
    if (e.method === 0) {
      const out = packed.subarray(0, Math.min(packed.length, cap));
      const cut = out.length < packed.length;
      return { bytes: out, cut, crcOk: cut ? null : Z.crc32(out) === e.crc };
    }
    /* deflate: read the stream in pieces, so a small entry that grows enormous is stopped early */
    const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = []; let got = 0, cut = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (got + value.length > e.usize && !limit) { reader.cancel().catch(() => {}); throw new Error('"' + e.name + '" grows bigger than the ' + Z.size(e.usize) + ' its list says, so it was stopped. The archive may be damaged or made to fill up memory (a "zip bomb").'); }
        if (got + value.length >= cap) { parts.push(value.subarray(0, cap - got)); got = cap; cut = e.usize > got; reader.cancel().catch(() => {}); break; }
        parts.push(value); got += value.length;
      }
    } catch (err) {
      if (/grows bigger/.test(err.message)) throw err;
      throw new Error('"' + e.name + '" could not be unpacked: its compressed data is damaged.');
    }
    const out = new Uint8Array(got); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return { bytes: out, cut, crcOk: cut ? null : Z.crc32(out) === e.crc };
  };

  /* the folder tree: { name, path, dirs: Map, files: [entries], size, csize, count } */
  Z.tree = function (entries) {
    const root = { name: '', path: '', dirs: new Map(), files: [], size: 0, csize: 0, count: 0 };
    for (const e of entries) {
      const parts = e.path.split('/').filter(Boolean);
      if (!parts.length) continue;
      let node = root;
      const last = e.dir ? parts.length : parts.length - 1;
      for (let i = 0; i < last; i++) {
        if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { name: parts[i], path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [], size: 0, csize: 0, count: 0, entry: null });
        node = node.dirs.get(parts[i]);
        if (!e.dir) { node.size += e.usize; node.csize += e.csize; node.count++; }
      }
      if (e.dir) node.entry = e; else { node.files.push(e); }
    }
    root.size = entries.reduce((s, e) => s + (e.dir ? 0 : e.usize), 0); root.csize = entries.reduce((s, e) => s + (e.dir ? 0 : e.csize), 0); root.count = entries.filter(e => !e.dir).length;
    return root;
  };
  Z.size = function (n) {
    if (n < 1024) return n + ' B';
    const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return (n < 10 ? n.toFixed(1) : Math.round(n)) + ' ' + u[i];
  };
  Z.ext = name => { const m = /\.([^./]+)$/.exec(name); return m ? m[1].toLowerCase() : ''; };
  Z.TEXT = new Set(['txt', 'md', 'log', 'json', 'js', 'mjs', 'cjs', 'ts', 'css', 'html', 'htm', 'xml', 'svg', 'csv', 'tsv', 'ini', 'cfg', 'conf', 'yml', 'yaml', 'ps1', 'psm1', 'psd1', 'bat', 'cmd', 'sh', 'py', 'tf', 'toml', 'sql', 'rels', 'java', 'mf', 'properties', 'c', 'h', 'cpp', 'cs', 'go', 'rs', 'rb', 'php', 'vbs', 'reg', 'inf', 'gitignore', 'editorconfig', 'xsd', 'xsl', 'plist', 'vtt', 'srt', 'tex', 'rtf']);
  Z.IMAGE = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml', avif: 'image/avif' };
  /* PortD keeps these as text files (so Notepad can open them); everything else is written as binary */
  Z.PORTD_TEXT = new Set(['txt', 'md', 'log', 'json', 'js', 'mjs', 'css', 'html', 'htm', 'xml', 'svg', 'csv', 'tsv', 'ini', 'cfg', 'conf', 'yml', 'yaml', 'ps1', 'psm1', 'psd1', 'bat', 'cmd', 'sh', 'py', 'tf', 'toml', 'sql']);
})();
