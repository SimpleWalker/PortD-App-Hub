/* Builds and tests every app (or the ones named), one after another:  node build/test-all.js [app-id …]   (npm test)
   Each app is tested against the latest PortD build, and also against its earliest supported PortD when app.json
   sets "portdEarliest". The output of every run goes to <app>/test-results.txt. When every run passes, the app
   README's "Tested with PortD …" line is written from the versions that were run, so it never claims more.
   Exits with 1 if any check failed. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const { BUILDS, LATEST } = require('./versions');
let bad = [];
for (const dir of require('./apps')(process.argv.slice(2))) {
  const id = path.basename(dir), m = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8'));
  require('./pack')(dir);
  if (m.portdEarliest && !BUILDS.includes(m.portdEarliest)) { console.log(id.padEnd(18) + 'portdEarliest ' + m.portdEarliest + ' has no build in build/ (there are ' + BUILDS.join(', ') + ')'); bad.push(id); continue; }
  const vers = m.portdEarliest && m.portdEarliest !== LATEST ? [m.portdEarliest, LATEST] : [LATEST];
  let out = '', ok = true;
  for (const v of vers) {
    const r = spawnSync(process.execPath, [path.join(dir, 'test.js')], { encoding: 'utf8', maxBuffer: 64 << 20, env: Object.assign({}, process.env, { PORTD: v }) });
    const o = (r.stdout || '') + (r.stderr || '');
    out += (out ? '\n\n' : '') + '=== PortD ' + v + (v === LATEST ? ' (latest)' : ' (earliest)') + ' ===\n' + o;
    const last = o.trim().split('\n').filter(l => /checks:/.test(l)).pop() || 'crashed';
    console.log(id.padEnd(18) + ('PortD ' + v).padEnd(13) + last);
    if (r.status !== 0) ok = false;
  }
  fs.writeFileSync(path.join(dir, 'test-results.txt'), out);
  if (!ok) { bad.push(id); continue; }
  /* the README states what was tested: a line right under the "Version …" line */
  const rp = path.join(dir, 'README.md'), line = 'Tested with PortD ' + (vers.length > 1 ? vers[0] + ' (earliest) and ' + vers[1] + ' (latest)' : vers[0] + ' (latest)') + '.';
  let txt = fs.readFileSync(rp, 'utf8');
  if (/^Tested with PortD .*$/m.test(txt)) txt = txt.replace(/^Tested with PortD .*$/m, line);
  else txt = txt.replace(/^(Version .*)$/m, '$1\n\n' + line);
  fs.writeFileSync(rp, txt);
}
if (bad.length) { console.log('\nFailed: ' + bad.join(', ')); process.exit(1); }
