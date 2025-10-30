# AgentFlow Docs

MkDocs + Material documentation site, managed with uv.

## Requirements

- uv installed (https://docs.astral.sh/uv/)

## Install dependencies

Dependencies are tracked in `pyproject.toml` and locked in `uv.lock`.

```bash
uv sync
```

## Run the local server

```bash
uv run mkdocs serve
```

The site will be available at http://127.0.0.1:8000/.

## Build static site

```bash
uv run mkdocs build
```

The static output is generated into the `site/` directory (ignored by Git).

## Project layout

- `mkdocs.yml` – MkDocs configuration (theme, plugins, navigation)
- `docs/` – Markdown content (add your pages here)
- `.venv/` – Project virtual environment (created by uv)
- `pyproject.toml` – Project metadata and dependencies
- `uv.lock` – Reproducible dependency lockfile

## Notes

- Mermaid diagrams are enabled via `mkdocs-mermaid2-plugin`.
- `mkdocstrings` is installed and ready if you want to auto-generate API docs for Python.
