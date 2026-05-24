import {useEffect, useState} from 'react';
import Icon from '../Icon';
import styles from './styles.module.css';

const CACHE_KEY = 'agentflow_stats_v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

type LiveStats = {
  stars: number;
  commits: number;
  ts: number;
};

function fmt(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

async function loadStats(): Promise<LiveStats> {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: LiveStats = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL) return cached;
      }
    } catch {}
  }

  const [repoRes, commitsRes] = await Promise.allSettled([
    fetch('https://api.github.com/repos/10xHub/Agentflow'),
    fetch('https://api.github.com/repos/10xHub/Agentflow/commits?per_page=1'),
  ]);

  let stars = 0;
  let commits = 0;

  if (repoRes.status === 'fulfilled' && repoRes.value.ok) {
    const data = await repoRes.value.json();
    stars = data.stargazers_count ?? 0;
  }

  if (commitsRes.status === 'fulfilled' && commitsRes.value.ok) {
    const link = commitsRes.value.headers.get('Link') ?? '';
    const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (match) commits = parseInt(match[1], 10);
  }

  const result: LiveStats = {stars, commits, ts: Date.now()};
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {}
  return result;
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

export default function StatsBar({stats}: Props) {
  const [live, setLive] = useState<LiveStats | null>(null);

  useEffect(() => {
    loadStats().then(setLive).catch(() => {});
  }, []);

  const items: Stat[] = stats ?? [
    {
      icon: 'Star',
      label: 'GitHub stars',
      value: live ? `★ ${fmt(live.stars)}` : '★ —',
      href: 'https://github.com/10xHub/Agentflow',
    },
    {
      icon: 'GitBranch',
      label: 'commits',
      value: live ? fmt(live.commits) : '—',
      href: 'https://github.com/10xHub/Agentflow/commits/main',
    },
    {
      icon: 'BadgeCheck',
      label: '',
      value: '82% (Codecov)',
    },
    {
      icon: 'Scale',
      label: 'License',
      value: 'MIT',
      href: 'https://opensource.org/licenses/MIT',
    },
  ];

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
            <li key={s.label} className={styles.item}>
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
