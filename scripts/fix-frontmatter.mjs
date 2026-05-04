#!/usr/bin/env node
/**
 * Auto-fill missing or undersized SEO front-matter across docs/.
 *
 * For each .md / .mdx file under docs/, this:
 *   - Parses existing front-matter (preserves all keys we don't touch)
 *   - Fills `title` if missing/too-short/too-long, derived from H1 or slug
 *   - Fills `description` if missing/too-short, derived from first paragraph
 *   - Fills `keywords` if missing, derived from path-segment keyword cluster
 *
 * Conservative: never overwrites a good existing value. Idempotent.
 *
 * Usage:
 *   node scripts/fix-frontmatter.mjs            # apply changes
 *   node scripts/fix-frontmatter.mjs --dry-run  # report only
 */
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const docsDir = resolve(root, 'docs');
const dryRun = process.argv.includes('--dry-run');

const TITLE_MIN = 25;
const TITLE_MAX = 60;
const DESC_MIN = 100;
const DESC_MAX = 160;

// Brand suffixes (longest first). Picked based on whether title already has "agentflow".
// Docusaurus auto-appends " | AgentFlow" to every <title>, so we deliberately avoid that
// exact suffix to prevent rendering "X | AgentFlow | AgentFlow".
const SUFFIXES_NO_BRAND = [
  ' — AgentFlow Python AI Agent Framework',
  ' — AgentFlow Python AI Agents',
  ' for AgentFlow',
  ' in AgentFlow',
];
const SUFFIXES_HAS_BRAND = [
  ' — Python AI Agent Framework Documentation',
  ' — Python AI Agent Framework',
  ' — Python AI Agents',
  ' Documentation',
];

// Keyword clusters per top-level docs section. Order matters (most-specific first).
const SECTION_KEYWORDS = {
  'get-started': ['agentflow get started', 'python ai agent setup', 'agentflow installation'],
  beginner: ['ai agents for beginners', 'first ai agent python', 'agentflow tutorial'],
  concepts: ['agentflow concepts', 'agent architecture', 'multi-agent orchestration'],
  'how-to/api-cli': ['agentflow api', 'agentflow cli', 'agent rest api'],
  'how-to/client': ['agentflow typescript client', 'ai agent client', 'agent sdk'],
  'how-to/python': ['agentflow python', 'python ai agent guide', 'multi-agent python'],
  'how-to/production': ['production ai agents', 'agent deployment', 'agent observability'],
  providers: ['llm providers', 'ai model providers', 'agentflow providers'],
  'reference/api-cli': ['agentflow api reference', 'rest api documentation', 'agent cli reference'],
  'reference/client': ['typescript client reference', 'agent client api', 'agentflow client sdk'],
  'reference/python': ['agentflow python reference', 'agent api reference', 'python agent library'],
  'reference/rest-api': ['rest api reference', 'agent http api', 'agentflow rest endpoints'],
  tutorials: ['ai agent tutorial', 'multi-agent tutorial', 'agentflow examples'],
  courses: ['genai course', 'ai agent course', 'agent engineering course'],
  troubleshooting: ['agentflow troubleshooting', 'agent debugging', 'ai agent errors'],
  compare: ['python ai agent framework comparison', 'langgraph alternative', 'agentflow vs', 'best agent framework'],
};

const BASE_KEYWORDS = ['agentflow', 'python ai agent framework'];

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

function splitFrontMatter(src) {
  if (!src.startsWith('---\n') && !src.startsWith('---\r\n')) return {fm: '', body: src};
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return {fm: '', body: src};
  return {fm: m[1], body: src.slice(m[0].length)};
}

function parseFm(fmText) {
  const out = {};
  const order = [];
  if (!fmText) return {data: out, order};
  let i = 0;
  const lines = fmText.split(/\r?\n/);
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const [, key, rawVal] = m;
    let val = rawVal;
    // Block list (next lines starting with `  -`)
    if (val === '' || val === '|' || val === '>') {
      // First check if next lines are a YAML list (`  - item`) — those are arrays
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, ''));
        j++;
      }
      if (items.length) {
        out[key] = items;
        order.push(key);
        i = j;
        continue;
      }
      // Otherwise treat as multi-line scalar — join indented lines as a string
      const buf = [];
      i++;
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      out[key] = buf.join(' ');
      order.push(key);
      continue;
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      // Look ahead for inline list (next lines `  - item`)
      const peek = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        peek.push(lines[j].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, ''));
        j++;
      }
      if (peek.length && val === '') {
        val = peek;
        i = j - 1;
      } else {
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      }
    }
    out[key] = val;
    order.push(key);
    i++;
  }
  return {data: out, order};
}

