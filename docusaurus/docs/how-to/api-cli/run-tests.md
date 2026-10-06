---
title: Run Tests — CLI how-to
sidebar_label: Run Tests
description: How to run your AgentFlow project's test suite using agentflow test. Covers coverage, thresholds, keyword filters, and agentflow.json configuration.
keywords:
  - agentflow test
  - agentflow cli
  - pytest wrapper
  - agentflow
  - python ai agent framework
  - run tests coverage
---


# Run tests

The `agentflow test` command is a thin wrapper around pytest. It runs from the project root, reads optional defaults from `agentflow.json`, and forwards any extra arguments to pytest directly.

## Prerequisites

pytest must be installed in your environment:

```bash
pip install pytest
```

For coverage reports, also install pytest-cov:

```bash
pip install pytest-cov
```

## Quick start

From the folder that contains `agentflow.json`:

```bash
agentflow test
```

No path is passed to pytest, so pytest uses its own discovery rules: it reads `testpaths` from `pytest.ini` or `pyproject.toml`, or falls back to scanning the current directory. This matches the behaviour of running `pytest` directly.

## Target a specific path

Provide a path to restrict the run to a directory or file:

```bash
# A subdirectory
agentflow test tests/unit

# A single file
agentflow test tests/unit/test_graph.py
```

When a path is given, pytest only collects tests under that path.

## Run with coverage

```bash
agentflow test --coverage
```

This adds the following flags to pytest:

```
--cov=. --cov-report=term-missing --cov-report=html:htmlcov
```

A summary is printed in the terminal and a full HTML report is written to `htmlcov/index.html`.

### Open the HTML report automatically

```bash
agentflow test --coverage --html
```

After the test run completes, the HTML coverage report opens in your default browser.

## Filter tests by keyword

```bash
agentflow test -k "weather"
```

The `-k` expression is forwarded directly to pytest. Only tests whose name or node ID matches the expression are collected and run.

## Pass raw pytest arguments

Use `--` to separate `agentflow test` options from raw pytest arguments:

```bash
# Short output, show only failures
agentflow test -- -q --tb=short

# Combine with coverage
agentflow test --coverage -- --tb=long --no-header
```

Everything after `--` is appended verbatim to the pytest command.

## Configure defaults in agentflow.json

Add a `test` section to `agentflow.json` to set project-level defaults. All fields are optional. CLI flags always take precedence over config values.

```json
{
  "agent": "graph.react:app",
  "test": {
    "path": "tests",
    "coverage": true,
    "coverage_threshold": 80
  }
}
```

| Field | Description |
| --- | --- |
| `path` | Default test path when no `PATH` argument is given |
| `coverage` | Enable coverage on every run without needing `--coverage` |
| `coverage_threshold` | Minimum coverage percentage; the run fails if coverage drops below this value |

With this config, a bare `agentflow test` is equivalent to:

```bash
agentflow test tests --coverage -- --cov-fail-under=80
```

### Enforce a coverage threshold in CI

Set `coverage_threshold` in `agentflow.json` and run `agentflow test` in CI. If coverage falls below the threshold, pytest exits with a non-zero code and the CI step fails.

```yaml
# .github/workflows/ci.yml (example)
- name: Run tests
  run: agentflow test --coverage
```

No extra flags needed in the workflow — the threshold is already declared in the config file.

## Verbose and quiet modes

```bash
# Extra pytest output
agentflow test --verbose

# Suppress everything except errors
agentflow test --quiet
```

## Common scenarios

**Run a fast smoke test against one file:**

```bash
agentflow test tests/test_smoke.py -k "health"
```

**Full coverage check during local development:**

```bash
agentflow test --coverage --html
```

**Strict CI run with threshold:**

```json
{
  "test": {
    "coverage": true,
    "coverage_threshold": 70
  }
}
```

```bash
agentflow test
```

**Pass pytest markers:**

```bash
agentflow test -- -m "not integration"
```

## Common issues

**"No module named pytest"**
- Install pytest: `pip install pytest`

**"No module named pytest_cov"**
- Install pytest-cov: `pip install pytest-cov`

**Coverage is below threshold, run fails**
- The exit code reflects the threshold failure. Increase test coverage or lower `coverage_threshold` in `agentflow.json`.

**Tests directory not found**
- Pass the correct path explicitly: `agentflow test src/tests`
- Or update `"path"` in the `test` section of `agentflow.json`
