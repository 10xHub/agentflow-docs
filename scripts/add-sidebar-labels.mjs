#!/usr/bin/env node
/**
 * Add `sidebar_label:` to every doc that doesn't have one yet.
 *
 * The SEO `title:` field is keyword-rich (e.g. "Get Started — AgentFlow Python
 * AI Agent Framework"), which is great for Google but ugly in the sidebar.
 * Docusaurus uses `sidebar_label:` if set, falling back to `title:` otherwise.
 *
 * This script extracts a clean short label by taking everything before the
 * first ` — ` / ` | ` / ` : ` separator in the title.
 *
 * Usage:
 *   node scripts/add-sidebar-labels.mjs            # apply
 *   node scripts/add-sidebar-labels.mjs --dry-run  # report only
 */
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const docsDir = resolve(root, 'docs');
const dryRun = process.argv.includes('--dry-run');

async function walk(dir) {
  const entries = await readdir(dir, {withFileTypes: true});
  const out = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.mdx')))
      out.push(full);
  }
  return out;
}

/** Extract a short, sidebar-friendly label from a title string. */
function shortLabel(title, filePath) {
  if (!title) return '';
  let s = title.trim();
  // Strip surrounding quotes if YAML-quoted
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  // Take everything before the first separator: ` — `, ` | `, or `: ` (colon+space, no leading-space requirement)
  const sepRegex = /\s+—\s+|\s+\|\s+|:\s+/;
  s = s.split(sepRegex)[0].trim();

  const rel = filePath.replace(/\\/g, '/');

  // Compare pages: "AgentFlow vs X" → "vs X"
  if (rel.includes('/docs/compare/')) {
    s = s.replace(/^AgentFlow\s+/i, '');
    // Roundup index has no "vs"
    if (s === 'Compared' || s.toLowerCase().startsWith('best ')) s = 'Overview';
    if (rel.endsWith('best-python-agent-framework-2026.mdx')) s = '2026 roundup';
    if (rel.endsWith('compare/index.md')) s = 'Overview';
  }

  // Use-cases: "Build a X AI Agent" / "Build a X" → "X"
  if (rel.includes('/docs/use-cases/')) {
    s = s.replace(/^Build a\s+/i, '');
    s = s.replace(/\s+AI Agent.*$/i, '');
    s = s.replace(/\s+in Python.*$/i, '');
    if (rel.endsWith('use-cases/index.md')) s = 'Overview';
  }

  // Integrations: "AgentFlow with X" → "with X"
  if (rel.includes('/docs/integrations/')) {
    s = s.replace(/^AgentFlow\s+/i, '');
    if (rel.endsWith('integrations/index.md')) s = 'Overview';
  }

  return s;
}

let scanned = 0;
let updated = 0;
const files = await walk(docsDir);

for (const file of files) {
  scanned++;
  const src = await readFile(file, 'utf8');
  if (!src.startsWith('---')) continue;

  const fmEnd = src.indexOf('\n---', 3);
  if (fmEnd === -1) continue;

  const fmText = src.slice(3, fmEnd);
  const body = src.slice(fmEnd);

  // Skip if sidebar_label already set
  if (/^sidebar_label\s*:/m.test(fmText)) continue;

  // Find title line
  const titleMatch = fmText.match(/^title\s*:\s*(.+)$/m);
  if (!titleMatch) continue;

  const label = shortLabel(titleMatch[1], file);
  if (!label) continue;

  // YAML safety: quote if contains ':' or is a YAML special value
  const needsQuote = /[":#&*!|>'%@`]/.test(label) || /^(true|false|null|yes|no|~)$/i.test(label) || label.includes(': ');
  const yamlValue = needsQuote ? JSON.stringify(label) : label;

  // Insert after the title line
  const newFm = fmText.replace(
    /^(title\s*:\s*.+)$/m,
    `$1\nsidebar_label: ${yamlValue}`,
  );

  const next = '---' + newFm + body;
  const rel = relative(root, file).replace(/\\/g, '/');
  console.log(`${dryRun ? '[dry] ' : ''}+ sidebar_label "${label}" → ${rel}`);
  if (!dryRun) await writeFile(file, next, 'utf8');
  updated++;
}

console.log(
  `\nScanned ${scanned} files. ${updated} ${dryRun ? 'would get' : 'got'} a sidebar_label.`,
);
