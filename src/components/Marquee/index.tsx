import type {ReactNode} from 'react';
import styles from './styles.module.css';

type Props = {
  children: ReactNode;
  /** Duration of one full cycle in seconds. Default 40s. */
  durationSec?: number;
  /** Pause animation on hover. Default true. */
  pauseOnHover?: boolean;
};

/** CSS-only horizontal marquee. Renders children twice for a seamless loop.
 *  Respects `prefers-reduced-motion` (animation pauses).
 */
export default function Marquee({children, durationSec = 40, pauseOnHover = true}: Props) {
  return (
    <div
      className={`${styles.marquee} ${pauseOnHover ? styles.pauseHover : ''}`}
      style={{['--marquee-duration' as never]: `${durationSec}s`}}>
      <div className={styles.track}>
        <div className={styles.set} aria-hidden="false">{children}</div>
        <div className={styles.set} aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
