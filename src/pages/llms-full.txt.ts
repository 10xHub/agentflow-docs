import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';
import { buildHref, docHref, getBuilds, getDocs, getPosts, postHref, toMarkdown } from '../lib/content';

// Every build guide, doc and post as markdown in one file, for tools that load a whole site into context.
export const GET: APIRoute = async () => {
  const [builds, docs, posts] = await Promise.all([getBuilds(), getDocs(), getPosts()]);
  const parts = [
    `# ${SITE.name}: full documentation and blog\n\n> ${SITE.description}\n`,
    ...builds.map((b) => toMarkdown(b, buildHref(b.id))),
    ...docs.map((d) => toMarkdown(d, docHref(d.id))),
    ...posts.map((p) => toMarkdown(p, postHref(p.id))),
  ];
  return new Response(parts.join('\n---\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
