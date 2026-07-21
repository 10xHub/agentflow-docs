---
title: Install Skills — CLI how-to
sidebar_label: Install Skills
description: How to use agentflow skills to install bundled coding-agent skills for Codex, Claude, and GitHub Copilot.
keywords:
  - agentflow skills
  - agentflow cli
  - coding agent skills
  - claude skills
  - codex skills
  - github copilot
  - agentflow
  - python ai agent framework
---

# Install skills

`agentflow skills` installs bundled AgentFlow coding-agent skills into your project. These skills teach Codex, Claude, or GitHub Copilot how to work with the AgentFlow framework in your codebase.

## What skills are

Skills are collections of documentation and instructions that coding agents read to understand your project's patterns, conventions, and APIs. Installing skills gives your AI coding assistant knowledge of AgentFlow's graph model, tool patterns, and project layout without having to explain it from scratch every session.

## Supported agents

| # | Agent | Install path |
| --- | --- | --- |
| 1 | Codex | `.agents/skills/agentflow/` |
| 2 | Claude | `.claude/skills/agentflow/` |
| 3 | GitHub | `.github/skills/agentflow/` and `.github/instructions/agentflow.instructions.md` |

List supported agents:

```bash
agentflow skills --list
```

## Quick install (interactive)

From the root of your project:

```bash
agentflow skills
```

If stdin is a terminal, the CLI shows a numbered menu and prompts you to choose an agent. Enter a number (`1`, `2`, or `3`) or type the agent name.

## Install for a specific agent

Skip the interactive menu by naming the agent:

```bash
agentflow skills --agent claude
agentflow skills --agent codex
agentflow skills --agent github
```

The `--agent` flag accepts the agent name (case-insensitive) or its menu number.

## Install for all agents at once

```bash
agentflow skills --all
```

This installs skills for Codex, Claude, and GitHub in a single command. Any agent that already has skills installed is skipped unless `--force` is also passed.

## Install in a different directory

By default the skills are installed relative to the current working directory. Pass `--path` to target a different project root:

```bash
agentflow skills --agent claude --path ./my-other-project
```

The CLI refuses to install skills at the filesystem root or directly in the home directory.

## Overwrite an existing installation

If skills are already installed, the command exits with an error to prevent accidental overwrites. Pass `--force` to replace the existing installation:

```bash
agentflow skills --agent claude --force
agentflow skills --all --force
```

## What gets installed

### Codex and Claude

A folder named `agentflow` is copied into the agent's skills directory (`.agents/skills/` or `.claude/skills/`). It contains a `SKILL.md` entry point and a `references/` directory with topic-specific documentation.

A manifest file (`.agentflow-skill.json`) is written into the installed directory recording the target agent, CLI version, and installation timestamp.

### GitHub Copilot

Two artifacts are installed:

1. `.github/instructions/agentflow.instructions.md` — a single instruction file read by GitHub Copilot
2. `.github/skills/agentflow/` — the full skills folder with the same content as Codex and Claude

A manifest is written into the skills folder.

## Options reference

| Option | Short | Default | Description |
| --- | --- | --- | --- |
| `--agent` | `-a` | (prompt) | Agent name or menu number: `codex`, `claude`, `github`, `1`, `2`, `3` |
| `--path` | `-p` | `.` | Project directory where skills are installed |
| `--force` | `-f` | off | Overwrite an existing installation |
| `--all` | | off | Install for every supported agent |
| `--list` | `-l` | off | Print supported agents and exit |
| `--verbose` | `-v` | off | Enable verbose logging |
| `--quiet` | `-q` | off | Suppress all output except errors |

## After installation

Once installed, open your AI coding assistant and it can reference the AgentFlow skill documentation during your session. For Claude Code, the skill is loaded automatically from `.claude/skills/agentflow/`. For Codex, it is available in `.agents/skills/agentflow/`.

To update skills after a CLI upgrade, re-run the install with `--force`:

```bash
pip install --upgrade 10xscale-agentflow-cli
agentflow skills --agent claude --force
```

## Troubleshooting

**"Skill already installed" error**
- The target path already exists. Pass `--force` to overwrite.

**"stdin is not interactive" error when no `--agent` is given**
- You are running in a non-interactive environment (CI, pipe). Pass `--agent` explicitly: `agentflow skills --agent claude`.

**"Bundled skills template not found"**
- The CLI installation may be corrupted. Try reinstalling: `pip install --force-reinstall 10xscale-agentflow-cli`.
