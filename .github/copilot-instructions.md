# AgentFlow Documentation - AI Agent Instructions

## Project Overview

This is a **documentation-only repository** for AgentFlow (a Python multi-agent framework). It uses **MkDocs with Material theme** and is managed with **uv** (Python package manager). The codebase contains no source code—only Markdown documentation files.

**Key Goal**: Document three main components:
1. **AgentFlow** (agentflow) - Main Python Library for building agent graphs
1. **AgentFlow CLI** (`agentflow`) - Python CLI for scaffolding and running agent APIs
2. **AgentFlow Typescript Client** (`@10xscale/agentflow-client`) - TypeScript library for consuming agent APIs

## Project Structure

```
docs/
├── cli/           # AgentFlow CLI documentation (Python)
│   ├── cli.md              # Command reference
│   ├── configuration.md    # agentflow.json config
│   ├── deployment.md       # Docker/K8s deployment
│   └── authentication.md   # Auth setup
└── client/        # Typescript client library documentation (TypeScript)
    ├── api-reference.md    # All 23 endpoints
    ├── QUICK_START.md      # Getting started
    ├── stream-usage.md     # Real-time streaming
    ├── invoke-usage.md     # Synchronous execution
    ├── thread-api.md       # Thread management
    ├── memory-api.md       # Memory operations
    └── state-schema-guide.md  # Dynamic state schemas

mkdocs.yml         # MkDocs config (nav structure currently minimal)
pyproject.toml     # Dependencies: mkdocs, mkdocs-material, mkdocs-mermaid2-plugin
site/              # Generated static site (git-ignored)
```

## Development Workflow

### Local Development Server
```bash
uv run mkdocs serve    # Serves at http://127.0.0.1:8000/
```

### Building Static Site
```bash
uv run mkdocs build    # Output to site/
```

### Dependency Management
```bash
uv sync                # Install/sync dependencies from pyproject.toml
```