#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'schema', 'migrations');
const distDir = path.join(__dirname, '..', 'dist', 'schema', 'migrations');

fs.mkdirSync(distDir, { recursive: true });
const files = fs.readdirSync(srcDir);
for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
}
console.log(`Copied ${files.length} migration files to dist/`);
