import type { APIRoute } from 'astro';

// Search and AI answer engines are allowed on purpose: being cited by ChatGPT, Claude,
// Perplexity and Google AI features requires that their crawlers can read the site.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site).toString();
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# AI search and answer engines',
    'User-agent: GPTBot',
    'User-agent: OAI-SearchBot',
    'User-agent: ChatGPT-User',
    'User-agent: ClaudeBot',
    'User-agent: Claude-SearchBot',
    'User-agent: PerplexityBot',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
