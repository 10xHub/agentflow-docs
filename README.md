# AgentFlow Documentation

Official documentation for the AgentFlow ecosystem—a comprehensive, production-ready stack for building, deploying, and consuming multi-agent systems.

This documentation covers three interconnected components:

- **[AgentFlow Python Library](docs/Agentflow/index.md)** — Core framework for building agent graphs and orchestrating multi-agent workflows
- **[AgentFlow CLI](docs/cli/index.md)** — Command-line tool for scaffolding projects, running local servers, and deploying to production
- **[AgentFlow TypeScript Client](docs/client/index.md)** — Fully typed client library for consuming AgentFlow APIs in web and Node.js applications

Built with **MkDocs + Material theme**, managed with **uv** for fast, reproducible builds.

---

## 🚀 Quick Start

### Requirements

- [uv](https://docs.astral.sh/uv/) installed

### Install dependencies

Dependencies are tracked in `pyproject.toml` and locked in `uv.lock`:

```bash
uv sync
```

### Run the local development server

```bash
uv run mkdocs serve
```

The site will be available at **http://127.0.0.1:8000/**

### Build static site

```bash
uv run mkdocs build
```

The static output is generated into the `site/` directory (ignored by Git).

---

## 📁 Project Structure

```
docs/
├── index.md                 # Landing page for the ecosystem
├── Agentflow/              # Python library documentation
│   ├── index.md            # Library overview and quick start
│   ├── graph/              # Graph orchestration concepts
│   ├── context/            # State and context management
│   └── ...
├── cli/                    # CLI documentation
│   ├── index.md            # CLI overview
│   ├── cli.md              # Command reference
│   ├── configuration.md    # Configuration guide
│   └── ...
├── client/                 # TypeScript client documentation
│   ├── index.md            # Client overview
│   ├── api-reference.md    # Full API reference
│   ├── stream-usage.md     # Streaming guide
│   └── ...
└── Tutorial/               # Step-by-step tutorials
    ├── rag.md              # RAG implementation
    ├── long_term_memory.md # Memory management
    └── react/              # React agent tutorials

mkdocs.yml                  # MkDocs configuration
pyproject.toml              # Project metadata and dependencies
uv.lock                     # Reproducible dependency lockfile
```

---

## 🔧 Configuration

### Dependencies

Key dependencies include:

- **mkdocs** — Static site generator
- **mkdocs-material** — Material Design theme
- **mkdocs-mermaid2-plugin** — Mermaid diagram support
- **mkdocstrings** — Auto-generate API docs from Python docstrings (optional)

All dependencies are managed via `pyproject.toml` and can be updated with:

```bash
uv sync
```

### Theme and Plugins

Configured in `mkdocs.yml`:

- Material theme with custom colors and features
- Mermaid diagrams for visual architecture representations
- Search functionality
- Navigation structure for organized browsing

---

## 📝 Contributing

### Adding new documentation

1. Create a new Markdown file in the appropriate directory under `docs/`
2. Update `mkdocs.yml` navigation if needed
3. Test locally with `uv run mkdocs serve`
4. Build to verify: `uv run mkdocs build`

### Documentation style

- Use clear, concise language
- Include code examples where applicable
- Add links to related sections
- Use proper Markdown formatting
- Include badges for PyPI, GitHub, etc. where relevant

---

## 🔗 Useful Links

- **GitHub Repository**: https://github.com/10xhub/agentflow
- **PyPI Package**: https://pypi.org/project/10xscale-agentflow/
- **Examples**: https://github.com/10xhub/agentflow/tree/main/examples

---

## 📄 License

This documentation is part of the AgentFlow project. See the main repository for license information.
