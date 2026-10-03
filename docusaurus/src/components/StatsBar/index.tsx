import {useEffect, useState} from 'react';
import Icon from '../Icon';
import styles from './styles.module.css';

const CACHE_KEY = 'agentflow_stats_v2';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

type LiveStats = {
  stars: number;
  ts: number;
};

function fmt(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Star count is best-effort only. Unauthenticated api.github.com calls are
 * rate-limited per IP and return 403 for a large share of visitors, so the
 * component must render a complete, truthful bar when the fetch fails —
 * never a dash or a zero.
 */
async function loadStars(): Promise<number> {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: LiveStats = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL && cached.stars > 0) return cached.stars;
      }
    } catch {}
  }

  const res = await fetch('https://api.github.com/repos/10xHub/Agentflow');
  if (!res.ok) return 0;
  const data = await res.json();
  const stars: number = data.stargazers_count ?? 0;

  if (stars > 0) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({stars, ts: Date.now()} satisfies LiveStats));
    } catch {}
  }
  return stars;
}

type Stat = {
  icon: 'Star' | 'Package' | 'Code' | 'Scale' | 'BadgeCheck' | 'GitBranch';
  label: string;
  value: string;
  href?: string;
};

type Props = {
  stats?: Stat[];
};

/** Facts that hold with or without a successful network call. */
const staticStats: Stat[] = [
  {
    icon: 'Scale',
    label: 'License',
    value: 'MIT',
    href: 'https://opensource.org/licenses/MIT',
  },
  {
    icon: 'Code',
    label: 'Requires',
    value: 'Python 3.12+',
  },
  {
    icon: 'Package',
    label: 'on PyPI',
    value: '10xscale-agentflow',
    href: 'https://pypi.org/project/10xscale-agentflow/',
  },
];

export default function StatsBar({stats}: Props) {
  const [stars, setStars] = useState(0);

  useEffect(() => {
    loadStars()
      .then(setStars)
      .catch(() => {});
  }, []);

  const githubStat: Stat = stars
    ? {
        icon: 'Star',
        label: 'GitHub stars',
        value: fmt(stars),
        href: 'https://github.com/10xHub/Agentflow',
      }
    : {
        icon: 'Star',
        label: 'on GitHub',
        value: 'Star us',
        href: 'https://github.com/10xHub/Agentflow',
      };

  const items: Stat[] = stats ?? [githubStat, ...staticStats];

  return (
    <section className={styles.bar} aria-label="Project stats">
      <ul className={styles.list}>
        {items.map((s) => {
          const inner = (
            <>
              <Icon name={s.icon} size={16} />
              <span className={styles.value}>{s.value}</span>
              <span className={styles.label}>{s.label}</span>
            </>
          );
          return (
            <li key={`${s.icon}-${s.label}`} className={styles.item}>
              {s.href ? (
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {inner}
                </a>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
