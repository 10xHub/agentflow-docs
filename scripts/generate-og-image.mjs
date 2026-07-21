#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const inputSvg = resolve(root, 'static/img/agentflow-social-card.svg');
const outputPng = resolve(root, 'static/img/agentflow-social-card.png');

/**
 * The PNG is committed, not built on deploy: social scrapers and link
 * unfurlers do not render SVG, and `themeConfig.image` pointed at a PNG that
 * did not exist for months, so every share showed no card at all.
 *
 * Prefers `sharp` when it is installed, falls back to `rsvg-convert`, which is
 * present on most Linux boxes and needs no node_modules entry.
 */
async function renderWithSharp() {
  const {default: sharp} = await import('sharp');
  const svg = await readFile(inputSvg);
  return sharp(svg, {density: 300})
    .resize(1200, 630, {fit: 'cover'})
    .png({compressionLevel: 9, quality: 90})
    .toBuffer();
}

function renderWithRsvg() {
  const result = spawnSync('rsvg-convert', ['-w', '1200', '-h', '630', inputSvg], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

let png = null;
try {
  png = await renderWithSharp();
} catch {
  png = renderWithRsvg();
}

if (!png) {
  console.error(
    'Could not render the social card. Install either one:\n' +
      '  npm i -D sharp\n' +
      '  apt install librsvg2-bin   # provides rsvg-convert',
  );
  process.exit(1);
}

await writeFile(outputPng, png);
console.log(`Wrote ${outputPng} (${png.length} bytes)`);
