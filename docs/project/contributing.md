---
title: Contributing — AgentFlow project
sidebar_label: Contributing
description: How to contribute to AgentFlow and to these docs, including the local setup, the writing conventions, and the checks that must pass before a pull request merges.
keywords:
  - contribute to agentflow
  - agentflow development setup
  - agentflow docs contributing
  - open source contribution
  - agentflow pull request
---

# Contributing

AgentFlow is MIT licensed and developed in the open. Bug reports, fixes,
documentation, and examples are all welcome.

| You want to change | Repository |
| --- | --- |
| The core Python framework | [10xHub/Agentflow](https://github.com/10xHub/Agentflow) |
| The API server or CLI | [10xHub/agentflow-cli](https://github.com/10xHub/agentflow-cli) |
| The TypeScript client | [10xHub/agentflow-client](https://github.com/10xHub/agentflow-client) |
| This documentation site | [10xHub/agentflow-docs](https://github.com/10xHub/agentflow-docs) |

Every page here has an **Edit this page** link at the bottom that opens the
right file in the docs repository.

---

## Contributing to the framework

The core library uses [`uv`](https://docs.astral.sh/uv/):

```bash
git clone https://github.com/10xHub/Agentflow
cd Agentflow
uv sync --dev              # create .venv and install the package plus dev tools
uv run pre-commit install  # enable the git hooks
```

Install the extras for whatever subsystem you are working on:

```bash
uv pip install -e ".[google-genai,openai,mcp,pg_checkpoint]"
```

Before opening a pull request:

```bash
pytest                 # coverage gate is 80%
ruff check . && ruff format .
mypy .
```

Tests that need a real Redis or Postgres are marked `integration` and are
excluded from a default run. Run them with `--integration` once you have the
services up.

The full guide, including the code of conduct, lives in `CONTRIBUTING.md` in each
repository.

### What a good pull request looks like

- One concern per pull request. A fix plus a refactor is two pull requests.
- A test that fails before the change and passes after it.
- A changelog entry under `## [Unreleased]` in the affected package, using the
  `Added` / `Changed` / `Fixed` / `Breaking` headings. Breaking changes must
  include the migration step.
- Public API changes come with docs. A new parameter that appears nowhere on this
  site does not exist as far as users are concerned.

---

## Contributing to these docs

```bash
git clone https://github.com/10xHub/agentflow-docs
cd agentflow-docs
npm install
npm start          # dev server with hot reload on http://localhost:3000
```

Checks that must pass:

```bash
npm run build              # fails on any broken internal link
npm run typecheck
npm run lint:frontmatter   # every page needs title, description, keywords
npm run verify:api         # documented symbols and routes must exist
```

`verify:api` needs the framework installed, because it checks the docs against
the packages users actually get:

```bash
pip install 10xscale-agentflow 10xscale-agentflow-cli
npm run verify:api
```

### Where a page belongs

The site follows the [Divio](https://docs.divio.com/documentation-system/)
four-quadrant split. Put a page where its reader is, not where its topic is.

| Section | Purpose | The reader is |
| --- | --- | --- |
| `docs/get-started/`, `docs/beginner/` | Guided first steps | Learning by doing, in order |
| `docs/tutorials/` | Complete worked examples | Following a scenario end to end |
| `docs/how-to/` | One task, one page | Stuck on a specific job |
| `docs/concepts/` | Explanation and mental models | Trying to understand, not to type |
| `docs/reference/` | Exhaustive, factual API surface | Looking something up |
| `docs/troubleshooting/` | Symptom to cause to fix | Something is broken right now |

If a topic needs coverage in more than one quadrant, write the reference page and
link to it. Do not restate the same parameter table in four places: that is how
the site accumulated four pages about `agentflow.json`.

### Writing conventions

- **Front matter is required**: `title`, `sidebar_label`, `description`,
  `keywords`. Keep the description factual and under 165 characters. Never pad a
  description to hit a length target.
- **Verify before asserting.** Read the source for the signature, the default,
  and the error message. Three shipped drift bugs came from plausible guesses.
- **Every code block should run.** Use real import paths. Prefer a short complete
  example over a long partial one.
- **Link with relative paths** (`../concepts/state-graph.md`) so the build
  catches breakage. `onBrokenLinks` is set to `throw`.
- **Moving or renaming a page requires a redirect** in `docusaurus.config.ts`.
- Course lessons have extra structural rules in `COURSE_STYLE_GUIDE.md` at the
  repository root.

### Releasing a docs version

Docs are versioned only when a release line needs to stay available. When work
starts on the next minor, freeze the current one first:

```bash
npm run docs:cut-version -- 1.0
```

That snapshots `docs/` into `versioned_docs/version-1.0`, after which `docs/`
becomes the unreleased docs and the version dropdown appears in the navbar
automatically.
