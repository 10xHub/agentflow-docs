#!/usr/bin/env node
/**
 * One-shot conflict resolver for the upstream/main merge.
 *
 * Each conflict is in the frontmatter of a concept doc:
 *  - HEAD has our SEO frontmatter (keyword-rich title, description, keywords, sidebar_label)
 *  - upstream/main added `sidebar_position` and a plain title/description
 *
 * Resolution: keep HEAD's frontmatter, splice in upstream's `sidebar_position`
 * if HEAD doesn't already have one.
 */
import {readFile, writeFile} from 'node:fs/promises';

const files = [
  'docs/concepts/agents-and-tools.md',
  'docs/concepts/architecture.md',
  'docs/concepts/checkpointing-and-threads.md',
  'docs/concepts/dependency-injection.md',
  'docs/concepts/media-and-files.md',
  'docs/concepts/memory-and-store.md',
  'docs/concepts/production-runtime.md',
  'docs/concepts/state-and-messages.md',
  'docs/concepts/state-graph.md',
  'docs/concepts/streaming.md',
];

for (const file of files) {
  const src = await readFile(file, 'utf8');
  const m = src.match(
    /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> upstream\/main\r?\n?/,
  );
  if (!m) {
    console.log(`SKIP ${file} — no conflict marker`);
    continue;
  }
  const ours = m[1];
  const theirs = m[2];

  const sidebarPosMatch = theirs.match(/^sidebar_position:\s*(\d+)\s*$/m);
  const sidebarPos = sidebarPosMatch ? sidebarPosMatch[1] : null;

  let resolved = ours;
  if (sidebarPos && !/^sidebar_position:/m.test(ours)) {
    // Append to the end of our frontmatter block
    resolved = ours.trimEnd() + `\nsidebar_position: ${sidebarPos}`;
  }

  const next = src.replace(m[0], resolved + '\n');
  await writeFile(file, next, 'utf8');
  console.log(`OK ${file} (sidebar_position=${sidebarPos ?? 'none'})`);
}
