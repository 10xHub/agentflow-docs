#!/usr/bin/env node
/**
 * Contributor data generator.
 *
 * Agentflow is spread across five repositories, so no single GitHub contributor
 * graph shows the whole picture. This merges all five into one list, deduped by
 * login, and writes it to `src/data/contributors.json` for <ContributorWall /> to
 * render.
 *
 * The output is committed. Builds read the JSON and never call the API, so the
 * docs site keeps building when GitHub is down or rate-limiting, and page loads
 * never spend a visitor's unauthenticated API quota.
 *
 * Set GITHUB_TOKEN to raise the rate limit (5 requests unauthenticated is
 * usually fine; CI runners share IPs and can hit the cap).
 *
 * Usage:
 *   node scripts/fetch-contributors.mjs
 *   GITHUB_TOKEN=ghp_... node scripts/fetch-contributors.mjs
 */
import {writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'src/data/contributors.json');

const REPOS = [
  '10xHub/agentflow',
  '10xHub/agentflow-cli',
  '10xHub/agentflow-client',
  '10xHub/agentflow-docs',
  '10xHub/agentflow-playground',
];

/**
 * Rendered separately, as the lead-maintainer card. Leaving the login in the
 * wall as well would just be the same face twice, and the commit spread between
 * a project's founder and its contributors makes for a lopsided grid.
 */
const LEAD_MAINTAINER = 'Iamsdt';

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

async function fetchContributors(repo) {
  const url = `https://api.github.com/repos/${repo}/contributors?per_page=100&anon=0`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'agentflow-docs-contributor-sync',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
  });

  if (!res.ok) {
    const hint =
      res.status === 403 && !token
        ? ' (rate limited; set GITHUB_TOKEN and retry)'
        : '';
    throw new Error(`${repo}: HTTP ${res.status} ${res.statusText}${hint}`);
  }

  return res.json();
}

const merged = new Map();

for (const repo of REPOS) {
  const contributors = await fetchContributors(repo);

  for (const c of contributors) {
    if (c.type === 'Bot' || c.login.endsWith('[bot]')) continue;
    if (c.login === LEAD_MAINTAINER) continue;

    const existing = merged.get(c.login);
    if (existing) {
      existing.contributions += c.contributions;
      if (!existing.repos.includes(repo)) existing.repos.push(repo);
    } else {
      merged.set(c.login, {
        login: c.login,
        avatar: c.avatar_url.replace(/\?.*$/, ''),
        url: c.html_url,
        contributions: c.contributions,
        repos: [repo],
      });
    }
  }

  console.log(`  ${repo}: ${contributors.length} entries`);
}

const contributors = [...merged.values()].sort(
  (a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login),
);

await mkdir(dirname(OUT), {recursive: true});
await writeFile(OUT, `${JSON.stringify(contributors, null, 2)}\n`, 'utf8');

console.log(
  `\nWrote ${contributors.length} contributors to src/data/contributors.json`,
);
