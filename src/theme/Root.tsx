import {useEffect} from 'react';
import type {ReactNode} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function Root({children}: {children: ReactNode}): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const clarityId =
    (siteConfig.customFields?.microsoftClarityId as string | undefined) ?? '';

  useEffect(() => {
    if (!clarityId || typeof window === 'undefined') return;
    const w = window as unknown as Window & {[key: string]: unknown};
    if (w.clarity) return;
    (function (
      c: Window & {[key: string]: unknown},
      l: Document,
      a: string,
      r: string,
      i: string,
    ) {
      c[a] =
        c[a] ||
        function () {
          ((c[a] as {q?: unknown[]}).q = (c[a] as {q?: unknown[]}).q || []).push(arguments);
        };
      const t = l.createElement(r) as HTMLScriptElement;
      t.async = true;
      t.src = 'https://www.clarity.ms/tag/' + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode?.insertBefore(t, y);
    })(w, document, 'clarity', 'script', clarityId);
  }, [clarityId]);

  return <>{children}</>;
}
