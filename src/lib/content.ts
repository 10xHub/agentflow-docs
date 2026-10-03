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

export const docHref = (id: string) => (id === 'index' ? '/docs' : `/docs/${id}`);
export const docMarkdownHref = (id: string) => `/docs/${id}.md`;
export const postHref = (id: string) => `/blog/${id}`;
export const postMarkdownHref = (id: string) => `/blog/${id}.md`;
export const absolute = (path: string) => new URL(path, SITE.url).toString();

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Rough reading time for blog posts, at 230 words per minute. */
export const readingMinutes = (body = '') => Math.max(1, Math.round(body.split(/\s+/).length / 230));

/**
 * Plain-markdown version of an entry for AI agents and LLM crawlers: title, summary and
 * canonical URL up front, then the source body with MDX import/export lines removed.
 */
export function toMarkdown(entry: Doc | Post, canonicalPath: string): string {
  const body = (entry.body ?? '')
    .split('\n')
    .filter((line: string) => !/^(import|export)\s/.test(line))
    .join('\n')
    .trim();
  const updated = entry.data.updated ? `\nLast updated: ${entry.data.updated.toISOString().slice(0, 10)}` : '';
  return `# ${entry.data.title}\n\n> ${entry.data.description}\n\nSource: ${absolute(canonicalPath)}${updated}\n\n${body}\n`;
}
