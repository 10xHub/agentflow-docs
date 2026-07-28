import {brandIcons, type BrandKey} from '@site/src/lib/brand-icons';
import styles from './styles.module.css';

const AVATAR_PX = 88;

type Link = {
  /** Brand icon key; the icon's title doubles as the visible label. */
  brand: BrandKey;
  href: string;
  /** Handle shown next to the icon, e.g. "@Iamsdt". */
  handle: string;
};

type Props = {
  name: string;
  /** Short role line under the name. */
  role: string;
  /** GitHub user id, used to build the avatar URL. */
  avatarId: number;
  links: Link[];
  children?: React.ReactNode;
};

export default function MaintainerCard({
  name,
  role,
  avatarId,
  links,
  children,
}: Props) {
  return (
    <section className={styles.card}>
      <img
        className={styles.avatar}
        src={`https://avatars.githubusercontent.com/u/${avatarId}?s=${AVATAR_PX * 2}&v=4`}
        alt=""
        width={AVATAR_PX}
        height={AVATAR_PX}
        loading="lazy"
        decoding="async"
      />

      <div className={styles.body}>
        <p className={styles.name}>{name}</p>
        <p className={styles.role}>{role}</p>

        {children ? <div className={styles.bio}>{children}</div> : null}

        <ul className={styles.links}>
          {links.map(({brand, href, handle}) => {
            const icon = brandIcons[brand];
            return (
              <li key={brand} className={styles.linkItem}>
                <a
                  className={styles.link}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${name} on ${icon.title}`}
                >
                  <svg
                    className={styles.icon}
                    role="presentation"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d={icon.path} />
                  </svg>
                  <span>{handle}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
