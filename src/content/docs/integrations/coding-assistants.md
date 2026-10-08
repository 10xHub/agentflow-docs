---
title: Skills
seoTitle: "10xGraph skills for Codex, Claude and Copilot"
description: Install the bundled 10xGraph skill for Codex, Claude or GitHub Copilot so your coding assistant knows the framework, or give your own agents skills.
section: Integrations
group: "Coding assistants"
order: 90
updated: "2026-10-06"
---

Skills are folders of instructions, scripts and references that follow the Agent Skills specification. 10xGraph uses them in two places: a bundled skill that teaches your coding assistant (Codex, Claude or GitHub Copilot) how to build with 10xGraph, and a runtime feature that lets your own agents load skills on demand. This page is for developers who want an assistant to write correct 10xGraph code, and for those packaging reusable agent behavior.

## Start here

To teach an assistant, run `10xgraph skills --agent claude` (or `codex`, `github`) from your project root. The sections below list exactly which files get installed. For the command itself, see [Install skills](/docs/integrations/coding-assistants) and the [CLI commands reference](/docs/reference/api-cli/commands).

To give your own agents skills, read [How to give an agent skills](/docs/guides/use-skills), then the [Skills reference](/docs/reference/python/skills). The tutorial [Skills](/docs/examples/skills) walks through a working example from the repository.

10xGraph uses skills in two places. Both follow the [Agent Skills specification](https://agentskills.io/specification), so a skill folder is portable between them:

| You want to | Go to |
|---|---|
| Give **your own 10xGraph agents** skills they load on demand, with bundled scripts and references | [How to give an agent skills](/docs/guides/use-skills) and the [Skills reference](/docs/reference/python/skills) |
| Teach **your coding assistant** (Codex, Claude, GitHub Copilot) how to build with 10xGraph | The rest of this page |

## The 10xGraph skill for coding assistants

10xGraph skills are bundled assistant instructions for coding agents such as Codex, Claude, and GitHub Copilot. They are copied from:

```text
tenxgraph_api/cli/templates/skills
```

Use these skills when you want an assistant to understand 10xGraph package boundaries, graph patterns, CLI behavior, API routes, TypeScript client conventions, testing, and production guidance while editing a 10xGraph project.

```bash
10xgraph skills --agent codex
10xgraph skills --agent claude
10xgraph skills --agent github
```

## What gets installed

The same base skill bundle is copied into the assistant-specific location.

| Assistant | Installed files |
|---|---|
| Codex | `.agents/skills/10xgraph/` |
| Claude | `.claude/skills/10xgraph/` |
| GitHub Copilot | `.github/instructions/10xgraph.instructions.md` and `.github/skills/10xgraph/` |

Every assistant gets the same folder, copied from:

```text
tenxgraph_api/cli/templates/skills/10xgraph
```

The bundle follows the [Agent Skills specification](https://agentskills.io/specification). Paths inside `SKILL.md` are relative to the skill folder, so one copy works in every install location. Check it, or your own skills, with `10xgraph skills --validate <path>`.

For GitHub Copilot, 10xGraph also copies:

```text
tenxgraph_api/cli/templates/skills/copilot/10xgraph.instructions.md
```

That file points Copilot at the installed skill bundle under `.github/skills/10xgraph/`.

## What the skill contains

The base bundle contains:

```text
agentflow/
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

`SKILL.md` is the entry point. It tells the assistant when to use the 10xGraph skill, which packages exist, where the public docs live, and which reference file to read before changing a subsystem.

The reference files cover:

| Area | What the assistant learns |
|---|---|
| Architecture | Package layout across `agentflow`, `agentflow-api`, `agentflow-client`, docs, and playground |
| Agents and graphs | `Agent`, `ToolNode`, `StateGraph`, prebuilt agents, state, messages, tools, and handoffs |
| Runtime behavior | Checkpointing, dependency injection, memory, media, streaming, publishers, and protocols |
| API and CLI | `10xgraph init`, `api`, `play`, `build`, `skills`, `10xgraph.json`, auth, settings, middleware, routes, and errors |
| TypeScript client | Auth, invoke, stream, messages, threads, memory, files, and client-side tool execution |
| Quality and safety | Testing, evaluation, provider adapters, validators, and prompt-injection safeguards |

## Install for one assistant

Run from the project root:

```bash
10xgraph skills --agent codex
```

Supported values are `codex`, `claude`, `github`, or menu numbers `1`, `2`, `3`.

If you omit `--agent` in an interactive terminal, 10xGraph prompts you to choose:

```text
Which agent?
- 1. Codex
- 2. Claude
- 3. GitHub
```

In non-interactive environments, pass `--agent` or `--all`.

## Install for every assistant

```bash
10xgraph skills --all
```

If an installation already exists, `--all` skips that assistant unless you also pass `--force`.

## Install into another project

```bash
10xgraph skills --agent claude --path ./my-agent
```

The command refuses to install directly into the filesystem root or your home directory. Point `--path` at a project folder.

## Update an existing install

```bash
10xgraph skills --agent github --force
```

Use `--force` to replace an existing installed 10xGraph skill after updating the CLI.

## List supported assistants

```bash
10xgraph skills --list
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
- [Initialize a project](/docs/server/project-setup)
- [Architecture](/docs/concepts)
