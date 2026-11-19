/* Builds and tests every app (or the ones named), one after another:  node build/test-all.js [app-id …]   (npm test)
   Each app's results are written to <app>/test-results.txt. Exits with 1 if any check failed. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
let bad = [];
for (const dir of require('./apps')(process.argv.slice(2))) {
  const id = path.basename(dir);
  require('./pack')(dir);
  const r = spawnSync(process.execPath, [path.join(dir, 'test.js')], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(dir, 'test-results.txt'), out);
  const last = out.trim().split('\n').filter(l => /checks:/.test(l)).pop() || 'crashed';
  console.log(id.padEnd(16) + last);
  if (r.status !== 0) bad.push(id);
}
if (bad.length) { console.log('\nFailed: ' + bad.join(', ')); process.exit(1); }
