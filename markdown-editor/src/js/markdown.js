/* Markdown Editor: a Markdown reader (CommonMark core plus GitHub tables, task lists, strikethrough and bare links).
   It turns text into a tree, which is drawn element by element (toDOM) or written out as escaped HTML (toHTML).
   Raw HTML in the text is never passed on as HTML: it is shown as the text it is. No DOM code in parse(). */
(function () {
  'use strict';
  const MD = window.MD = {};

  /* ---------- links: only these can ever become a link ---------- */
  MD.safeUrl = function (u) {
    u = String(u || '').trim();
    if (/^(https?:|mailto:)/i.test(u)) return { kind: 'web', href: u };
    if (/^#/.test(u)) return { kind: 'anchor', href: u };
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^[a-z]:[\\/]/i.test(u)) return { kind: 'blocked', href: u };      /* javascript:, data:, file:, … */
    return { kind: 'file', href: u };          /* a path: a file on the drive */
  };
  MD.slug = s => s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');

  /* ---------- blocks ---------- */
  const RE = {
    blank: /^\s*$/,
    atx: /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/,
    hr: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
    fence: /^( {0,3})(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/,
    quote: /^ {0,3}> ?/,
    item: /^( {0,3})([-+*]|\d{1,9}[.)])(?=[ \t]|$)([ \t]*)/,
    setext: /^ {0,3}(=+|-+)[ \t]*$/,
    tdelim: /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
    ref: /^ {0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*$/
  };
  const expandTabs = l => l.indexOf('\t') < 0 ? l : l.replace(/^[ \t]+/, m => { let c = 0; for (const ch of m) c = ch === '\t' ? c + 4 - c % 4 : c + 1; return ' '.repeat(c); });
  const indentOf = l => l.length - l.trimStart().length;
  const splitRow = l => { let s = l.trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1); const out = []; let cur = '', code = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; } else if (c === '`') { code = !code; cur += c; } else if (c === '|' && !code) { out.push(cur.trim()); cur = ''; } else cur += c; } out.push(cur.trim()); return out; };
  const startsBlock = l => RE.atx.test(l) || RE.hr.test(l) || RE.fence.test(l) || RE.quote.test(l) || (RE.item.test(l) && !RE.blank.test(l.replace(RE.item, '')) && (/^ {0,3}[-+*]/.test(l) || /^ {0,3}1[.)]/.test(l)));

  function blocks(lines, refs) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (RE.blank.test(line)) { i++; continue; }
      let m;
      if ((m = RE.fence.exec(line))) {
        const ind = m[1].length, mark = m[2], body = [];
        i++;
        while (i < lines.length && !new RegExp('^ {0,3}' + mark[0] + '{' + mark.length + ',}\\s*$').test(lines[i])) { body.push(lines[i].replace(new RegExp('^ {0,' + ind + '}'), '')); i++; }
        i++;
        out.push({ t: 'pre', lang: m[3] || '', v: body.join('\n') });
        continue;
      }
      if (indentOf(line) >= 4) {
        const body = [];
        while (i < lines.length && (indentOf(lines[i]) >= 4 || RE.blank.test(lines[i]))) { body.push(lines[i].slice(4)); i++; }
        while (body.length && RE.blank.test(body[body.length - 1])) body.pop();
        out.push({ t: 'pre', lang: '', v: body.join('\n') });
        continue;
      }
      if ((m = RE.atx.exec(line))) { out.push({ t: 'h', level: m[1].length, src: (m[2] || '').trim() }); i++; continue; }
      if (RE.hr.test(line)) { out.push({ t: 'hr' }); i++; continue; }
      if (RE.quote.test(line)) {
        const body = [];
        while (i < lines.length && !RE.blank.test(lines[i]) && (RE.quote.test(lines[i]) || !startsBlock(lines[i]))) { body.push(lines[i].replace(RE.quote, '')); i++; }
        out.push({ t: 'quote', c: blocks(body, refs) });
        continue;
      }
      if ((m = RE.item.exec(line))) {
        const ordered = /\d/.test(m[2]), kind = ordered ? m[2].slice(-1) : m[2], list = { t: ordered ? 'ol' : 'ul', start: ordered ? parseInt(m[2], 10) : 1, items: [], loose: false };
        let gap = false;                    /* a blank line between items, or between blocks inside one, makes the list loose */
        while (i < lines.length && (m = RE.item.exec(lines[i])) && (ordered ? /\d/.test(m[2]) && m[2].slice(-1) === kind : m[2] === kind)) {
          if (gap) list.loose = true;
          const rest = lines[i].slice(m[0].length), wide = m[3].length > 4 && rest.trim();
          const pad = wide ? m[1].length + m[2].length + 1 : m[0].length + (rest.trim() ? 0 : 1);
          const body = [wide ? lines[i].slice(pad) : rest];
          i++; gap = false;
          while (i < lines.length) {
            const l = lines[i];
            if (RE.blank.test(l)) { body.push(''); gap = true; i++; continue; }
            if (indentOf(l) >= pad) { if (gap) list.loose = true; body.push(l.slice(pad)); gap = false; i++; continue; }
            if (!gap && !startsBlock(l) && !RE.item.test(l)) { body.push(l); i++; continue; }      /* lazy continuation */
            break;
          }
          while (body.length && body[body.length - 1] === '') body.pop();
          let task = null, t;
          if ((t = /^\[([ xX])\](?:[ \t]+|$)/.exec(body[0] || ''))) { task = t[1] !== ' '; body[0] = body[0].slice(t[0].length); }
          list.items.push({ task, c: blocks(body, refs) });
        }
        out.push(list);
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && RE.tdelim.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const head = splitRow(line), align = splitRow(lines[i + 1]).map(c => /^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : /^:-+$/.test(c) ? 'left' : null);
        if (align.length === head.length) {
          const rows = [];
          i += 2;
          while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].includes('|') && !startsBlock(lines[i])) { const r = splitRow(lines[i]); rows.push(head.map((_, k) => r[k] || '')); i++; }
          out.push({ t: 'table', align, head, rows });
          continue;
        }
      }
      /* paragraph, perhaps with reference definitions in front, perhaps a setext heading */
      const para = [];
      while (i < lines.length && !RE.blank.test(lines[i])) {
        if (para.length && startsBlock(lines[i])) break;
        if (para.length && RE.setext.test(lines[i])) { out.push({ t: 'h', level: lines[i].trim()[0] === '=' ? 1 : 2, src: para.join('\n').trim() }); para.length = 0; i++; break; }
        if (!para.length && (m = RE.ref.exec(lines[i]))) { const k = m[1].toLowerCase().replace(/\s+/g, ' '); if (!refs[k]) refs[k] = { href: m[2], title: m[3] || m[4] || m[5] || '' }; i++; continue; }
        para.push(lines[i].replace(/^ {0,3}/, '')); i++;
      }
      if (para.length) out.push({ t: 'p', src: para.join('\n') });
    }
    return out;
  }

  /* ---------- inline ---------- */
  const PUNCT = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;
  function inline(s, refs) {
    const out = [];
    let text = '', i = 0;
    const flush = () => { if (text) { out.push({ t: 'text', v: text }); text = ''; } };
    while (i < s.length) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) {
        if (s[i + 1] === '\n') { flush(); out.push({ t: 'br' }); i += 2; continue; }
        if (PUNCT.test(s[i + 1])) { text += s[i + 1]; i += 2; continue; }
      }
      if (c === '\n') { const hard = / {2,}$/.test(text); text = text.replace(/ +$/, ''); flush(); out.push(hard ? { t: 'br' } : { t: 'text', v: '\n' }); i++; continue; }
      if (c === '`') {
        const run = /^`+/.exec(s.slice(i))[0], j = s.indexOf(run, i + run.length);
        let k = j;
        while (k >= 0 && s[k + run.length] === '`') k = s.indexOf(run, k + run.length + 1);
        if (k >= 0) { flush(); let v = s.slice(i + run.length, k).replace(/\n/g, ' '); if (/^ .*[^ ].* $/.test(v)) v = v.slice(1, -1); out.push({ t: 'code', v }); i = k + run.length; continue; }
        text += run; i += run.length; continue;
      }
      if (c === '<') {
        const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/.exec(s.slice(i));
        if (m) { flush(); const href = /^(https?:|mailto:)/i.test(m[1]) ? m[1] : 'mailto:' + m[1]; out.push({ t: 'link', href, title: '', c: [{ t: 'text', v: m[1] }] }); i += m[0].length; continue; }
        text += c; i++; continue;              /* any other < is text: raw HTML is never passed on */
      }
      if (c === '[' || (c === '!' && s[i + 1] === '[')) {
        const img = c === '!', l = linkAt(s, img ? i + 1 : i, refs);
        if (l) {
          flush();
          if (img) out.push({ t: 'img', src: l.href, title: l.title, alt: plain(inline(l.label, refs)) });
          else out.push({ t: 'link', href: l.href, title: l.title, c: inline(l.label, refs) });
          i = l.end; continue;
        }
        text += c; i++; continue;
      }
      if (c === '*' || c === '_' || (c === '~' && s[i + 1] === '~')) {
        const e = emphAt(s, i, refs);
        if (e) { flush(); out.push(e.node); i = e.end; continue; }
        const run = /^(\*+|_+|~+)/.exec(s.slice(i))[0]; text += run; i += run.length; continue;
      }
      if ((c === 'h' || c === 'w') && !/[\w]$/.test(text)) {
        const m = /^(?:https?:\/\/|www\.)[^\s<]*[^\s<.,:;"')\]*_~?!]/.exec(s.slice(i));
        if (m) { flush(); out.push({ t: 'link', href: m[0].startsWith('www.') ? 'https://' + m[0] : m[0], title: '', c: [{ t: 'text', v: m[0] }] }); i += m[0].length; continue; }
      }
      text += c; i++;
    }
    flush();
    return out;
  }
  /* [label](dest "title"), [label][ref], [label][] or [label] at position i (which holds the "[") */
  function linkAt(s, i, refs) {
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      const c = s[j];
      if (c === '\\') { j++; continue; }
      if (c === '`') { const run = /^`+/.exec(s.slice(j))[0], k = s.indexOf(run, j + run.length); if (k > 0) { j = k + run.length - 1; continue; } }
      if (c === '[') depth++;
      else if (c === ']' && --depth === 0) break;
    }
    if (j >= s.length) return null;
    const label = s.slice(i + 1, j);
    let m = /^\(\s*(?:<([^<>\n]*)>|((?:[^\s()\\]|\\.|\((?:[^\s()\\]|\\.)*\))*))(?:\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\(([^)]*)\)))?\s*\)/.exec(s.slice(j + 1));
    if (m) return { label, href: (m[1] !== undefined ? m[1] : m[2]).replace(/\\(.)/g, '$1'), title: (m[3] || m[4] || m[5] || '').replace(/\\(.)/g, '$1'), end: j + 1 + m[0].length };
    const key = k => refs[k.toLowerCase().replace(/\s+/g, ' ').trim()];
    m = /^\[([^\]]*)\]/.exec(s.slice(j + 1));
    if (m) { const r = key(m[1] || label); if (r) return { label, href: r.href, title: r.title, end: j + 1 + m[0].length }; }
    const r = key(label);
    if (r) return { label, href: r.href, title: r.title, end: j + 1 };
    return null;
  }
  /* *em*, **strong**, ***both***, _em_, __strong__, ~~strike~~ */
  function emphAt(s, i, refs) {
    const ch = s[i], run = new RegExp('^\\' + ch + '+').exec(s.slice(i))[0];
    const n = ch === '~' ? 2 : Math.min(run.length, 3);
    if (ch === '~' && run.length !== 2) return null;
    const after = s[i + run.length];
    if (!after || /\s/.test(after)) return null;
    if (ch === '_' && i > 0 && /[\p{L}\p{N}]/u.test(s[i - 1])) return null;
    const mark = ch.repeat(n);
    let k = i + n;
    while ((k = s.indexOf(mark, k)) >= 0) {
      const ok = /\S/.test(s[k - 1]) && s[k - 1] !== ch && s[k + n] !== ch && s.slice(i + n, k).trim() && (ch !== '_' || !/[\p{L}\p{N}]/u.test(s[k + n] || ''));
      if (ok) {
        const inner = inline(s.slice(i + n, k), refs);
        const node = ch === '~' ? { t: 'del', c: inner } : n === 1 ? { t: 'em', c: inner } : n === 2 ? { t: 'strong', c: inner } : { t: 'em', c: [{ t: 'strong', c: inner }] };
        return { node, end: k + n };
      }
      k += 1;
    }
    return null;
  }
  const plain = nodes => nodes.map(n => n.t === 'text' || n.t === 'code' ? n.v : n.t === 'img' ? n.alt : n.c ? plain(n.c) : n.t === 'br' ? ' ' : '').join('');

  /* ---------- the whole document ---------- */
  MD.parse = function (text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map(expandTabs), refs = {};
    const tree = blocks(lines, refs), ids = {};
    (function fill(bs) {
      for (const b of bs) {
        if (b.t === 'p' || b.t === 'h') { b.c = inline(b.src, refs); delete b.src; }
        if (b.t === 'h') { let id = MD.slug(plain(b.c)) || 'section'; if (ids[id] !== undefined) id += '-' + ++ids[id]; else ids[id] = 0; b.id = id; }
        if (b.t === 'table') { b.head = b.head.map(c => inline(c, refs)); b.rows = b.rows.map(r => r.map(c => inline(c, refs))); }
        if (b.t === 'quote') fill(b.c);
        if (b.t === 'ul' || b.t === 'ol') b.items.forEach(it => fill(it.c));
      }
    })(tree);
    return tree;
  };
  MD.plain = plain;
  MD.title = function (tree) { const h = tree.find(b => b.t === 'h' && b.level === 1) || tree.find(b => b.t === 'h'); return h ? plain(h.c) : ''; };

  /* ---------- drawing into the page ----------
     o.image(src, alt, title) returns an element to show for a picture; o.link(href, kind) is called on click */
  MD.toDOM = function (tree, doc, o) {
    const el = (tag, cls) => { const e = doc.createElement(tag); if (cls) e.className = cls; return e; };
    const frag = doc.createDocumentFragment();
    function inl(nodes, parent, tight) {
      for (const n of nodes) {
        let e;
        switch (n.t) {
          case 'text': parent.append(n.v); continue;
          case 'br': parent.append(el('br')); continue;
          case 'code': e = el('code'); e.textContent = n.v; break;
          case 'em': e = el('em'); inl(n.c, e); break;
          case 'strong': e = el('strong'); inl(n.c, e); break;
          case 'del': e = el('del'); inl(n.c, e); break;
          case 'img': e = o.image(n.src, n.alt, n.title); break;
          case 'link': {
            const u = MD.safeUrl(n.href);
            if (u.kind === 'blocked') { e = el('span', 'badlink'); e.title = 'This link was not made clickable: only web (http, https) and email links are allowed. It points to: ' + n.href; inl(n.c, e); break; }
            e = el('a'); e.href = u.kind === 'web' ? u.href : '#'; e.dataset.href = u.href; e.dataset.kind = u.kind;
            e.title = (n.title ? n.title + '\n' : '') + (u.kind === 'file' ? 'A file on the drive: ' + u.href + ' (open it from Files)' : u.href);
            if (u.kind === 'file') e.className = 'filelink';
            inl(n.c, e);
            break;
          }
        }
        if (n.title && e && n.t !== 'link') e.title = n.title;
        parent.append(e);
      }
    }
    function blk(bs, parent, tight) {
      for (const b of bs) {
        let e;
        switch (b.t) {
          case 'p': if (tight) { inl(b.c, parent); continue; } e = el('p'); inl(b.c, e); break;
          case 'h': e = el('h' + b.level); e.id = b.id; inl(b.c, e); break;
          case 'hr': e = el('hr'); break;
          case 'pre': { e = el('pre'); const c = el('code'); if (b.lang) c.dataset.lang = b.lang; c.textContent = b.v; e.append(c); break; }
          case 'quote': e = el('blockquote'); blk(b.c, e); break;
          case 'table': {
            e = el('table'); const th = el('thead'), tr = el('tr'), tb = el('tbody');
            b.head.forEach((c, k) => { const x = el('th'); if (b.align[k]) x.style.textAlign = b.align[k]; inl(c, x); tr.append(x); });
            th.append(tr); e.append(th);
            for (const r of b.rows) { const row = el('tr'); r.forEach((c, k) => { const x = el('td'); if (b.align[k]) x.style.textAlign = b.align[k]; inl(c, x); row.append(x); }); tb.append(row); }
            if (b.rows.length) e.append(tb);
            const wrap = el('div', 'tablewrap'); wrap.append(e); e = wrap;
            break;
          }
          case 'ul': case 'ol': {
            e = el(b.t); if (b.t === 'ol' && b.start !== 1) e.start = b.start;
            for (const it of b.items) {
              const li = el('li');
              if (it.task !== null) { li.className = 'task'; const box = el('input'); box.type = 'checkbox'; box.checked = it.task; box.disabled = true; box.setAttribute('aria-label', it.task ? 'done' : 'not done'); li.append(box, ' '); }
              blk(it.c, li, !b.loose);
              e.append(li);
            }
            break;
          }
        }
        parent.append(e);
      }
    }
    blk(tree, frag);
    return frag;
  };

  /* ---------- writing HTML text, for Export as HTML ----------
     o.image(src) returns a data URL for a picture, or null */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  MD.toHTML = function (tree, o) {
    function inl(nodes) {
      return nodes.map(n => {
        switch (n.t) {
          case 'text': return esc(n.v);
          case 'br': return '<br>\n';
          case 'code': return '<code>' + esc(n.v) + '</code>';
          case 'em': return '<em>' + inl(n.c) + '</em>';
          case 'strong': return '<strong>' + inl(n.c) + '</strong>';
          case 'del': return '<del>' + inl(n.c) + '</del>';
          case 'img': { const u = o.image(n.src); return u ? '<img src="' + esc(u) + '" alt="' + esc(n.alt) + '"' + (n.title ? ' title="' + esc(n.title) + '"' : '') + '>' : '<span class="missing">[picture: ' + esc(n.alt || n.src) + ']</span>'; }
          case 'link': {
            const u = MD.safeUrl(n.href);
            if (u.kind === 'web') return '<a href="' + esc(u.href) + '" rel="noopener noreferrer" target="_blank"' + (n.title ? ' title="' + esc(n.title) + '"' : '') + '>' + inl(n.c) + '</a>';
            if (u.kind === 'anchor') return '<a href="' + esc(u.href) + '">' + inl(n.c) + '</a>';
            return '<span>' + inl(n.c) + '</span>';
          }
        }
        return '';
      }).join('');
    }
    function blk(bs, tight) {
      return bs.map(b => {
        switch (b.t) {
          case 'p': return tight ? inl(b.c) : '<p>' + inl(b.c) + '</p>\n';
          case 'h': return '<h' + b.level + ' id="' + esc(b.id) + '">' + inl(b.c) + '</h' + b.level + '>\n';
          case 'hr': return '<hr>\n';
          case 'pre': return '<pre><code' + (b.lang ? ' class="language-' + esc(b.lang) + '"' : '') + '>' + esc(b.v) + '</code></pre>\n';
          case 'quote': return '<blockquote>\n' + blk(b.c) + '</blockquote>\n';
          case 'table': {
            const a = k => b.align[k] ? ' style="text-align:' + b.align[k] + '"' : '';
            return '<table>\n<thead><tr>' + b.head.map((c, k) => '<th' + a(k) + '>' + inl(c) + '</th>').join('') + '</tr></thead>\n' +
              (b.rows.length ? '<tbody>\n' + b.rows.map(r => '<tr>' + r.map((c, k) => '<td' + a(k) + '>' + inl(c) + '</td>').join('') + '</tr>\n').join('') + '</tbody>\n' : '') + '</table>\n';
          }
          case 'ul': case 'ol':
            return '<' + b.t + (b.t === 'ol' && b.start !== 1 ? ' start="' + b.start + '"' : '') + '>\n' + b.items.map(it => '<li' + (it.task !== null ? ' class="task"><input type="checkbox" disabled' + (it.task ? ' checked' : '') + '> ' : '>') + blk(it.c, !b.loose) + '</li>\n').join('') + '</' + b.t + '>\n';
        }
        return '';
      }).join('');
    }
    return blk(tree);
  };
  MD.escape = esc;
})();
