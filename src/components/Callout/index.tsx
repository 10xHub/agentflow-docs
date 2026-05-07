import type {ReactNode} from 'react';
import Icon from '../Icon';
import styles from './styles.module.css';

export type CalloutVariant = 'info' | 'tip' | 'warning' | 'danger' | 'note';

type Props = {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
};

const variantConfig: Record<CalloutVariant, {iconName: Parameters<typeof Icon>[0]['name']; defaultTitle: string}> = {
  info:    {iconName: 'Info',          defaultTitle: 'Info'},
  tip:     {iconName: 'Lightbulb',     defaultTitle: 'Tip'},
  warning: {iconName: 'TriangleAlert', defaultTitle: 'Warning'},
  danger:  {iconName: 'OctagonAlert',  defaultTitle: 'Danger'},
  note:    {iconName: 'StickyNote',    defaultTitle: 'Note'},
};

export default function Callout({variant = 'info', title, children}: Props) {
  const cfg = variantConfig[variant];
  return (
    <aside
      className={`${styles.callout} ${styles[`callout-${variant}`]}`}
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'note'}>
      <div className={styles.iconWrap} aria-hidden="true">
        <Icon name={cfg.iconName} size={18} strokeWidth={2} />
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{title ?? cfg.defaultTitle}</p>
        <div className={styles.content}>{children}</div>
      </div>
    </aside>
  );
}
