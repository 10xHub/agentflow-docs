---
title: Coming from agentflow
description: Migrate from the old agentflow package names to the new 10xGraph naming convention.
updated: "2026-10-08"
order: 130
group: "Next steps"
section: "Get started"
---

The 10xGraph project was renamed from Agentflow to avoid name collisions in search. The new package names are `10xgraph` (core) and `10xgraph-api` (server/CLI), with Python imports `tenxgraph` and `tenxgraph_api`. The old names work until version 2.0 with deprecation warnings, but you should migrate now. This guide walks you through the steps.

## Prerequisites

You have a project using one or more of:
- `10xscale-agentflow` (core package)
- `10xscale-agentflow-cli` (API server/CLI)
- The old imports `agentflow` or `agentflow_cli`
- The `agentflow` or `agentflow.json` config

Python 3.12 or higher is required for the new packages.

## Migration steps

### Step 1: Uninstall the old packages

The old and new packages provide overlapping modules, so you must uninstall the old ones first.

```bash
pip uninstall 10xscale-agentflow 10xscale-agentflow-cli -y
```

### Step 2: Install the new packages

Install the core framework and any provider extras you need.

```bash
pip install 10xgraph 10xgraph-api
```

If you use a specific LLM provider, include the extra:

```bash
# For Google Gemini
pip install "10xgraph[google-genai]" 10xgraph-api

# For OpenAI
pip install "10xgraph[openai]" 10xgraph-api

# For Anthropic Claude
pip install "10xgraph[anthropic]" 10xgraph-api

# For multiple providers
pip install "10xgraph[google-genai,openai,anthropic]" 10xgraph-api
```

For production deployments, also add optional features:

```bash
pip install "10xgraph[google-genai,pg_checkpoint,redis]" 10xgraph-api
```

### Step 3: Update Python imports

Replace `agentflow` with `tenxgraph` and `agentflow_cli` with `tenxgraph_api` throughout your codebase.

**Core framework imports** (in graph definitions, nodes, tools):

```python
# Old
from agentflow import StateGraph, Agent, Message
from agentflow.storage.checkpointer import PgCheckpointer

# New
from tenxgraph import StateGraph, Agent, Message
from tenxgraph.storage.checkpointer import PgCheckpointer
```

**API server imports** (in `10xgraph.json` agent paths, custom auth):

```python
# Old
from agentflow_cli import BaseAuth

# New
from tenxgraph_api import BaseAuth
```

Use the import paths from the `/docs/reference` pages to verify the correct location for any symbol you need.

### Step 4: Rename the config file

The API server looks for `10xgraph.json` first, then falls back to `agentflow.json`. Rename your configuration file to avoid ambiguity.

```bash
mv agentflow.json 10xgraph.json
```

If you have multiple environment-specific configs, rename them too:

```bash
mv agentflow.dev.json 10xgraph.dev.json
mv agentflow.prod.json 10xgraph.prod.json
```

The config structure has not changed. You only need to rename the file.

### Step 5: Update environment variables (optional)

The CLI respects both old and new environment variable names. If you set any of these, update them for consistency:

| Old name | New name |
|---|---|
| `AGENTFLOW_NO_FULLSCREEN` | `TENXGRAPH_NO_FULLSCREEN` |
| `AGENTFLOW_NO_SPINNER` | `TENXGRAPH_NO_SPINNER` |
| `AGENTFLOW_ASCII` | `TENXGRAPH_ASCII` |

The old names continue to work but print a deprecation warning. Updating them is optional until version 2.0.

### Step 6: Update WebSocket authentication (if applicable)

If your client uses WebSocket connections with authentication, the subprotocol name changed.

**Old protocol:**

```typescript
// Old
const ws = new WebSocket(
  'ws://localhost:8000/v1/graph/ws',
  'agentflow-bearer.v1'
);
```

**New protocol:**

```typescript
// New
const ws = new WebSocket(
  'ws://localhost:8000/v1/graph/ws',
  '10xgraph-bearer.v1'
);
```

The server accepts both subprotocol names for backward compatibility, but you should update your client code.

### Step 7: Verify the migration

Start the API server and invoke your agent to confirm everything works.

```bash
# Start the server
10xgraph api

# In another terminal, invoke the agent
curl -X POST http://localhost:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "thread_id": "test-thread"
  }' | jq .

# Or run a local Python test
python -c "
from tenxgraph import StateGraph, Agent
from tenxgraph.storage.checkpointer import InMemoryCheckpointer

# Quick sanity check
graph = Agent(model='google/gemini-2.5-flash')
config = {'checkpointer': InMemoryCheckpointer()}
compiled = graph.compile(**config)
print('Graph compiled successfully')
"
```

