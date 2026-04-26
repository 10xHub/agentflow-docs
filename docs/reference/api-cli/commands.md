---
title: CLI Commands
description: Complete reference for all agentflow CLI commands and their options.
---

# CLI commands

Install the CLI:

```bash
pip install 10xscale-agentflow-cli
```

Verify:

```bash
agentflow version
```

---

## agentflow init

Scaffold a new project with `agentflow.json` and a starter graph module.

```bash
agentflow init [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--path`, `-p` | `.` | Directory to initialize files in |
| `--force`, `-f` | `false` | Overwrite existing files |
| `--prod` | `false` | Add `pyproject.toml` and `.pre-commit-config.yaml` |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Creates:**

```
agentflow.json
graph/
  __init__.py
  react.py
skills/
  agent-skills/
    SKILL.md
    references/
      skill-concepts.md
      agentflow.md
      claude.md
      codex.md
      github.md
```

**With `--prod`:**

```
agentflow.json
graph/
  __init__.py
  react.py
skills/
  agent-skills/
    SKILL.md
    references/
      skill-concepts.md
      agentflow.md
      claude.md
      codex.md
      github.md
pyproject.toml
.pre-commit-config.yaml
```

**Example:**

```bash
# Initialize in the current directory
agentflow init

# Initialize in a specific folder
agentflow init --path ./my-agent

# Overwrite an existing project
agentflow init --force
```

---

## agentflow api

Start the FastAPI server that serves your compiled graph.

```bash
agentflow api [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--config`, `-c` | `agentflow.json` | Path to config file |
| `--host`, `-H` | `0.0.0.0` | Bind host (use `127.0.0.1` for localhost only) |
| `--port`, `-p` | `8000` | Bind port |
| `--reload/--no-reload` | `--reload` | Enable auto-reload on file changes |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Example:**

```bash
# Start with defaults (binds to all interfaces)
agentflow api

# Start on localhost only
agentflow api --host 127.0.0.1 --port 8000

# Disable auto-reload for production
agentflow api --no-reload

# Use a different config file
agentflow api --config ./config/prod.json
```

---

## agentflow play

Start the API server and open the hosted playground in a browser.

```bash
agentflow play [OPTIONS]
```

Accepts the same options as `agentflow api`. The `--host` and `--port` values are also used to build the `backendUrl` that is passed to the hosted playground.

**Example:**

```bash
agentflow play --host 127.0.0.1 --port 8000
```

The CLI prints the playground URL. If the browser does not open automatically, open the URL manually. The `backendUrl` query parameter tells the playground which local API to call.

---

## agentflow build

Generate a `Dockerfile` (and optionally `docker-compose.yml`) for deployment.

```bash
agentflow build [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--output`, `-o` | `Dockerfile` | Output Dockerfile path |
| `--force`, `-f` | `false` | Overwrite existing Dockerfile |
| `--python-version` | `3.13` | Python base image version |
| `--port`, `-p` | `8000` | Port to expose in the container |
| `--docker-compose/--no-docker-compose` | `--no-docker-compose` | Also generate `docker-compose.yml` |
| `--service-name` | `agentflow-cli` | Service name in `docker-compose.yml` |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Example:**

```bash
# Minimal Dockerfile
agentflow build

# Dockerfile + docker-compose.yml
agentflow build --docker-compose --service-name my-agent

# Custom Python version
agentflow build --python-version 3.12
```

---

## agentflow skills

Install bundled AgentFlow skills into project-local assistant skill directories.

```bash
agentflow skills [OPTIONS]
```

When `--agent` is omitted in an interactive terminal, the command prompts:

```text
Which agent?
- 1. Codex
- 2. Claude
- 3. GitHub
```

| Option | Default | Description |
| --- | --- | --- |
| `--agent`, `-a` | prompt | Target agent: `codex`, `claude`, `github`, or menu number `1`, `2`, `3` |
| `--path`, `-p` | `.` | Project directory where the skills should be installed |
| `--force`, `-f` | `false` | Overwrite the existing installed AgentFlow skill directory |
| `--all` | `false` | Install skills for every supported agent |
| `--list`, `-l` | `false` | List supported agents and exit |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

Install locations:

| Agent | Installed files |
| --- | --- |
| Codex | `.agents/skills/agentflow/` |
| Claude | `.claude/skills/agentflow/` |
| GitHub | `.github/instructions/agentflow.instructions.md` and `.github/skills/agentflow/` |

**Example:**

```bash
# Prompt for target agent
agentflow skills

# Install for Codex
agentflow skills --agent codex

# Install for Claude in another project directory
agentflow skills --agent claude --path ./my-agent

# Install for every supported assistant
agentflow skills --all

# List supported assistants
agentflow skills --list

# Overwrite an existing install
agentflow skills --agent github --force
```

---

## agentflow version

Print the CLI and library versions.

```bash
agentflow version [--verbose]
```

---

## Global options

All commands accept `--help` (`-h`) for usage information:

```bash
agentflow --help
agentflow api --help
agentflow init --help
```
