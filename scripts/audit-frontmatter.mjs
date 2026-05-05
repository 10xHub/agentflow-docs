#!/usr/bin/env node
/**
 * Front-matter SEO linter for AgentFlow docs.
 *
 * Walks docs/ and reports markdown files where:
 *   - title is missing, > 60 chars, or < 25 chars
 *   - description is missing, > 160 chars, or < 100 chars
 *   - keywords array is missing
 *
 * Exit code 1 on any error so CI can gate merges.
 *
 * Usage: node scripts/audit-frontmatter.mjs [--fix-missing]
 */
import {readdir, readFile} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const docsDir = resolve(root, 'docs');

const TITLE_MIN = 25;
const TITLE_MAX = 60;
const DESC_MIN = 100;
const DESC_MAX = 160;

async function walk(dir) {
  const entries = await readdir(dir, {withFileTypes: true});
  const files = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.mdx')))
      files.push(full);
  }
  return files;
}

function parseFrontMatter(src) {
  if (!src.startsWith('---')) return null;
  const end = src.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = src.slice(3, end).trim();
  const fm = {};
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const [, key, raw] = m;
    let val = raw.trim();
    if (val === '') {
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, ''));
        j++;
      }
      if (items.length) {
        fm[key] = items;
        i = j;
        continue;
      }
    }
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val.startsWith('[') && val.endsWith(']'))
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    fm[key] = val;
    i++;
  }
  return fm;
}

const issues = [];
const files = await walk(docsDir);

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const src = await readFile(file, 'utf8');
  const fm = parseFrontMatter(src);
  const errs = [];

  if (!fm) {
    errs.push('missing front matter');
  } else {
    const title = typeof fm.title === 'string' ? fm.title : '';
    const desc = typeof fm.description === 'string' ? fm.description : '';
    if (!title) errs.push('title missing');
    else if (title.length > TITLE_MAX)
      errs.push(`title ${title.length} chars (max ${TITLE_MAX})`);
    else if (title.length < TITLE_MIN)
      errs.push(`title ${title.length} chars (min ${TITLE_MIN})`);

    if (!desc) errs.push('description missing');
    else if (desc.length > DESC_MAX)
      errs.push(`description ${desc.length} chars (max ${DESC_MAX})`);
    else if (desc.length < DESC_MIN)
      errs.push(`description ${desc.length} chars (min ${DESC_MIN})`);

    if (!Array.isArray(fm.keywords) || fm.keywords.length === 0)
      errs.push('keywords missing');
  }

  if (errs.length) issues.push({file: rel, errs});
}

if (issues.length === 0) {
  console.log(`OK — all ${files.length} doc files pass SEO front-matter checks.`);
  process.exit(0);
}

console.log(`SEO front-matter issues in ${issues.length}/${files.length} files:\n`);
for (const {file, errs} of issues) {
  console.log(`  ${file}`);
  for (const e of errs) console.log(`    - ${e}`);
}
console.log(
  `\nFix targets: title ${TITLE_MIN}-${TITLE_MAX} chars, description ${DESC_MIN}-${DESC_MAX} chars, keywords array.`,
);
process.exit(1);
