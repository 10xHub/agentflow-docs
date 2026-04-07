# AgentFlow Docs

Professional documentation site for the AgentFlow ecosystem.

This site is now built with **Docusaurus** so the documentation can support a product-quality landing page, beginner learning paths, MDX/React examples, and GitHub Pages deployment.

## Local Development

```bash
npm install
npm run start
```

The dev server runs at `http://localhost:3000`.

## Build

```bash
npm run build
npm run serve
```

The static output is generated into `build/`.

## GitHub Pages

The workflow at `.github/workflows/deploy.yml` builds the site and deploys it to GitHub Pages.

By default, it assumes a project page URL like:

```text
https://<owner>.github.io/<repo>/
```

For a custom domain such as `https://docs.agentflow.ai`, set `SITE_URL` and `BASE_URL` in the workflow or repository variables:

```text
SITE_URL=https://docs.agentflow.ai
BASE_URL=/
```

## Structure

```text
docs/
  get-started/
  concepts/
  tutorials/
  how-to/
  production/
  reference/
src/
  components/
  css/
  pages/
static/
  img/
```

The previous MkDocs content is preserved under `docs-mkdocs-legacy/` so it can be mined during the rewrite.

## Legacy MkDocs

The old MkDocs config files are still in the repo for reference:

```text
mkdocs.yml
pyproject.toml
uv.lock
```

They are no longer the primary docs site.
