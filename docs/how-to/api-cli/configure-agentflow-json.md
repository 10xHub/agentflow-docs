---
title: Configure agentflow.json
description: How to configure agentflow.json for checkpointers, stores, auth, and environment variables.
---

# Configure agentflow.json

This guide walks through common configuration tasks. See [agentflow.json reference](../../reference/api-cli/configuration.md) for a complete field list.

## Add a checkpointer

Without a checkpointer, each request is stateless. Add one to persist conversation history:

**In-memory (development):**

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

**Postgres + Redis (production):**

```bash
pip install 10xscale-agentflow[pg_checkpoint]
```

```python
# graph/dependencies.py
from agentflow.storage.checkpointer import PgCheckpointer

my_checkpointer = PgCheckpointer(
    db_url="postgresql+asyncpg://user:pass@localhost/agentflow",
    redis_url="redis://localhost:6379/0",
)
```

```json
{
  "agent": "graph.react:app",
  "checkpointer": "graph.dependencies:my_checkpointer"
}
```

## Add a memory store

```python
# graph/dependencies.py
from agentflow.storage.store import create_cloud_qdrant_store

my_store = create_cloud_qdrant_store(
    url="https://your-qdrant.cloud",
    api_key="your-api-key",
    collection="agent-memories",
)
```

```json
{
  "agent": "graph.react:app",
  "store": "graph.dependencies:my_store"
}
```

## Load environment variables

Point `env` to your `.env` file:

```json
{
  "agent": "graph.react:app",
  "env": ".env"
}
```

Your `.env`:

```bash
GOOGLE_API_KEY=your-key
REDIS_URL=redis://localhost:6379/0
```

## Enable JWT authentication

```json
{
  "agent": "graph.react:app",
  "auth": "jwt"
}
```

Set the required environment variables:

```bash
JWT_SECRET_KEY=super-secret-key
JWT_ALGORITHM=HS256
```

## Use a custom auth backend

```json
{
  "agent": "graph.react:app",
  "auth": {
    "method": "custom",
    "path": "graph.auth:MyAuthBackend"
  }
}
```

## Use multiple config files for different environments

Keep separate files per environment:

```
config/
  dev.json
  staging.json
  prod.json
```

Start with a specific config:

```bash
agentflow api --config config/prod.json
```

A production `config/prod.json` might look like:

```json
{
  "agent": "graph.react:app",
  "checkpointer": "graph.dependencies:pg_checkpointer",
  "store": "graph.dependencies:qdrant_store",
  "env": ".env.prod",
  "auth": "jwt"
}
```
