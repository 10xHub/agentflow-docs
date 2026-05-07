import type {ReactNode} from 'react';
import {Highlight, themes} from 'prism-react-renderer';
import Icon from '../Icon';
import styles from './styles.module.css';

type Props = {
  /** File name shown in the title bar (e.g. "react_sync.py", "bash"). */
  filename?: string;
  /** Source code to render. */
  code: string;
  /** Prism language. Defaults to 'python'. */
  language?: 'python' | 'typescript' | 'tsx' | 'bash' | 'json';
  /** Show a copy-to-clipboard button. */
  copy?: boolean;
  /** Render mac-style traffic-light dots in the title bar. */
  trafficLights?: boolean;
  /** Compact variant — smaller padding, used inline (e.g. install commands). */
  compact?: boolean;
  /** Optional content to render below the code area. */
  footer?: ReactNode;
};

export default function TerminalBlock({
  filename,
  code,
  language = 'python',
  copy = true,
  trafficLights = true,
  compact = false,
  footer,
}: Props) {
  const handleCopy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(code);
  };

  return (
    <div className={`${styles.terminal} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        {trafficLights ? (
          <div className={styles.dots} aria-hidden="true">
            <span className={styles.dotRed} />
            <span className={styles.dotAmber} />
            <span className={styles.dotGreen} />
          </div>
        ) : null}
        {filename ? <span className={styles.filename}>{filename}</span> : null}
        {copy ? (
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            aria-label="Copy code">
            <Icon name="Copy" size={14} />
          </button>
        ) : null}
      </div>
      <Highlight code={code.trim()} language={language} theme={themes.vsDark}>
        {({className, style, tokens, getLineProps, getTokenProps}) => (
          <pre className={`${styles.pre} ${className}`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({line})}>
                {line.map((token, j) => (
                  <span key={j} {...getTokenProps({token})} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
