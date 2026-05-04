import {useMemo} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type Props = {
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  slug: string;
  keywords?: string[];
  image?: string;
};

export default function BlogStructuredData({
  headline,
  description,
  datePublished,
  dateModified,
  authorName = 'AgentFlow Team',
  slug,
  keywords = [],
  image,
}: Props) {
  const {siteConfig} = useDocusaurusContext();
  const siteUrl = siteConfig.url.replace(/\/$/, '');
  const url = `${siteUrl}/blog/${slug}`;

  const json = useMemo(
    () =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline,
        description,
        url,
        mainEntityOfPage: {'@type': 'WebPage', '@id': url},
        datePublished,
        dateModified: dateModified ?? datePublished,
        author: {
          '@type': 'Organization',
          name: authorName,
          url: siteUrl,
        },
        publisher: {
          '@type': 'Organization',
          name: 'AgentFlow',
          url: siteUrl,
          logo: {
            '@type': 'ImageObject',
            url: `${siteUrl}/img/agentflow-mark.svg`,
          },
        },
        image: image
          ? `${siteUrl}${image.startsWith('/') ? image : `/${image}`}`
          : `${siteUrl}/img/agentflow-social-card.png`,
        keywords: keywords.join(', '),
        inLanguage: 'en',
      }),
    [
      headline,
      description,
      url,
      datePublished,
      dateModified,
      authorName,
      siteUrl,
      keywords,
      image,
    ],
  );

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{__html: json}}
    />
  );
}
