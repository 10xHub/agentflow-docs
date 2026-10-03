// Draws ```mermaid blocks as diagrams in the browser. Mermaid (about 1 MB) is only fetched on
// pages that have a diagram, and the diagrams are redrawn when the site theme changes.
// The source stays in the page (and in the .md twin), so search engines and AI agents read it.

const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.esm.min.mjs';

export async function renderMermaid() {
  const blocks = [...document.querySelectorAll<HTMLElement>('pre > code.language-mermaid')];
  if (!blocks.length) return;

  const figures = blocks.map((code) => {
    const pre = code.parentElement!;
    const figure = document.createElement('figure');
    figure.className = 'mermaid-figure';
    figure.dataset.source = code.textContent ?? '';
    const source = document.createElement('details');
    source.className = 'mermaid-source';
    source.innerHTML = '<summary>Diagram source</summary>';
    pre.replaceWith(figure);
    source.append(pre);
    figure.append(document.createElement('div'), source);
    return figure;
  });

  let mermaid: { initialize: (c: object) => void; render: (id: string, src: string) => Promise<{ svg: string }> };
  try {
    mermaid = (await import(/* @vite-ignore */ MERMAID_URL)).default;
  } catch {
    figures.forEach((f) => f.querySelector('details')?.setAttribute('open', ''));
    return;
  }

  let run = 0;
  const draw = async () => {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', fontFamily: 'IBM Plex Sans, system-ui, sans-serif', securityLevel: 'strict' });
    run++;
    for (const [i, f] of figures.entries()) {
      try {
        const { svg } = await mermaid.render(`mmd-${run}-${i}`, f.dataset.source!);
        f.firstElementChild!.innerHTML = svg;
        f.classList.remove('is-error');
      } catch {
        f.classList.add('is-error');
        f.querySelector('details')?.setAttribute('open', '');
      }
    }
  };
  await draw();
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
