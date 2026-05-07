---
title: "AgentFlow with FastAPI: Embed an Agent in Your App"
sidebar_label: with FastAPI
description: How to embed an AgentFlow agent in your existing FastAPI service. Mount the runtime, add custom routes, share auth, and stream responses.
keywords:
  - agentflow fastapi
  - fastapi ai agent
  - python agent fastapi integration
  - fastapi agent server
  - mount agentflow fastapi
sidebar_position: 2
---

# AgentFlow with FastAPI

`agentflow api` is the fastest path from a compiled graph to an HTTP endpoint. But many teams already run a FastAPI service with auth, middleware, and routes they cannot rewrite. Embedding AgentFlow inside that service is straightforward.

## Two approaches

1. **Run `agentflow api` as a separate service.** Your FastAPI app proxies to it. Cleanest separation; one extra hop.
2. **Embed the graph in your existing FastAPI app.** Direct calls into Python. Fewer hops; more code.

For most production teams, option 1 is the default. Option 2 makes sense when you have shared business logic.

## Option 1: `agentflow api` as a sidecar

Run AgentFlow as its own process behind the same load balancer:

```yaml
# docker-compose.yml
services:
  api:
    build: ./api
    ports: ["8000:8000"]
    environment:
      AGENT_URL: http://agent:8001

  agent:
    image: my-agent:latest
    ports: ["8001:8001"]
    command: agentflow api --host 0.0.0.0 --port 8001
```

Your FastAPI app proxies the `/agent/*` routes:

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import httpx

app = FastAPI()

@app.post("/agent/invoke")
async def proxy_invoke(req: Request):
    body = await req.body()
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{AGENT_URL}/v1/graph/invoke", content=body)
        return r.json()

@app.post("/agent/stream")
async def proxy_stream(req: Request):
    body = await req.body()
    async def gen():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{AGENT_URL}/v1/graph/stream", content=body) as r:
                async for chunk in r.aiter_bytes():
                    yield chunk
    return StreamingResponse(gen(), media_type="text/event-stream")
```

Add auth, rate limiting, and validation in the proxy layer; let AgentFlow handle agent execution.

## Option 2: Embed the graph directly

Import your compiled graph and call it from a FastAPI route:

```python
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from agentflow.core.state import Message
from agentflow.utils import ResponseGranularity
from agentflow.core.state.stream_chunks import StreamEvent

from my_app.graph import app as agent_app  # your compiled graph
from my_app.auth import current_user

api = FastAPI()

class AgentRequest(BaseModel):
    text: str

@api.post("/agent/invoke")
async def invoke(body: AgentRequest, user = Depends(current_user)):
    result = await agent_app.ainvoke(
        {"messages": [Message.text_message(body.text)]},
        config={"thread_id": f"user-{user.id}", "recursion_limit": 25},
    )
    return {"text": result["messages"][-1].text()}

@api.post("/agent/stream")
async def stream(body: AgentRequest, user = Depends(current_user)):
    async def gen():
        async for chunk in agent_app.astream(
            {"messages": [Message.text_message(body.text)]},
            config={"thread_id": f"user-{user.id}", "recursion_limit": 25},
            response_granularity=ResponseGranularity.LOW,
        ):
            if chunk.event == StreamEvent.MESSAGE and chunk.message:
                payload = {"role": chunk.message.role, "content": chunk.message.text()}
                yield f"event: message_chunk\ndata: {json.dumps(payload)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
```

This is the lower-friction version when:

- You want auth via existing FastAPI middleware
- The agent shares Python objects (DB sessions, ML models) with your service
- You only need one or two endpoints

## Auth patterns

### JWT from your existing service

If your FastAPI app already validates JWTs:

```python
from fastapi import Header, HTTPException

async def current_user(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    payload = jwt.decode(token, key=SECRET, algorithms=["HS256"])
    return User(id=payload["sub"])
```

Pass `user.id` into `thread_id` so each user gets their own conversation.

### API keys for service-to-service

For machine clients:

```python
from fastapi import Depends
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_key(key: str = Depends(api_key_header)):
    if not is_valid_key(key):
        raise HTTPException(403)
    return key
```

See [Auth and authorization](/docs/how-to/production/auth-and-authorization) for AgentFlow-side auth.

## Streaming gotchas

- **`X-Accel-Buffering: no`** disables nginx buffering; without it, SSE events sit in the proxy buffer.
- **ALB / Cloudflare idle timeout.** Default 60s is shorter than many agent runs. Bump to 300s.
- **`Cache-Control: no-cache`** prevents browsers from caching the stream.
- **Trailing `\n\n`** terminates SSE events. Required by spec.

For more on SSE, see [streaming agent responses with FastAPI and SSE](/blog/streaming-agent-responses-fastapi-sse).

## Sharing dependencies

Embed mode lets the agent share a database session with your service. Use AgentFlow's context manager to inject deps:

```python
from agentflow.core.context import ContextManager

# Bind a per-request context
async def get_agent_context(user = Depends(current_user), db = Depends(get_db)):
    return ContextManager(user_id=user.id, db_session=db)

# In your tools
def lookup_order(order_id: str, ctx: ContextManager) -> str:
    """Look up an order for the current user."""
    return ctx.db_session.query(Order).filter_by(id=order_id, user_id=ctx.user_id).first()
```

See [the context manager guide](/docs/how-to/python/use-context-manager).

## When to choose which

| Concern | Sidecar | Embedded |
|---|---|---|
| Independent deploys | ✅ | ❌ |
| Shared DB sessions | ❌ (over HTTP) | ✅ |
| Scale agent independently | ✅ | ❌ |
| Single Docker image | ❌ | ✅ |
| Hot reload during dev | ✅ | ✅ |

Default to sidecar; embed when you have a real reason.

## Further reading

- [Run with API](/docs/beginner/run-with-api).`agentflow api` standalone
- [Streaming agent responses with SSE](/blog/streaming-agent-responses-fastapi-sse)
- [Deployment guide](/docs/how-to/production/deployment)
- [Get started](/docs/get-started)
