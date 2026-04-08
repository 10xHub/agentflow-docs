---
title: Configure agentflow.json
description: How to configure agentflow.json for checkpointers, stores, auth, and environment variables.
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

## Memory: Store

A store is for long-term semantic memory (embeddings, facts). It is separate from the checkpointer (which holds conversation history).

### Adding a store

Example using Qdrant for vector search:

```python
# graph/dependencies.py
from agentflow.storage.store import create_cloud_qdrant_store

my_store = create_cloud_qdrant_store(
    url="https://your-qdrant-cloud-instance.com",
    api_key="your-qdrant-api-key",
    collection="agent-memories",
)
```

```json
{
  "agent": "graph.react:app",
  "store": "graph.dependencies:my_store"
}
```

Your graph can then retrieve and store semantic information (via embeddings) that persists across conversations.

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
