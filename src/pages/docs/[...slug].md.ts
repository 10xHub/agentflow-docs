import type { APIRoute } from 'astro';
import { docHref, getDocs, toMarkdown, type Doc } from '../../lib/content';

// Plain-markdown twin of every doc at /docs/<id>.md, for AI agents and LLM crawlers.
export async function getStaticPaths() {
  const docs = await getDocs();
  return docs.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => {
  const entry = props.entry as Doc;
  return new Response(toMarkdown(entry, docHref(entry.id)), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
