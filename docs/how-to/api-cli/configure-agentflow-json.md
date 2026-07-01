---
title: Configure agentflow.json — Python AI Agent Framework
sidebar_label: Configure agentflow.json
description: How to configure agentflow.json for checkpointers, stores, auth, and environment variables. Part of the AgentFlow agentflow api guide for production-ready.
keywords:
  - agentflow api
  - agentflow cli
  - agent rest api
  - agentflow
  - python ai agent framework
  - configure agentflowjson
---


# Configure agentflow.json

`agentflow.json` is the single source of truth for how your API server behaves. This guide walks through each field with examples and explains when to use each option. For a complete reference, see [agentflow.json Configuration Reference](../../reference/api-cli/configuration.md).

## Basic structure

Every `agentflow.json` must have at least an `agent` field:

```json
{
  "agent": "graph.react:app"
}
```

This tells the server where to load your compiled graph from. All other fields are optional but recommended for production.

## Core fields

### agent (required)

The import path to your compiled graph, in the format `module:attribute`:

```json
{
  "agent": "graph.react:app"
}
```

This import happens when the server starts. The module `graph.react` is imported and the `app` attribute is retrieved. The `app` must be a `CompiledGraph` instance:

```python
# graph/react.py
from agentflow.core.graph import StateGraph

state_graph = StateGraph(MyState)
# ... add nodes, edges ...
app = state_graph.compile()  # app is the compiled graph
```

**Why it matters:** If this import fails, the server will not start. Common issues:
- The module does not exist (typo in the path)
- The attribute does not exist on the module
- The module has syntax errors

**Debugging:** Test the import manually:

```bash
python -c "from graph.react import app; print(type(app))"
```

### env (optional)

Path to a `.env` file containing environment variables:

```json
{
  "agent": "graph.react:app",
  "env": ".env"
}
```

The server uses `python-dotenv` to load this file before importing your graph module. This is useful for:

- **Development secrets** (API keys, database URLs) that should not be committed to git
- **Local overrides** of production variables for testing

Example `.env`:

```bash
# API keys
GOOGLE_API_KEY=sk-abc123...
OPENAI_API_KEY=sk-def456...

# Database connections
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql://user:pass@localhost/mydb

# Feature flags
ENABLE_STREAMING=true
```

Your graph code accesses them:

```python
import os

api_key = os.environ["GOOGLE_API_KEY"]
```

**Important:** Never commit `.env` files to version control. Add `.env` to `.gitignore`.

**In production:** Pass environment variables via container/process environment, not `.env` files:

```bash
export GOOGLE_API_KEY=...
export REDIS_URL=...
agentflow api --no-reload
```

## Persistence: Checkpointer

### Without a checkpointer

Each API request is stateless. There is no conversation history. The next request forgets all prior context.

### With a checkpointer

Conversation state is saved after each step. By providing a `thread_id`, you can resume a conversation later:

```bash
# First request
curl -X POST http://localhost:8000/v1/graph/invoke \
  -d '{
    "messages": [{"role": "user", "content": "What is my name?"}],
    "config": {"thread_id": "user-123"}
  }'

# Second request (same thread, context is preserved)
curl -X POST http://localhost:8000/v1/graph/invoke \
  -d '{
    "messages": [{"role": "user", "content": "Remind me what I just asked."}],
    "config": {"thread_id": "user-123"}
  }'
```

### Adding a checkpointer

**Development (in-memory, lost on restart):**

```python
# graph/dependencies.py
from agentflow.storage.checkpointer import InMemoryCheckpointer

my_checkpointer = InMemoryCheckpointer()
```

```json
{
  "agent": "graph.react:app",
  "checkpointer": "graph.dependencies:my_checkpointer"
}
```

Fast and easy, but state is lost when the server restarts.

**Production (PostgreSQL + Redis):**

Install the optional dependency:

```bash
pip install 10xscale-agentflow[pg_checkpoint]
```

Create the checkpointer:

```python
# graph/dependencies.py
from agentflow.storage.checkpointer import PgCheckpointer

my_checkpointer = PgCheckpointer(
    db_url="postgresql+asyncpg://user:password@localhost/agentflow",
    redis_url="redis://localhost:6379/0",
    table="state_checkpoints",  # Optional: customize table name
)
```

```json
{
  "agent": "graph.react:app",
  "checkpointer": "graph.dependencies:my_checkpointer"
}
```

This persists all state to a PostgreSQL database, enabling:
- Durable conversation history across server restarts
- Multi-server deployments (shared state)
- Data retention and compliance

**Health check:** Verify the checkpointer is accessible:

```bash
curl -X GET http://localhost:8000/v1/threads
```

If the database is unreachable, you get a 500 error.

## Thread name generation

When a new conversation thread is created, generate a human-readable name instead of a raw UUID:

