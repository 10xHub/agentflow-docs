---
title: Run Tests
seoTitle: "Run your agent test suite from the CLI"
description: Run your 10xGraph project's test suite with 10xgraph test. Configure coverage thresholds and CI gates via 10xgraph.json.
section: "Testing and evaluation"
group: "Unit tests"
order: 30
label: Run Tests
updated: "2026-10-08"
faq:
  - question: "Do I need to write tests in a specific way for 10xgraph test?"
    answer: "No. `10xgraph test` is a wrapper around pytest, so any pytest test works as-is. Write tests with the test-building tools described in /docs/testing/unit-tests."
  - question: "Can I enforce coverage requirements in CI?"
    answer: "Yes. Set `coverage_threshold` in 10xgraph.json and the command will fail if coverage drops below that percentage. The exit code ensures CI gates work correctly."
  - question: "How do I run only specific tests?"
    answer: "Use `-k` to filter by name: `10xgraph test -k \"weather\"` runs only tests whose name contains 'weather'. Or pass a directory/file path to run tests in that location only."
---

The `10xgraph test` command runs your project's test suite and measures code coverage. It is a thin wrapper around pytest that reads your project configuration from `10xgraph.json`, so you can set coverage thresholds and test paths once and enforce them in CI without duplicating settings.

## Prerequisites

Your environment needs pytest and, if you want coverage reports, pytest-cov. These are standard dependencies that belong in your project's `pyproject.toml` or `requirements.txt`:

```bash
pip install pytest pytest-cov
```

