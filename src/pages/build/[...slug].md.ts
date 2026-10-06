import type { APIRoute } from 'astro';
import { buildHref, getBuilds, toMarkdown, type Build } from '../../lib/content';

// Plain-markdown twin of every build guide at /build/<id>.md, for AI agents and LLM crawlers.
export async function getStaticPaths() {
  const builds = await getBuilds();
  return builds.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => {
  const entry = props.entry as Build;
  return new Response(toMarkdown(entry, buildHref(entry.id)), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
