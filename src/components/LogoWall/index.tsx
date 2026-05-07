import {brandIcons, type BrandKey} from '@site/src/lib/brand-icons';
import Marquee from '../Marquee';
import styles from './styles.module.css';

type Logo = {
  key: BrandKey;
  /** Optional display label (defaults to brand title) */
  label?: string;
};

const logos: Logo[] = [
  {key: 'openai'},
  {key: 'anthropic'},
  {key: 'google', label: 'Gemini'},
  {key: 'googleCloud', label: 'Vertex AI'},
  {key: 'postgres', label: 'Postgres'},
  {key: 'redis'},
  {key: 'qdrant'},
  {key: 'fastapi'},
  {key: 'nextjs'},
  {key: 'vercel'},
  {key: 'docker'},
  {key: 'python'},
  {key: 'typescript'},
];

type Props = {
  heading?: string;
  durationSec?: number;
};

export default function LogoWall({
  heading = 'Works with the stack you already use',
  durationSec = 50,
}: Props) {
  return (
    <section className={styles.wall} aria-label={heading}>
      <p className={styles.heading}>{heading}</p>
      <Marquee durationSec={durationSec}>
        {logos.map(({key, label}) => {
          const icon = brandIcons[key];
          return (
            <div key={key} className={styles.logo} title={icon.title}>
              <svg
                role="img"
                viewBox="0 0 24 24"
                aria-label={icon.title}
                xmlns="http://www.w3.org/2000/svg">
                <path d={icon.path} />
              </svg>
              <span>{label ?? icon.title}</span>
            </div>
          );
        })}
      </Marquee>
    </section>
  );
}
