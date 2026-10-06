import {useMemo} from 'react';
import type {ReactNode} from 'react';
import Layout from '@theme-original/DocItem/Layout';
import type LayoutType from '@theme/DocItem/Layout';
import type {WrapperProps} from '@docusaurus/types';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type Props = WrapperProps<typeof LayoutType>;

/**
 * Wraps the doc page body with a per-page `TechArticle` JSON-LD block.
 *
 * The blog already emits `BlogPosting` (see BlogStructuredData) and Docusaurus
 * emits `BreadcrumbList`, but individual doc pages carried no article-level
 * schema — only the site-wide Organization/WebSite/SoftwareApplication graph.
 * TechArticle gives each page a headline, a `dateModified` freshness signal
 * (AI engines weight recency heavily), and an author/publisher for E-E-A-T,
 * which is what makes a page citable rather than merely indexable.
 */
export default function DocItemLayoutWrapper(props: Props): ReactNode {
  const {metadata, frontMatter} = useDoc();
  const {siteConfig} = useDocusaurusContext();

  const jsonLd = useMemo(() => {
    const base = siteConfig.url.replace(/\/$/, '');
    const url = `${base}${metadata.permalink}`;
    // Docusaurus exposes `lastUpdatedAt` in milliseconds; older versions used
    // seconds. Normalise so the date is never off by a factor of 1000 (which
    // otherwise renders absurd years like +058523).
    const raw = metadata.lastUpdatedAt;
    const modified =
      typeof raw === 'number'
        ? new Date(raw < 1e12 ? raw * 1000 : raw).toISOString()
        : undefined;
    const keywords = Array.isArray(frontMatter.keywords)
      ? (frontMatter.keywords as string[])
      : undefined;

    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: metadata.title,
      name: metadata.title,
      ...(metadata.description ? {description: metadata.description} : {}),
      url,
      mainEntityOfPage: {'@type': 'WebPage', '@id': url},
      ...(modified ? {datePublished: modified, dateModified: modified} : {}),
      author: {'@type': 'Organization', name: '10xScale', url: 'https://10xscale.ai'},
      publisher: {
        '@type': 'Organization',
        name: '10xScale',
        url: 'https://10xscale.ai',
        logo: {'@type': 'ImageObject', url: `${base}/img/agentflow-mark.svg`},
      },
      ...(keywords && keywords.length ? {keywords: keywords.join(', ')} : {}),
      inLanguage: 'en',
      isPartOf: {'@type': 'WebSite', name: 'AgentFlow by 10xScale', url: base},
    });
  }, [metadata, frontMatter, siteConfig.url]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: jsonLd}}
      />
      <Layout {...props} />
    </>
  );
}
