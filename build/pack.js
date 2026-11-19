#!/usr/bin/env node
/* PortD App Hub packer.
   Usage: node build/pack.js <app folder> [more app folders...]
   Reads <app>/app.json (the manifest fields) and every file under <app>/src/, checks them against the
   PortD 1.0 package rules (format 3), and writes <app>/<id>-<version>.portdapp.
   Exits with code 1, naming the problem, if anything would be refused by PortD or breaks the sandbox rules. */
'use strict';
const fs = require('fs'), path = require('path');

const LIMITS = { FILES: 256, FILE: 8 * 1048576, TOTAL: 24 * 1048576 };
const FIXED_EXT = ['.portd', '.portdapp', '.lnk', '.url'];
const TEXT_EXT = new Set(['.html', '.htm', '.css', '.js', '.json', '.md', '.txt', '.svg', '.csv', '.tsv', '.xml']);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const BAD_NAME = /[\\/:*?"<>|\u0000-\u001f]/;
/* Things the sandbox blocks or the hub rules forbid. Checked in scripts and the entry page. */
const LINT = [
  [/<script[^>]*type\s*=\s*["']?module/i, 'ES modules do not run in PortD'],
  [/\bimport\s*\(/, 'dynamic import() does not run in PortD'],
  [/\bfetch\s*\(/, 'fetch() is blocked in PortD'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest is blocked in PortD'],
  [/\bnew\s+(Shared)?Worker\s*\(/, 'workers are blocked in PortD'],
  [/(^|[^.\w])(alert|confirm|prompt)\s*\(/, 'alert/confirm/prompt are not used in hub apps (use an in-app confirmation)'],
  [/<form[\s>]/i, 'forms are not used in hub apps'],
  [/https?:\/\/(?!www\.w3\.org\/)[a-z0-9-]+\.[a-z]/i, 'a network address in a source file (only allowed as text the user sees; mark the line with "pack-ok" if intended)']
];

function fail(msg) { console.error('pack: ' + msg); process.exit(1); }

function walk(dir, rel, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name), r = rel ? rel + '/' + name : name;
    if (fs.statSync(full).isDirectory()) walk(full, r, out); else out.push({ full, rel: r });
  }
  return out;
}

function pack(appDir) {
  appDir = path.resolve(appDir);
  const mf = path.join(appDir, 'app.json'), src = path.join(appDir, 'src');
  if (!fs.existsSync(mf)) fail(appDir + ': no app.json');
  if (!fs.existsSync(src)) fail(appDir + ': no src folder');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  if (typeof m.name !== 'string' || !m.name.trim()) fail('app.json has no name');
  if (!/^[a-z0-9-]{1,40}$/.test(m.id || '')) fail('id "' + m.id + '" must be 1 to 40 lowercase letters, digits and hyphens');
  if (!/^\d+\.\d+\.\d+$/.test(m.version || '')) fail('version "' + m.version + '" must look like 1.2.3');
  for (const t of m.fileTypes || []) {
    if (!/^\.[a-z0-9]{1,16}$/.test(t.ext)) fail('file type "' + t.ext + '" is not a lowercase extension with a dot');
    if (FIXED_EXT.includes(t.ext)) fail(t.ext + ' has a fixed meaning in PortD and cannot be declared');
  }
  const entry = m.entry || 'index.html';
  /* every app carries its own copy of the shared host layer; it must match build/lib/host.js */
  const shared = path.join(__dirname, 'lib', 'host.js'), mine = path.join(src, 'js', 'host.js');
  if (fs.existsSync(mine) && fs.readFileSync(mine, 'utf8') !== fs.readFileSync(shared, 'utf8')) fail('src/js/host.js differs from build/lib/host.js: copy the shared one in (or change the shared one and copy it to every app)');
  const list = walk(src, '', []), files = {}, seen = new Set();
  let total = 0;
  if (list.length > LIMITS.FILES) fail(list.length + ' files; a package can hold at most ' + LIMITS.FILES);
  for (const { full, rel } of list) {
    const parts = rel.split('/'), low = rel.toLowerCase();
    if (parts.some(p => !p || p === '.' || p === '..' || BAD_NAME.test(p) || /[ .]$/.test(p) || /^ /.test(p))) fail('file path not allowed: ' + rel);
    if (low === 'manifest.json') fail('src/manifest.json is not allowed: PortD writes it');
    if (seen.has(low)) fail('two files differ only in case: ' + rel);
    seen.add(low);
    const ext = path.extname(rel).toLowerCase(), buf = fs.readFileSync(full);
    if (buf.length > LIMITS.FILE) fail(rel + ' is over 8 MB');
    if ((total += buf.length) > LIMITS.TOTAL) fail('the package is over 24 MB');
    if (TEXT_EXT.has(ext)) {
      const text = buf.toString('utf8').replace(/^﻿/, '');
      if (ext === '.js' || ext === '.html' || ext === '.htm') {
        text.split('\n').forEach((line, i) => {
          if (/pack-ok/.test(line)) return;
          for (const [re, why] of LINT) if (re.test(line)) fail(rel + ':' + (i + 1) + ': ' + why + '\n    ' + line.trim().slice(0, 160));
        });
      }
      files[rel] = { enc: 'text', d: text };
    } else if (MIME[ext]) files[rel] = { enc: 'dataurl', d: 'data:' + MIME[ext] + ';base64,' + buf.toString('base64') };
    else fail(rel + ': unknown file type ' + ext + ' (add it to the packer if it is needed)');
  }
  if (!files[entry]) fail('the entry file ' + entry + ' is not in src/');
  if (m.icon && !/^(glyph:|emoji:)/.test(m.icon) && !files[m.icon]) fail('the icon ' + m.icon + ' is not in src/');
  const pkg = Object.assign({ format: 'portd-app', formatVersion: 3 }, {
    id: m.id, name: m.name, version: m.version, description: m.description || '', icon: m.icon || '', entry,
    width: m.width || 640, height: m.height || 440, singleInstance: m.singleInstance === true, fileTypes: m.fileTypes || []
  }, { files });
  const out = path.join(appDir, m.id + '-' + m.version + '.portdapp');
  for (const old of fs.readdirSync(appDir)) if (old.endsWith('.portdapp') && path.join(appDir, old) !== out) fs.unlinkSync(path.join(appDir, old));
  fs.writeFileSync(out, JSON.stringify(pkg, null, 1));
  console.log('pack: ' + path.relative(process.cwd(), out) + '  (' + Object.keys(files).length + ' files, ' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB)');
  return out;
}

if (require.main === module) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) fail('usage: node build/pack.js <app folder> [...]');
  dirs.forEach(pack);
}
module.exports = pack;
