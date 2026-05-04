---
title: REST API — Threads — AgentFlow Python AI Agent Framework
description: Reference for the thread state and messages endpoints. Part of the AgentFlow rest api reference guide for production-ready Python AI agents.
keywords:
  - rest api reference
  - agent http api
  - agentflow rest endpoints
  - agentflow
  - python ai agent framework
  - rest api — threads
---


# REST API: Threads

Thread endpoints let you read and manage conversation state stored in the checkpointer. A thread is identified by its `thread_id`.

Base path: `/v1/threads`

---

## GET /v1/threads

List all threads stored in the checkpointer.

**Response:**

```json
{
  "success": true,
  "data": {
    "threads": [
      {"thread_id": "t1", "created_at": "2026-04-01T10:00:00Z"},
      {"thread_id": "t2", "created_at": "2026-04-02T09:30:00Z"}
    ]
  }
}
```

---

## GET /v1/threads/`{thread_id}`/state

Get the saved state for a thread.

**Path parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `thread_id` | string or integer | Thread identifier |

**Response:**

```json
{
  "success": true,
  "data": {
    "state": {
      "context": [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"}
      ]
    }
  }
}
```

---

## PUT /v1/threads/`{thread_id}`/state

Replace or update state fields for a thread.

**Request body:**

```json
{
  "state": {
    "user_id": "user-456"
  },
  "config": {}
}
```

| Field | Type | Description |
| --- | --- | --- |
| `state` | object | State fields to merge into the current state |
| `config` | object | Optional extra config |

**Response:**

```json
{
  "success": true,
  "data": {"updated": true}
}
```

Use this endpoint to inject custom state fields (like `user_id`) before the first invoke call or to repair inconsistent state.

---

## DELETE /v1/threads/`{thread_id}`/state

Clear the saved state for a thread. The next invoke call with this `thread_id` will start fresh.

**Response:**

```json
{
  "success": true,
  "data": {"deleted": true}
}
```

---

## GET /v1/threads/`{thread_id}`/messages

Get the conversation messages for a thread.

**Response:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {"role": "user", "content": "Hello"},
      {"role": "assistant", "content": "Hi there!"}
    ]
  }
}
```

---

## PUT /v1/threads/`{thread_id}`/messages

Append or replace messages for a thread.

**Request body:**

```json
{
  "messages": [
    {"role": "user", "content": "Injected message"}
  ]
}
```

---

## Authentication

When auth is configured, all endpoints require an `Authorization` header. Accessing thread state requires the `checkpointer:read` permission; writing state requires `checkpointer:write`.
