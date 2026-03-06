#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'prompts');
const distDir = path.join(__dirname, '..', 'dist', 'prompts');

fs.mkdirSync(distDir, { recursive: true });
const files = fs.readdirSync(srcDir);
for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
}
console.log(`Copied ${files.length} prompt files to dist/`);
