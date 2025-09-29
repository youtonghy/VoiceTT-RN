#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const roots = ['app', 'components', 'contexts', 'hooks', 'services', 'types'];
const cjkRegex = /[\u3400-\u9FFF]/;
const offenders = [];

const shouldScan = (filePath) => {
  return ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(filePath));
};

const walk = (dir) => {
  if (!fs.existsSync(dir)) {
    return;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && shouldScan(fullPath)) {
      const contents = fs.readFileSync(fullPath, 'utf8');
      if (cjkRegex.test(contents)) {
        offenders.push(fullPath);
      }
    }
  }
};

roots.forEach(walk);

if (offenders.length > 0) {
  console.error('Found hard-coded CJK characters in:\n' + offenders.join('\n'));
  process.exit(1);
}

