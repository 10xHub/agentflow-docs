import {useState} from 'react';
import TerminalBlock from '../TerminalBlock';
import styles from './styles.module.css';

export type CodeSample = {
  /** Tab label */
  label: string;
  /** Optional badge shown next to the label (e.g. line count, "shortest") */
  badge?: string;
  /** Filename in the terminal title bar */
  filename: string;
  /** Prism language */
  language?: 'python' | 'typescript' | 'tsx' | 'bash' | 'json';
  /** Source code */
  code: string;
  /** Optional footer text under the code (e.g. line count, install command) */
  footer?: string;
};

type Props = {
  samples: CodeSample[];
  defaultIndex?: number;
};

export default function CodeSwitcher({samples, defaultIndex = 0}: Props) {
  const [active, setActive] = useState(defaultIndex);
  const sample = samples[active] ?? samples[0];
  if (!sample) return null;

  return (
    <div className={styles.switcher}>
      <div className={styles.tabs} role="tablist" aria-label="Framework">
        {samples.map((s, i) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            className={`${styles.tab} ${i === active ? styles.tabActive : ''}`}
            onClick={() => setActive(i)}>
            <span>{s.label}</span>
            {s.badge ? <em className={styles.badge}>{s.badge}</em> : null}
          </button>
        ))}
      </div>
      <TerminalBlock
        filename={sample.filename}
        code={sample.code}
        language={sample.language ?? 'python'}
        footer={sample.footer}
      />
    </div>
  );
}
