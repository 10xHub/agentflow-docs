import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

export type RelatedDoc = {
  to: string;
  title: string;
  description?: string;
};

type Props = {
  heading?: string;
  docs: RelatedDoc[];
};

export default function RelatedDocs({heading = 'Related guides', docs}: Props) {
  if (!docs.length) return null;
  return (
    <aside className={styles.related} aria-label={heading}>
      <Heading as="h2" className={styles.relatedHeading}>
        {heading}
      </Heading>
      <ul className={styles.relatedList}>
        {docs.map((doc) => (
          <li key={doc.to} className={styles.relatedItem}>
            <Link to={doc.to} className={styles.relatedLink}>
              <span className={styles.relatedTitle}>{doc.title}</span>
              {doc.description ? (
                <span className={styles.relatedDescription}>{doc.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
