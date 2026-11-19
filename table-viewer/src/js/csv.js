/* Table Viewer: reading and writing delimited text. No DOM code here. */
(function () {
  'use strict';
  const CSV = window.CSV = {};
  CSV.DELIMS = [{ ch: ',', name: 'Comma' }, { ch: ';', name: 'Semicolon' }, { ch: '\t', name: 'Tab' }, { ch: '|', name: 'Pipe' }];
  const lineBreaks = s => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c === 10 || (c === 13 && s.charCodeAt(i + 1) !== 10)) n++; } return n; };

  /* Splits text into records. Quotes follow RFC 4180: a quoted value may hold the delimiter, line breaks and "" for a
     quote. Returns { rows, lines, unterminated }: lines[i] is the line row i starts on; unterminated is the line of a
     quote that never closes, or null. Blank lines are left out. limit stops after that many characters (for sniffing). */
  CSV.parse = function (text, d, limit) {
    const rows = [], lines = [], n = limit ? Math.min(limit, text.length) : text.length;
    let i = 0, line = 1, row = [], rowLine = 1, unterminated = null;
    if (!n) return { rows, lines, unterminated };
    const end = () => { if (!(row.length === 1 && row[0] === '')) { rows.push(row); lines.push(rowLine); } };
    for (;;) {
      let field;
      if (text.charCodeAt(i) === 34) {
        const qLine = line; let s = '';
        i++;
        for (;;) {
          const j = text.indexOf('"', i);
          if (j < 0 || j >= n) { const rest = text.slice(i, n); s += rest; line += lineBreaks(rest); i = n; unterminated = qLine; break; }
          const part = text.slice(i, j); s += part; line += lineBreaks(part);
          if (text.charCodeAt(j + 1) === 34 && j + 1 < n) { s += '"'; i = j + 2; continue; }
          i = j + 1; break;
        }
        let k = i; while (k < n) { const c = text[k]; if (c === d || c === '\n' || c === '\r') break; k++; }
        if (k > i) s += text.slice(i, k);
        i = k; field = s;
      } else {
        let k = i; while (k < n) { const c = text[k]; if (c === d || c === '\n' || c === '\r') break; k++; }
        field = text.slice(i, k); i = k;
      }
      row.push(field);
      if (i >= n) { end(); break; }
      if (text[i] === d) { i++; if (i >= n) { row.push(''); end(); break; } continue; }
      i += text[i] === '\r' && text[i + 1] === '\n' ? 2 : 1;
      line++;
      end(); row = []; rowLine = line;
      if (i >= n) break;
    }
    return { rows, lines, unterminated };
  };

  /* The delimiter that splits the start of the file most consistently into more than one column.
     ext ('csv', 'tsv', …) breaks a tie or decides when nothing splits. */
  CSV.sniff = function (text, ext) {
    const sample = text.length > 65536 ? text.slice(0, text.lastIndexOf('\n', 65536) + 1 || 65536) : text;
    let best = null;
    for (const { ch } of CSV.DELIMS) {
      const rows = CSV.parse(sample, ch).rows.slice(0, 50);
      if (!rows.length) continue;
      const counts = {}; rows.forEach(r => { counts[r.length] = (counts[r.length] || 0) + 1; });
      const mode = +Object.keys(counts).sort((a, b) => counts[b] - counts[a] || b - a)[0];
      if (mode < 2) continue;
      const score = counts[mode] / rows.length * 1000 + Math.min(mode, 50) + (ext === 'tsv' && ch === '\t' ? 5 : 0) + (ext === 'csv' && ch === ',' ? 5 : 0);
      if (!best || score > best.score) best = { ch, score };
    }
    return best ? best.ch : ext === 'tsv' ? '\t' : ',';
  };

  /* line ending the file mostly uses */
  CSV.eol = text => { const i = text.indexOf('\n'); return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n'; };

  /* one value written out, quoted only when it has to be */
  CSV.cell = function (v, d) {
    v = v == null ? '' : String(v);
    return v.includes(d) || v.includes('"') || v.includes('\n') || v.includes('\r') || /^\s|\s$/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  CSV.write = function (rows, d, eol) { return rows.map(r => r.map(v => CSV.cell(v, d)).join(d)).join(eol || '\r\n') + (eol || '\r\n'); };

  /* numbers as people write them in tables: 12, -3.5, 1,234.5, 1e6, 12%; null when the text is not one */
  const NUM = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][-+]?\d+)?%?$/;
  CSV.num = function (s) {
    s = String(s).trim();
    if (!s || !/\d/.test(s) || !NUM.test(s)) return null;
    const v = parseFloat(s.replace(/,/g, '').replace(/%$/, ''));
    return Number.isFinite(v) ? v : null;
  };
})();
