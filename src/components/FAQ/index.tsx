import {useMemo} from 'react';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

export type FAQEntry = {
  q: string;
  a: string;
};

type Props = {
  heading?: string;
  items: FAQEntry[];
};

export default function FAQ({heading = 'Frequently asked questions', items}: Props) {
  const jsonLd = useMemo(
    () =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((it) => ({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: it.a,
          },
        })),
      }),
    [items],
  );

  if (!items.length) return null;

  return (
    <section className={styles.faq} aria-label={heading}>
      <Heading as="h2" className={styles.faqHeading}>
        {heading}
      </Heading>
      <div className={styles.faqList}>
        {items.map((it) => (
          <details key={it.q} className={styles.faqItem}>
            <summary className={styles.faqQuestion}>{it.q}</summary>
            <div className={styles.faqAnswer}>{it.a}</div>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: jsonLd}}
      />
    </section>
  );
}
