---
title: REST API — Memory Store
description: Reference for the memory store endpoints.
---

# REST API: Memory store

The memory store endpoints are only available when a `store` is configured in `agentflow.json`. They provide cross-thread, semantic-search-enabled memory storage.

Base path: `/v1/store`

---

## POST /v1/store/memories

Store a memory record.

**Request body:**

```json
{
  "content": "User prefers concise responses.",
  "user_id": "user-123",
  "agent_id": "my-agent",
  "metadata": {
    "category": "preference"
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `content` | string | yes | The memory text |
| `user_id` | string | no | Associate with a user |
| `agent_id` | string | no | Associate with an agent |
| `metadata` | object | no | Arbitrary extra data |

**Response:**

```json
{
  "success": true,
  "data": {
    "memory_id": "mem_abc123",
    "content": "User prefers concise responses.",
    "created_at": "2026-04-08T10:00:00Z"
  }
}
```

---

## POST /v1/store/search

Search memories by semantic similarity.

**Request body:**

```json
{
  "query": "How does this user like to receive information?",
  "user_id": "user-123",
  "limit": 5,
  "filters": {
    "category": "preference"
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string | yes | Search query (cannot be empty) |
| `user_id` | string | no | Filter by user |
| `agent_id` | string | no | Filter by agent |
| `limit` | integer | no | Max results to return (default: 10) |
| `filters` | object | no | Metadata key-value filters |

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "memory_id": "mem_abc123",
        "content": "User prefers concise responses.",
        "score": 0.91,
        "metadata": {"category": "preference"}
      }
    ]
  }
}
```

---

## POST /v1/store/memories/`{memory_id}`

Get a memory by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "memory_id": "mem_abc123",
    "content": "User prefers concise responses.",
    "user_id": "user-123",
    "metadata": {}
  }
}
```

---

## GET /v1/store/memories

List stored memories with optional filters.

**Query parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `user_id` | string | Filter by user |
| `agent_id` | string | Filter by agent |
| `limit` | integer | Max results |

---

## PUT /v1/store/memories/`{memory_id}`

Update a stored memory.

**Request body:**

```json
{
  "content": "Updated memory content.",
  "metadata": {"updated": true}
}
```

---

## DELETE /v1/store/memories/`{memory_id}`

Delete a memory record.

**Response:**

```json
{
  "success": true,
  "data": {"deleted": true}
}
```

---

## POST /v1/store/memories/forget

Delete all memories matching filters.

**Request body:**

```json
{
  "user_id": "user-123",
  "agent_id": "my-agent"
}
```

---

## Authentication

Writing and deleting memories requires `store:write` permission. Reading and searching requires `store:read`.
