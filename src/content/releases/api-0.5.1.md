---
package: api
version: "0.5.1"
date: 2026-09-24
summary: Reworks the CLI around a full-screen, animated terminal experience with new dev, audit, demo and config commands, guided prompts and machine-readable output modes.
breaking: false
---

### Added

- **`agentflow dev`**, a goal-oriented local development command (config, host, port, `--reload/--no-reload`, `--open/--no-open`). `api` and `play` remain available.
- **`agentflow audit`** runs six read-only checks: Python interpreter, installed `10xscale-agentflow-cli`, installed `10xscale-agentflow`, whether the installed core still exposes the evaluation API that `agentflow eval` imports, whether `agentflow.json` exists with a valid `agent` key, and whether the default port is free. It exits `1` on any failure and `0` otherwise (warnings do not fail the run), so it works as a CI gate.
- **`agentflow demo`** previews the animation, timeline and progress states without touching project state (`--style all|typing|network|init|build|eval`).
- **`agentflow config list|get|set|unset|path|validate`** manages cross-platform user preferences stored as JSON in the per-user config directory. `output.format`, `output.color` and `output.progress` are read at startup as defaults, and explicit flags still win.
- **Persistent full-screen surface** on interactive terminals, with a pinned header and footer status bar and the command output scrolling between them. Opt out with `--no-fullscreen` or `AGENTFLOW_NO_FULLSCREEN=1`.
- **Animated command intros, live step timelines and determinate progress.** Timelines are wired into `play`, `dev`, `api`, `init`, `build`, `test` and `audit`, and `agentflow eval` shows a progress bar with a running pass/fail tally.
- **Shared guided-prompt layer.** Every interactive question uses one themed service with a clean Ctrl+C exit and a single non-interactive policy. `agentflow skills` now uses an arrow-key list where space toggles and enter confirms, and `agentflow init` explains each option inline.
- **Root options** `--format`, `--json`, `--color`, `--no-color`, `--progress`, `--animation/--no-animation`, `--fullscreen/--no-fullscreen`, `--cwd`, `--yes`, `--non-interactive`, `--debug` and `-V/--version`.
- Adaptive rendering with TTY and CI detection, plain and JSONL modes, `NO_COLOR` support, an ASCII fallback and quiet mode.
- Reproducible `agentflow init --non-interactive` recipes and `--dry-run` previews.
- Staged startup feedback, a pre-flight port check and connected-playground completion output for `agentflow play` and `agentflow dev`.
- Stable CLI error codes and dependency recovery suggestions.

### Changed

- Command implementations load lazily, so a broken optional feature no longer prevents root help, version, completion or unrelated commands from starting.
- CLI logging uses one invocation-wide handler, so quiet and verbose levels apply consistently without duplicate records.
- Project configuration discovery walks parent directories from the current working directory.
- `agentflow init` no longer prints one line per scaffolded file. Files stream through the active timeline row instead.
- The `agentflow init` template configures JWT with the bare `"jwt"` string, which is the form `agentflow.json` accepts for the built-in method.
- The error for dynamic tool setup in production or multi-tenant mode now names which condition tripped (`MODE` or a configured auth backend) and points to `CompiledGraph.attach_remote_tools()` as the static alternative.

### Fixed

- **The full-screen session no longer erases the command's output.** Each line used to overwrite the last, and releasing the screen discarded everything drawn on it.
- **A terminal that cannot host a prompt no longer crashes the command.** Under MSYS or Cygwin shells on Windows, `stdin.isatty()` is true but prompt-toolkit cannot attach, which surfaced as `AF-INTERNAL-001`. Such terminals are now treated as non-interactive.
- Pinned chrome is repainted after each prompt, and one Rich `Console` is reused per stream so background output no longer collides with spinners and progress bars.
- A console that reports itself as a terminal but refuses the alternate buffer (legacy Windows console) now aborts the frame before writing anything.