```python
# graph/thread_name_generator.py
from agentflow_cli.src.app.utils.thread_name_generator import ThreadNameGenerator

class MyThreadNameGenerator(ThreadNameGenerator):
    async def generate_name(self, messages: list[str]) -> str:
        # Optionally use message context or an LLM
        return "thoughtful-conversation"

my_generator = MyThreadNameGenerator()
```

```json
{
  "agent": "graph.react:app",
  "thread_name_generator": "graph.thread_name_generator:MyThreadNameGenerator"
}
```

When a new thread is created via the API, it automatically gets a readable name like `exploring-ideas` instead of `550e8400-e29b-41d4-a716-446655440000`.

## Observability

Send graph, node, LLM, and tool spans to [Pydantic Logfire](https://pydantic.dev/logfire) and/or [LangSmith](https://docs.langchain.com/langsmith/) by adding an `observability` block. The server configures the exporters and attaches the tracing publisher at startup — you do not call any setup helper yourself.

```json
{
  "agent": "graph.react:app",
  "observability": {
    "level": "standard",
    "logfire":   { "enabled": true, "service_name": "my-agent", "send_to_logfire": true, "console": false },
    "langsmith": { "enabled": true, "project": "my-agent", "endpoint": null }
  }
}
```

Keep the secrets in `.env`, never in `agentflow.json`:

```bash
LOGFIRE_TOKEN=your-logfire-write-token
LANGSMITH_API_KEY=your-langsmith-api-key
```

Field notes:

- `level` — `spans` (timing only), `standard` (default; token counts, model, params — no message content), or `full` (adds prompt/completion content; PII risk, opt in deliberately).
- `logfire.enabled` / `langsmith.enabled` — turn each backend on independently; enable both to fan out to both.
- `langsmith.endpoint` — leave `null` for the default, or set a regional base URL like `https://eu.api.smith.langchain.com/otel`.
- Requires the extra: `pip install '10xscale-agentflow[observability]'`. If a backend is enabled but its package or key is missing, the server logs a warning and starts without that exporter.

For the equivalent Python API (`setup_logfire` / `setup_langsmith` / `setup_observability` and the dedicated publishers), see [Send traces to Logfire and LangSmith](../python/send-traces-to-logfire-langsmith.md).

## Authentication

### No authentication (development only)

```json
{
  "agent": "graph.react:app",
  "auth": null
}
```

Or omit the `auth` field entirely. All requests are accepted.

### JWT authentication

```json
{
  "agent": "graph.react:app",
  "auth": "jwt"
}
```

Add required environment variables:

```bash
export JWT_SECRET_KEY="your-long-random-secret-key-at-least-32-chars"
export JWT_ALGORITHM="HS256"
agentflow api
```

Clients must now provide a valid JWT token in every request:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/v1/graph/invoke
```

Requests without a valid token get a `401 Unauthorized` response.

### Custom authentication

For integration with external identity providers (OAuth, SAML, custom API keys):

```python
# graph/auth.py
from agentflow_cli.src.app.core.auth.base_auth import BaseAuth

class MyCustomAuth(BaseAuth):
    async def authenticate(self, request) -> dict | None:
        # Check custom header or token
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return None
        
        # Verify against your system
        user = await verify_api_key(api_key)
        if not user:
            return None
        
        # Return user info for authorization later
        return {"user_id": user.id, "role": user.role}
```

```json
{
  "agent": "graph.react:app",
  "auth": {
    "method": "custom",
    "path": "graph.auth:MyCustomAuth"
  }
}
```

### Authorization (fine-grained permissions)

After authenticating, restrict which users can access which endpoints:

```python
# graph/auth.py
class MyAuthorizationBackend:
    async def authorize(self, user: dict, resource: str, action: str) -> bool:
        role = user.get("role", "guest")
        
        # Only admins can invoke graph
        if resource == "graph" and action == "invoke":
            return role == "admin"
        
        # Only owners can view threads
        if resource == "checkpointer" and action == "read":
            return role in ("admin", "user")
        
        return False
```

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "authorization": "graph.auth:MyAuthorizationBackend"
}
```

## Testing

The optional `"test"` section configures the `agentflow test` command, which is a thin wrapper around pytest.

### Minimal example

```json
{
  "agent": "graph.react:app",
  "test": {
    "path": "tests/"
  }
}
```

### Full example with coverage

```json
{
  "agent": "graph.react:app",
  "test": {
    "path": "tests/",
    "coverage": true,
    "coverage_threshold": 80
  }
}
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | string | null (pytest auto-discovery) | Directory or file to pass to pytest |
| `coverage` | boolean | `false` | Enable `--cov` and generate an HTML coverage report in `htmlcov/` |
| `coverage_threshold` | integer | null | Fail the run if coverage falls below this percentage (`--cov-fail-under`) |

### How fields interact with CLI flags

CLI flags always win. The `agentflow.json` values are fallbacks used when the flag is not provided:

```bash
# Uses path/coverage from agentflow.json
agentflow test

# Overrides path; coverage still comes from agentflow.json
agentflow test --path tests/unit/

# Overrides coverage; path still comes from agentflow.json
agentflow test --coverage
```

## Evaluation

The optional `"evaluation"` section configures the `agentflow eval` command. It controls where eval files are discovered, where reports are written, and the default pass-rate threshold. **It does not control evaluation criteria** — those come from `confeval.py` inside your evals directory.

### Minimal example

```json
{
  "agent": "graph.react:app",
  "evaluation": {
    "directory": "evals"
  }
}
```

### Full example

```json
{
  "agent": "graph.react:app",
  "evaluation": {
    "directory": "evals",
    "output_dir": "eval_reports",
    "threshold": 0.9,
    "parallel": true,
    "max_concurrency": 8
  }
}
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `directory` | string | `"evals"` | Directory to scan for eval files (files matching `*_eval.py` or `eval_*.py`) |
| `output_dir` | string | `"eval_reports"` | Directory where HTML and JSON reports are written |
| `threshold` | float | null | Minimum pass rate (0.0–1.0). The command exits with code 1 if the pass rate is below this value |
| `parallel` | boolean | `false` | Run eval cases concurrently instead of sequentially |
| `max_concurrency` | integer | `4` | Maximum number of cases running at the same time (only applies when `parallel` is `true`) |

### How fields interact with CLI flags

CLI flags take priority over `agentflow.json`. JSON values are fallbacks:

```bash
# Uses all settings from agentflow.json
agentflow eval

# Overrides output_dir; other settings still come from agentflow.json
agentflow eval --output-dir ci_reports/

# Overrides threshold; directory still comes from agentflow.json
agentflow eval --threshold 0.95

# Overrides parallel and concurrency
agentflow eval --parallel --max-concurrency 16
```

### Criteria configuration

Evaluation criteria (thresholds per criterion, judge model, match type) are **not** set in `agentflow.json`. They live in `confeval.py` inside your evals directory:

```python
# evals/confeval.py
from agentflow.qa.evaluation import EvalConfig, CriteriaConfig, CriterionConfig

EVAL_CONFIG = EvalConfig(
    criteria=CriteriaConfig(
        tool_name_match=CriterionConfig.tool_name_match(threshold=1.0),
        rouge_match=CriterionConfig.rouge_match(threshold=0.5),
        node_order=CriterionConfig.node_order(threshold=0.8),
    )
)
```

If no `confeval.py` is found, the built-in defaults are used.

## Environment-specific configs

Create separate config files for dev, staging, and production:

```
config/
  dev.json
  staging.json
  prod.json
```

**config/dev.json** (local development, no persistence):

```json
{
  "agent": "graph.react:app",
  "env": ".env.dev",
  "auth": null
}
```

**config/staging.json** (pre-production, with checkpointer):

```json
{
  "agent": "graph.react:app",
  "env": ".env.staging",
  "checkpointer": "graph.dependencies:pg_checkpointer",
  "store": "graph.dependencies:qdrant_store",
  "auth": "jwt"
}
```

**config/prod.json** (production, all features):

```json
{
  "agent": "graph.react:app",
  "env": ".env.prod",
  "checkpointer": "graph.dependencies:pg_checkpointer_prod",
  "store": "graph.dependencies:qdrant_store_prod",
  "thread_name_generator": "graph.thread_name_generator:ProductionNameGenerator",
  "auth": "jwt",
  "authorization": "graph.auth:ProductionAuthorizationBackend"
}
```

Start the server with the appropriate config:

```bash
# Development
agentflow api --config config/dev.json

# Production
MODE=production agentflow api --config config/prod.json --no-reload
```

## Validating your config

Before deploying, verify the config is valid:

```bash
python -c "
import json
with open('agentflow.json') as f:
    config = json.load(f)
print('Config is valid JSON')
print(f'Agent path: {config.get(\"agent\")}')
"
```

Then test that the graph can be imported:

```bash
python -c "from graph.react import app; print(f'Graph loaded: {type(app)}')
```

If both succeed, your config is likely valid. Start the server and test an endpoint:

```bash
agentflow api &
curl http://127.0.0.1:8000/ping
```

## Common config issues

**"Module not found" error**
- Check the module path is spelled correctly
- Verify the module exists in your project
- Try importing manually: `python -c "from graph.react import app"`

**"Attribute not found" error**
- Verify the attribute name exists on the module
- In the example, `graph.react:app` requires an `app` variable in `graph/react.py`

**"Checkpointer database connection failed"**
- Verify the database URL is correct
- Verify the database is running and accessible
- Test the connection: `psql postgresql://user:pass@localhost/agentflow`

**"JWT_SECRET_KEY not found"**
- Set the environment variable: `export JWT_SECRET_KEY=...`
- Or add it to your `.env` file and point `agentflow.json` to it: `"env": ".env"`
