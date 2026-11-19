/* JSON Viewer: a JSON reader that says where a mistake is, keeps keys in file order (and duplicates), and keeps
   numbers exactly as written. Iterative, so deep nesting cannot overflow the stack. No DOM code here.
   Nodes: { t: 'o', keys: [], vals: [], dup: Set|null } object, { t: 'a', vals: [] } array,
          { t: 's', v } string, { t: 'n', v: 'as written' } number, { t: 'b', v: true|false }, { t: 'z' } null. */
(function () {
  'use strict';
  const J = window.JSONV = {};

  class ParseError extends Error { constructor(msg, pos) { super(msg); this.pos = pos; } }
  J.ParseError = ParseError;

  /* line and column (both from 1) of a character position */
  J.where = function (text, pos) {
    let line = 1, last = -1;
    for (let i = 0; i < pos && i < text.length; i++) if (text.charCodeAt(i) === 10) { line++; last = i; }
    return { line, col: pos - last };
  };

  const describe = ch => ch === undefined ? 'the end of the file' : ch === '\n' ? 'a line break' : /\s/.test(ch) ? 'a space' : '"' + ch + '"';
  const NUM = /-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?/y;

  J.parse = function (text) {
    let i = 0;
    const n = text.length, stack = [];
    let root = null, count = 0;
    const ws = () => { while (i < n) { const c = text.charCodeAt(i); if (c === 32 || c === 10 || c === 13 || c === 9) i++; else break; } };
    const err = (msg, at) => { throw new ParseError(msg, at === undefined ? i : at); };

    function str() {
      const start = i; i++;
      let out = '', from = i;
      for (;;) {
        if (i >= n) err('This string is never closed: the closing " is missing.', start);
        const c = text.charCodeAt(i);
        if (c === 34) { out += text.slice(from, i); i++; return out; }
        if (c === 92) {
          out += text.slice(from, i);
          const e = text[i + 1];
          if (e === 'u') {
            const hex = text.slice(i + 2, i + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) err('"\\u" must be followed by four hexadecimal digits.', i);
            out += String.fromCharCode(parseInt(hex, 16)); i += 6;
          } else {
            const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
            if (!(e in map)) err('"\\' + (e === undefined ? '' : e) + '" is not a valid escape in a string.', i);
            out += map[e]; i += 2;
          }
          from = i; continue;
        }
        if (c < 32) err(c === 10 ? 'A string cannot run onto the next line: the closing " is missing.' : 'A control character must be written as an escape inside a string.', i);
        i++;
      }
    }
    /* reads one value; containers are pushed and filled by the loop below */
    function value() {
      ws();
      const c = text[i];
      count++;
      if (c === '{') { i++; return { t: 'o', keys: [], vals: [], dup: null, open: true }; }
      if (c === '[') { i++; return { t: 'a', vals: [], open: true }; }
      if (c === '"') return { t: 's', v: str() };
      if (c === 't' && text.startsWith('true', i)) { i += 4; return { t: 'b', v: true }; }
      if (c === 'f' && text.startsWith('false', i)) { i += 5; return { t: 'b', v: false }; }
      if (c === 'n' && text.startsWith('null', i)) { i += 4; return { t: 'z' }; }
      if (c === '-' || (c >= '0' && c <= '9')) {
        NUM.lastIndex = i; const m = NUM.exec(text);
        if (!m || m[0] === '-') err('This is not a valid number.', i);
        i += m[0].length;
        if (/[0-9.eE+\-]/.test(text[i] || '')) err('This is not a valid number' + (m[0] === '0' || m[0] === '-0' ? ': a number cannot start with 0.' : '.'), i);
        return { t: 'n', v: m[0] };
      }
      if (c === "'") err('Strings must use double quotes ("), not single quotes.');
      if (c === '}' || c === ']') err('A value is missing before ' + describe(c) + (stack.length ? ' (a comma too many?)' : '') + '.');
      if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) err('Comments are not allowed in JSON.');
      if (c === undefined) err(stack.length ? 'The file ends before the ' + (stack[stack.length - 1].t === 'o' ? 'object' : 'array') + ' is closed.' : 'The file is empty.');
      if (/[A-Za-z_]/.test(c)) { const w = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, i + 40))[0]; err('"' + w + '" is not a JSON value. Text must be in double quotes; the only words allowed are true, false and null.'); }
      err('Unexpected ' + describe(c) + ': a value was expected here.');
    }

    ws();
    let v = value();
    for (;;) {
      if (v && v.open) {             /* a container just opened: is it empty? */
        delete v.open;
        ws();
        const close = v.t === 'o' ? '}' : ']';
        if (text[i] === close) { i++; }
        else {
          stack.push(v);
          if (v.t === 'o') {
            v.seen = new Set();
            if (text[i] !== '"') err(text[i] === undefined ? 'The file ends before the object is closed.' : 'Expected a key in double quotes, but found ' + describe(text[i]) + '.');
            v.pending = str(); ws();
            if (text[i] !== ':') err('Expected ":" after the key "' + v.pending.slice(0, 40) + '", but found ' + describe(text[i]) + '.');
            i++;
          }
          v = value(); continue;
        }
      }
      /* v is complete: attach it to its parent */
      if (!stack.length) { root = v; break; }
      const p = stack[stack.length - 1];
      if (p.t === 'o') { if (p.seen.has(p.pending)) (p.dup || (p.dup = new Set())).add(p.keys.length); else p.seen.add(p.pending); p.keys.push(p.pending); p.vals.push(v); delete p.pending; }
      else p.vals.push(v);
      ws();
      const c = text[i];
      if (c === ',') {
        i++; ws();
        if (p.t === 'o') {
          if (text[i] === '}') err('There is a comma after the last item: remove it.', i);
          if (text[i] !== '"') err('Expected a key in double quotes, but found ' + describe(text[i]) + '.');
          p.pending = str(); ws();
          if (text[i] !== ':') err('Expected ":" after the key "' + p.pending.slice(0, 40) + '", but found ' + describe(text[i]) + '.');
          i++;
        } else if (text[i] === ']') err('There is a comma after the last item: remove it.', i);
        v = value(); continue;
      }
      if ((p.t === 'o' && c === '}') || (p.t === 'a' && c === ']')) { i++; v = stack.pop(); delete v.seen; continue; }
      if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) err('Comments are not allowed in JSON.');
      if (c === undefined) err('The file ends before the ' + (p.t === 'o' ? 'object' : 'array') + ' is closed: a "' + (p.t === 'o' ? '}' : ']') + '" is missing.');
      err('Expected "," or "' + (p.t === 'o' ? '}' : ']') + '" after a value in ' + (p.t === 'o' ? 'an object' : 'an array') + ', but found ' + describe(c) + '.');
    }
    ws();
    if (i < n) err('There is more after the end of the JSON value. A JSON file holds one value; is a comma or a [ ] around them missing?');
    return { root, count };
  };

  /* a JavaScript-style path: $.store.book[0]["first name"] */
  const IDENT = /^[A-Za-z_$][\w$]*$/;
  J.step = (key, inArray) => inArray ? '[' + key + ']' : IDENT.test(key) ? '.' + key : '[' + JSON.stringify(key) + ']';
  /* a JSON Pointer (RFC 6901): /store/book/0/first name */
  J.pointerStep = key => '/' + String(key).replace(/~/g, '~0').replace(/\//g, '~1');

  /* a node as JSON text; numbers keep how they were written */
  J.stringify = function (node, indent) {
    const out = [], pad = d => indent ? '\n' + ' '.repeat(indent * d) : '';
    (function w(x, d) {
      switch (x.t) {
        case 's': out.push(JSON.stringify(x.v)); break;
        case 'n': out.push(x.v); break;
        case 'b': out.push(String(x.v)); break;
        case 'z': out.push('null'); break;
        case 'a':
          if (!x.vals.length) { out.push('[]'); break; }
          out.push('['); x.vals.forEach((c, k) => { if (k) out.push(','); out.push(pad(d + 1)); w(c, d + 1); }); out.push(pad(d) + ']'); break;
        case 'o':
          if (!x.keys.length) { out.push('{}'); break; }
          out.push('{'); x.keys.forEach((k, j) => { if (j) out.push(','); out.push(pad(d + 1) + JSON.stringify(k) + (indent ? ': ' : ':')); w(x.vals[j], d + 1); }); out.push(pad(d) + '}'); break;
      }
    })(node, 0);
    return out.join('');
  };
  /* a number that JavaScript cannot hold exactly */
  J.inexact = v => { const x = Number(v); return !Number.isFinite(x) || (/^-?\d+$/.test(v) && !Number.isSafeInteger(x)) || String(x) !== v && /^-?\d+(\.\d+)?$/.test(v) && v.replace(/^-?0*|\.?0*$/g, '').replace('.', '').length > 15; };
})();
