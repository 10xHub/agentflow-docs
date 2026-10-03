// Docs reader behaviour: reading lenses, the run bar (sections as graph nodes that fill as you
// read), visited pages on the docs map, keyboard shortcuts and the mobile map toggle.
// Everything here is progressive: without JS the page is a normal, complete article.

type Lens = 'read' | 'skim' | 'code';
const LENS_KEY = 'docs:lens';
const VISITED_KEY = 'docs:visited';
const NOTES: Record<Lens, string> = {
  read: '',
  skim: 'Skim lens: headings, first paragraphs, callouts and tables.',
  code: 'Code lens: headings and code only.',
};

const store = {
  get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* private mode: state lasts for this page */ }
  },
};

// For the code lens: mark headings whose section holds no code, so the lens can hide them.
function markCodeSections(reader: HTMLElement) {
  const CODE = '.code-frame, .tabs, .file-tree, pre';
  reader.querySelectorAll<HTMLElement>('.doc-prose > :is(h2, h3)').forEach((h) => {
    const level = Number(h.tagName[1]);
    let el = h.nextElementSibling;
    let hasCode = false;
    while (el && !(/^H[23]$/.test(el.tagName) && Number(el.tagName[1]) <= level)) {
      if (el.matches(CODE) || el.querySelector(CODE)) hasCode = true;
      // An h2 also keeps its place when one of its h3 subsections has code.
      el = el.nextElementSibling;
    }
    if (!hasCode) h.dataset.noCode = '';
  });
}

function initLens(reader: HTMLElement) {
  markCodeSections(reader);
  const buttons = [...reader.querySelectorAll<HTMLButtonElement>('.lens [data-lens]')];
  const note = reader.querySelector<HTMLElement>('[data-lens-note]');
  const set = (lens: Lens, remember = true) => {
    reader.dataset.lens = lens;
    buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === lens)));
    if (note) {
      note.hidden = lens === 'read';
      note.innerHTML = lens === 'read' ? '' : `${NOTES[lens]} <button type="button" data-lens-reset>Show everything</button> <kbd>1</kbd>`;
    }
    if (remember) store.set(LENS_KEY, lens);
  };
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.lens as Lens)));
  note?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-lens-reset]')) set('read');
  });
  const saved = store.get(LENS_KEY);
  set(saved === 'skim' || saved === 'code' ? saved : 'read', false);
  return set;
}

function initRun(reader: HTMLElement) {
  const links = [...reader.querySelectorAll<HTMLAnchorElement>('[data-run]')];
  const fill = reader.querySelector<HTMLElement>('.run-fill');
  const nowNum = reader.querySelector<HTMLElement>('.run-now-num');
  const nowText = reader.querySelector<HTMLElement>('.run-now-text');
  const targets = links.map((a) => document.getElementById(a.dataset.run!)).filter((el): el is HTMLElement => !!el);
  if (!targets.length || targets.length !== links.length) return;

  let last = -2;
  const update = () => {
    const line = window.innerHeight * 0.3;
    // Hidden sections (lenses) have no box; measure the next visible one instead.
    const tops = targets.map((t) => (t.getClientRects().length ? t.getBoundingClientRect().top : Infinity));
    let i = -1;
    tops.forEach((top, n) => { if (top <= line) i = n; });
    let frac = 0;
    if (i >= 0 && i < tops.length - 1) {
      const span = tops[i + 1] - tops[i];
      frac = span > 0 && Number.isFinite(span) ? Math.min(1, Math.max(0, (line - tops[i]) / span)) : 0;
    }
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atEnd) { i = targets.length - 1; frac = 0; }
    const steps = Math.max(1, targets.length - 1);
    fill?.style.setProperty('--p', String(Math.max(0, Math.min(1, (Math.max(i, 0) + frac) / steps))));
    if (i === last) return;
    last = i;
    links.forEach((a, n) => {
      a.classList.toggle('is-done', n < i);
      a.classList.toggle('is-hidden', !Number.isFinite(tops[n]));
      if (n === i) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    targets.forEach((t, n) => t.classList.toggle('is-reached', n <= i));
    const k = Math.max(i, 0);
    if (nowNum) nowNum.textContent = String(k + 1).padStart(2, '0');
    if (nowText) nowText.textContent = links[k].dataset.label ?? '';
  };
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  return () => { last = -2; update(); };
}

function initVisited(reader: HTMLElement) {
  const id = reader.dataset.docId;
  let visited: string[] = [];
  try { visited = JSON.parse(store.get(VISITED_KEY) ?? '[]'); } catch { visited = []; }
  // Section landing pages have no doc id: they show progress without recording a visit.
  if (id && !visited.includes(id)) {
    visited.push(id);
    store.set(VISITED_KEY, JSON.stringify(visited));
  }
  const seen = new Set(visited);

  reader.querySelectorAll<HTMLElement>('[data-doc-id].map-node').forEach((a) => a.classList.toggle('is-visited', seen.has(a.dataset.docId!)));
  reader.querySelectorAll<HTMLElement>('[data-dot]').forEach((d) => d.classList.toggle('is-visited', seen.has(d.dataset.dot!)));
  reader.querySelectorAll<HTMLElement>('.map-section').forEach((section) => {
    const bar = section.querySelector<HTMLElement>('[data-bar]');
    if (!bar) return;
    const nodes = [...section.querySelectorAll<HTMLElement>('.map-node')];
    const done = nodes.filter((n) => seen.has(n.dataset.docId!)).length;
    bar.style.setProperty('--p', String(nodes.length ? done / nodes.length : 0));
  });
  const progress = reader.querySelector<HTMLElement>('[data-map-progress]');
  if (progress) {
    const all = [...reader.querySelectorAll<HTMLElement>('.map-node')].map((n) => n.dataset.docId!);
    const read = all.filter((d) => seen.has(d)).length;
    progress.textContent = `${read} of ${all.length} explored`;
    progress.style.setProperty('--p', String(all.length ? read / all.length : 0));
  }
}

function initMapToggle(reader: HTMLElement) {
  const toggle = reader.querySelector<HTMLButtonElement>('.map-toggle');
  toggle?.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') !== 'true'));
  });
}

function initKeys(setLens: (l: Lens) => void, refresh?: () => void) {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], dialog')) return;
    const go = (sel: string) => document.querySelector<HTMLAnchorElement>(sel)?.click();
    if (e.key === '[') go('[data-prev]');
    else if (e.key === ']') go('[data-next]');
    else if (e.key === '1' || e.key === '2' || e.key === '3') {
      setLens((['read', 'skim', 'code'] as const)[Number(e.key) - 1]);
      refresh?.();
    } else return;
    e.preventDefault();
  });
}

export function initReader() {
  const reader = document.querySelector<HTMLElement>('.reader');
  if (!reader) return;
  const setLens = initLens(reader);
  const refresh = initRun(reader);
  reader.querySelectorAll('.lens [data-lens]').forEach((b) => b.addEventListener('click', () => refresh?.()));
  initVisited(reader);
  initMapToggle(reader);
  initKeys(setLens, refresh);
}
