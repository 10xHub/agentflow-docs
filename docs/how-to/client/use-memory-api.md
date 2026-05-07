---
title: How to use the memory API
sidebar_label: How to use the memory API
description: Step-by-step guide to storing, searching, and managing long-term memories with AgentFlowClient. Part of the AgentFlow agentflow typescript client guide for.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - how to use the memory api
sidebar_position: 5
---


# How to use the memory API

The memory API stores information that persists across threads and sessions — user preferences, facts learned during conversations, and anything else the agent should remember long-term. This guide shows you how to store, search, and manage memories.

:::info Requires store
All memory operations require the `store` field to be configured in `agentflow.json`. Without a store the endpoints return empty results.
:::

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- The API server running with a memory store configured.

---

## Step 1: Store a memory

Use `storeMemory()` to store any piece of information:

```ts
import { MemoryType } from '@10xscale/agentflow-client';

const response = await client.storeMemory({
  content: 'User prefers responses in French.',
  memory_type: MemoryType.SEMANTIC,
  category: 'preferences',
  metadata: { source: 'user_profile' },
});

const memoryId = response.data.memory_id;
console.log('Stored memory:', memoryId);
```

Save `memory_id` if you need to update or delete the memory later.

---

## Step 2: Search for memories

`searchMemory()` uses vector similarity to find memories that are semantically related to your query:

```ts
import { MemoryType, RetrievalStrategy } from '@10xscale/agentflow-client';

const results = await client.searchMemory({
  query: 'What language does the user prefer?',
  memory_type: MemoryType.SEMANTIC,
  category: 'preferences',
  limit: 3,
  score_threshold: 0.6,
  retrieval_strategy: RetrievalStrategy.SIMILARITY,
});

for (const r of results.data.results) {
  console.log(`Score: ${r.score.toFixed(3)} — ${r.content}`);
}
```

Memories with a score above `score_threshold` (0–1) are returned. Remove `score_threshold` if you want all results regardless of relevance.

---

## Step 3: Use memories to enhance agent responses

Build relevant context from memories and inject it into the system prompt before each `invoke()` call:

```ts
async function invokeWithMemory(question: string, threadId: string) {
  // 1. Find relevant memories
  const memories = await client.searchMemory({
    query: question,
    memory_type: MemoryType.SEMANTIC,
    limit: 5,
    score_threshold: 0.65,
  });

  // 2. Build context block
  const context = memories.data.results
    .map(r => `- ${r.content}`)
    .join('\n');

  const systemMsg = Message.text_message(
    `You are a helpful assistant.\n\nLong-term context:\n${context}`,
    'system'
  );

  // 3. Invoke
  return client.invoke([systemMsg, Message.text_message(question)], {
    config: { configurable: { thread_id: threadId } },
    response_granularity: 'low',
  });
}
```

---

## Step 4: Retrieve a specific memory

Fetch a single memory by its ID:

```ts
const memory = await client.getMemory(memoryId);
console.log(memory.data.memory.content);
console.log(memory.data.memory.memory_type);
console.log(memory.data.memory.metadata);
```

---

## Step 5: Update a memory

Replace the content of an existing memory:

```ts
await client.updateMemory(
  memoryId,
  'User prefers responses in French and Spanish.',
  {
    metadata: { updated: true, updated_at: new Date().toISOString() },
  }
);
console.log('Memory updated');
```

---

## Step 6: Delete a specific memory

```ts
const result = await client.deleteMemory(memoryId);
console.log('Deleted:', result.data.success);
```

---

## Step 7: List all memories

`listMemories()` returns all stored memories. Use `limit` to paginate:

```ts
const all = await client.listMemories({ limit: 50 });
console.log(`Found ${all.data.memories.length} memories`);

for (const mem of all.data.memories) {
  console.log(`[${mem.memory_type}] ${mem.content.slice(0, 80)}`);
}
```

---

## Step 8: Bulk-delete memories

`forgetMemories()` removes all memories matching a type or category. More efficient than deleting one by one:

```ts
// Delete all episodic memories in a temporary category
await client.forgetMemories({
  memory_type: MemoryType.EPISODIC,
  category: 'session_temp',
});

// Delete memories matching a custom filter
await client.forgetMemories({
  filters: { expired: true },
});
```

---

## Memory type guide

Choose the right `MemoryType` for each piece of information:

| Type | Use for |
|---|---|
| `EPISODIC` | Conversation events, session notes, recent interactions. |
| `SEMANTIC` | Facts, user preferences, world knowledge the agent should recall. |
| `PROCEDURAL` | How-to workflows, step sequences, recurring processes. |
| `ENTITY` | Information about specific people, places, or products. |
| `RELATIONSHIP` | How entities relate to each other. |
| `DECLARATIVE` | Explicit facts stated directly by the user or administrator. |
| `CUSTOM` | Domain-specific memory types unique to your application. |

Using consistent types makes retrieval more accurate — `searchMemory` can filter by type.

---

## Choosing a retrieval strategy

| Strategy | Best for |
|---|---|
| `SIMILARITY` | Finding semantically related memories. Default and most useful. |
| `TEMPORAL` | Retrieving the most recent memories in chronological order. |
| `RELEVANCE` | Scoring by the store backend's custom relevance model. |
| `HYBRID` | Combining similarity and relevance for balanced retrieval. |
| `GRAPH_TRAVERSAL` | Navigating entity/relationship memories in a knowledge graph. |

---

## Complete example: memory-aware chat

```ts
import {
  AgentFlowClient,
  Message,
  MemoryType,
  RetrievalStrategy,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });
const THREAD_ID = 'user-abc-session';

async function memoryChat(userInput: string) {
  // Recall relevant memories
  const recalled = await client.searchMemory({
    query: userInput,
    memory_type: MemoryType.SEMANTIC,
    limit: 3,
    score_threshold: 0.6,
    retrieval_strategy: RetrievalStrategy.SIMILARITY,
  });

  const contextBlock = recalled.data.results.length > 0
    ? '\n\nContext from memory:\n' + recalled.data.results.map(r => `- ${r.content}`).join('\n')
    : '';

  // Invoke with memory context
  const result = await client.invoke(
    [
      Message.text_message(`You are a helpful assistant.${contextBlock}`, 'system'),
      Message.text_message(userInput),
    ],
    {
      config: { configurable: { thread_id: THREAD_ID } },
      response_granularity: 'low',
    }
  );

  // Store this exchange as an episodic memory
  await client.storeMemory({
    content: `User asked: "${userInput}"`,
    memory_type: MemoryType.EPISODIC,
    category: 'conversations',
    metadata: { thread_id: THREAD_ID },
  });

  return result;
}

// Run the memory-aware chat
const result = await memoryChat('What is my preferred language?');
console.log(result.messages);
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `404` on `getMemory` | Memory ID not found. | Verify the ID. Memories may have been deleted. |
| `AgentFlowError` status `503` | Store not configured or unreachable. | Check `store` field in `agentflow.json` and the store backend status. |
| Empty search results | Score threshold too high, wrong memory type, or store is empty. | Lower `score_threshold`, remove the type filter, or check that memories have been stored. |

---

## What you learned

- `storeMemory()` requires `content`, `memory_type`, and `category`.
- `searchMemory()` with `RetrievalStrategy.SIMILARITY` does vector search — the store must support embeddings.
- Use memory search results to build a system prompt that gives the agent long-term context.
- `forgetMemories()` bulk-deletes by type, category, or filter.

## Next step

See [how-to/client/upload-files](upload-files.md) to learn how to upload images and documents for use in multimodal messages.
