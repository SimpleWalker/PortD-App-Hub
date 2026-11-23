/* Encoder-Decoder: the window. Seven tools on tabs; each converts live as you type. Only the open tab, each tool's
   options and the theme are saved: what you type (tokens, passwords) is never kept. */
(function () {
  'use strict';
  const C = window.Codec, $ = id => document.getElementById(id);
  const num = n => n.toLocaleString('en-GB');
  const plural = (n, w, ws) => num(n) + ' ' + (n === 1 ? w : ws || w + 's');
  const DEFAULTS = {
    b64: { dir: 'enc', url: false, cs: 'utf8', wrap: false },
    url: { dir: 'enc', whole: false, plus: true },
    hex: { dir: 'enc', sep: ' ', upper: false },
    html: { dir: 'enc', all: false },
    hash: { upper: false },
    gen: { kind: 'uuid', count: 1, gupper: false, braces: false, length: 20, upper: true, lower: true, digits: true, symbols: true, clear: true, words: 5, sep: '-', capital: true, digit: true }
  };
  let settings = { theme: 'auto', tab: 'b64', opts: JSON.parse(JSON.stringify(DEFAULTS)) };
  const tools = {}, order = [];

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2200); }
  const saveSettings = () => Host.saveSettings(settings);
  async function copy(text, what) {
    if (!text) { toast('There is nothing to copy yet.'); return; }
    if (await Host.copy(text)) { toast('Copied ' + (what || plural(text.length, 'character'))); return; }
    const ov = $('copyDlg'), back = document.activeElement;
    $('copyText').value = text; ov.hidden = false; $('copyText').focus(); $('copyText').select();
    const close = () => { ov.hidden = true; ov.removeEventListener('keydown', key); if (back) back.focus(); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === $('copyText') ? ov.querySelector('[data-act]') : $('copyText')).focus(); } e.stopPropagation(); };
    ov.querySelector('[data-act]').onclick = close; ov.addEventListener('keydown', key);
  }
  /* a text box whose whole text can be replaced (Clear, Swap) with Ctrl+Z bringing the old text back */
  function undoable(ta, changed) {
    let undo = null;
    ta.replaceAll = t => { undo = ta.value !== t ? { before: ta.value, after: t } : null; ta.value = t; changed(); };
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && undo && ta.value === undo.after) { e.preventDefault(); const b = undo.before; undo = null; ta.value = b; changed(); toast('The earlier text is back.'); }
    });
    ta.addEventListener('input', changed);
  }
  function seg(label, value, choices, onPick) {   /* a row of buttons, one pressed */
    const box = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    for (const [v, text] of choices) box.append(h('button', { class: 'sbtn', 'data-v': v, 'aria-pressed': String(v === value), onclick: () => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); onPick(v); } }, text));
    box.set = v => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); };
    return box;
  }
  function check(label, on, onChange, title) {
    const i = h('input', { type: 'checkbox' }); i.checked = !!on; i.onchange = () => onChange(i.checked);
    return h('label', { class: 'chk', title }, i, ' ' + label);
  }
  function select(label, value, choices, onChange) {
    const s = h('select', { class: 'field', 'aria-label': label });
    for (const [v, t] of choices) s.append(new Option(t, v));
    s.value = value; s.onchange = () => onChange(s.value);
    return h('label', { class: 'sel' }, label + ' ', s);
  }

  /* ---------- the four converters share one layout: input left, output right ---------- */
  function converter(id, name, cfg) {
    const o = settings.opts[id];
    const inLabel = h('label', { class: 'colhead', for: id + '-in' }), outLabel = h('label', { class: 'colhead', for: id + '-out' });
    const input = h('textarea', { id: id + '-in', class: 'ta mono', spellcheck: 'false', placeholder: '' });
    const output = h('textarea', { id: id + '-out', class: 'ta mono out', readonly: true, spellcheck: 'false' });
    const msg = h('div', { class: 'msg', role: 'status' }), info = h('span', { class: 'muted small' });
    const dirSeg = seg('Direction', o.dir, [['enc', 'Encode'], ['dec', 'Decode']], v => { o.dir = v; saveSettings(); update(); });
    const swapBtn = h('button', { class: 'btn', title: 'Turn the result into the input and change direction (Alt+S)', onclick: swap }, '⇄ Swap');
    const copyBtn = h('button', { class: 'btn primary', title: 'Copy the result (Alt+C)', onclick: () => copy(output.value) }, 'Copy');
    const clearBtn = h('button', { class: 'btn', title: 'Clear the input (Alt+X); Ctrl+Z in the box brings it back', onclick: clear }, 'Clear');
    const opts = h('div', { class: 'opts' }, cfg.options(o, () => { saveSettings(); update(); }));
    const panel = h('section', { class: 'panel conv', id: 'p-' + id, role: 'tabpanel', 'aria-labelledby': 't-' + id },
      h('div', { class: 'ctrl' }, dirSeg, opts, h('span', { class: 'grow' }), swapBtn),
      h('div', { class: 'cols' },
        h('div', { class: 'col' }, inLabel, input, h('div', { class: 'acts' }, info, h('span', { class: 'grow' }), clearBtn)),
        h('div', { class: 'col' }, outLabel, output, h('div', { class: 'acts' }, msg, h('span', { class: 'grow' }), copyBtn))));
    function update() {
      const [a, b] = cfg.labels(o);
      inLabel.textContent = a; outLabel.textContent = b;
      input.placeholder = o.dir === 'enc' ? 'Type or paste the text to encode' : 'Paste the ' + a + ' to decode';
      info.textContent = input.value ? plural(input.value.length, 'character') : '';
      if (!input.value) { output.value = ''; msg.textContent = ''; msg.className = 'msg'; return; }
      try {
        const r = cfg.run(input.value, o);
        output.value = r.out; msg.textContent = r.note || plural(r.out.length, 'character'); msg.className = 'msg' + (r.note ? ' note' : '');
      } catch (e) { output.value = ''; msg.textContent = e.message; msg.className = 'msg err'; }
    }
    function swap() {
      if (msg.classList.contains('err')) { toast('Fix the input first: there is nothing to swap.'); return; }
      const out = output.value;
      o.dir = o.dir === 'enc' ? 'dec' : 'enc'; dirSeg.set(o.dir); saveSettings();
      input.replaceAll(out); input.focus();
    }
    function clear() { if (!input.value) return; input.replaceAll(''); input.focus(); toast('Cleared. Ctrl+Z in the box brings it back.'); }
    undoable(input, update);
    update();
    return { panel, name, swap, clear, copyOut: () => copy(output.value), focus: () => input.focus(), input, output, msg };
  }
  /* bytes that should be text: UTF-8 if they are, else shown as Latin-1 with a note */
  function bytesToText(bytes, cs) {
    if (cs === 'latin1') return { out: C.fromLatin1(bytes) };
    try { return { out: C.fromUtf8(bytes) }; }
    catch (e) { return { out: C.fromLatin1(bytes), note: 'These ' + plural(bytes.length, 'byte') + ' are not UTF-8 text, so they are shown one character per byte (Latin-1). In hex they start ' + C.hexOf(bytes.subarray(0, 24), ' ') + (bytes.length > 24 ? ' …' : '') }; }
  }

  function build() {
  tools.b64 = converter('b64', 'Base64', {
    labels: o => o.dir === 'enc' ? ['Text', o.url ? 'Base64URL' : 'Base64'] : [o.url ? 'Base64URL' : 'Base64', 'Text'],
    options: (o, ch) => [
      seg('Alphabet', o.url ? 'url' : 'std', [['std', 'Base64'], ['url', 'Base64URL']], v => { o.url = v === 'url'; ch(); }),
      select('Text is', o.cs, [['utf8', 'UTF-8'], ['latin1', 'Latin-1']], v => { o.cs = v; ch(); }),
      check('Lines of 76', o.wrap, v => { o.wrap = v; ch(); }, 'When encoding, break the result into lines of 76 characters (as in email)')],
    run: (s, o) => {
      if (o.dir === 'enc') { let out = C.b64encode(o.cs === 'latin1' ? C.latin1(s) : C.utf8(s), o.url); if (o.wrap) out = out.replace(/.{76}(?=.)/g, '$&\n'); return { out }; }
      return bytesToText(C.b64decode(s, o.url), o.cs);
    }
  });
  tools.url = converter('url', 'URL', {
    labels: o => o.dir === 'enc' ? ['Text', 'URL-encoded'] : ['URL-encoded', 'Text'],
    options: (o, ch) => [
      check('Whole address', o.whole, v => { o.whole = v; ch(); }, 'When encoding, keep : / ? # & = as they are, for a full web address'),
      check('+ means space', o.plus, v => { o.plus = v; ch(); }, 'When decoding, turn + into a space (as in web forms)')],
    run: (s, o) => ({ out: o.dir === 'enc' ? C.urlEncode(s, o.whole) : C.urlDecode(s, o.plus) })
  });
  tools.hex = converter('hex', 'Hex', {
    labels: o => o.dir === 'enc' ? ['Text', 'Hex (UTF-8 bytes)'] : ['Hex', 'Text'],
    options: (o, ch) => [
      select('Between bytes', o.sep, [[' ', 'space'], ['', 'nothing'], [':', 'colon'], ['-', 'dash']], v => { o.sep = v; ch(); }),
      check('Upper case', o.upper, v => { o.upper = v; ch(); })],
    run: (s, o) => {
      if (o.dir === 'enc') { const x = C.hexOf(C.utf8(s), o.sep); return { out: o.upper ? x.toUpperCase() : x, note: plural(C.utf8(s).length, 'byte') }; }
      const b = C.hexDecode(s), r = bytesToText(b, 'utf8');
      if (!r.note) r.note = plural(b.length, 'byte');
      return r;
    }
  });
  tools.html = converter('html', 'HTML', {
    labels: o => o.dir === 'enc' ? ['Text', 'HTML entities'] : ['HTML entities', 'Text'],
    options: (o, ch) => [check('Also non-ASCII', o.all, v => { o.all = v; ch(); }, 'When encoding, also write letters such as é and emoji as &#…; numbers')],
    run: (s, o) => {
      if (o.dir === 'enc') return { out: C.htmlEncode(s, o.all) };
      const r = C.htmlDecode(s);
      return { out: r.text, note: r.unknown.length ? 'Not recognised, so left as they are: ' + r.unknown.map(u => '&' + u + ';').join(' ') : '' };
    }
  });

  /* ---------- JWT ---------- */
  tools.jwt = (function () {
    const input = h('textarea', { id: 'jwt-in', class: 'ta mono', spellcheck: 'false', placeholder: 'Paste a token (eyJ…), with or without "Bearer "' });
    const out = h('div', { class: 'jwtout', id: 'jwt-out', 'aria-live': 'polite' });
    const clearBtn = h('button', { class: 'btn', title: 'Clear (Alt+X); Ctrl+Z in the box brings it back', onclick: clear }, 'Clear');
    const panel = h('section', { class: 'panel', id: 'p-jwt', role: 'tabpanel', 'aria-labelledby': 't-jwt' },
      h('div', { class: 'ctrl' }, h('div', { class: 'warnline' }, h('b', null, 'Decoding only.'), ' The signature is not checked, so this does not tell you the token is genuine.')),
      h('div', { class: 'cols' },
        h('div', { class: 'col' }, h('label', { class: 'colhead', for: 'jwt-in' }, 'Token'), input, h('div', { class: 'acts' }, h('span', { class: 'grow' }), clearBtn)),
        h('div', { class: 'col' }, h('div', { class: 'colhead' }, 'What it says'), out)));
    let header = '', payload = '';
    const fmt = d => ({ local: d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }), utc: d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') });
    function ago(ms) {
      const a = Math.abs(ms), u = [[86400000, 'day'], [3600000, 'hour'], [60000, 'minute'], [1000, 'second']].find(x => a >= x[0]) || [1000, 'second'];
      const t = plural(Math.floor(a / u[0]), u[1]);
      return ms > 0 ? 'in ' + t : t + ' ago';
    }
    function update() {
      out.textContent = ''; header = payload = '';
      if (!input.value.trim()) { out.append(h('p', { class: 'muted' }, 'The header, the claims and the times appear here.')); return; }
      let t;
      try { t = C.jwt(input.value); } catch (e) { out.append(h('div', { class: 'msg err' }, e.message)); return; }
      header = JSON.stringify(t.header, null, 2); payload = JSON.stringify(t.payload, null, 2);
      const now = Date.now(), times = C.jwtTimes(t.payload), chips = h('div', { class: 'chips' });
      const exp = times.find(x => x.name === 'exp'), nbf = times.find(x => x.name === 'nbf');
      if (exp) chips.append(exp.date.getTime() < now ? h('span', { class: 'chip bad' }, 'Expired ' + ago(exp.date - now)) : h('span', { class: 'chip ok' }, 'Not expired: ends ' + ago(exp.date - now)));
      else chips.append(h('span', { class: 'chip' }, 'No expiry (exp)'));
      if (nbf && nbf.date.getTime() > now) chips.append(h('span', { class: 'chip bad' }, 'Not valid yet: starts ' + ago(nbf.date - now)));
      chips.append(h('span', { class: 'chip' }, 'Algorithm: ' + (t.header.alg || '?')));
      if (!t.signed || t.header.alg === 'none') chips.append(h('span', { class: 'chip bad' }, 'Not signed'));
      out.append(chips);
      if (times.length) {
        const NAMES = { iat: 'Issued (iat)', nbf: 'Valid from (nbf)', exp: 'Expires (exp)', auth_time: 'Signed in (auth_time)' };
        const tb = h('table', { class: 'times' }, h('tr', null, h('th', null, ''), h('th', null, 'Your time'), h('th', null, 'UTC')));
        for (const x of times) { const f = fmt(x.date); tb.append(h('tr', { class: x.name === 'exp' && x.date.getTime() < now ? 'expired' : '' }, h('td', null, NAMES[x.name]), h('td', null, f.local), h('td', null, f.utc))); }
        out.append(tb);
      }
      const block = (title, text) => h('div', { class: 'jblock' }, h('div', { class: 'jhead' }, h('b', null, title), h('span', { class: 'grow' }), h('button', { class: 'btn small', onclick: () => copy(text, title.toLowerCase()) }, 'Copy')), h('pre', { class: 'mono', tabindex: '0', 'aria-label': title }, text));
      out.append(block('Header', header), block('Payload', payload));
    }
    function clear() { if (!input.value) return; input.replaceAll(''); input.focus(); toast('Cleared. Ctrl+Z in the box brings it back.'); }
    undoable(input, update);
    update();
    return { panel, name: 'JWT', clear, copyOut: () => copy(payload, 'payload'), focus: () => input.focus(), swap: () => toast('Swap is for the converters.'), input };
  })();

  /* ---------- Hash ---------- */
  tools.hash = (function () {
    const o = settings.opts.hash;
    const input = h('textarea', { id: 'hash-in', class: 'ta mono', spellcheck: 'false', placeholder: 'Type text to hash, or press Open file…' });
    const fileBox = h('div', { class: 'filebox', hidden: true });
    const openBtn = h('button', { class: 'btn', title: 'Hash a file instead of text', onclick: openFile }, 'Open file…');
    const clearBtn = h('button', { class: 'btn', title: 'Clear (Alt+X)', onclick: clear }, 'Clear');
    const rows = h('div', { class: 'hrows', id: 'hash-out' });
    const expect = h('input', { class: 'field mono', id: 'hash-expect', spellcheck: 'false', autocomplete: 'off', placeholder: 'Paste the hash you expect, to compare' });
    const verdict = h('div', { class: 'msg', role: 'status', id: 'hash-verdict' });
    const info = h('span', { class: 'muted small' });
    const panel = h('section', { class: 'panel', id: 'p-hash', role: 'tabpanel', 'aria-labelledby': 't-hash' },
      h('div', { class: 'ctrl' }, openBtn, check('Upper case', o.upper, v => { o.upper = v; saveSettings(); draw(); })),
      h('div', { class: 'cols' },
        h('div', { class: 'col' }, h('label', { class: 'colhead', for: 'hash-in' }, 'Text'), fileBox, input, h('div', { class: 'acts' }, info, h('span', { class: 'grow' }), clearBtn)),
        h('div', { class: 'col' }, h('div', { class: 'colhead' }, 'Hashes'), rows, h('label', { class: 'colhead', for: 'hash-expect' }, 'Compare'), expect, verdict)));
    let file = null, results = {}, seq = 0;
    async function compute() {
      const my = ++seq;
      const bytes = file ? file.bytes : C.utf8(input.value);
      info.textContent = file ? '' : plural(bytes.length, 'byte') + ' as UTF-8';
      const r = {};
      for (const a of C.HASHES) r[a] = C.hexOf(await C.hash(a, bytes));
      if (my !== seq) return;
      results = r; draw();
    }
    function draw() {
      rows.textContent = '';
      for (const a of C.HASHES) {
        const v = results[a] ? (o.upper ? results[a].toUpperCase() : results[a]) : '';
        rows.append(h('div', { class: 'hrow' + (a === 'MD5' ? ' weak' : ''), 'data-alg': a },
          h('div', { class: 'hname' }, a, a === 'MD5' ? h('span', { class: 'tag' }, 'not secure') : null),
          h('div', { class: 'hval mono', tabindex: '0', 'aria-label': a + ' ' + v }, v),
          h('button', { class: 'btn small', 'aria-label': 'Copy ' + a, onclick: () => copy(v, 'the ' + a + ' hash') }, 'Copy')));
      }
      compare();
    }
    function compare() {
      const want = expect.value.trim().toLowerCase().replace(/^(sha-?\d+|md5)\s*[:=]\s*/, '').replace(/[\s:]/g, '');
      for (const r of rows.children) r.classList.remove('match');
      if (!want) { verdict.textContent = ''; verdict.className = 'msg'; return; }
      const hit = C.HASHES.find(a => results[a] === want);
      if (hit) { rows.querySelector('[data-alg="' + hit + '"]').classList.add('match'); verdict.textContent = '✓ Matches the ' + hit + ' hash.'; verdict.className = 'msg ok'; }
      else { verdict.textContent = '✗ Does not match any of these hashes.'; verdict.className = 'msg err'; }
    }
    expect.addEventListener('input', compare);
    function setFile(f) {
      file = f; input.hidden = !f ? false : true; fileBox.hidden = !f; fileBox.textContent = '';
      if (f) fileBox.append(h('div', null, h('b', null, f.name), h('div', { class: 'muted small' }, plural(f.bytes.length, 'byte') + (f.asText ? ' (stored by PortD as text, hashed as UTF-8)' : ''))), h('button', { class: 'btn', onclick: () => { setFile(null); input.focus(); } }, 'Back to text'));
      compute();
    }
    async function openFile() {
      try {
        if (Host.inPortD) {
          const r = await PortD.ui.openFile({ title: 'Hash a file' });
          if (!r) return;
          const d = await PortD.fs.read(r.path), m = typeof d === 'string' && /^data:[^,]*;base64,/.exec(d);
          if (m) setFile({ name: r.name, bytes: C.b64decode(d.slice(m[0].length)) });
          else setFile({ name: r.name, bytes: C.utf8(String(d)), asText: true });
        } else {
          const i = h('input', { type: 'file' });
          i.onchange = async () => { const f = i.files[0]; if (f) setFile({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); };
          i.click();
        }
      } catch (e) { toast('Could not read the file: ' + e.message, 5000); }
    }
    let t = 0;
    undoable(input, () => { clearTimeout(t); t = setTimeout(compute, 150); });
    function clear() { if (file) { setFile(null); return; } if (!input.value) return; input.replaceAll(''); input.focus(); toast('Cleared. Ctrl+Z in the box brings it back.'); }
    compute();
    return { panel, name: 'Hash', clear, copyOut: () => copy(results['SHA-256'] && (o.upper ? results['SHA-256'].toUpperCase() : results['SHA-256']), 'the SHA-256 hash'), focus: () => input.hidden ? openBtn.focus() : input.focus(), swap: () => toast('Swap is for the converters.'), input, compute, get results() { return results; } };
  })();

  /* ---------- Generate ---------- */
  tools.gen = (function () {
    const o = settings.opts.gen;
    const output = h('textarea', { id: 'gen-out', class: 'ta mono out', readonly: true, spellcheck: 'false' });
    const note = h('div', { class: 'msg', role: 'status' });
    const genBtn = h('button', { class: 'btn primary', id: 'genBtn', title: 'Make new ones (Alt+G)', onclick: () => make(true) }, 'Generate');
    const copyBtn = h('button', { class: 'btn', title: 'Copy (Alt+C)', onclick: () => copy(output.value) }, 'Copy');
    const optBox = h('div', { class: 'gopts' });
    const kindSeg = seg('What to make', o.kind, [['uuid', 'GUID'], ['password', 'Password'], ['phrase', 'Passphrase']], v => { o.kind = v; saveSettings(); drawOpts(); make(); });
    const numIn = (label, key, min, max) => {
      const i = h('input', { type: 'number', class: 'field num', min, max, value: o[key], 'aria-label': label });
      i.oninput = () => { const v = Math.max(min, Math.min(max, parseInt(i.value, 10) || min)); if (String(v) === i.value) { o[key] = v; saveSettings(); make(); } };
      i.onchange = () => { const v = Math.max(min, Math.min(max, parseInt(i.value, 10) || min)); i.value = v; if (o[key] !== v) { o[key] = v; saveSettings(); make(); } };
      return h('label', { class: 'sel' }, label + ' ', i);
    };
    const tick = (label, key, title) => check(label, o[key], v => { o[key] = v; saveSettings(); make(); }, title);
    function drawOpts() {
      optBox.textContent = '';
      if (o.kind === 'uuid') optBox.append(numIn('How many', 'count', 1, 1000), tick('Upper case', 'gupper'), tick('With { }', 'braces', 'As in the Windows registry'));
      else if (o.kind === 'password') optBox.append(numIn('Length', 'length', 4, 128), tick('A–Z', 'upper'), tick('a–z', 'lower'), tick('0–9', 'digits'), tick('Symbols', 'symbols', C.SETS.symbols), tick('Avoid look-alikes', 'clear', 'Leave out I l 1 O 0 o'));
      else optBox.append(numIn('Words', 'words', 3, 12), select('Between words', o.sep, [['-', 'dash'], [' ', 'space'], ['.', 'dot'], ['_', 'underscore'], ['', 'nothing']], v => { o.sep = v; saveSettings(); make(); }), tick('Capitals', 'capital'), tick('Add a digit', 'digit'));
    }
    const panel = h('section', { class: 'panel', id: 'p-gen', role: 'tabpanel', 'aria-labelledby': 't-gen' },
      h('div', { class: 'ctrl' }, kindSeg, h('span', { class: 'grow' }), genBtn),
      h('div', { class: 'cols' },
        h('div', { class: 'col narrow' }, h('div', { class: 'colhead' }, 'Options'), optBox, h('p', { class: 'muted small' }, 'Made with the browser\'s secure random numbers (crypto.getRandomValues). Nothing is kept: copy what you need.')),
        h('div', { class: 'col' }, h('label', { class: 'colhead', for: 'gen-out' }, 'Result'), output, h('div', { class: 'acts' }, note, h('span', { class: 'grow' }), copyBtn))));
    function make(announce) {
      try {
        if (o.kind === 'uuid') {
          const list = []; for (let i = 0; i < o.count; i++) { let u = C.uuid(); if (o.gupper) u = u.toUpperCase(); if (o.braces) u = '{' + u + '}'; list.push(u); }
          output.value = list.join('\n'); note.textContent = plural(o.count, 'GUID') + ' (version 4, random)'; note.className = 'msg';
        } else {
          const r = o.kind === 'password' ? C.password(o) : C.passphrase(o);
          output.value = r.text; note.textContent = 'About ' + r.bits + ' bits: ' + C.strength(r.bits) + '.' + (o.kind === 'phrase' ? ' From ' + num(C.WORDS.length) + ' words.' : '');
          note.className = 'msg ' + (r.bits < 40 ? 'err' : r.bits < 60 ? 'note' : 'ok');
        }
      } catch (e) { output.value = ''; note.textContent = e.message; note.className = 'msg err'; }
      if (announce) toast('Made new ' + (o.kind === 'uuid' ? (o.count > 1 ? 'GUIDs' : 'GUID') : o.kind === 'password' ? 'password' : 'passphrase'), 1200);
    }
    drawOpts(); make();
    return { panel, name: 'Generate', clear: () => {}, copyOut: () => copy(output.value), focus: () => genBtn.focus(), swap: () => toast('Swap is for the converters.'), make, output };
  })();

  }

  /* ---------- tabs ---------- */
  const TABS = [['b64', 'Base64'], ['url', 'URL'], ['hex', 'Hex'], ['html', 'HTML'], ['jwt', 'JWT'], ['hash', 'Hash'], ['gen', 'Generate']];
  function drawTabs() { TABS.forEach(([id, name], i) => {
    order.push(id);
    $('tabs').append(h('button', { class: 'tab', id: 't-' + id, role: 'tab', 'aria-controls': 'p-' + id, title: name + ' (Alt+' + (i + 1) + ')', onclick: () => setTab(id, false) }, name));
    $('panels').append(tools[id].panel);
  }); }
  function setTab(id, focusTab) {
    if (!tools[id]) id = 'b64';
    settings.tab = id;
    for (const t of order) { const on = t === id, b = $('t-' + t); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; tools[t].panel.hidden = !on; }
    if (focusTab) $('t-' + id).focus();
    saveSettings();
  }
  $('tabs').addEventListener('keydown', e => {
    const i = order.indexOf(settings.tab), to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: order.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); setTab(order[(to + order.length) % order.length], true);
  });
  document.addEventListener('keydown', e => {
    if (!$('copyDlg').hidden || !e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase(), t = tools[settings.tab];
    let go = null;
    if (/^[1-7]$/.test(k)) go = () => { setTab(order[+k - 1]); tools[order[+k - 1]].focus(); };
    else go = { s: () => t.swap(), c: () => t.copyOut(), x: () => t.clear(), g: () => { if (settings.tab === 'gen') tools.gen.make(true); } }[k];
    if (go) { e.preventDefault(); go(); }
  });

  /* ---------- theme ---------- */
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); saveSettings(); toast(THEMES[settings.theme][1]); };

  /* ---------- start: settings are read first, then the tools are drawn with them ---------- */
  (async () => {
    const s = await Host.loadSettings({});
    if (s && typeof s === 'object') {
      if (['auto', 'light', 'dark'].includes(s.theme)) settings.theme = s.theme;
      if (s.opts && typeof s.opts === 'object') for (const k in DEFAULTS) if (s.opts[k] && typeof s.opts[k] === 'object') for (const p in DEFAULTS[k]) if (typeof s.opts[k][p] === typeof DEFAULTS[k][p]) settings.opts[k][p] = s.opts[k][p];
      if (typeof s.tab === 'string') settings.tab = s.tab;
    }
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    Host.setTitle('Encoder-Decoder');
    build(); drawTabs();
    setTab(settings.tab); tools[settings.tab].focus();
    window.__ed = { tools, get settings() { return settings; }, ready: true };
  })();
})();
