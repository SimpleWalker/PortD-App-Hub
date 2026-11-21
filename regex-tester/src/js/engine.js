/* Regex Tester: the matching. Building the pattern, spotting risky shapes, finding matches within limits,
   and the replace preview. No drawing here; app.js draws. Everything hangs off window.Rx. */
(function () {
  'use strict';
  const Rx = window.Rx = {};
  Rx.FLAGS = ['g', 'i', 'm', 's', 'u', 'y'];
  Rx.LIMIT = { shown: 1000, ms: 500, slow: 200 };

  /* the pattern as a RegExp, or { error } in plain words */
  Rx.build = function (pattern, flags) {
    if (!pattern) return { error: '' };
    try { return { re: new RegExp(pattern, flags + 'd') }; }   // d: also report where each group matched
    catch (e) {
      let m = String(e.message || e).replace(/^Invalid regular expression: \/.*\/[a-z]*: /s, '').replace(/^Invalid regular expression: /, '');
      return { error: m.charAt(0).toUpperCase() + m.slice(1) + '.' };
    }
  };

  /* walks the pattern; calls fn(kind, i, token) for '(' ')' '|', quantifiers ('q') and atoms ('a': a character, an escape,
     a [class] or '.'). The (?: (?= (?! (?<= (?<! (?<name> openings are skipped as one '(' */
  function walk(p, fn) {
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '\\') { fn('a', i, p.slice(i, i + 2)); i++; continue; }
      if (c === '[') { const a = i; i++; if (p[i] === '^') i++; if (p[i] === ']') i++; while (i < p.length && p[i] !== ']') { if (p[i] === '\\') i++; i++; } fn('a', a, '['); continue; }
      if (c === '(') { fn('(', i); if (p[i + 1] === '?') { const m = /^\(\?(?::|=|!|<=|<!|<[A-Za-z_$][\w$]*>)/.exec(p.slice(i)); if (m) i += m[0].length - 1; } }
      else if (c === ')') fn(')', i);
      else if (c === '|') fn('|', i);
      else if (c === '*' || c === '+' || c === '?' || c === '{') fn('q', i);
      else if (c !== '^' && c !== '$') fn('a', i, c);
    }
  }
  /* the quantifier starting at i: { unbounded, variable } (unbounded: * + {n,} or a large {n,m}; variable: the count can vary) */
  function quant(p, i) {
    const c = p[i];
    if (c === '*' || c === '+') return { unbounded: true, variable: true };
    if (c === '?') return { unbounded: false, variable: true };
    const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i));
    if (!m) return null;
    return { unbounded: m[2] !== undefined && (m[3] === '' || +m[3] > 16), variable: m[2] !== undefined && m[3] !== m[1] };
  }

  /* Risky shapes: a repeated group that holds a repeat or an alternative, such as (a+)+, (\w*)* or (a|ab)+.
     They can take so long on text that almost matches that the window stops responding. Returns a reason or ''. */
  const GENERAL = /^(\[|\.|\\[wWdDsSbBpP])$/;   // tokens that can match many different characters
  Rx.risky = function (p) {
    const group = () => ({ rep: false, alt: false, firsts: [], want: true });
    const stack = [group()];
    let why = '', lastClose = -1, closed = null;
    /* alternatives can overlap when two start the same way, one starts with a class, or one is empty */
    const overlap = g => g.alt && (g.want || g.firsts.some((t, n) => GENERAL.test(t) || g.firsts.indexOf(t) !== n));
    walk(p, (k, i, tok) => {
      if (why) return;
      const top = stack[stack.length - 1];
      if (k === 'a') { if (top.want) { top.firsts.push(tok.length === 1 && /[a-z]/i.test(tok) && /i/.test(Rx._flags || '') ? tok.toLowerCase() : tok); top.want = false; } closed = null; }
      else if (k === '(') { if (top.want) { top.firsts.push('['); top.want = false; } stack.push(group()); closed = null; }
      else if (k === '|') { top.alt = true; if (top.want) top.firsts.push(''); top.want = true; }
      else if (k === ')') { if (stack.length > 1) { closed = stack.pop(); closed.ovl = overlap(closed); lastClose = i; } }
      else if (k === 'q') {
        const q = quant(p, i);
        if (!q) return;
        if (closed && lastClose === i - 1) {
          if (q.unbounded && (closed.rep || closed.ovl)) why = closed.rep ? 'a repeated group that holds another repeat' : 'a repeated group of choices that can match the same text';
          if (q.variable || closed.rep) top.rep = true;
        } else if (q.variable) top.rep = true;
        closed = null;
      }
    });
    return why;
  };

  /* the names of the groups, in order (index 1 first); unnamed groups are '' */
  Rx.groupNames = function (p) {
    const names = [];
    walk(p, (k, i) => {
      if (k !== '(') return;
      if (p[i + 1] !== '?') { names.push(''); return; }
      const m = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(p.slice(i));
      if (m) names.push(m[1]);
    });
    return names;
  };

  /* finds matches: at most LIMIT.shown kept, counting on until LIMIT.ms is used up.
     Returns { matches: [{ index, length, text, groups: [{ n, name, value, index }] }], count, stopped: '' | 'time', ms } */
  Rx.run = function (re, text, names) {
    const t0 = performance.now(), out = [], global = re.global;
    re.lastIndex = 0;
    let count = 0, stopped = '';
    for (;;) {
      const m = re.exec(text);
      if (!m) break;
      count++;
      if (out.length < Rx.LIMIT.shown) {
        const groups = [];
        for (let g = 1; g < m.length; g++) groups.push({ n: g, name: names[g - 1] || '', value: m[g], index: m.indices && m.indices[g] ? m.indices[g][0] : -1 });
        out.push({ index: m.index, length: m[0].length, text: m[0], groups });
      }
      if (!global) break;
      if (m[0].length === 0) re.lastIndex = m.index + ((re.unicode || re.unicodeSets) && text.codePointAt(m.index) > 0xffff ? 2 : 1);
      if (performance.now() - t0 > Rx.LIMIT.ms) { stopped = 'time'; break; }
    }
    re.lastIndex = 0;
    return { matches: out, count, stopped, ms: performance.now() - t0 };
  };

  /* the replace preview: the browser's own replace, so $1, $<name>, $&, $` , $' and $$ work exactly as in JavaScript */
  Rx.replace = function (re, text, replacement) {
    const plain = new RegExp(re.source, re.flags.replace('d', ''));
    return text.replace(plain, replacement);
  };

  /* for the saved file: { v: 1, patterns: [...] } with each entry cleaned */
  Rx.cleanSaved = function (o) {
    const list = o && Array.isArray(o.patterns) ? o.patterns : [];
    const s = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);
    return list.slice(0, 500).map(x => ({
      name: s(x && x.name, 80).trim() || 'Untitled',
      pattern: s(x && x.pattern, 5000),
      flags: s(x && x.flags, 8).split('').filter((f, i, a) => Rx.FLAGS.includes(f) && a.indexOf(f) === i).join(''),
      text: s(x && x.text, 100000),
      replacement: s(x && x.replacement, 5000),
      saved: x && typeof x.saved === 'number' ? x.saved : 0
    }));
  };
})();
