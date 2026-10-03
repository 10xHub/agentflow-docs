import { getCollection, type CollectionEntry } from 'astro:content';
import { DOC_SECTIONS, SITE } from './site';

export type Doc = CollectionEntry<'docs'>;
export type Post = CollectionEntry<'blog'>;

const sectionRank = (s: Doc['data']['section']) => DOC_SECTIONS.indexOf(s);

export async function getDocs(): Promise<Doc[]> {
  const docs = await getCollection('docs', (e: Doc) => !e.data.draft);
  return docs.sort(
    (a: Doc, b: Doc) =>
      sectionRank(a.data.section) - sectionRank(b.data.section) ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title),
  );
}

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', (e: Post) => !e.data.draft);
  return posts.sort((a: Post, b: Post) => b.data.date.getTime() - a.data.date.getTime());
}

/** Tags across all posts with their post counts, most used first. */
export function getTags(posts: Post[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const docHref = (id: string) => (id === 'index' ? '/docs' : `/docs/${id}`);
export const docMarkdownHref = (id: string) => `/docs/${id}.md`;
export const postHref = (id: string) => `/blog/${id}`;
export const postMarkdownHref = (id: string) => `/blog/${id}.md`;
export const tagSlug = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const tagHref = (tag: string) => `/blog/tags/${tagSlug(tag)}`;
export const absolute = (path: string) => new URL(path, SITE.url).toString();

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Rough reading time for blog posts, at 230 words per minute. */
export const readingMinutes = (body = '') => Math.max(1, Math.round(body.split(/\s+/).length / 230));

const CALLOUT_LABELS: Record<string, string> = { note: 'Note', tip: 'Tip', warning: 'Warning', danger: 'Danger' };
const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * Turns MDX source into plain markdown: drops import/export lines, rewrites the components in
 * components/mdx to their markdown equivalents and strips Shiki notation comments ([!code ++]).
 * Components must open and close on their own lines, which is the house style anyway.
 */
export function mdxToMarkdown(source: string): string {
  const out: string[] = [];
  let fence = false;
  let quote = false;
  for (const line of source.split('\n')) {
    const t = line.trim();
    if (/^(```|~~~)/.test(t)) fence = !fence;
    if (fence || /^(```|~~~)/.test(t)) {
      // The twin shows the final code: lines marked as removed in a diff are dropped.
      if (/\[!code --\]/.test(line)) continue;
      out.push((quote ? '> ' : '') + line.replace(/\s*(#|\/\/|<!--)\s*\[!code [^\]]+\]\s*(-->)?/g, ''));
      continue;
    }
    if (/^(import|export)\s/.test(t)) continue;
    if (/^<\/?(Tabs|Steps|CardGrid|FileTree)\b[^>]*>$/.test(t) || t === '</TabItem>') continue;
    if (t.startsWith('<TabItem')) {
      out.push(`**${attr(t, 'label') ?? ''}**`, '');
      continue;
    }
    if (t.startsWith('<Callout')) {
      const type = attr(t, 'type') ?? 'note';
      out.push(`> **${attr(t, 'title') ?? CALLOUT_LABELS[type] ?? 'Note'}**`);
      quote = true;
      continue;
    }
    if (t === '</Callout>') {
      while (out.at(-1) === '>') out.pop();
      out.push('');
      quote = false;
      continue;
    }
    if (t.startsWith('<LinkCard')) {
      const href = attr(t, 'href') ?? '';
      const desc = attr(t, 'description');
      out.push(`- [${attr(t, 'title') ?? href}](${href.startsWith('/') ? absolute(href) : href})${desc ? `: ${desc}` : ''}`);
      continue;
    }
    if (quote && !t && out.at(-1) === '>') continue;
    out.push(quote ? (t ? `> ${line}` : '>') : line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const faqMarkdown = (faq: { q: string; a: string }[]) =>
  faq.length ? `\n\n## Frequently asked questions\n\n${faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}` : '';

/**
 * Plain-markdown version of an entry for AI agents and LLM crawlers: title, summary and
 * canonical URL up front, then the body as plain markdown, then the FAQ.
 */
export function toMarkdown(entry: Doc | Post, canonicalPath: string): string {
  const body = mdxToMarkdown(entry.body ?? '');
  const updated = entry.data.updated ? `\nLast updated: ${entry.data.updated.toISOString().slice(0, 10)}` : '';
  return `# ${entry.data.title}\n\n> ${entry.data.description}\n\nSource: ${absolute(canonicalPath)}${updated}\n\n${body}${faqMarkdown(entry.data.faq)}\n`;
}

/** FAQPage JSON-LD built from the same text the page shows. */
export const faqJsonLd = (faq: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