If your imports resolve and the agent runs, the migration is complete.

## Handling old aliases (deprecated but functional)

The old names work until 2.0 but emit deprecation warnings:

- `import agentflow` still works and imports `tenxgraph` internally.
- The CLI command `agentflow` still exists; it prints a notice and runs the command.
- Old environment variable names (`AGENTFLOW_*`) still work.
- The config file `agentflow.json` still loads if `10xgraph.json` does not exist.

You do not need to fix these immediately, but expect warnings. Migration is encouraged to avoid breakage when 2.0 is released.

## Directory and naming changes

Beyond code and config, a few runtime paths have changed. These are usually transparent, but know where they are:

| What | Old location | New location |
|---|---|---|
| Home directory | `~/.agentflow` | `~/.10xgraph` |
| Media scheme | `agentflow://media/` | `graph://media/` |
| Logger names | `agentflow.*` | `tenxgraph.*` |

**Home directory.** Used by SQLite checkpointer defaults. If you set a custom path, no change needed. Otherwise, the first run creates `~/.10xgraph` and reads from `~/.agentflow` as a fallback if that does not exist.

**Media scheme.** If your code references media URIs directly (e.g., for logging or storage backends), update the scheme. Old `agentflow://` URIs still resolve, so code works without change, but new code should use `graph://media/`.

**Logger names.** If you configure logging by module name (e.g., `logging.getLogger("agentflow.core")`), update to `tenxgraph.core`.

## Common issues

### Issue: `ModuleNotFoundError: No module named 'agentflow'`

After uninstalling the old package, Python cannot find the `agentflow` module if you still import from it. **Action:** Update all imports to use `tenxgraph` and `tenxgraph_api` as shown in step 3.

### Issue: Import paths like `agentflow.graph` or `agentflow.state` fail

The package was restructured; there are no top-level `state` or `graph` shims. **Action:** Use the canonical paths from the reference pages. Example:

```python
# Wrong
from agentflow.graph import StateGraph

# Correct
from tenxgraph.core.graph import StateGraph
```

### Issue: `10xgraph api` fails with config file not found

The server looks for `10xgraph.json` in the current directory. If you renamed `agentflow.json` to something else or placed it elsewhere, the server cannot find it. **Action:** Ensure `10xgraph.json` is in the working directory, or pass `--config /path/to/config.json`.

```bash
10xgraph api --config ./config/10xgraph.json
```

### Issue: Deprecation warnings from old imports

Old imports like `from agentflow import ...` work but print warnings. **Action:** This is normal during migration. Update imports to silence warnings.

### Issue: WebSocket connection fails with subprotocol error

Old clients using the `agentflow-bearer` subprotocol may fail if the server strictly requires the new subprotocol. **Action:** Update the subprotocol name to `10xgraph-bearer.v1` in your client code (step 6).

## What stays the same

The agent graph logic, message format, checkpointer API, and evaluation framework are unchanged. You do not need to rewrite your graphs or tests.

- Graph definitions (nodes, edges, state) are identical.
- Message and state APIs have not changed.
- `10xgraph.json` structure is the same; only the filename changed.
- All checkpoint data and thread history remain valid.

Migration is a rename, not a rewrite.

## What's next

Once you have migrated, explore the new features and guides:

- `/docs/concepts/state-graph` — dive deeper into graph mechanics.
- `/docs/guides/prebuilt-agents` — use prebuilt agents for common patterns.
- `/docs/server/configure` — configure the API server for production.
- `/docs/reference` — the full API reference for Python and REST endpoints.

All guides use the new `tenxgraph` and `10xgraph-api` names.

## FAQ

### Do I have to migrate now?

No, the old names work until version 2.0. However, migrating now avoids future breakage and gives you access to new features and bug fixes that are released under the new names.

### Can I use both old and new names in the same project?

Not recommended. Uninstall the old packages before installing the new ones, as both provide an `agentflow` module and will conflict.

### Will my old API calls still work?

Yes. The HTTP API is unchanged; only the CLI command and package names changed. If your client uses the REST API (not the CLI), no changes are needed on the client side. You only need to update your server-side code and configuration.

### What about the TypeScript client?

The TypeScript client package is still `@10xscale/agentflow-client` for now (renamed npm package not yet released). It will be renamed to `@10xgraph/client` in a future release. Update when you upgrade.

### How do I report issues with the migration?

File an issue on [GitHub](https://github.com/10xGraph/10xGraph) with:
- The old package/import you were using.
- The new one you migrated to.
- The error or unexpected behavior.
