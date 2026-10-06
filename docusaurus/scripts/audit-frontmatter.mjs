#!/usr/bin/env node
/**
 * Front-matter SEO linter for AgentFlow docs.
 *
 * Walks docs/ and reports markdown files where:
 *   - title, description, or keywords are missing            -> error, fails CI
 *   - title or description length is outside the search-result
 *     display window                                          -> warning only
 *
 * Length is deliberately a warning. Failing CI on a short description is what
 * produced the "Part of the AgentFlow <keyword> guide for." padding sentence
 * across 85 pages. A short, honest description beats a padded one.
 *
 * Usage: node scripts/audit-frontmatter.mjs [--strict]
 *   --strict  also fail on length warnings
 */
import {readdir, readFile} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const docsDir = resolve(root, 'docs');

/** Docusaurus appends " | AgentFlow" (12 chars) to every page title. */
const TITLE_MIN = 10;
const TITLE_MAX = 65;
const DESC_MIN = 60;
const DESC_MAX = 165;

const strict = process.argv.includes('--strict');

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
let errorCount = 0;
let warnCount = 0;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const src = await readFile(file, 'utf8');
  const fm = parseFrontMatter(src);
  const errs = [];
  const warns = [];

  if (!fm) {
    errs.push('missing front matter');
  } else {
    const title = typeof fm.title === 'string' ? fm.title : '';
    const desc = typeof fm.description === 'string' ? fm.description : '';
    if (!title) errs.push('title missing');
    else if (title.length > TITLE_MAX)
      warns.push(`title ${title.length} chars (max ${TITLE_MAX})`);
    else if (title.length < TITLE_MIN)
      warns.push(`title ${title.length} chars (min ${TITLE_MIN})`);

    if (!desc) errs.push('description missing');
    else if (desc.length > DESC_MAX)
      warns.push(`description ${desc.length} chars (max ${DESC_MAX})`);
    else if (desc.length < DESC_MIN)
      warns.push(`description ${desc.length} chars (min ${DESC_MIN})`);

    if (!Array.isArray(fm.keywords) || fm.keywords.length === 0)
      errs.push('keywords missing');
  }

  errorCount += errs.length;
  warnCount += warns.length;
  if (errs.length || warns.length) issues.push({file: rel, errs, warns});
}

if (issues.length === 0) {
  console.log(`OK — all ${files.length} doc files pass front-matter checks.`);
  process.exit(0);
}

console.log(`Front-matter report for ${files.length} doc files:\n`);
for (const {file, errs, warns} of issues) {
  console.log(`  ${file}`);
  for (const e of errs) console.log(`    error   ${e}`);
  for (const w of warns) console.log(`    warning ${w}`);
}
console.log(
  `\n${errorCount} error(s), ${warnCount} warning(s). ` +
    `Guidance: title ${TITLE_MIN}-${TITLE_MAX} chars, description ${DESC_MIN}-${DESC_MAX} chars, keywords array required.`,
);
process.exit(errorCount > 0 || (strict && warnCount > 0) ? 1 : 0);
