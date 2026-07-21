#!/usr/bin/env node
/**
 * External link checker.
 *
 * `onBrokenLinks: 'throw'` covers internal links at build time. Nothing covered
 * external ones, which is how the docs ended up pointing readers at
 * `playground.agentflow.dev` — a hostname that does not resolve.
 *
 * Checks every distinct external URL in docs/ and blog/ with a HEAD request,
 * falling back to GET for hosts that reject HEAD.
 *
 * Usage:
 *   node scripts/check-external-links.mjs            # report and exit 1 on failures
 *   node scripts/check-external-links.mjs --warn     # report but always exit 0
 */
import {readdir, readFile} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const warnOnly = process.argv.includes('--warn');
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

/**
 * Hosts that are examples, local, or intentionally unreachable from CI.
 * Anything matched here is never requested.
 */
const IGNORE = [
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/,
  /^https?:\/\/([\w.-]+\.)?example\.(com|org)/,
  /^https?:\/\/your-/,
  /^https?:\/\/[\w.-]*yourapp/,
  /^https?:\/\/collector/,
  /^https?:\/\/\.\.\./,
  /^https?:\/\/[\w.-]*\.internal/,
  /^https?:\/\/xyz\.qdrant\.io/,
  // Sites that block automated requests outright; a 403 here is not a broken link.
  /^https:\/\/www\.npmjs\.com/,
  /^https:\/\/x\.com/,
  /^https:\/\/twitter\.com/,
  /^https:\/\/www\.linkedin\.com/,
];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, {withFileTypes: true});
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.mdx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function extractUrls(text) {
  // Code is stripped first. A URL inside a fence is almost always an API
  // endpoint being called, not a link a reader can click, and endpoints
  // correctly answer 401/400 to an unauthenticated probe.
  const prose = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');

  // Markdown links, bare URLs in prose, and href attributes. Trailing
  // punctuation is stripped because prose puts periods after links.
  const found = new Set();
  for (const match of prose.matchAll(/https?:\/\/[^\s)"'`<>\]}]+/g)) {
    found.add(match[0].replace(/[.,;:]+$/, ''));
  }
  return found;
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {'user-agent': 'agentflow-docs-link-check'},
    });
    // Plenty of hosts answer HEAD with 403/404/405 and serve the page fine on
    // GET, so any failure is re-checked with GET and that answer is final.
    if (!res.ok) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {'user-agent': 'agentflow-docs-link-check'},
      });
    }
    return {ok: res.ok, status: res.status};
  } catch (error) {
    return {ok: false, status: error.name === 'AbortError' ? 'timeout' : 'unreachable'};
  } finally {
    clearTimeout(timer);
  }
}

const files = [...(await walk(resolve(root, 'docs'))), ...(await walk(resolve(root, 'blog')))];
const urls = new Map(); // url -> [file, ...]

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const text = await readFile(file, 'utf8');
  for (const url of extractUrls(text)) {
    if (IGNORE.some((pattern) => pattern.test(url))) continue;
    if (!urls.has(url)) urls.set(url, []);
    urls.get(url).push(rel);
  }
}

const targets = [...urls.keys()].sort();
console.log(`Checking ${targets.length} external URLs from ${files.length} files...\n`);

const failures = [];
let index = 0;

async function worker() {
  while (index < targets.length) {
    const url = targets[index++];
    const {ok, status} = await probe(url);
    if (!ok) failures.push({url, status, files: urls.get(url)});
    process.stdout.write(ok ? '.' : 'x');
  }
}

await Promise.all(Array.from({length: CONCURRENCY}, worker));
console.log('\n');

if (failures.length === 0) {
  console.log(`OK — all ${targets.length} external links resolve.`);
  process.exit(0);
}

for (const {url, status, files: sources} of failures) {
  console.log(`${String(status).padEnd(12)} ${url}`);
  for (const source of sources.slice(0, 5)) console.log(`             ${source}`);
  if (sources.length > 5) console.log(`             ...and ${sources.length - 5} more`);
}
console.log(`\n${failures.length} of ${targets.length} external links failed.`);
process.exit(warnOnly ? 0 : 1);
