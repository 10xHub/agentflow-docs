---
title: REST API — Threads — REST API reference
sidebar_label: REST API
description: Reference for the thread state and messages endpoints.
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

## Route summary

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/v1/threads` | `checkpointer:read` |
| `GET` | `/v1/threads/{thread_id}` | `checkpointer:read` |
| `DELETE` | `/v1/threads/{thread_id}` | `checkpointer:delete` |
| `GET` | `/v1/threads/{thread_id}/state` | `checkpointer:read` |
| `PUT` | `/v1/threads/{thread_id}/state` | `checkpointer:write` |
| `DELETE` | `/v1/threads/{thread_id}/state` | `checkpointer:delete` |
| `GET` | `/v1/threads/{thread_id}/messages` | `checkpointer:read` |
| `POST` | `/v1/threads/{thread_id}/messages` | `checkpointer:write` |
| `GET` | `/v1/threads/{thread_id}/messages/{message_id}` | `checkpointer:read` |
| `DELETE` | `/v1/threads/{thread_id}/messages/{message_id}` | `checkpointer:delete` |

There is no create-thread endpoint. A thread is created implicitly by the first `POST /v1/graph/invoke` or `POST /v1/graph/stream` that uses its `thread_id`, or by the server generating one when the request omits it.

---

## GET /v1/threads

List threads stored in the checkpointer. With ownership authorization active, only threads owned by the caller are returned.

**Query parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `search` | string | — | Free-text filter over thread records |
| `offset` | integer | — | Number of threads to skip. Must be `>= 0`. |
| `limit` | integer | `100` | Page size. Clamped server-side to a maximum of `1000` regardless of what the client asks for. Must be `> 0`. |

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

## GET /v1/threads/`{thread_id}`

Get a single thread record (metadata, not messages or state).

**Path parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `thread_id` | string or integer | Thread identifier. An empty or whitespace-only string, or an integer below `1`, returns `422`. |

**Response:**

```json
{
  "success": true,
  "data": {
    "thread_data": {
      "thread_id": "t1",
      "thread_name": "Weather in Paris",
      "user_id": "user-123"
    }
  }
}
```

---

## DELETE /v1/threads/`{thread_id}`

Delete a thread and its checkpointed data.

**Request body:**

```json
{
  "config": {}
}
```

The body is required; send `{}` or `{"config": {}}` when you have no extra config to pass. Keys in `config` are merged into the checkpointer config alongside `thread_id`.

**Response:**

```json
{
  "success": true,
  "data": {"success": true, "message": "Thread deleted successfully"}
}
```

Deleting a thread also evicts its cached ownership entry, so the `thread_id` can be reused by a different user afterwards.

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

**Query parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `search` | string | — | Free-text filter over message content |
| `offset` | integer | — | Number of messages to skip. Must be `>= 0`. |
| `limit` | integer | `100` | Page size. Clamped server-side to a maximum of `1000`. Must be `> 0`. |

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

## POST /v1/threads/`{thread_id}`/messages

Store messages on a thread.

**Request body:**

```json
{
  "messages": [
    {"role": "user", "content": "Injected message"}
  ],
  "metadata": {"source": "import"},
  "config": {}
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `messages` | array | yes | Messages to store. An empty array returns `422`. |
| `metadata` | object | no | Arbitrary metadata stored with the write |
| `config` | object | no | Extra keys merged into the checkpointer config |

**Response:**

```json
{
  "success": true,
  "data": {"success": true, "message": "Messages stored"}
}
```

---

## GET /v1/threads/`{thread_id}`/messages/`{message_id}`

Get a single message from a thread.

**Path parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `thread_id` | string or integer | Thread identifier |
| `message_id` | string or integer | Message identifier. Empty or whitespace-only returns `422`. |

**Response:** the `Message` object.

---

## DELETE /v1/threads/`{thread_id}`/messages/`{message_id}`

Delete a single message from a thread.

**Request body:**

```json
{
  "config": {}
}
```

**Response:**

```json
{
  "success": true,
  "data": {"success": true, "message": "Message deleted successfully"}
}
```

---

## Authentication and ownership

When auth is configured, all endpoints require a bearer token. Each route declares its own permission, listed in [Route summary](#route-summary); the required scope is the `"<resource>:<action>"` string, for example `checkpointer:read`.

With the ownership authorization backend active (the default in `MODE=production`), `thread_id` is also checked against the thread's owner. A request for a thread owned by another user is rejected with `403` before it reaches the checkpointer. A `thread_id` that does not exist yet is allowed through, since it represents a new session.

See [Authentication](../api-cli/auth.md).
