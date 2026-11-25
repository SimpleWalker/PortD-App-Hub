/* The PortD builds the tests run against: build/portd-<version>.html, one per released PortD, never edited.
   The newest is the latest. An app may set "portdEarliest" in app.json: the earliest PortD it supports, which
   npm test runs it against as well. */
'use strict';
const fs = require('fs'), path = require('path');
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const BUILDS = fs.readdirSync(__dirname).map(f => /^portd-(\d+\.\d+\.\d+)\.html$/.exec(f)).filter(Boolean).map(m => m[1]).sort(cmp);
const LATEST = BUILDS[BUILDS.length - 1];
/* a version ("1.0.0") or a path to a build */
const file = v => /^\d+\.\d+\.\d+$/.test(v) ? path.join(__dirname, 'portd-' + v + '.html') : path.resolve(v);
module.exports = { BUILDS, LATEST, file, cmp };