function escapeYamlString(s) {
  if (typeof s !== 'string') return JSON.stringify(s);
  if (/[:#\[\]{}&*!|>'"%@`]/.test(s) || s.includes(': ') || s.includes(' #')) {
    return JSON.stringify(s);
  }
  return s;
}

function serializeFm(data, order) {
  const out = [];
  const seen = new Set();
  const emit = (k) => {
    if (!(k in data)) return;
    seen.add(k);
    const v = data[k];
    if (Array.isArray(v)) {
      out.push(`${k}:`);
      for (const item of v) out.push(`  - ${escapeYamlString(item)}`);
    } else if (typeof v === 'string') {
      out.push(`${k}: ${escapeYamlString(v)}`);
    } else {
      out.push(`${k}: ${JSON.stringify(v)}`);
    }
  };
  for (const k of order) if (!seen.has(k)) emit(k);
  for (const k of Object.keys(data)) if (!seen.has(k)) emit(k);
  return out.join('\n');
}

function firstH1(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

function firstParagraph(body) {
  const stripped = body
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/^import\s+.+?from\s+['"].+?['"];?\s*$/gm, '')
    .replace(/^#\s+.+$/m, '')
    .replace(/^:::[a-z]+[\s\S]*?:::\s*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim();
  // Take first non-empty paragraph
  for (const para of stripped.split(/\n\s*\n/)) {
    const flat = para
      .replace(/^>\s*/gm, '')
      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (flat.length >= 20 && !/^[#=*-]/.test(flat)) return flat;
  }
  return '';
}

function slugTitle(filePath) {
  const rel = relative(docsDir, filePath).replace(/\.mdx?$/, '');
  const segs = rel.split(sep);
  const last = segs[segs.length - 1] === 'index' ? segs[segs.length - 2] : segs[segs.length - 1];
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionKey(filePath) {
  const rel = relative(docsDir, filePath).replace(/\\/g, '/');
  // Match longest section prefix
  const candidates = Object.keys(SECTION_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const k of candidates) if (rel.startsWith(`${k}/`) || rel === `${k}.md` || rel === `${k}.mdx`) return k;
  const top = rel.split('/')[0];
  return SECTION_KEYWORDS[top] ? top : '';
}

function stripBrandSuffix(s) {
  // Remove pre-existing brand suffixes so we don't double-stack on re-runs
  return s
    .replace(/\s*\|\s*AgentFlow\s*$/i, '')
    .replace(/\s*[—–-]\s*AgentFlow.*$/i, '')
    .replace(/\s*[—–-]\s*Python AI Agent.*$/i, '')
    .replace(/\s*[—–-]\s*Documentation\s*$/i, '')
    .replace(/\s+for AgentFlow\s*$/i, '')
    .replace(/\s+in AgentFlow\s*$/i, '')
    .replace(/\s+Documentation\s*$/i, '')
    .trim();
}

function pickSuffix(base) {
  const hasBrand = /agentflow/i.test(base);
  const list = hasBrand ? SUFFIXES_HAS_BRAND : SUFFIXES_NO_BRAND;
  for (const suffix of list) {
    const candidate = `${base}${suffix}`;
    if (candidate.length >= TITLE_MIN && candidate.length <= TITLE_MAX) return candidate;
  }
  // Fall back to the shortest suffix even if it leaves us below TITLE_MIN
  return `${base}${list[list.length - 1]}`;
}

function buildTitle(existing, body, filePath) {
  // First check: if existing fits and has no doubled-brand pattern or pipe-AgentFlow
  // suffix (which Docusaurus auto-appends, causing "X | AgentFlow | AgentFlow"), keep it.
  if (
    typeof existing === 'string' &&
    existing.length >= TITLE_MIN &&
    existing.length <= TITLE_MAX &&
    !/agentflow.*agentflow/i.test(existing) &&
    !/\|\s*AgentFlow\s*$/i.test(existing)
  ) {
    return {value: existing, changed: false};
  }
  const h1 = firstH1(body);
  const slug = slugTitle(filePath);
  const rawCandidates = [
    typeof existing === 'string' && existing.length ? stripBrandSuffix(existing) : '',
    h1,
    slug,
  ].filter(Boolean);
  // First try any candidate that already fits 25-60 chars without modification
  for (const c of rawCandidates) {
    if (c.length >= TITLE_MIN && c.length <= TITLE_MAX) return {value: c, changed: c !== existing};
  }
  // Otherwise pad the longest sub-min candidate with a brand suffix
  const subMin = rawCandidates.filter((c) => c.length < TITLE_MIN).sort((a, b) => b.length - a.length);
  if (subMin.length) {
    const padded = pickSuffix(subMin[0]);
    return {value: padded, changed: padded !== existing};
  }
  // Truncate over-long candidates at a word boundary
  for (const c of rawCandidates) {
    if (c.length > TITLE_MAX) {
      const trimmed = c.slice(0, TITLE_MAX).replace(/\s+\S*$/, '').trim();
      if (trimmed.length >= TITLE_MIN) return {value: trimmed, changed: trimmed !== existing};
    }
  }
  const fallback = pickSuffix(slug);
  return {value: fallback, changed: fallback !== existing};
}

function stripDescTail(s) {
  // Remove tails added by previous runs of this script so we don't stack them
  return s
    .replace(/\s+Part of the AgentFlow .*$/i, '')
    .replace(/\s+AgentFlow is an open-source Python framework.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampDescription(s) {
  if (s.length <= DESC_MAX) return s;
  const cut = s.slice(0, DESC_MAX);
  const lastSentence = cut.match(/^.*[.!?](?=\s|$)/);
  if (lastSentence && lastSentence[0].length >= DESC_MIN) return lastSentence[0].trim();
  const wordBoundary = cut.replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '').trim();
  return wordBoundary.endsWith('.') ? wordBoundary : `${wordBoundary}.`;
}

function buildDescription(existing, body, title, filePath) {
  if (
    typeof existing === 'string' &&
    existing.length >= DESC_MIN &&
    existing.length <= DESC_MAX &&
    !/  +/.test(existing) &&
    !/Part of the AgentFlow .* guide/i.test(existing)
  ) {
    return {value: existing, changed: false};
  }
  const para = firstParagraph(body);
  const section = sectionKey(filePath);
  const sectionWord =
    section && SECTION_KEYWORDS[section] ? SECTION_KEYWORDS[section][0] : 'agentflow docs';

  let candidate = stripDescTail((typeof existing === 'string' && existing.trim()) || para || '');
  candidate = clampDescription(candidate);

  if (candidate.length < DESC_MIN) {
    const stem = candidate.replace(/[.\s]+$/, '');
    const tail = `Part of the AgentFlow ${sectionWord} guide for production-ready Python AI agents.`;
    candidate = stem ? `${stem}. ${tail}` : tail;
  }
  if (candidate.length < DESC_MIN) {
    candidate = `${title}. AgentFlow is an open-source Python framework for building production-ready multi-agent systems with memory, streaming, and an API.`;
  }
  candidate = clampDescription(candidate);
  return {value: candidate, changed: candidate !== existing};
}

function buildKeywords(existing, filePath, title) {
  if (Array.isArray(existing) && existing.length >= 3) {
    return {value: existing, changed: false};
  }
  const section = sectionKey(filePath);
  const sectionTerms = section ? SECTION_KEYWORDS[section] ?? [] : [];
  const titleKw = stripBrandSuffix(title || '')
    .toLowerCase()
    .replace(/[?!.,:;"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const merged = [...new Set([...sectionTerms, ...BASE_KEYWORDS, titleKw].filter(Boolean))].slice(0, 6);
  return {value: merged, changed: true};
}

let updated = 0;
let unchanged = 0;
const files = await walk(docsDir);

for (const file of files) {
  const src = await readFile(file, 'utf8');
  const {fm: fmText, body} = splitFrontMatter(src);
  const {data, order} = parseFm(fmText);

  const titleResult = buildTitle(data.title, body, file);
  const descResult = buildDescription(data.description, body, titleResult.value, file);
  const kwResult = buildKeywords(data.keywords, file, titleResult.value);

  let changed = false;
  if (titleResult.changed) {
    data.title = titleResult.value;
    if (!order.includes('title')) order.unshift('title');
    changed = true;
  }
  if (descResult.changed) {
    data.description = descResult.value;
    if (!order.includes('description')) {
      const ti = order.indexOf('title');
      order.splice(ti >= 0 ? ti + 1 : order.length, 0, 'description');
    }
    changed = true;
  }
  if (kwResult.changed) {
    data.keywords = kwResult.value;
    if (!order.includes('keywords')) {
      const di = order.indexOf('description');
      order.splice(di >= 0 ? di + 1 : order.length, 0, 'keywords');
    }
    changed = true;
  }

  if (!changed) {
    unchanged++;
    continue;
  }

  const newFm = serializeFm(data, order);
  const newSrc = `---\n${newFm}\n---\n\n${body.replace(/^\n+/, '')}`;
  if (!dryRun) await writeFile(file, newSrc, 'utf8');
  updated++;
  const rel = relative(root, file).replace(/\\/g, '/');
  console.log(`${dryRun ? '[dry] ' : ''}updated ${rel}`);
}

console.log(`\n${updated} file(s) ${dryRun ? 'would be ' : ''}updated, ${unchanged} unchanged.`);
