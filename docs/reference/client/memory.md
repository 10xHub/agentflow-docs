---
title: Memory — AgentFlow Python AI Agent Framework
description: Reference for all memory store methods on AgentFlowClient — store, search, list, update, and delete memories.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - memory
sidebar_position: 6
---


# Memory

The memory API lets you store and retrieve long-term memories across threads. Memories are typed (episodic, semantic, procedural, etc.) and support vector similarity search, temporal retrieval, and hybrid strategies.

:::info Requires store
The memory endpoints require the `store` field to be configured in `agentflow.json`. Without a store, endpoints return empty results.
:::

**Endpoints base path:** `/v1/store`  
**Source:** `src/endpoints/storeMemory.ts`, `src/endpoints/searchMemory.ts`, `src/endpoints/getMemory.ts`, `src/endpoints/updateMemory.ts`, `src/endpoints/deleteMemory.ts`, `src/endpoints/listMemories.ts`, `src/endpoints/forgetMemories.ts`

---

## Imported enums

```ts
import {
  MemoryType,
  RetrievalStrategy,
  DistanceMetric,
} from '@10xscale/agentflow-client';
```

### `MemoryType`

| Value | Enum key | Use case |
|---|---|---|
| `'episodic'` | `EPISODIC` | Conversation memories and session events. |
| `'semantic'` | `SEMANTIC` | Facts, knowledge, and world-model information. |
| `'procedural'` | `PROCEDURAL` | How-to knowledge, workflows, and procedures. |
| `'entity'` | `ENTITY` | Information about specific entities (people, places, products). |
| `'relationship'` | `RELATIONSHIP` | Relationships between entities. |
| `'declarative'` | `DECLARATIVE` | Explicit facts and events recorded verbatim. |
| `'custom'` | `CUSTOM` | Custom memory types specific to your application. |

### `RetrievalStrategy`

| Value | Description |
|---|---|
| `'similarity'` | Vector similarity search. Default for most use cases. |
| `'temporal'` | Retrieve memories in chronological order. |
| `'relevance'` | Score memories by relevance to the query using the store's own model. |
| `'hybrid'` | Combination of similarity and relevance. |
| `'graph_traversal'` | Knowledge graph traversal for entity/relationship memories. |

### `DistanceMetric`

| Value | Description |
|---|---|
| `'cosine'` | Cosine similarity. Default. Best for semantic similarity in high-dimensional spaces. |
| `'euclidean'` | Euclidean distance. |
| `'dot_product'` | Dot product similarity. |
| `'manhattan'` | Manhattan (L1) distance. |

---

## `storeMemory(request)`

Store a new memory entry.

**Endpoint:** `POST /v1/store/memories`

```ts
const response = await client.storeMemory({
  content: 'User prefers dark mode and monospace fonts.',
  memory_type: MemoryType.SEMANTIC,
  category: 'preferences',
  metadata: { source: 'user_settings', importance: 'high' },
});

console.log('Stored memory ID:', response.data.memory_id);
```

### `StoreMemoryRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | `string` | ✅ | The text content to store as a memory. |
| `memory_type` | `MemoryType` | ✅ | The type of memory. Controls how the store indexes and retrieves it. |
| `category` | `string` | ✅ | Arbitrary category string for grouping related memories. |
| `metadata` | `Record<string, any>` | ❌ | Optional key-value metadata stored alongside the memory. |
| `config` | `Record<string, any>` | ❌ | Optional store-level config (backend-specific). |
| `options` | `Record<string, any>` | ❌ | Optional store-level options (backend-specific). |

### `StoreMemoryResponse`

```ts
interface StoreMemoryResponse {
  data: {
    memory_id: string;
  };
  metadata: ResponseMetadata;
}
```

Save the `memory_id` to update or delete the memory later.

---

## `searchMemory(request)`

Search for memories using vector similarity, temporal ordering, or a hybrid strategy.

**Endpoint:** `POST /v1/store/search`

```ts
const response = await client.searchMemory({
  query: 'What are the user\'s display preferences?',
  memory_type: MemoryType.SEMANTIC,
  category: 'preferences',
  limit: 5,
  retrieval_strategy: RetrievalStrategy.SIMILARITY,
  distance_metric: DistanceMetric.COSINE,
  score_threshold: 0.7,
});

for (const result of response.data.results) {
  console.log(`Score: ${result.score.toFixed(3)} — ${result.content}`);
}
```

### `SearchMemoryRequest`

| Field | Type | Default | Description |
|---|---|---|---|
| `query` | `string` | — | The search query. Converted to a vector embedding by the store backend. |
| `memory_type` | `MemoryType` | `EPISODIC` | Filter by memory type. |
| `category` | `string` | `''` | Filter by category. Empty string returns all categories. |
| `limit` | `number` | `10` | Maximum number of results to return. |
| `score_threshold` | `number` | `0` | Minimum similarity score (0–1). Results below this threshold are excluded. |
| `filters` | `Record<string, any>` | `{}` | Additional key-value filters matched against memory metadata. |
| `retrieval_strategy` | `RetrievalStrategy` | `SIMILARITY` | Which retrieval algorithm to use. |
| `distance_metric` | `DistanceMetric` | `COSINE` | Which distance metric to use for vector search. |
| `max_tokens` | `number` | `4000` | Maximum total tokens to return across all results. |
| `config` | `Record<string, any>` | `{}` | Store-level config. |
| `options` | `Record<string, any>` | `{}` | Store-level options. |

### `SearchMemoryResponse`

