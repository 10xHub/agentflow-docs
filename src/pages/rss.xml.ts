import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';
import { getPosts, postHref } from '../lib/content';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();
  return rss({
    title: `${SITE.name} blog`,
    description: 'Engineering notes on production AI agents from the 10xGraph team.',
    site: context.site ?? SITE.url,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: postHref(p.id),
      categories: p.data.tags,
      author: p.data.author,
    })),
    trailingSlash: false,
    customData: '<language>en-us</language>',
  });
};
