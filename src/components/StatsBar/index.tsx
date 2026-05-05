import Icon from '../Icon';
import styles from './styles.module.css';

type Stat = {
  icon: 'Star' | 'Package' | 'Code' | 'Scale' | 'BadgeCheck' | 'GitBranch';
  label: string;
  value: string;
  href?: string;
};

const defaultStats: Stat[] = [
  {
    icon: 'Star',
    label: 'GitHub stars',
    value: '★ 2.1k',
    href: 'https://github.com/10xHub/Agentflow',
  },
  {
    icon: 'Package',
    label: 'PyPI installs',
    value: '8k / week',
    href: 'https://pypi.org/project/agentflow/',
  },
  {
    icon: 'Code',
    label: 'npm installs',
    value: '12k / week',
    href: 'https://www.npmjs.com/package/@10xscale/agentflow-client',
  },
  {
    icon: 'Scale',
    label: 'License',
    value: 'MIT',
    href: 'https://opensource.org/licenses/MIT',
  },
];

type Props = {
  stats?: Stat[];
};

export default function StatsBar({stats = defaultStats}: Props) {
  return (
    <section className={styles.bar} aria-label="Project stats">
      <ul className={styles.list}>
        {stats.map((s) => {
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
