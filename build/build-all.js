/* Packs every app (or the ones named):  node build/build-all.js [app-id …]   (npm run build) */
'use strict';
const pack = require('./pack');
for (const dir of require('./apps')(process.argv.slice(2))) pack(dir);
