import Heading from '@theme/Heading';
import GlowCard from '../GlowCard';
import styles from './styles.module.css';

const features = [
  {
    icon: 'Network' as const,
    title: 'Graph orchestration',
    description:
      'Typed StateGraph with conditional edges, sub-graphs, recursion limits, and explicit routing. Agents you can read, log, and replay.',
  },
  {
    icon: 'DatabaseZap' as const,
    title: 'Production persistence',
    description:
      'InMemoryCheckpointer for dev, PgCheckpointer (Postgres + Redis) for prod. Threads survive restarts and resume across replicas.',
  },
  {
    icon: 'Unplug' as const,
    title: 'Backend to frontend',
    description:
      'Built-in REST and SSE server, a typed TypeScript client, and a hosted playground. One project, full stack, no glue.',
  },
];

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="sectionHeader sectionHeader--center">
          <p className="eyebrow">Framework foundations</p>
          <Heading as="h2">Everything a serious agent app needs.</Heading>
          <p>
            One Python project. Typed graphs, durable threads, a production
            server, and a typed TypeScript client. Without the glue tax.
          </p>
        </div>
        <div className={styles.grid}>
          {features.map((f) => (
            <GlowCard key={f.title} icon={f.icon} title={f.title}>
              <p>{f.description}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