Pytest discovers tests automatically from your project root, looking for files named `test_*.py` or `*_test.py` and functions named `test_*`. You can customize discovery with a `pytest.ini` or `pyproject.toml` configuration file (see [pytest docs](https://docs.pytest.org/)); the `10xgraph test` command respects those settings.

## Run your tests

From the folder that contains `10xgraph.json`, run all tests:

```bash
10xgraph test
```

The command runs pytest from the project root using pytest's own discovery rules: it reads `testpaths` from `pytest.ini` or `pyproject.toml`, or falls back to scanning the current directory. This behavior matches running `pytest` directly.

If the test run succeeds, `10xgraph test` exits with code 0. If any test fails, it exits with code 1. If you have set a `coverage_threshold` in `10xgraph.json` and coverage falls below that threshold, the command exits with code 1 even if all tests pass.

## Target a specific test path

Restrict the run to a directory or file by providing a path argument:

```bash
# Run all tests in a subdirectory
10xgraph test tests/unit

# Run a single test file
10xgraph test tests/unit/test_graph.py
```

When you provide a path, pytest only collects tests under that location. This is useful for running a fast subset of tests during local development before running the full suite in CI.

## Measure code coverage

Add `--coverage` to enable code coverage reporting:

```bash
10xgraph test --coverage
```

This adds the following flags to pytest:

```
--cov=. --cov-report=term-missing --cov-report=html:htmlcov
```

The command prints a coverage summary in the terminal and writes a detailed HTML report to `htmlcov/index.html`. The HTML report shows which lines are covered, which are missing, and why: you can click into each file to see untested branches. This helps you understand coverage gaps without reading raw data.

To open the report in your default browser automatically:

```bash
10xgraph test --coverage --html
```

After the test run completes, the browser opens to `htmlcov/index.html`.

## Filter tests by keyword expression

Run only tests matching a name pattern with the `-k` option:

```bash
10xgraph test -k "weather"
```

This forwards the expression directly to pytest. Only tests whose name or node ID matches the expression are collected and run. Expressions support `and`, `or`, and `not`: for example, `-k "weather and not slow"` runs tests with "weather" in the name, excluding those with "slow".

## Pass raw pytest arguments

Use `--` to separate `10xgraph test` options from raw pytest arguments that you want to pass through unchanged:

```bash
# Quiet output, short tracebacks
10xgraph test -- -q --tb=short

# Long tracebacks, no header
10xgraph test --coverage -- --tb=long --no-header

# Run only fast tests, skip slow and integration
10xgraph test -- -m "not slow and not integration"
```

Everything after `--` is appended to the pytest command verbatim. This lets you use any pytest feature without writing custom CLI options in `10xgraph test` itself.

## Configure your testing defaults

Add a `test` section to `10xgraph.json` to set project-level defaults for path, coverage, and coverage threshold. CLI flags always take precedence over config values:

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

| Field | Type | Description |
| --- | --- | --- |
| `path` | string | Default test directory or file when no `PATH` argument is given. If unset, pytest auto-discovers from the current directory. |
| `coverage` | boolean | If `true`, enable coverage reporting on every run without needing `--coverage`. Defaults to `false`. |
| `coverage_threshold` | integer | Minimum coverage percentage (0-100). The test run fails if coverage drops below this value. When set, the threshold is enforced even if tests pass. Defaults to unset (no threshold). |

With the config above, a bare `10xgraph test` is equivalent to running:

```bash
10xgraph test tests --coverage -- --cov-fail-under=80
```

## Enforce coverage in CI

To fail the CI pipeline when code coverage drops below a target, set `coverage_threshold` in `10xgraph.json` and run `10xgraph test --coverage` in your CI workflow. The command exits with a non-zero code if coverage falls short, which stops the pipeline.

Here is a GitHub Actions example:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - name: Run tests with coverage
        run: 10xgraph test --coverage
```

The `coverage_threshold` from `10xgraph.json` ensures the threshold is enforced without repeating it in the workflow. Other CI systems (GitLab CI, CircleCI, Jenkins, etc.) follow the same pattern: install dependencies, then run `10xgraph test --coverage`. The exit code works the same way everywhere.

## Control output verbosity

By default, `10xgraph test` runs in verbose mode (`-v`), printing one line per test. You can change this:

```bash
# Very detailed output with full tracebacks
10xgraph test --verbose

# Quiet output: only show errors and summary
10xgraph test --quiet
```

## Common workflows

**Run a fast smoke test during development:**

```bash
10xgraph test tests/test_smoke.py -k "health"
```

This runs only tests in the smoke test file with "health" in the name. Useful for quick validation before committing.

**Full coverage check with a visual report:**

```bash
10xgraph test --coverage --html
```

This generates a detailed HTML coverage report and opens it in your browser. You can browse the report to find uncovered lines and decide which ones need tests.

**Strict CI gate with a high threshold:**

```json
{
  "test": {
    "coverage": true,
    "coverage_threshold": 85
  }
}
```

```bash
10xgraph test
```

In CI, this ensures both that tests pass and that coverage never drops below 85%.

**Run all except slow or integration tests locally:**

```bash
10xgraph test -- -m "not slow and not integration"
```

This is useful when you want fast feedback during development. Mark slow tests with `@pytest.mark.slow` and integration tests with `@pytest.mark.integration` in your test code.

## Troubleshoot common errors

**"No module named pytest"**

Pytest is not installed. Install it in your environment:

```bash
pip install pytest
```

If you use a virtual environment or uv, activate it first.

**"No module named pytest_cov"**

The pytest-cov plugin is not installed. Install it:

```bash
pip install pytest-cov
```

Coverage reporting requires this plugin. If you never use `--coverage`, you do not need it.

**Coverage is below threshold, tests fail**

The test command exits with code 1 because coverage fell below `coverage_threshold` in `10xgraph.json`. Either increase your test coverage, or lower the threshold if the current target is unrealistic. Check the coverage report (`htmlcov/index.html` after running with `--coverage`) to see which lines are uncovered.

**Tests directory not found or no tests collected**

Pytest did not find any tests. Check the path:

```bash
# Explicit path
10xgraph test tests

# Or list what pytest finds
pytest --collect-only
```

If the path is correct, ensure your test files are named `test_*.py` or `*_test.py`, and test functions are named `test_*`. You can customize this in `pytest.ini` or `pyproject.toml`.

**Import errors in tests**

If your tests import your agent code, ensure the project is installed in editable mode:

```bash
pip install -e .
```

This makes your source code importable from tests.

## Next steps

Once your test suite is running, explore the unit testing tools in `/docs/testing/unit-tests` to write tests more effectively. For evaluation (checking whether an agent answers questions correctly), see `/docs/testing/evaluation` instead.
