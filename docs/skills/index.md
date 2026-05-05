---
title: Skills
description: Install bundled AgentFlow assistant skills for Codex, Claude, and GitHub Copilot.
slug: /skills
---

# Skills

AgentFlow skills are bundled assistant instructions for coding agents such as Codex, Claude, and GitHub Copilot. They are copied from:

```text
agentflow-api/agentflow_cli/cli/templates/skills
```

Use these skills when you want an assistant to understand AgentFlow package boundaries, graph patterns, CLI behavior, API routes, TypeScript client conventions, testing, and production guidance while editing an AgentFlow project.

```bash
agentflow skills --agent codex
agentflow skills --agent claude
agentflow skills --agent github
```

## What gets installed

The same base skill bundle is copied into the assistant-specific location.

| Assistant | Installed files |
|---|---|
| Codex | `.agents/skills/agentflow/` |
| Claude | `.claude/skills/agentflow/` |
| GitHub Copilot | `.github/instructions/agentflow.instructions.md` and `.github/skills/agentflow/` |

For Codex and Claude, the installed folder is copied from:

```text
agentflow-api/agentflow_cli/cli/templates/skills/agent-skills
```

For GitHub Copilot, AgentFlow also copies:

```text
agentflow-api/agentflow_cli/cli/templates/skills/copilot/agentflow.instructions.md
```

That file points Copilot at the installed skill bundle under `.github/skills/agentflow/`.

## What the skill contains

The base bundle contains:

```text
agent-skills/
+-- SKILL.md
+-- references/
    +-- architecture.md
    +-- agents-and-tools.md
    +-- state-graph.md
    +-- state-and-messages.md
    +-- checkpointing-and-threads.md
    +-- dependency-injection.md
    +-- media-and-files.md
    +-- memory-and-store.md
    +-- streaming.md
    +-- production-runtime.md
    +-- api-client.md
    +-- remote-tools.md
    +-- callbacks-and-command.md
    +-- prebuilt-agents-and-tools.md
    +-- testing-and-evaluation.md
    +-- publishers-and-runtime-protocols.md
    +-- context-id-background.md
    +-- providers-and-adapters.md
    +-- security-and-validators.md
    +-- cli-commands.md
    +-- api-configuration.md
    +-- auth-and-authorization.md
    +-- api-settings-and-middleware.md
    +-- rest-api-and-errors.md
    +-- id-and-thread-name-generators.md
    +-- client-auth-and-errors.md
    +-- client-messages-invoke-stream.md
    +-- client-threads-memory-files.md
```

`SKILL.md` is the entry point. It tells the assistant when to use the AgentFlow skill, which packages exist, where the public docs live, and which reference file to read before changing a subsystem.

The reference files cover:

| Area | What the assistant learns |
|---|---|
| Architecture | Package layout across `agentflow`, `agentflow-api`, `agentflow-client`, docs, and playground |
| Agents and graphs | `Agent`, `ToolNode`, `StateGraph`, prebuilt agents, state, messages, tools, and handoffs |
| Runtime behavior | Checkpointing, dependency injection, memory, media, streaming, publishers, and protocols |
| API and CLI | `agentflow init`, `api`, `play`, `build`, `skills`, `agentflow.json`, auth, settings, middleware, routes, and errors |
| TypeScript client | Auth, invoke, stream, messages, threads, memory, files, and client-side tool execution |
| Quality and safety | Testing, evaluation, provider adapters, validators, and prompt-injection safeguards |

## Install for one assistant

Run from the project root:

```bash
agentflow skills --agent codex
```

Supported values are `codex`, `claude`, `github`, or menu numbers `1`, `2`, `3`.

If you omit `--agent` in an interactive terminal, AgentFlow prompts you to choose:

```text
Which agent?
- 1. Codex
- 2. Claude
- 3. GitHub
```

In non-interactive environments, pass `--agent` or `--all`.

## Install for every assistant

```bash
agentflow skills --all
```

If an installation already exists, `--all` skips that assistant unless you also pass `--force`.

## Install into another project

```bash
agentflow skills --agent claude --path ./my-agent
```

The command refuses to install directly into the filesystem root or your home directory. Point `--path` at a project folder.

## Update an existing install

```bash
agentflow skills --agent github --force
```

Use `--force` to replace an existing installed AgentFlow skill after updating the CLI.

## List supported assistants

```bash
agentflow skills --list
```

## Options

| Option | Default | Description |
|---|---|---|
| `--agent`, `-a` | interactive prompt | Target assistant: `codex`, `claude`, `github`, or menu number `1`, `2`, `3` |
| `--path`, `-p` | `.` | Project directory where skills should be installed |
| `--force`, `-f` | `false` | Overwrite an existing install |
| `--all` | `false` | Install skills for every supported assistant |
| `--list`, `-l` | `false` | List supported assistants and exit |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

## Related docs

- [CLI commands](/docs/reference/api-cli/commands)
- [Initialize a project](/docs/how-to/api-cli/initialize-project)
- [Architecture](/docs/concepts/architecture)
