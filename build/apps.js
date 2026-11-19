/* The app folders in the repository: every top-level folder with an app.json. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
module.exports = (only) => fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'app.json')) && (!only.length || only.includes(d))).sort().map(d => path.join(ROOT, d));
