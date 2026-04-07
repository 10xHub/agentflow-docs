import Heading from '@theme/Heading';
import styles from './styles.module.css';

const features = [
  {
    title: 'Orchestration first',
    description:
      'Model agents as workflows with explicit state, routing, and execution boundaries instead of scattered prompt calls.',
  },
  {
    title: 'Production foundations',
    description:
      'Bring checkpointing, storage, background work, callbacks, and graceful failure handling into the core architecture.',
  },
  {
    title: 'Backend to frontend',
    description:
      'Document one connected stack across the Python library, API and CLI package, hosted playground, and TypeScript client.',
  },
];

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="sectionHeader">
          <p className="eyebrow">Framework foundations</p>
          <Heading as="h2">Everything a serious agent app needs, in one path.</Heading>
        </div>
        <div className={styles.grid}>
          {features.map((feature) => (
            <article className={styles.card} key={feature.title}>
              <div className={styles.icon} aria-hidden="true" />
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
