---
title: Memory store endpoints — REST API reference
sidebar_label: Memory store
description: Reference for /v1/store — storing, searching, listing, updating, deleting, and forgetting memories through the AgentFlow API server.
keywords:
  - agentflow memory api
  - rest api reference
  - agent memory endpoints
  - agentflow store
  - semantic memory search
---


# REST API: Memory store

The memory store endpoints are available only when a `store` is configured in
`agentflow.json`. They provide cross-thread, semantic-search-enabled memory.

Base path: `/v1/store`

Every request body extends a common base, so all endpoints accept these two
optional fields in addition to their own:

| Field | Type | Description |
| --- | --- | --- |
| `config` | object | Configuration values forwarded to the store backend (for example `user_id`, `agent_id`, or backend-specific keys). Defaults to `{}`. |
| `options` | object | Extra keyword arguments forwarded verbatim to the store backend. |

Scoping a memory to a user or agent is done through `config`, not through
top-level fields.

---

## POST /v1/store/memories

Store a memory record. Requires `store:write`.

**Request body:**

```json
{
  "content": "User prefers concise responses.",
  "memory_type": "episodic",
  "category": "preference",
  "metadata": {"source": "chat"},
  "config": {"user_id": "user-123"}
}
```

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `content` | string or `Message` | yes | | Memory text, or a structured `Message` object |
| `memory_type` | string | no | `episodic` | Memory classification used by the backend |
| `category` | string | no | `general` | Category label |
| `metadata` | object | no | `null` | Arbitrary metadata stored with the memory |

**Response:**

```json
{
  "success": true,
  "message": "Memory stored successfully",
  "data": {"memory_id": "mem_abc123"}
}
```

---

## POST /v1/store/search

Search memories by semantic similarity. Requires `store:read`.

**Request body:**

```json
{
  "query": "How does this user like to receive information?",
  "category": "preference",
  "limit": 5,
  "config": {"user_id": "user-123"}
}
```

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `query` | string | yes | | Search query. Empty or whitespace-only returns `422` |
| `memory_type` | string | no | `null` | Filter by memory type |
| `category` | string | no | `null` | Filter by category |
| `limit` | integer | no | `10` | Maximum results. Must be greater than 0 |
| `score_threshold` | float | no | `null` | Minimum similarity score for a result to be returned |
| `filters` | object | no | `null` | Additional store-specific filters |
| `retrieval_strategy` | string | no | `similarity` | Retrieval strategy used by the backend |
| `distance_metric` | string | no | `cosine` | Distance metric applied during similarity search |
| `max_tokens` | integer | no | `4000` | Token budget used for truncation during similarity search |

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

## POST /v1/store/memories/list

List stored memories. Requires `store:read`.

This is a `POST` because the request carries a `config` object; there is no
`GET` variant.

**Request body (optional):**

```json
{
  "limit": 50,
  "config": {"user_id": "user-123"}
}
```

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | no | `100` | Maximum memories to return. Values `<= 0` return `422` |

Sending no body at all is valid and applies the defaults.

**Response:**

```json
{
  "success": true,
  "data": {
    "memories": [
      {
        "memory_id": "mem_abc123",
        "content": "User prefers concise responses.",
        "metadata": {"category": "preference"}
      }
    ]
  }
}
```

---

## POST /v1/store/memories/`{memory_id}`

Get a single memory by ID. Requires `store:read`.

The body is optional and carries only `config` and `options`. An empty or
whitespace-only `memory_id` returns `422`.

**Response:**

```json
{
  "success": true,
  "data": {
    "memory": {
      "memory_id": "mem_abc123",
      "content": "User prefers concise responses.",
      "metadata": {}
    }
  }
}
```

:::note
`list` and `forget` are registered before this catch-all route, so
`POST /v1/store/memories/list` lists memories rather than fetching a memory
whose ID is the literal string `list`.
:::

---

## PUT /v1/store/memories/`{memory_id}`

Update a stored memory. Requires `store:write`.

**Request body:**

```json
{
  "content": "Updated memory content.",
  "metadata": {"updated": true}
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `content` | string or `Message` | yes | Replacement content |
| `metadata` | object | no | Replacement metadata |

**Response:**

```json
{
  "success": true,
  "message": "Memory updated successfully",
  "data": {"success": true}
}
```

---

## DELETE /v1/store/memories/`{memory_id}`

Delete one memory record. Requires `store:delete`.

The body is optional and carries only `config` and `options`.

**Response:**

```json
{
  "success": true,
  "message": "Memory deleted successfully",
  "data": {"success": true}
}
```

---

## POST /v1/store/memories/forget

Delete every memory matching the given filters. Requires `store:delete`.

**Request body:**

```json
{
  "memory_type": "episodic",
  "category": "preference",
  "filters": {"source": "chat"},
  "config": {"user_id": "user-123"}
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `memory_type` | string | no | Restrict deletion to one memory type |
| `category` | string | no | Restrict deletion to one category |
| `filters` | object | no | Additional backend filters |

**Response:**

```json
{
  "success": true,
  "message": "Memories removed successfully",
  "data": {"success": true}
}
```

---

## Permissions

| Operation | Required permission |
| --- | --- |
| Store, update | `store:write` |
| Search, get, list | `store:read` |
| Delete, forget | `store:delete` |
