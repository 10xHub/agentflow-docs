---
title: Install Skills
seoTitle: "Install coding-agent skills with the CLI"
description: "Use 10xgraph skills to install bundled coding-agent skills for Codex, Claude, and GitHub Copilot, and validate them against the Agent Skills spec."
section: How-to guides
group: CLI
order: 930
label: Install Skills
updated: "2026-09-29"
---

`10xgraph skills` installs bundled 10xGraph coding-agent skills into your project. These skills teach Codex, Claude, or GitHub Copilot how to work with the 10xGraph framework in your codebase.

## What skills are

Skills are collections of documentation and instructions that coding agents read to understand your project's patterns, conventions, and APIs. Installing skills gives your AI coding assistant knowledge of 10xGraph's graph model, tool patterns, and project layout without having to explain it from scratch every session.

The bundled skill follows the [Agent Skills specification](https://agentskills.io/specification): a folder with a `SKILL.md` entry point and a `references/` directory. Paths inside `SKILL.md` are relative to the skill folder, so the same folder works for every agent.

## Supported agents

| # | Agent | Install path |
| --- | --- | --- |
| 1 | Codex | `.agents/skills/10xgraph/` |
| 2 | Claude | `.claude/skills/10xgraph/` |
| 3 | GitHub | `.github/skills/10xgraph/` and `.github/instructions/10xgraph.instructions.md` |

List supported agents:

```bash
10xgraph skills --list
```

## Quick install (interactive)

From the root of your project:

```bash
10xgraph skills
```

If stdin is a terminal, the CLI shows a numbered menu and prompts you to choose an agent. Enter a number (`1`, `2`, or `3`) or type the agent name.

## Install for a specific agent

Skip the interactive menu by naming the agent:

```bash
10xgraph skills --agent claude
10xgraph skills --agent codex
10xgraph skills --agent github
```

The `--agent` flag accepts the agent name (case-insensitive) or its menu number.

## Install for all agents at once

```bash
10xgraph skills --all
```

This installs skills for Codex, Claude, and GitHub in a single command. Any agent that already has skills installed is skipped unless `--force` is also passed.

## Install in a different directory

By default the skills are installed relative to the current working directory. Pass `--path` to target a different project root:

```bash
10xgraph skills --agent claude --path ./my-other-project
```

The CLI refuses to install skills at the filesystem root or directly in the home directory.

## Overwrite an existing installation

If skills are already installed, the command exits with an error to prevent accidental overwrites. Pass `--force` to replace the existing installation:

```bash
10xgraph skills --agent claude --force
10xgraph skills --all --force
```

## What gets installed

### Codex and Claude

A folder named `agentflow` is copied into the agent's skills directory (`.agents/skills/` or `.claude/skills/`). It contains a `SKILL.md` entry point and a `references/` directory with topic-specific documentation. Every agent receives an identical folder.

A manifest file (`.agentflow-skill.json`) is written into the installed directory recording the target agent, CLI version, and installation timestamp.

### GitHub Copilot

Two artifacts are installed:

1. `.github/instructions/10xgraph.instructions.md`, a single instruction file read by GitHub Copilot
2. `.github/skills/10xgraph/`, the full skills folder with the same content as Codex and Claude

A manifest is written into the skills folder.

## Options reference

| Option | Short | Default | Description |
| --- | --- | --- | --- |
| `--agent` | `-a` | (prompt) | Agent name or menu number: `codex`, `claude`, `github`, `1`, `2`, `3` |
| `--path` | `-p` | `.` | Project directory where skills are installed |
| `--force` | `-f` | off | Overwrite an existing installation |
| `--all` | | off | Install for every supported agent |
| `--list` | `-l` | off | Print supported agents and exit |
| `--validate` | | | Validate a skill directory, or a folder of skill directories, against the Agent Skills specification and exit. Repeatable. Nothing is installed. |
| `--verbose` | `-v` | off | Enable verbose logging |
| `--quiet` | `-q` | off | Suppress all output except errors |

## After installation

Once installed, open your AI coding assistant and it can reference the 10xGraph skill documentation during your session. For Claude Code, the skill is loaded automatically from `.claude/skills/10xgraph/`. For Codex, it is available in `.agents/skills/10xgraph/`.

To update skills after a CLI upgrade, re-run the install with `--force`:

```bash
pip install --upgrade 10xgraph-api
10xgraph skills --agent claude --force
```

Before 0.7.0 the skill installed as `agentflow` (for example `.claude/skills/agentflow/`). The new install does not remove that folder, so delete it after installing `10xgraph`.

## Validate skills

`--validate` checks skills you write yourself, for your coding agent or for a 10xGraph `Agent` (see the [Skills reference](/docs/reference/python/skills)), against the [Agent Skills specification](https://agentskills.io/specification):

```bash
10xgraph skills --validate ./.agents/skills
10xgraph skills --validate ./skills/pdf-processing --validate ./shared-skills
```

Each path can be a single skill directory or a folder whose subdirectories are skills. The command prints a table with each skill's status and lists every problem:

- **Errors** break the specification: missing or invalid `name` / `description`, a name that does not match its folder, unknown frontmatter fields, non-string `metadata` values, invalid YAML.
- **Warnings** are recommendations: a `SKILL.md` body over 500 lines, or a `references/...`, `scripts/...` or `assets/...` path that does not exist.

The command exits with status `1` when any skill has an error, so it can run in CI. It needs a `10xgraph` release that includes `tenxgraph.core.skills.validate_skill`.

## Troubleshooting

**"Skill already installed" error**
- The target path already exists. Pass `--force` to overwrite.

**"stdin is not interactive" error when no `--agent` is given**
- You are running in a non-interactive environment (CI, pipe). Pass `--agent` explicitly: `10xgraph skills --agent claude`.

**"Bundled skills template not found"**
- The CLI installation may be corrupted. Try reinstalling: `pip install --force-reinstall 10xgraph-api`.
