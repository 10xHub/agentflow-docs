// Shiki transformer: wraps every fenced code block in a frame with a header bar.
// The header shows the file name from the fence meta (```python title="graph/agent.py")
// or a label for the language, plus a copy button (wired up by the script in BaseLayout).

const LANG_LABELS = {
  bash: 'Terminal',
  sh: 'Terminal',
  shell: 'Terminal',
  zsh: 'Terminal',
  console: 'Terminal',
  py: 'Python',
  python: 'Python',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  javascript: 'JavaScript',
  json: 'JSON',
  jsonc: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  dockerfile: 'Dockerfile',
  diff: 'Diff',
  text: 'Text',
  txt: 'Text',
  md: 'Markdown',
  mdx: 'MDX',
  sql: 'SQL',
  ini: 'INI',
  env: '.env',
};

const TERMINAL = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);

/** @returns {import('shiki').ShikiTransformer} */
export function codeFrame() {
  return {
    name: '10xgraph:code-frame',
    root(root) {
      const raw = this.options.meta?.__raw ?? '';
      const title = /title="([^"]+)"/.exec(raw)?.[1];
      const lang = String(this.options.lang ?? 'text').toLowerCase();
      const label = title ?? LANG_LABELS[lang] ?? lang;
      const kind = title ? 'file' : TERMINAL.has(lang) ? 'terminal' : 'lang';
      const pre = root.children.find((n) => n.type === 'element' && n.tagName === 'pre');
      if (!pre) return;
      root.children = [
        {
          type: 'element',
          tagName: 'figure',
          properties: { className: ['code-frame'], dataKind: kind },
          children: [
            {
              type: 'element',
              tagName: 'figcaption',
              properties: { className: ['code-head'], dataPagefindIgnore: '' },
              children: [
                { type: 'element', tagName: 'span', properties: { className: ['code-title'] }, children: [{ type: 'text', value: label }] },
                {
                  type: 'element',
                  tagName: 'button',
                  properties: { type: 'button', className: ['code-copy'], ariaLabel: `Copy ${label} code` },
                  children: [{ type: 'text', value: 'Copy' }],
                },
              ],
            },
            pre,
          ],
        },
      ];
    },
  };
}
