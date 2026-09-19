#!/usr/bin/env node
// sync-www.js
// Run this whenever you edit any web game file to keep www/ in sync.
// Usage: node sync-www.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW  = path.join(ROOT, 'www');

// Files to sync from root to www/
const webFiles = [
  'index.html',
  'style.css',
  'perf.js',
  'script.js',
  'audio.js',
  'entities.js',
  'levels.js',
  'renderer.js',
  'game-themes.js',
  'game.js',
  'mobile-controls.js',
  'three.min.js',
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];

let updated = 0;
for (const file of webFiles) {
  const src  = path.join(ROOT, file);
  const dest = path.join(WWW, file);
  if (!fs.existsSync(src)) { console.log(`SKIP (not found): ${file}`); continue; }
  const srcStat  = fs.statSync(src);
  const destStat = fs.existsSync(dest) ? fs.statSync(dest) : null;
  if (!destStat || srcStat.mtimeMs > destStat.mtimeMs) {
    fs.copyFileSync(src, dest);
    console.log(`SYNCED: ${file}`);
    updated++;
  }
}

if (updated === 0) {
  console.log('All files already up to date.');
} else {
  console.log(`\nSynced ${updated} file(s). Now run: npx cap sync android`);
}
