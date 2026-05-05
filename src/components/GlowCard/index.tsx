import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import Icon from '../Icon';
import styles from './styles.module.css';

type Props = {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  children: ReactNode;
  href?: string;
};

export default function GlowCard({icon, title, children, href}: Props) {
  const Inner = (
    <>
      <div className={styles.iconTile} aria-hidden="true">
        <Icon name={icon} size={22} strokeWidth={2} />
      </div>
      <Heading as="h3" className={styles.title}>{title}</Heading>
      <div className={styles.body}>{children}</div>
    </>
  );

  if (href) {
    return (
      <a className={`${styles.card} ${styles.linkable}`} href={href}>
        {Inner}
      </a>
    );
  }
  return <article className={styles.card}>{Inner}</article>;
}
