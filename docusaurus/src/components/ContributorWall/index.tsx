import contributors from '@site/src/data/contributors.json';
import styles from './styles.module.css';

/**
 * Avatars are requested at 2x the rendered size so they stay sharp on retina
 * displays. GitHub serves any `s` value from the same CDN object.
 */
const AVATAR_PX = 44;
const AVATAR_SRC = AVATAR_PX * 2;

/**
 * Repo names are long and share a prefix, which makes them useless as chips.
 * These are the short forms the docs already use for the five packages.
 */
const REPO_LABELS: Record<string, string> = {
  '10xHub/agentflow': 'core',
  '10xHub/agentflow-cli': 'CLI',
  '10xHub/agentflow-client': 'client',
  '10xHub/agentflow-docs': 'docs',
  '10xHub/agentflow-playground': 'playground',
};

const repoLabel = (repo: string) => REPO_LABELS[repo] ?? repo.split('/').pop();

type Props = {
  heading?: string;
  blurb?: string;
  /** Show each contributor's merged commit count across all five repos. */
  showCounts?: boolean;
};

export default function ContributorWall({
  heading = 'The people who build Agentflow',
  blurb,
  showCounts = false,
}: Props) {
  if (contributors.length === 0) return null;

  return (
    <section className={styles.wall} aria-labelledby="contributor-wall-heading">
      <h3 id="contributor-wall-heading" className={styles.heading}>
        {heading}
      </h3>
      {blurb ? <p className={styles.blurb}>{blurb}</p> : null}

      <ul className={styles.grid}>
        {contributors.map((c) => {
          const repos = c.repos.map(repoLabel);
          return (
            <li key={c.login} className={styles.item}>
              <a
                className={styles.card}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${c.login} on GitHub. Contributed to ${repos.join(', ')}.`}
              >
                <img
                  className={styles.avatar}
                  src={`${c.avatar}?s=${AVATAR_SRC}&v=4`}
                  alt=""
                  width={AVATAR_PX}
                  height={AVATAR_PX}
                  loading="lazy"
                  decoding="async"
                />

                <span className={styles.body}>
                  <span className={styles.login} title={c.login}>
                    {c.login}
                  </span>

                  <span className={styles.repos}>
                    {repos.map((label) => (
                      <span className={styles.repo} key={label}>
                        {label}
                      </span>
                    ))}
                    {showCounts ? (
                      <span className={styles.count}>{c.contributions}</span>
                    ) : null}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
