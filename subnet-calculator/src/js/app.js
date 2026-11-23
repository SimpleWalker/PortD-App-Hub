/* Subnet Calculator: the window. Five tools on tabs, each worked out as you type. Each tool's last input is kept. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), f4 = IP.fmt4;
  const num = n => n.toLocaleString('en-GB');
  const plural = (n, w, ws) => num(n) + ' ' + (n === 1 ? w : ws || w + 's');
  const SHOW_ROWS = 1024;
  let settings = { theme: 'auto', tab: 'v4', v4: '192.168.10.37/26', split: { net: '10.20.0.0/22', by: 'count', count: 6, prefix: 26 },
    contains: { ip: '10.20.3.15', ranges: '10.20.0.0/22\n10.20.4.0/24\n192.168.0.0/16\n10.20.3.1 - 10.20.3.9' },
    sum: '10.1.0.0/24\n10.1.1.0/24\n10.1.2.0/23\n10.1.4.0/24\n10.1.4.128/25\n172.16.5.10', v6: '2001:db8:abcd:12::1/64' };
  const tools = {}, order = [];

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat()) if (k != null) e.append(k);
    return e;
  }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), ms || 2200); }
  let saveT = 0;
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => Host.saveSettings(settings), 400); };
  addEventListener('pagehide', () => { clearTimeout(saveT); Host.saveSettings(settings); });
  async function copy(text, what) {
    if (!text) { toast('There is nothing to copy yet.'); return; }
    if (await Host.copy(text)) { toast('Copied ' + what); return; }
    const ov = $('copyDlg'), back = document.activeElement;
    $('copyText').value = text; ov.hidden = false; $('copyText').focus(); $('copyText').select();
    const close = () => { ov.hidden = true; ov.removeEventListener('keydown', key); if (back) back.focus(); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === $('copyText') ? ov.querySelector('[data-act]') : $('copyText')).focus(); } e.stopPropagation(); };
    ov.querySelector('[data-act]').onclick = close; ov.addEventListener('keydown', key);
  }
  const field = (id, label, value, ph) => h('input', { id, class: 'field mono big', value, placeholder: ph, spellcheck: 'false', autocomplete: 'off', 'aria-label': label });
  const msg = id => h('div', { id, class: 'msg', role: 'status' });
  function say(el, text, kind) { el.textContent = text || ''; el.className = 'msg' + (kind ? ' ' + kind : ''); }
  /* a table of label / value rows; values can be selected and copied */
  function facts(rows) {
    const t = h('table', { class: 'facts' });
    for (const [k, v, cls] of rows) t.append(h('tr', { class: cls || null }, h('th', { scope: 'row' }, k), h('td', { class: 'mono' }, v)));
    return t;
  }
  const asText = rows => rows.map(([k, v]) => k + ': ' + v).join('\n');
  function seg(label, value, choices, onPick) {
    const box = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    for (const [v, text] of choices) box.append(h('button', { class: 'sbtn', 'data-v': v, 'aria-pressed': String(v === value), onclick: () => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); onPick(v); } }, text));
    return box;
  }
  function panel(id, ...kids) { return h('section', { class: 'panel', id: 'p-' + id, role: 'tabpanel', 'aria-labelledby': 't-' + id }, ...kids); }
  const live = (el, fn) => { let t = 0; el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(fn, 120); }); };

  /* the tools are made once the saved inputs are read */
  function make() {
  /* ---------- IPv4 ---------- */
  tools.v4 = (function () {
    const input = field('v4-in', 'IPv4 address with prefix or mask', settings.v4, 'for example: 10.1.2.3/22 or 10.1.2.3 255.255.252.0');
    const m = msg('v4-msg'), out = h('div', { id: 'v4-out', class: 'out' });
    const copyBtn = h('button', { class: 'btn primary', onclick: () => copy(text, 'the details') }, 'Copy all');
    let text = '';
    function bitsRow(name, n, prefix) {
      const b = IP.bits4(n), cells = [];
      for (let o = 0; o < 4; o++) {
        const oct = h('span', { class: 'oct' });
        for (let i = o * 8; i < o * 8 + 8; i++) oct.append(h('span', { class: i < prefix ? 'nb' : 'hb' }, b[i]));
        cells.push(oct); if (o < 3) cells.push(h('span', { class: 'dot' }, '.'));
      }
      return h('tr', null, h('th', { scope: 'row' }, name), h('td', { class: 'bits mono', 'aria-label': name + ' in binary: ' + b.match(/.{8}/g).join(' ') }, cells), h('td', { class: 'mono' }, f4(n)));
    }
    function update() {
      settings.v4 = input.value; saveSoon();
      out.textContent = ''; text = '';
      let c;
      try { c = IP.parseCidr4(input.value); } catch (e) { say(m, e.message, 'err'); input.setAttribute('aria-invalid', 'true'); return; }
      input.removeAttribute('aria-invalid');
      const i = IP.info4(c.addr, c.prefix);
      const notes = [];
      if (c.assumed) notes.push('No prefix or mask was given, so this is a single address (/32).');
      if (c.addr !== i.net && c.addr !== i.bc && c.prefix < 31) notes.push(f4(c.addr) + ' is host ' + num(c.addr - i.net) + ' of this network.');
      else if (c.prefix < 31 && c.addr === i.net) notes.push('This is the network address itself.');
      else if (c.prefix < 31 && c.addr === i.bc) notes.push('This is the broadcast address of the network.');
      say(m, notes.join(' ') || f4(i.net) + '/' + i.prefix, notes.length ? 'note' : 'ok');
      const hosts = i.prefix === 31 ? '2 (a point-to-point link, RFC 3021)' : i.prefix === 32 ? '1 (a single address)' : num(i.usable);
      const rows = [['Address', f4(c.addr)], ['Network', f4(i.net) + '/' + i.prefix], ['Broadcast', i.prefix >= 31 ? '(none for /' + i.prefix + ')' : f4(i.bc)],
        ['First host', f4(i.first)], ['Last host', f4(i.last)], ['Usable hosts', hosts], ['Addresses in all', num(i.size)],
        ['Subnet mask', f4(i.mask) + ' (/' + i.prefix + ')'], ['Wildcard mask', f4(i.wildcard)], ['Class', i.cls],
        ['Type', i.kind], ['As a number', num(c.addr) + ' (hex ' + c.addr.toString(16).toUpperCase().padStart(8, '0') + ')']];
      if (i.netKind !== i.kind) rows.splice(11, 0, ['Network type', i.netKind]);
      text = asText(rows);
      const bt = h('table', { class: 'bintab' }, h('caption', null, 'In binary: network bits are highlighted'),
        bitsRow('Address', c.addr, c.prefix), bitsRow('Mask', i.mask, c.prefix), bitsRow('Network', i.net, c.prefix), bitsRow('Broadcast', i.bc, c.prefix));
      out.append(facts(rows), bt);
    }
    live(input, update); input.addEventListener('keydown', e => { if (e.key === 'Enter') update(); });
    const p = panel('v4', h('div', { class: 'ctrl' }, h('label', { for: 'v4-in', class: 'lbl' }, 'Address'), input, copyBtn), m, out);
    update();
    return { panel: p, name: 'IPv4', focus: () => input.focus(), copyOut: () => copy(text, 'the details'), input, update };
  })();

  /* ---------- Split ---------- */
  tools.split = (function () {
    const o = settings.split;
    const net = field('split-in', 'Network to split', o.net, 'for example: 10.20.0.0/22');
    const n = h('input', { id: 'split-n', type: 'number', class: 'field num', min: 1, max: 65536, value: o.by === 'count' ? o.count : o.prefix, 'aria-label': o.by === 'count' ? 'How many subnets' : 'New prefix length' });
    const nl = h('label', { for: 'split-n', class: 'lbl' }, o.by === 'count' ? 'Subnets' : 'New prefix /');
    const by = seg('Split by', o.by, [['count', 'By count'], ['prefix', 'By prefix']], v => {
      o.by = v; n.value = v === 'count' ? o.count : o.prefix; nl.textContent = v === 'count' ? 'Subnets' : 'New prefix /';
      n.setAttribute('aria-label', v === 'count' ? 'How many subnets' : 'New prefix length'); update();
    });
    const m = msg('split-msg'), out = h('div', { id: 'split-out', class: 'out tableout' });
    let res = null;
    const header = ['#', 'Network', 'First host', 'Last host', 'Broadcast', 'Usable hosts'];
    const row = (x, i) => [String(i + 1), f4(x.net) + '/' + x.prefix, f4(x.first), f4(x.last), x.prefix >= 31 ? '-' : f4(x.bc), String(x.usable)];
    const asLines = () => res.list.map(x => f4(x.net) + '/' + x.prefix).join('\n');
    const asTable = () => [header].concat(res.list.map(row)).map(r => r.join('\t')).join('\n');
    const copyText = h('button', { class: 'btn primary', onclick: () => res && copy(asLines(), plural(res.list.length, 'subnet') + ' as text') }, 'Copy as text');
    const copyTable = h('button', { class: 'btn', title: 'Tab-separated, with headings: pastes into Excel as a table', onclick: () => res && copy(asTable(), 'the table') }, 'Copy as table');
    function update() {
      const v = parseInt(n.value, 10);
      if (o.by === 'count') o.count = v || 1; else o.prefix = isNaN(v) ? o.prefix : v;
      o.net = net.value; saveSoon();
      out.textContent = ''; res = null;
      let c;
      try { c = IP.parseCidr4(net.value); res = IP.split4(IP.info4(c.addr, c.prefix).net, c.prefix, { by: o.by, count: v, prefix: v }); }
      catch (e) { say(m, e.message, 'err'); return; }
      const first = res.list[0], note = [];
      note.push(plural(res.list.length, 'subnet') + ' of /' + res.prefix + ' (' + plural(first.usable, 'usable host') + ' each).');
      if (o.by === 'count' && v !== res.list.length) note.push('You asked for ' + v + '; subnets come in powers of two, so you get ' + res.list.length + '.');
      if (c.addr !== IP.info4(c.addr, c.prefix).net) note.push('Started from the network ' + f4(IP.info4(c.addr, c.prefix).net) + '/' + c.prefix + '.');
      say(m, note.join(' '), 'ok');
      const t = h('table', { class: 'grid' }, h('thead', null, h('tr', null, header.map(x => h('th', { scope: 'col' }, x)))));
      const tb = h('tbody');
      res.list.slice(0, SHOW_ROWS).forEach((x, i) => tb.append(h('tr', null, row(x, i).map((v, j) => h('td', { class: j ? 'mono' : 'num' }, v)))));
      t.append(tb); out.append(t);
      if (res.list.length > SHOW_ROWS) out.append(h('p', { class: 'muted' }, 'The first ' + num(SHOW_ROWS) + ' are shown here; Copy copies all ' + num(res.list.length) + '.'));
    }
    live(net, update); n.addEventListener('input', update);
    const p = panel('split', h('div', { class: 'ctrl' }, h('label', { for: 'split-in', class: 'lbl' }, 'Network'), net, by, nl, n, h('span', { class: 'grow' }), copyText, copyTable), m, out);
    update();
    return { panel: p, name: 'Split', focus: () => net.focus(), copyOut: () => res && copy(asLines(), plural(res.list.length, 'subnet') + ' as text'), update };
  })();

  /* ---------- In range? ---------- */
  tools.contains = (function () {
    const o = settings.contains;
    const ip = field('in-ip', 'Address to check', o.ip, 'for example: 10.20.3.15');
    const list = h('textarea', { id: 'in-list', class: 'ta mono', spellcheck: 'false', 'aria-label': 'Ranges, one per line', placeholder: 'One per line: 10.0.0.0/8, 10.0.0.0 255.0.0.0, 10.0.0.1 - 10.0.0.9, or one address' }, o.ranges);
    const m = msg('in-msg'), out = h('div', { id: 'in-out', class: 'out' });
    let text = '';
    function update() {
      o.ip = ip.value; o.ranges = list.value; saveSoon();
      out.textContent = ''; text = '';
      let a;
      try { a = IP.parse4(ip.value); } catch (e) { say(m, e.message, 'err'); return; }
      const r = IP.readList(list.value, IP.range4);
      if (!r.ok.length && !r.bad.length) { say(m, 'Type one or more ranges, one per line.'); return; }
      const ul = h('ul', { class: 'hits' }), lines = [];
      let hits = 0;
      for (const x of r.ok) {
        const yes = a >= x.start && a <= x.end; if (yes) hits++;
        const extra = x.cidr ? ' (' + f4(x.start) + ' – ' + f4(x.end) + ')' : '';
        ul.append(h('li', { class: yes ? 'yes' : 'no' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, yes ? '✓' : '✗'), h('span', { class: 'mono' }, x.text), h('span', { class: 'muted' }, extra), h('span', { class: 'sr' }, yes ? ': in this range' : ': not in this range')));
        lines.push((yes ? 'IN      ' : 'NOT IN  ') + x.text);
      }
      for (const b of r.bad) ul.append(h('li', { class: 'bad' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, '!'), h('span', { class: 'mono' }, b.text), h('span', null, ' ' + b.error)));
      out.append(ul);
      say(m, f4(a) + (hits ? ' is in ' + hits + ' of the ' + plural(r.ok.length, 'range') + '.' : ' is in none of the ' + plural(r.ok.length, 'range') + '.') + (r.bad.length ? ' ' + plural(r.bad.length, 'line') + ' could not be read.' : ''), hits ? 'ok' : 'note');
      text = f4(a) + '\n' + lines.join('\n');
    }
    live(ip, update); live(list, update);
    const p = panel('contains', h('div', { class: 'ctrl' }, h('label', { for: 'in-ip', class: 'lbl' }, 'Address'), ip, h('span', { class: 'grow' }), h('button', { class: 'btn primary', onclick: () => copy(text, 'the answer') }, 'Copy')), m,
      h('div', { class: 'cols' }, h('div', { class: 'col' }, h('label', { for: 'in-list', class: 'colhead' }, 'Ranges'), list), h('div', { class: 'col' }, h('div', { class: 'colhead' }, 'Is it in them?'), out)));
    update();
    return { panel: p, name: 'In range?', focus: () => ip.focus(), copyOut: () => copy(text, 'the answer'), update };
  })();

  /* ---------- Summarise ---------- */
  tools.sum = (function () {
    const list = h('textarea', { id: 'sum-in', class: 'ta mono', spellcheck: 'false', 'aria-label': 'Ranges to summarise', placeholder: 'Paste CIDRs, ranges or addresses: one per line, or separated by commas' }, settings.sum);
    const res = h('textarea', { id: 'sum-out', class: 'ta mono out', readonly: true, 'aria-label': 'Summarised ranges' });
    const m = msg('sum-msg'), bad = h('ul', { class: 'hits' });
    function update() {
      settings.sum = list.value; saveSoon();
      bad.textContent = ''; res.value = '';
      const r = IP.readList(list.value, IP.range4);
      for (const b of r.bad) bad.append(h('li', { class: 'bad' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, '!'), h('span', { class: 'mono' }, b.text), h('span', null, ' ' + b.error)));
      if (!r.ok.length) { say(m, r.bad.length ? 'None of the lines could be read.' : 'Paste a list of ranges to summarise.', r.bad.length ? 'err' : ''); return; }
      const s = IP.summarise4(r.ok);
      res.value = s.blocks.map(b => f4(b.net) + '/' + b.prefix).join('\n');
      const notAligned = r.ok.filter(x => x.cidr && !x.aligned).length;
      say(m, plural(r.ok.length, 'range') + ' in, ' + plural(s.blocks.length, 'CIDR block') + ' out.' + (notAligned ? ' ' + plural(notAligned, 'entry was', 'entries were') + ' not on a network boundary and were read as their whole network.' : '') + (r.bad.length ? ' ' + plural(r.bad.length, 'line') + ' could not be read.' : ''), r.bad.length ? 'note' : 'ok');
    }
    live(list, update);
    const p = panel('sum', h('div', { class: 'ctrl' }, h('span', { class: 'muted' }, 'Merges overlapping and neighbouring ranges into the fewest CIDR blocks (IPv4).'), h('span', { class: 'grow' }), h('button', { class: 'btn primary', onclick: () => copy(res.value, 'the summary') }, 'Copy')), m,
      h('div', { class: 'cols' }, h('div', { class: 'col' }, h('label', { for: 'sum-in', class: 'colhead' }, 'Ranges'), list), h('div', { class: 'col' }, h('label', { for: 'sum-out', class: 'colhead' }, 'Summarised'), res, bad)));
    update();
    return { panel: p, name: 'Summarise', focus: () => list.focus(), copyOut: () => copy(res.value, 'the summary'), update };
  })();

  /* ---------- IPv6 ---------- */
  tools.v6 = (function () {
    const input = field('v6-in', 'IPv6 address with prefix', settings.v6, 'for example: 2001:db8::1/64');
    const m = msg('v6-msg'), out = h('div', { id: 'v6-out', class: 'out' });
    let text = '';
    const show = (n, kind) => kind === 'IPv4-mapped' ? '::ffff:' + f4(Number(n & 0xffffffffn)) : IP.compress6(n);
    function nibbles(n, prefix) {
      const ex = IP.expand6(n), box = h('span', { class: 'bits mono' });
      let bit = 0;
      for (const ch of ex) { if (ch === ':') { box.append(h('span', { class: 'dot' }, ':')); continue; } box.append(h('span', { class: bit < prefix ? 'nb' : 'hb' }, ch)); bit += 4; }
      return box;
    }
    function update() {
      settings.v6 = input.value; saveSoon();
      out.textContent = ''; text = '';
      let c;
      try { c = IP.parseCidr6(input.value); } catch (e) { say(m, e.message, 'err'); input.setAttribute('aria-invalid', 'true'); return; }
      input.removeAttribute('aria-invalid');
      const i = IP.info6(c.n, c.prefix);
      say(m, (c.assumed ? 'No prefix was given, so this is a single address (/128). ' : '') + (c.zone ? 'The zone "%' + c.zone + '" names a network adapter on one computer; it is not part of the address.' : '') || show(c.n, i.kind) + '/' + c.prefix, c.assumed || c.zone ? 'note' : 'ok');
      const rows = [['Compressed', show(c.n, i.kind)], ['Expanded', IP.expand6(c.n)], ['Prefix', '/' + c.prefix],
        ['Network', IP.compress6(i.net) + '/' + c.prefix], ['First address', IP.expand6(i.net)], ['Last address', IP.expand6(i.last)],
        ['Addresses', IP.size6(i.size, c.prefix)], ['Type', i.kind]];
      if (c.prefix <= 64 && c.prefix % 4 === 0 && c.prefix > 0) rows.push(['/64 networks inside', IP.size6(1n << BigInt(64 - c.prefix), 128 - (64 - c.prefix))]);
      text = asText(rows);
      out.append(facts(rows), h('table', { class: 'bintab' }, h('caption', null, 'The prefix part is highlighted'),
        h('tr', null, h('th', { scope: 'row' }, 'Address'), h('td', null, nibbles(c.n, c.prefix))),
        h('tr', null, h('th', { scope: 'row' }, 'Network'), h('td', null, nibbles(i.net, c.prefix)))));
    }
    live(input, update); input.addEventListener('keydown', e => { if (e.key === 'Enter') update(); });
    const p = panel('v6', h('div', { class: 'ctrl' }, h('label', { for: 'v6-in', class: 'lbl' }, 'Address'), input, h('button', { class: 'btn primary', onclick: () => copy(text, 'the details') }, 'Copy all')), m, out);
    update();
    return { panel: p, name: 'IPv6', focus: () => input.focus(), copyOut: () => copy(text, 'the details'), update };
  })();

  }

  /* ---------- tabs ---------- */
  const TABS = [['v4', 'IPv4'], ['split', 'Split'], ['contains', 'In range?'], ['sum', 'Summarise'], ['v6', 'IPv6']];
  function drawTabs() {
    TABS.forEach(([id, name], i) => {
      order.push(id);
      $('tabs').append(h('button', { class: 'tab', id: 't-' + id, role: 'tab', 'aria-controls': 'p-' + id, title: name + ' (Alt+' + (i + 1) + ')', onclick: () => setTab(id) }, name));
      $('panels').append(tools[id].panel);
    });
  }
  function setTab(id, focusTab) {
    if (!tools[id]) id = 'v4';
    settings.tab = id;
    for (const t of order) { const on = t === id, b = $('t-' + t); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; tools[t].panel.hidden = !on; }
    if (focusTab) $('t-' + id).focus();
    saveSoon();
  }
  $('tabs').addEventListener('keydown', e => {
    const i = order.indexOf(settings.tab), to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: order.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); setTab(order[(to + order.length) % order.length], true);
  });
  document.addEventListener('keydown', e => {
    if (!$('copyDlg').hidden || !e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (/^[1-5]$/.test(k)) { e.preventDefault(); const id = order[+k - 1]; setTab(id); tools[id].focus(); }
    else if (k === 'c') { e.preventDefault(); tools[settings.tab].copyOut(); }
  });

  /* ---------- theme ---------- */
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); saveSoon(); toast(THEMES[settings.theme][1]); };

  /* ---------- start: the saved inputs are read before the tools are drawn ---------- */
  (async () => {
    const s = await Host.loadSettings({});
    const str = v => typeof v === 'string';
    if (s && typeof s === 'object') {
      if (['auto', 'light', 'dark'].includes(s.theme)) settings.theme = s.theme;
      for (const k of ['tab', 'v4', 'sum', 'v6']) if (str(s[k])) settings[k] = s[k];
      if (s.split && typeof s.split === 'object') { if (str(s.split.net)) settings.split.net = s.split.net; if (s.split.by === 'prefix' || s.split.by === 'count') settings.split.by = s.split.by; if (s.split.count > 0) settings.split.count = s.split.count | 0; if (s.split.prefix >= 0) settings.split.prefix = s.split.prefix | 0; }
      if (s.contains && typeof s.contains === 'object') { if (str(s.contains.ip)) settings.contains.ip = s.contains.ip; if (str(s.contains.ranges)) settings.contains.ranges = s.contains.ranges; }
    }
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    Host.setTitle('Subnet Calculator');
    make();
    drawTabs(); setTab(settings.tab); tools[settings.tab].focus();
    window.__sc4 = { tools, get settings() { return settings; }, ready: true };
  })();
})();
