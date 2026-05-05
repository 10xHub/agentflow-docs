#!/usr/bin/env node
/**
 * Replace em dashes in prose with conventional punctuation.
 *
 *  " — and"        → ", and"           (connector word stays in same sentence)
 *  " — Word"       → ". Word"          (already capitalized → sentence break)
 *  " — word"       → ". Word"          (other lowercase → break + capitalize)
 *  "X—Y"           → "X, Y"            (no spaces)
 *  " —" end-of-line → "."
 *
 * SKIPS:
 *  - Fenced code blocks (``` ... ```)
 *  - Inline code (`...`)
 *  - YAML front-matter values for "keywords" lists (only rewrites title/description)
 *
 * Usage:
 *   node scripts/strip-em-dashes.mjs                # apply to default targets
 *   node scripts/strip-em-dashes.mjs --dry-run      # report only
 *   node scripts/strip-em-dashes.mjs path/to/file   # operate on specific paths
 */
import {readdir, readFile, writeFile, stat} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const TARGETS = args.length
  ? args.map((p) => resolve(root, p))
  : [
      resolve(root, 'docs/compare'),
      resolve(root, 'docs/use-cases'),
      resolve(root, 'docs/integrations'),
      resolve(root, 'blog'),
      resolve(root, 'src/pages'),
    ];

// Words that, when following an em dash, should keep the same sentence (use comma)
const CONNECTORS = new Set([
  'and', 'or', 'but', 'so', 'yet', 'nor', 'for',
  'with', 'without', 'plus', 'minus',
  'including', 'like', 'such',
  'also', 'then', 'because', 'while',
]);

async function walk(p) {
  const s = await stat(p);
  if (s.isFile()) return [p];
  const out = [];
  for (const e of await readdir(p, {withFileTypes: true})) {
    const full = resolve(p, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile() && /\.(mdx?|tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Replace em dashes in a single chunk of prose.
 *  mode='prose'   → use ". Sentence" or ", connector"
 *  mode='heading' → use ": " (single space, preserve case)
 */
function rewriteProse(text, mode = 'prose') {
  let s = text;

  if (mode === 'heading') {
    // "X — Y" → "X: Y"  (preserve case of Y)
    s = s.replace(/\s*—\s+/g, ': ');
    s = s.replace(/(\w)—(\w)/g, '$1: $2');
    s = s.replace(/^\s*—\s*/g, '');
    s = s.replace(/\s*—\s*$/g, '');
    return s;
  }

  // Prose mode

  // 1) " — Word" in the middle of a line → ". Word" or ", word" depending on connector
  s = s.replace(
    /\s*—\s+([A-Za-z])([\w'’-]*)/g,
    (_m, firstChar, rest) => {
      const word = (firstChar + rest).toLowerCase();
      const isConnector = CONNECTORS.has(word);
      if (isConnector) {
        return `, ${firstChar.toLowerCase()}${rest}`;
      }
      // Sentence break: capitalize the first character if it's lowercase
      return `. ${firstChar.toUpperCase()}${rest}`;
    },
  );

  // 2) " — " followed by punctuation/symbol (rare, e.g. " — `code`") → ". "
  s = s.replace(/\s*—\s+(?=[`*"({[])/g, '. ');

  // 3) End-of-string dangling em dash → "."
  s = s.replace(/\s*—\s*$/g, '.');

  // 4) "X—Y" no spaces → "X, Y"
  s = s.replace(/(\w)—(\w)/g, '$1, $2');

  // 5) Leading em dash at start of line → drop
  s = s.replace(/^\s*—\s*/g, '');

  // 6) Collapse stray " . " (space + period + space) artifacts
  s = s.replace(/ \. /g, '. ');

  return s;
}

/** Apply rewriteProse to text but keep inline-code spans untouched. */
function rewriteLineWithInlineCode(line) {
  const parts = line.split(/(`[^`\n]*`)/g);
  return parts.map((part, i) => (i % 2 === 1 ? part : rewriteProse(part))).join('');
}

function rewriteFile(src) {
  // Split off front-matter
  let fmText = '';
  let body = src;
  const fmMatch = src.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
  if (fmMatch) {
    fmText = fmMatch[1];
    body = src.slice(fmText.length);
  }

  // Body: process line-by-line, skipping fenced code blocks
  const lines = body.split('\n');
  const out = [];
  let inFence = false;
  let fenceChar = '';

  for (const line of lines) {
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)/);
    if (fenceMatch) {
      const ch = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Markdown headings (# ##  ###) use heading-mode rewriting (": " instead of ". ")
    if (/^\s{0,3}#{1,6}\s/.test(line)) {
      const parts = line.split(/(`[^`\n]*`)/g);
      out.push(
        parts.map((p, i) => (i % 2 === 1 ? p : rewriteProse(p, 'heading'))).join(''),
      );
      continue;
    }
    out.push(rewriteLineWithInlineCode(line));
  }

  // Front-matter: rewrite only `title:` and `description:` lines (not `keywords:` array)
  if (fmText) {
    fmText = fmText.replace(
      /^(title|description):[ \t]*(.+)$/gm,
      (_m, key, value) => {
        // Title is heading-like; description is prose
        const mode = key === 'title' ? 'heading' : 'prose';
        let next = rewriteProse(value, mode);
        // YAML treats `: ` mid-string as a mapping separator. If the rewritten
        // value contains `: ` and isn't already quoted, wrap it in double quotes.
        const isQuoted = /^["'].*["']$/.test(next);
        if (!isQuoted && / : | :$|: /.test(next)) {
          next = `"${next.replace(/"/g, '\\"')}"`;
        }
        return `${key}: ${next}`;
      },
    );
  }

  return fmText + out.join('\n');
}

let scanned = 0;
let changed = 0;
const fileList = (await Promise.all(TARGETS.map(walk))).flat();

for (const file of fileList) {
  scanned++;
  const src = await readFile(file, 'utf8');
  if (!src.includes('—')) continue;
  const next = rewriteFile(src);
  if (next === src) continue;
  changed++;
  const rel = relative(root, file).replace(/\\/g, '/');
  console.log(`${dryRun ? '[dry] ' : ''}rewrote ${rel}`);
  if (!dryRun) await writeFile(file, next, 'utf8');
}

console.log(`\nScanned ${scanned} files. ${changed} ${dryRun ? 'would be' : 'were'} rewritten.`);
