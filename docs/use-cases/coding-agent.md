---
title: Build a Coding AI Agent in Python
description: How to build a coding AI agent in Python — code generation, file editing, test running, and the real-world tools production coding agents need.
keywords:
  - coding ai agent
  - ai code generation
  - python coding agent
  - code review agent
  - software engineering agent
sidebar_position: 4
---

# Build a coding AI agent in Python

Coding agents went from research demos to shipping products in 18 months. The architecture has stabilized: a graph that loops between an LLM and a small set of file-system + execution tools, with strict guardrails on what gets executed.

Here is the production-shaped pattern.

## Architecture at a glance

```
[ User instruction ]
       │
       ▼
[ Plan node ] ── LLM produces a plan, then approval interrupt
       │
       ▼
[ Execute loop ]
   ├── read_file
   ├── write_file (with diff approval)
   ├── run_tests
   ├── search_codebase
   └── done
       │
       ▼
[ Final summary ]
```

Two key ideas: **plan first, execute second** and **diffs need approval**.

## Why this shape

- **Plans catch ambiguity.** "Add caching" can mean ten things. Show the plan; let the user redirect cheaply.
- **Diffs need approval.** A coding agent that writes destructively without showing diffs becomes a liability fast.
- **Test feedback closes the loop.** The agent's "is this right?" check is the test suite, not its own self-confidence.

## The tools

```python
from pathlib import Path
import subprocess

def read_file(path: str) -> str:
    """Read the contents of a file relative to the repo root."""
    p = Path(path)
    if not p.is_relative_to(REPO_ROOT):
        return f"Path {path} is outside the repo. Refusing."
    if not p.exists():
        return f"File {path} does not exist."
    return p.read_text()[:50_000]  # cap at 50KB

def write_file(path: str, content: str, reason: str) -> str:
    """Propose writing a file. Returns the diff for human approval; does not write yet.

    Args:
        path: Relative file path.
        content: New file contents.
        reason: Why this change is being made.
    """
    p = Path(path)
    old = p.read_text() if p.exists() else ""
    diff = unified_diff(old, content, path)
    pending_writes.append({"path": path, "content": content, "diff": diff, "reason": reason})
    return f"Proposed change to {path}:\n\n{diff}\n\nApproval pending."

def run_tests(test_path: str = "") -> str:
    """Run the test suite (optionally narrowed by path)."""
    cmd = ["pytest", "-x", "--tb=short"]
    if test_path:
        cmd.append(test_path)
    result = subprocess.run(cmd, capture_output=True, timeout=120, text=True)
    output = (result.stdout + result.stderr)[-4000:]  # cap
    return f"Exit {result.returncode}\n\n{output}"

def search_codebase(query: str) -> str:
    """Grep-style search across the repo. Returns matching file paths and lines."""
    return run_grep(query)
```

Notes:

- **Path validation.** Always check that the path is inside the repo. Hostile prompts try to read `/etc/passwd`.
- **Output caps.** A test run that prints 1 MB of logs eats your context budget. Cap.
- **`write_file` does not actually write.** It proposes. A separate approval step (often a human) commits.

## The agent

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode

tool_node = ToolNode([read_file, write_file, run_tests, search_codebase])

agent = Agent(
    model="anthropic/claude-3-5-sonnet",
    system_prompt=[{"role": "system", "content": (
        "You are a coding assistant. "
        "Always start by exploring the codebase with read_file and search_codebase. "
        "Never write a file without first showing the user a plan and getting approval. "
        "After writing, always run tests. "
        "Stop and summarize when the task is complete."
    )}],
    tool_node="TOOL",
)
```

The system prompt is doing real work: it enforces the plan-first pattern and the always-test-after-write rule. Models follow these rules reliably with explicit instructions.

## Production considerations

- **Sandboxing.** A coding agent should not run on production hosts. Run inside Docker, or a single-tenant VM, or a managed sandbox like Modal or E2B.
- **Resource limits.** Cap CPU, memory, and wall time per `run_tests` call. Loops happen.
- **Network egress.** Disable or proxy outbound network from the sandbox unless the task requires it.
- **Diff approval flow.** For autonomous use, an LLM "reviewer" can approve trivial diffs but require human approval for >50 line changes or anything in `auth/`, `payments/`, etc.
- **Long contexts.** Coding tasks blow through context windows fast. Use models with 200k+ context, summarize old turns, or chunk by file.

## Variants

- **Code review agent** — read PR diff + tests, comment with suggestions
- **Migration agent** — apply mechanical refactors across many files
- **Bug-fix agent** — given a failing test, find and fix the cause
- **Documentation agent** — read code, generate or update docs

Same graph shape; different system prompts and tool sets.

## Metrics that matter

| Metric | Target |
|---|---|
| Tests passing after agent finishes | > 80% first run |
| Plan-acceptance rate | > 70% (lower means prompt is too vague) |
| Token cost per task | depends on repo size; budget $0.10–$2.00 |
| Wall-clock latency | tasks usually 1–10 minutes |

## Common mistakes

1. **Skipping the plan step.** Leads to the agent rewriting things you did not want changed.
2. **No path validation.** A prompt injection in a comment can pivot to read sensitive files.
3. **Unbounded test runs.** A test that hangs or runs for 20 minutes ruins the user experience.
4. **No diff approval.** First time the agent overwrites your `package.json`, you'll wish you had it.

## Further reading

- [ReAct agent with real APIs](/blog/react-agent-tools-real-apis) — tool design patterns
- [Production AI agents](/blog/production-ai-agents-observability-retries) — observability and retries
- [Multi-agent orchestration patterns](/blog/multi-agent-orchestration-python-7-patterns)
- [Get started](/docs/get-started)
