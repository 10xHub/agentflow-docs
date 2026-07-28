import contributors from '@site/src/data/contributors.json';
import styles from './styles.module.css';

/**
 * Avatars are requested at 2x the rendered size so they stay sharp on retina
 * displays. GitHub serves any `s` value from the same CDN object.
 */
const AVATAR_PX = 64;
const AVATAR_SRC = AVATAR_PX * 2;

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
        {contributors.map((c) => (
          <li key={c.login}>
            <a
              className={styles.person}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${c.login} on GitHub`}
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
              <span className={styles.login}>{c.login}</span>
              {showCounts ? (
                <span className={styles.count}>
                  {c.contributions} commits
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
