#!/usr/bin/env node
/**
 * Pre-release refresh for the docs site.
 *
 * The docs site has generated files that are committed rather than built on
 * deploy — `src/data/contributors.json` and the social-card PNG. Committing
 * them keeps builds independent of the GitHub API and of an SVG rasterizer
 * being installed on the deploy runner, but it also means they go stale
 * silently: nothing in `npm run build` regenerates them.
 *
 * This is the one command to run before cutting a release. It refreshes the
 * generated data, then runs the checks that only fail at read time (missing
 * front matter, dead external links), so a release does not ship a page that
 * builds fine and reads badly.
 *
 * Usage:
 *   npm run release:prep
 *   GITHUB_TOKEN=ghp_... npm run release:prep     # avoids API rate limits
 *   npm run release:prep -- --links               # also check external links (slow)
 *   npm run release:prep -- --skip-og             # leave the social card alone
 *   npm run release:prep -- --check               # fail if anything is stale, change nothing
 *
 * Exit code is non-zero if any step fails, so it can gate a release in CI.
 */
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRIBUTORS = resolve(root, 'src/data/contributors.json');
const SOCIAL_CARD = resolve(root, 'static/img/agentflow-social-card.png');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const withLinks = args.includes('--links');
const skipOg = args.includes('--skip-og');

/** Files this script regenerates, reported at the end so you know what to commit. */
const GENERATED = [CONTRIBUTORS, SOCIAL_CARD];

const results = [];

/**
 * Unauthenticated GitHub API calls are capped at 60/hour per IP, which a single
 * five-repo run can exhaust on a shared network. Borrow the `gh` CLI's token
 * when one is not already in the environment, so the common case needs no
 * setup and no token pasted into a shell.
 */
function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) return {token: fromEnv, source: 'environment'};

  const res = spawnSync('gh', ['auth', 'token'], {encoding: 'utf8'});
  const token = res.status === 0 ? res.stdout.trim() : '';
  if (token) return {token, source: 'gh CLI'};

  return {token: '', source: 'none (unauthenticated, may hit rate limits)'};
}

const {token, source: tokenSource} = resolveToken();
const childEnv = token ? {...process.env, GITHUB_TOKEN: token} : process.env;

function run(name, argv, {optional = false} = {}) {
  console.log(`\n→ ${name}`);
  const res = spawnSync(process.execPath, argv, {
    cwd: root,
    stdio: 'inherit',
    env: childEnv,
  });
  const ok = res.status === 0;
  results.push({name, ok, optional});
  if (!ok && optional) {
    console.log(`  (${name} failed, continuing — not release-blocking)`);
  }
  return ok;
}

/**
 * Snapshot before/after rather than trusting mtime: the fetch rewrites the file
 * unconditionally, so mtime always changes even when the contributor list did not.
 */
async function snapshot(files) {
  const out = new Map();
  for (const f of files) {
    out.set(f, await readFile(f, 'utf8').catch(() => null));
  }
  return out;
}

function gitDirty(files) {
  const rel = files.map((f) => relative(root, f));
  const res = spawnSync('git', ['status', '--porcelain', '--', ...rel], {
    cwd: root,
    encoding: 'utf8',
  });
  if (res.status !== 0) return null; // not a git checkout, or git unavailable
  return res.stdout.trim().split('\n').filter(Boolean);
}

const before = await snapshot(GENERATED);

if (checkOnly) {
  console.log('Running in --check mode: nothing will be written.\n');
}

// 1. Contributor wall. This is the value that drifts every release.
console.log(`GitHub token: ${tokenSource}`);
if (checkOnly) {
  results.push({name: 'contributors (skipped in --check)', ok: true, optional: true});
} else {
  run('Refreshing contributors', ['scripts/fetch-contributors.mjs']);
}

// 2. Social card PNG. Only matters when the source SVG changed; the generator
//    is cheap and idempotent, so just re-run it unless asked not to.
if (skipOg || checkOnly) {
  results.push({name: 'social card (skipped)', ok: true, optional: true});
} else {
  run('Regenerating social card', ['scripts/generate-og-image.mjs'], {optional: true});
}

// 3. Front matter. Missing title/description/keywords is a hard failure.
run('Auditing front matter', ['scripts/audit-frontmatter.mjs']);

// 4. External links. Network-dependent and slow, so opt-in.
if (withLinks) {
  run('Checking external links', ['scripts/check-external-links.mjs']);
} else {
  console.log('\n→ External links: skipped (pass --links to run)');
}

const after = await snapshot(GENERATED);
const changed = GENERATED.filter((f) => before.get(f) !== after.get(f));

console.log(`\n${'─'.repeat(60)}`);
for (const {name, ok, optional} of results) {
  console.log(`  ${ok ? '✓' : optional ? '!' : '✗'} ${name}`);
}

if (changed.length > 0) {
  console.log('\nRegenerated (commit these before tagging the release):');
  for (const f of changed) console.log(`  ${relative(root, f)}`);
} else if (!checkOnly) {
  console.log('\nGenerated files already up to date.');
}

if (checkOnly) {
  const dirty = gitDirty(GENERATED);
  if (dirty === null) {
    console.log('\nNot a git checkout — cannot verify generated files are committed.');
  } else if (dirty.length > 0) {
    console.log('\nUncommitted changes in generated files:');
    for (const line of dirty) console.log(`  ${line}`);
    results.push({name: 'generated files committed', ok: false});
  }
}

const failed = results.filter((r) => !r.ok && !r.optional);
if (failed.length > 0) {
  console.log(`\n${failed.length} blocking step(s) failed.`);
  process.exit(1);
}

console.log('\nRelease prep complete.');
