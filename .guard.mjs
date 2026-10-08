// Temporary: keeps docs frontmatter build-safe while pages are being rewritten. Deleted afterwards.
// Parses with js-yaml (the parser Astro uses) and applies the schema limits from content.config.ts.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const DOCS = 'src/content/docs';
const BACKUP = process.argv[2]; // last known-good tree (frontmatter fallback)
const LOG = process.argv[3];
const SECTIONS = ['Get started','Concepts','Build agents','API server','TypeScript client','Testing and evaluation','Integrations','Examples','Reference','Troubleshooting','Glossary','Compare','Project'];
const KEYS = new Set(['title','seoTitle','description','section','group','label','order','updated','faq','draft','slug']);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const clip = (s, n) => { if (s.length <= n) return s; const c = s.slice(0, n); const i = c.lastIndexOf('.'); return i >= 50 ? c.slice(0, i + 1) : c.slice(0, c.lastIndexOf(' ')).replace(/[,;:]$/, '') + '.'; };

function problems(fm) {
  const p = [];
  if (typeof fm.title !== 'string') p.push('title');
  if (typeof fm.description !== 'string' || fm.description.length < 50 || fm.description.length > 170) p.push('description');
  if (fm.seoTitle != null && (typeof fm.seoTitle !== 'string' || fm.seoTitle.length < 15 || fm.seoTitle.length > 49)) p.push('seoTitle');
  if (!SECTIONS.includes(fm.section)) p.push('section');
  if (fm.order != null && typeof fm.order !== 'number') p.push('order');
  if (fm.faq != null && (!Array.isArray(fm.faq) || fm.faq.some((f) => !f || typeof (f.q ?? f.question) !== 'string' || typeof (f.a ?? f.answer) !== 'string'))) p.push('faq');
  if (fm.updated != null && isNaN(new Date(fm.updated))) p.push('updated');
  return p;
}

function repair(fm) {
  for (const k of Object.keys(fm)) if (!KEYS.has(k)) delete fm[k];
  if (typeof fm.description === 'string' && fm.description.length > 170) fm.description = clip(fm.description, 170);
  if (fm.seoTitle != null && (typeof fm.seoTitle !== 'string' || fm.seoTitle.length > 49 || fm.seoTitle.length < 15)) delete fm.seoTitle;
  if (Array.isArray(fm.faq)) fm.faq = fm.faq.filter((f) => f && typeof (f.q ?? f.question) === 'string' && typeof (f.a ?? f.answer) === 'string').map((f) => ({ q: f.q ?? f.question, a: f.a ?? f.answer }));
  else delete fm.faq;
  return fm;
}

function pass() {
  const log = [];
  for (const file of walk(DOCS).filter((f) => /\.mdx?$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    const rel = path.relative(DOCS, file);
    let fm = null;
    try { fm = m ? yaml.load(m[1]) : null; } catch { fm = null; }
    if (fm && typeof fm === 'object' && problems(fm).length === 0) continue;
    let fixed = fm && typeof fm === 'object' ? repair({ ...fm }) : null;
    if (!fixed || problems(fixed).length) {
      // Fall back to the last known-good frontmatter for this page, keeping the new body.
      const b = path.join(BACKUP, rel);
      const bm = fs.existsSync(b) && fs.readFileSync(b, 'utf8').match(/^---\n([\s\S]*?)\n---\n?/);
      let good = null;
      try { good = bm ? yaml.load(bm[1]) : null; } catch {}
      if (!good) { log.push(`${rel}: UNFIXABLE`); continue; }
      fixed = repair({ ...good, ...(fixed || {}) });
      if (problems(fixed).length) fixed = repair(good);
    }
    const body = m ? text.slice(m[0].length) : text;
    fs.writeFileSync(file, `---\n${yaml.dump(fixed, { lineWidth: -1 }).trimEnd()}\n---\n${body}`);
    log.push(`${rel}: repaired`);
  }
  if (log.length) fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${log.join('; ')}\n`);
}

pass();
if (!process.argv.includes('--once')) setInterval(pass, 3000);
