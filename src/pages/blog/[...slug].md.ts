import type { APIRoute } from 'astro';
import { getPosts, postHref, toMarkdown, type Post } from '../../lib/content';

// Plain-markdown twin of every post at /blog/<id>.md, for AI agents and LLM crawlers.
export async function getStaticPaths() {
  const posts = await getPosts();
  return posts.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => {
  const entry = props.entry as Post;
  return new Response(toMarkdown(entry, postHref(entry.id)), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
