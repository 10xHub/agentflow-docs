import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { PACKAGES, SITE } from '../lib/site';
import { getReleases, releaseAnchor } from '../lib/content';

// Feed of releases, so people can follow new versions in any feed reader.
export const GET: APIRoute = async (context) => {
  const releases = await getReleases();
  return rss({
    title: `${SITE.name} releases`,
    description: 'New versions of the 10xGraph framework, API server and CLI, and TypeScript client.',
    site: context.site ?? SITE.url,
    items: releases.map((r) => ({
      title: `${PACKAGES[r.data.package].label} v${r.data.version}`,
      description: r.data.summary,
      pubDate: r.data.date,
      link: `/changelog#${releaseAnchor(r)}`,
      categories: [PACKAGES[r.data.package].name],
    })),
    trailingSlash: false,
    customData: '<language>en-us</language>',
  });
};