```ts
interface SearchMemoryResponse {
  data: {
    results: MemoryResult[];
  };
  metadata: ResponseMetadata;
}

interface MemoryResult {
  id: string;
  content: string;
  score: number;              // Similarity score (0–1, higher is more similar)
  memory_type: string;
  metadata: Record<string, any>;
  vector: number[];           // The embedding vector (may be empty in some backends)
  user_id: string;
  thread_id: string;
  timestamp: string;          // ISO 8601 timestamp
}
```

---

## `getMemory(memoryId, options?)`

Fetch a single memory by its ID.

**Endpoint:** `GET /v1/store/memories/{memoryId}`

```ts
const response = await client.getMemory('mem-abc123');
console.log(response.data.memory.content);
console.log(response.data.memory.score);
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `memoryId` | `string` | The memory ID returned by `storeMemory()`. |
| `options.config` | `Record<string, any>` | Optional store-level config. |
| `options.options` | `Record<string, any>` | Optional store-level options. |

---

## `updateMemory(memoryId, content, options?)`

Replace the content of an existing memory. The memory's type, category, and metadata can also be updated via `options`.

**Endpoint:** `PUT /v1/store/memories/{memoryId}`

```ts
await client.updateMemory(
  'mem-abc123',
  'User prefers dark mode, monospace fonts, and large text size.',
  {
    metadata: { tags: ['display', 'accessibility'], revised: true },
  }
);
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `memoryId` | `string` | The memory ID. |
| `content` | `string` | The new text content. Replaces the previous content. |
| `options.config` | `Record<string, any>` | Optional store-level config. |
| `options.options` | `Record<string, any>` | Optional store-level options. |
| `options.metadata` | `Record<string, any>` | Updated metadata. Merged with or replaces existing metadata (backend-dependent). |

### `UpdateMemoryResponse`

```ts
interface UpdateMemoryResponse {
  data: {
    success: boolean;
    data?: any;
  };
  metadata: ResponseMetadata;
}
```

---

## `deleteMemory(memoryId, options?)`

Delete a memory by ID.

**Endpoint:** `DELETE /v1/store/memories/{memoryId}`

```ts
const response = await client.deleteMemory('mem-abc123');
console.log('Deleted:', response.data.success);
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `memoryId` | `string` | The memory ID. |
| `options.config` | `Record<string, any>` | Optional store-level config. |
| `options.options` | `Record<string, any>` | Optional store-level options. |

---

## `listMemories(options?)`

List all stored memories (optionally with a limit).

**Endpoint:** `GET /v1/store/memories`

```ts
const response = await client.listMemories({ limit: 100 });

console.log(`Found ${response.data.memories.length} memories`);
for (const mem of response.data.memories) {
  console.log(`[${mem.memory_type}] ${mem.content.slice(0, 80)}`);
}
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `options.limit` | `number` | Maximum number of memories to return. |
| `options.config` | `Record<string, any>` | Optional store-level config. |
| `options.options` | `Record<string, any>` | Optional store-level options. |

---

## `forgetMemories(options?)`

Bulk-delete memories matching a filter. More efficient than calling `deleteMemory()` in a loop.

**Endpoint:** `DELETE /v1/store/memories`

```ts
// Delete all episodic memories in the 'session_temp' category
await client.forgetMemories({
  memory_type: MemoryType.EPISODIC,
  category: 'session_temp',
});

// Delete memories matching custom filters
await client.forgetMemories({
  filters: { expired: true },
});
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `options.memory_type` | `MemoryType` | Filter by memory type. |
| `options.category` | `string` | Filter by category. |
| `options.filters` | `Record<string, any>` | Additional key-value filters matched against memory metadata. |
| `options.config` | `Record<string, any>` | Optional store-level config. |
| `options.options` | `Record<string, any>` | Optional store-level options. |

### `ForgetMemoriesResponse`

```ts
interface ForgetMemoriesResponse {
  data: {
    success: boolean;
  };
  metadata: ResponseMetadata;
}
```

---

## Complete example: memory-enhanced agent

```ts
import {
  AgentFlowClient,
  Message,
  MemoryType,
  RetrievalStrategy,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

// Before invoking the agent, retrieve relevant past memories
async function invokeWithMemory(userInput: string) {
  // 1. Search for relevant context
  const memories = await client.searchMemory({
    query: userInput,
    memory_type: MemoryType.SEMANTIC,
    limit: 3,
    score_threshold: 0.6,
    retrieval_strategy: RetrievalStrategy.SIMILARITY,
  });

  // 2. Build a system prompt with context
  const context = memories.data.results
    .map(r => `- ${r.content}`)
    .join('\n');

  const systemMsg = Message.text_message(
    `You are a helpful assistant. Relevant context from memory:\n${context}`,
    'system'
  );

  // 3. Invoke the agent
  const result = await client.invoke([
    systemMsg,
    Message.text_message(userInput),
  ]);

  // 4. Store the interaction as an episodic memory
  await client.storeMemory({
    content: `User asked: "${userInput}"`,
    memory_type: MemoryType.EPISODIC,
    category: 'conversations',
  });

  return result;
}
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `404` | Memory not found (wrong ID or deleted). | Check the ID is correct. |
| `AgentFlowError` status `503` | Store not configured or unavailable. | Check `store` field in `agentflow.json` and the store backend status. |

---

## What you learned

- Use `MemoryType` to categorise memories for efficient retrieval.
- `searchMemory()` with `RetrievalStrategy.SIMILARITY` performs vector search — the store must support embeddings.
- `listMemories()` returns everything (use `limit` to paginate).
- `forgetMemories()` bulk-deletes by type, category, or filter.

## Next step

See [`reference/client/files`](files.md) to learn how to upload and reference media files in multimodal messages.
