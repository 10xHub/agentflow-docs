#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const inputSvg = resolve(root, 'static/img/agentflow-social-card.svg');
const outputPng = resolve(root, 'static/img/agentflow-social-card.png');

let sharp;
try {
  ({default: sharp} = await import('sharp'));
} catch {
  console.error(
    'Missing dependency "sharp". Install once with:\n  npm i -D sharp\nThen re-run: node scripts/generate-og-image.mjs',
  );
  process.exit(1);
}

const svg = await readFile(inputSvg);
const png = await sharp(svg, {density: 300})
  .resize(1200, 630, {fit: 'cover'})
  .png({compressionLevel: 9, quality: 90})
  .toBuffer();

await writeFile(outputPng, png);
console.log(`Wrote ${outputPng} (${png.length} bytes)`);
