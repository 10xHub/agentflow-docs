#!/usr/bin/env node
/**
 * One-off cleanup for machine-generated front matter.
 *
 * Two problems this fixes across docs/:
 *
 *  1. `title:` values all ended with the same keyword-stuffed suffix
 *     ("— AgentFlow Python AI Agent Framework"), which duplicated the site
 *     title that Docusaurus already appends and pushed <title> past 60 chars.
 *     Each section now gets a short, honest qualifier instead.
 *
 *  2. `description:` values had a boilerplate sentence appended to pad them to
 *     100 characters ("Part of the AgentFlow <keyword> guide for."). Many were
 *     truncated mid-sentence and read as broken English. The padding sentence
 *     is removed; the hand-written first sentence is kept as-is.
 *
 * Safe to re-run: both transformations are idempotent.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {readdirSync, statSync} from 'node:fs';
import {join, resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'docs');

/** Longest-prefix match wins. */
const SECTION_SUFFIX = [
  ['reference/python', 'Python API reference'],
  ['reference/client', 'TypeScript client reference'],
  ['reference/rest-api', 'REST API reference'],
  ['reference/api-cli', 'CLI reference'],
  ['how-to/python', 'AgentFlow how-to'],
  ['how-to/client', 'TypeScript client how-to'],
  ['how-to/api-cli', 'CLI how-to'],
  ['how-to/production', 'Production how-to'],
  ['concepts', 'AgentFlow concepts'],
  ['tutorials', 'AgentFlow tutorial'],
  ['courses', 'GenAI course'],
  ['qa', 'Testing and evaluation'],
  ['prebuild/agents', 'Prebuilt agents'],
  ['prebuild/tools', 'Prebuilt tools'],
  ['troubleshooting', 'Troubleshooting'],
  ['get-started', 'Get started'],
  ['beginner', 'Beginner path'],
  ['use-cases', 'Use case'],
  ['integrations', 'Integration guide'],
  ['providers', 'Model providers'],
  ['skills', 'Agent skills'],
];

/** Titles ending in one of these generic suffixes get re-qualified. */
const TITLE_BOILERPLATE =
  /\s*[—-]\s*AgentFlow (?:Python AI Agent Framework|Python AI Agents|Evaluation)\s*$/;

/** Padding sentence appended by the old fix-frontmatter script. */
const DESC_BOILERPLATE = /\s*Part of the AgentFlow .*$/;

function suffixFor(relPath) {
  const match = SECTION_SUFFIX.filter(([prefix]) => relPath.startsWith(prefix)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  return match?.[1];
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.mdx?$/.test(entry) ? [full] : [];
  });
}

let titlesFixed = 0;
let descriptionsFixed = 0;
const touched = [];

for (const file of walk(docsDir)) {
  const relPath = relative(docsDir, file);
  const original = await readFile(file, 'utf8');
  if (!original.startsWith('---')) continue;

  const end = original.indexOf('\n---', 3);
  if (end === -1) continue;

  let frontmatter = original.slice(0, end);
  const body = original.slice(end);
  let changed = false;

  frontmatter = frontmatter.replace(/^title:\s*(.+)$/m, (line, rawValue) => {
    const quote = /^["'].*["']$/.test(rawValue.trim()) ? rawValue.trim()[0] : '';
    const value = quote ? rawValue.trim().slice(1, -1) : rawValue.trim();
    if (!TITLE_BOILERPLATE.test(value)) return line;

    const base = value.replace(TITLE_BOILERPLATE, '').trim();
    const suffix = suffixFor(relPath);
    const next = suffix ? `${base} — ${suffix}` : base;
    titlesFixed += 1;
    changed = true;
    // Re-quote when the value contains a colon, which YAML would misread.
    const needsQuote = /:\s/.test(next) || next.includes('#');
    return `title: ${needsQuote ? JSON.stringify(next) : next}`;
  });

  frontmatter = frontmatter.replace(/^description:\s*(.+)$/m, (line, rawValue) => {
    const quote = /^["'].*["']$/.test(rawValue.trim()) ? rawValue.trim()[0] : '';
    const value = quote ? rawValue.trim().slice(1, -1) : rawValue.trim();
    if (!DESC_BOILERPLATE.test(value)) return line;

    const next = value.replace(DESC_BOILERPLATE, '').trim();
    descriptionsFixed += 1;
    changed = true;
    const needsQuote = /:\s/.test(next) || next.includes('#');
    return `description: ${needsQuote ? JSON.stringify(next) : next}`;
  });

  if (changed) {
    await writeFile(file, frontmatter + body);
    touched.push(relPath);
  }
}

console.log(`Rewrote ${titlesFixed} titles and ${descriptionsFixed} descriptions`);
console.log(`Files touched: ${touched.length}`);
