import {brandIcons, type BrandKey} from '@site/src/lib/brand-icons';
import styles from './styles.module.css';

type Props = {
  /** Display name of the competitor */
  competitor: string;
  /**
   * Optional brand-icons key for the competitor logo. If omitted, a text
   * wordmark is rendered instead.
   */
  competitorIcon?: BrandKey;
  /** A one-line takeaway, e.g. "Same graph mental model, no LangChain dependency." */
  tagline?: string;
};

function BrandLogo({iconKey, label}: {iconKey?: BrandKey; label: string}) {
  if (iconKey) {
    const icon = brandIcons[iconKey];
    return (
      <span className={styles.brand}>
        <svg
          role="img"
          viewBox="0 0 24 24"
          aria-label={icon.title}
          xmlns="http://www.w3.org/2000/svg">
          <path d={icon.path} />
        </svg>
        <span className={styles.brandText}>{label}</span>
      </span>
    );
  }
  return (
    <span className={styles.brand}>
      <span className={styles.brandText}>{label}</span>
    </span>
  );
}

export default function VsBanner({competitor, competitorIcon, tagline}: Props) {
  return (
    <aside className={styles.banner} aria-label={`AgentFlow versus ${competitor}`}>
      <div className={styles.row}>
        <BrandLogo label="AgentFlow" />
        <span className={styles.vs} aria-hidden="true">vs</span>
        <BrandLogo iconKey={competitorIcon} label={competitor} />
      </div>
      {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
    </aside>
  );
}
