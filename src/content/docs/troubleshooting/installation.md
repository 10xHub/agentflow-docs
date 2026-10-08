---
title: Installation Troubleshooting
description: Symptoms, causes, and fixes for common 10xGraph installation and environment setup issues.
section: Troubleshooting
order: 20
updated: "2026-10-08"
---

Use this page when 10xGraph fails before your app even starts: package install problems, import errors, missing dependencies, or broken Python environments.

## Troubleshooting flow

```mermaid
flowchart TD
    A[Install or import fails] --> B[Check Python version]
    B --> C[Check active virtual environment]
    C --> D[Check installed packages]
    D --> E[Check optional extras and provider deps]
    E --> F[Retry import or command]
```

## Issue: `pip install` fails

**Symptoms**

- install command exits with dependency errors
- build tools or package resolution fails

**Likely causes**

- unsupported Python version
- stale virtual environment
- conflicting previously installed packages

**Fix**

- use Python 3.12+
- create a fresh virtual environment
- reinstall inside the fresh environment

## Issue: `10xgraph` command is not found

**Symptoms**

- shell says command not found

**Likely causes**

- CLI package not installed
- virtual environment not activated
- shell path points at a different Python environment

**Fix**

```bash
pip install 10xgraph-api
which 10xgraph
10xgraph version
10xgraph audit          # interpreter, packages, project config, and port
```

If `which 10xgraph` points somewhere unexpected, activate the correct environment first. `10xgraph audit` reports the interpreter it runs under and the installed CLI and core versions, so it is the fastest way to spot a wrong environment or a CLI/core version skew.

## Issue: upgrading from `10xscale-agentflow-cli`

**Symptoms**

- `pip list` still shows `10xscale-agentflow-cli` or `10xscale-agentflow`
- imports of `agentflow` resolve to the wrong package after an upgrade

**Cause**

Since 0.7.0 the API package is `10xgraph-api` and the core is `10xgraph`. The old `10xscale-agentflow-cli` and `10xscale-agentflow` packages each ship an `agentflow` module, so they must not stay installed next to the new ones.

**Fix**

```bash
pip uninstall 10xscale-agentflow-cli 10xscale-agentflow
pip install 10xgraph-api
```

Then run `10xgraph` instead of `agentflow`. Until 2.0 the old command, `agentflow.json` and `from agentflow_cli import ...` keep working, so you can rename the config file and imports at your own pace.

## Issue: imports fail even after install

**Symptoms**

- `ModuleNotFoundError`
- `ImportError` during graph import or script execution

**Likely causes**

- package installed in a different environment
- optional dependency not installed
- import path in your code is outdated

**Fix**

- verify `python -c "import tenxgraph; print(tenxgraph.__file__)"`
- verify you are using current import paths in docs and code
- install optional extras when needed

## Issue: optional features fail at runtime

**Symptoms**

- a feature works until you use Postgres, A2A, or another optional integration
- runtime error says a package is missing

**Likely cause**

- optional dependencies were not installed

**Fix**

Install the required extras or packages for the feature you are actually using.

## Issue: environment variables appear to be ignored

**Symptoms**

- provider keys seem unset
- app behaves as if `.env` was not loaded

**Likely causes**

- `env` field missing from `10xgraph.json`
- `.env` file in the wrong directory
- variables exported in one shell but server started from another

**Fix**

- verify `10xgraph.json` points to the correct `.env`
- verify the file exists relative to the project root
- test with a direct Python import from the same shell session

## Related docs

- [Installation](/docs/get-started/installation)
- [Configure 10xgraph.json](/docs/server/configure)
- [Environment Variables](/docs/server/production-checklist)
- [Error Codes Reference](/docs/reference/error-codes)

## What you learned

- How to isolate installation problems to Python version, environment activation, missing packages, or missing config.
