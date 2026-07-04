#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const roots = ['app', 'components', 'contexts', 'hooks', 'services', 'types'];
const localeRoot = path.join('src', 'locales');
const baseLocale = 'en';
const cjkRegex = /[\u3400-\u9FFF]/;
const offenders = [];
const localeErrors = [];

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
}

const flattenKeys = (value, prefix = '', output = new Map()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenKeys(child, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }
  output.set(prefix, String(value ?? ''));
  return output;
};

const extractVariables = (value) => {
  const variables = new Set();
  const regex = /{{\s*([A-Za-z0-9_]+)\s*}}/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables).sort();
};

const readLocale = (locale) => {
  const filePath = path.join(localeRoot, locale, 'common.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

if (fs.existsSync(localeRoot)) {
  const locales = fs
    .readdirSync(localeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const base = flattenKeys(readLocale(baseLocale));
  const baseKeys = Array.from(base.keys()).sort();

  for (const locale of locales) {
    if (locale === baseLocale) {
      continue;
    }
    const current = flattenKeys(readLocale(locale));
    const currentKeys = Array.from(current.keys()).sort();
    const missing = baseKeys.filter((key) => !current.has(key));
    const extra = currentKeys.filter((key) => !base.has(key));
    if (missing.length > 0) {
      localeErrors.push(`${locale} missing keys:\n${missing.map((key) => `  - ${key}`).join('\n')}`);
    }
    if (extra.length > 0) {
      localeErrors.push(`${locale} extra keys:\n${extra.map((key) => `  - ${key}`).join('\n')}`);
    }
    for (const key of baseKeys) {
      if (!current.has(key)) {
        continue;
      }
      const expected = extractVariables(base.get(key));
      const actual = extractVariables(current.get(key));
      if (expected.join(',') !== actual.join(',')) {
        localeErrors.push(
          `${locale} interpolation mismatch at ${key}: expected [${expected.join(', ')}], got [${actual.join(', ')}]`
        );
      }
    }
  }
}

if (localeErrors.length > 0) {
  console.error('Found locale key mismatches:\n' + localeErrors.join('\n\n'));
}

if (offenders.length > 0 || localeErrors.length > 0) {
  process.exit(1);
}
