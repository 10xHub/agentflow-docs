---
title: "`Message` — AgentFlow Python AI Agent Framework"
description: Reference for the Message class and all content block types in the AgentFlow TypeScript client. Part of the AgentFlow typescript client reference guide for.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - "`message`"
sidebar_position: 2
---


# `Message`

The `Message` class is the data model that AgentFlow uses to represent every message in a conversation — user inputs, assistant responses, tool calls, and tool results. It is defined in `src/message.ts` and exported from `@10xscale/agentflow-client`.

---

## Import

```ts
import {
  Message,
  TextBlock,
  ImageBlock,
  AudioBlock,
  VideoBlock,
  DocumentBlock,
  DataBlock,
  ToolCallBlock,
  RemoteToolCallBlock,
  ToolResultBlock,
  ReasoningBlock,
  AnnotationBlock,
  ErrorBlock,
  MediaRef,
  AnnotationRef,
  TokenUsages,
} from '@10xscale/agentflow-client';
```

---

## `Message` class

```ts
class Message {
  message_id: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: ContentBlock[];
  delta: boolean;
  tools_calls?: Record<string, any>[];
  timestamp: number;
  metadata: Record<string, any>;
  usages?: TokenUsages;
  raw?: Record<string, any>;

  constructor(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: ContentBlock[],
    message_id?: string | null
  );
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `message_id` | `string \| null` | Server-assigned message ID. Use `"0"` or `null` when creating new messages — the server assigns the real ID. |
| `role` | `'user' \| 'assistant' \| 'system' \| 'tool'` | Who produced this message. |
| `content` | `ContentBlock[]` | Array of content blocks. A single message can have multiple blocks (e.g. text + image). |
| `delta` | `boolean` | `true` when this message is a streaming partial update rather than a final message. Set by the server. |
| `tools_calls` | `Record<string, any>[]` | Raw tool call array from the underlying LLM response. Populated by the server; do not set this manually. |
| `timestamp` | `number` | Unix timestamp in milliseconds when the message was created. Defaults to `Date.now()` at construction time. |
| `metadata` | `Record<string, any>` | Arbitrary key-value metadata you can attach to messages. |
| `usages` | `TokenUsages` | Token usage information returned by the LLM. Only present on `assistant` messages. |
| `raw` | `Record<string, any>` | The raw LLM response object, if the server passes it through. Useful for debugging. |

---

## Static factory methods

### `Message.text_message(content, role?, message_id?)`

The most common way to create a message. Creates a `Message` with a single `TextBlock`.

```ts
const userMsg = Message.text_message('What is the capital of France?');
// role defaults to 'user'

const systemMsg = Message.text_message(
  'You are a helpful geography tutor.',
  'system'
);
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | — | The text content. |
| `role` | `'user' \| 'assistant' \| 'system' \| 'tool'` | `'user'` | The role for the message. |
| `message_id` | `string \| null` | `null` | Optional message ID. Use `null` to let the server assign one. |

### `Message.tool_message(content, message_id?, meta?)`

Creates a `tool` role message containing `ToolResultBlock` instances. Typically you do not create these manually — when you use remote tools the client creates them for you.

```ts
const toolResult = Message.tool_message([
  new ToolResultBlock({
    call_id: 'call_abc123',
    output: { result: 42 },
    status: 'completed',
    is_error: false,
  }),
]);
```

---

## `ContentBlock` union type

The `content` field of a `Message` is an array of `ContentBlock` values. Each block has a `type` discriminant field. The full union is:

```ts
type ContentBlock =
  | TextBlock
  | ImageBlock
  | AudioBlock
  | VideoBlock
  | DocumentBlock
  | DataBlock
  | ToolCallBlock
  | RemoteToolCallBlock
  | ToolResultBlock
  | ReasoningBlock
  | AnnotationBlock
  | ErrorBlock;
```

---

## Block types

### `TextBlock`

Plain text content.

```ts
class TextBlock {
  type: 'text';
  text: string;
  annotations: AnnotationRef[];
}
```

```ts
const block = new TextBlock('Hello, world!');
```

| Field | Type | Description |
|---|---|---|
| `type` | `'text'` | Discriminant. Always `'text'`. |
| `text` | `string` | The text content. |
| `annotations` | `AnnotationRef[]` | Optional citation or note annotations appended to this block. |

---

### `ImageBlock`

An image attached to a message.

```ts
class ImageBlock {
  type: 'image';
  media: MediaRef;
  alt_text?: string;
  bbox?: number[];
}
```

```ts
const block = new ImageBlock(
  new MediaRef('url', 'https://example.com/photo.jpg'),
  'A photo of a cat'
);
```

| Field | Type | Description |
|---|---|---|
| `type` | `'image'` | Discriminant. |
| `media` | `MediaRef` | Reference to the image data. |
| `alt_text` | `string` | Accessible alternative text. |
| `bbox` | `number[]` | Optional bounding box `[x, y, w, h]` within a parent image. |

---

### `AudioBlock`

An audio clip attached to a message.

```ts
class AudioBlock {
  type: 'audio';
  media: MediaRef;
  transcript?: string;
  sample_rate?: number;
  channels?: number;
}
```

| Field | Type | Description |
|---|---|---|
| `media` | `MediaRef` | Reference to the audio data. |
| `transcript` | `string` | Optional pre-computed transcript of the audio. |
| `sample_rate` | `number` | Sample rate in Hz. |
| `channels` | `number` | Number of audio channels (1 = mono, 2 = stereo). |

---

### `VideoBlock`

A video clip attached to a message.

```ts
class VideoBlock {
  type: 'video';
  media: MediaRef;
  thumbnail?: MediaRef;
}
```

---

### `DocumentBlock`

A document (PDF, DOCX, etc.) attached to a message.

```ts
class DocumentBlock {
  type: 'document';
  media: MediaRef;
  pages?: number[];
  excerpt?: string;
}
```

| Field | Type | Description |
|---|---|---|
| `pages` | `number[]` | Which pages of the document are relevant (1-indexed). |
| `excerpt` | `string` | Optional extracted text excerpt from the document. |

---

### `DataBlock`

Raw binary or structured data encoded as base64 or referenced via `MediaRef`.

```ts
class DataBlock {
  type: 'data';
  mime_type: string;
  data_base64?: string;
  media?: MediaRef;
}
```

---

### `ToolCallBlock`

Represents a tool/function call made by the assistant. Populated by the server; you typically do not create these manually.

```ts
class ToolCallBlock {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, any>;
  tool_type?: string;
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique ID for this tool call (used to match with `ToolResultBlock.call_id`). |
| `name` | `string` | Name of the tool to call. |
| `args` | `Record<string, any>` | Arguments to pass to the tool function. |
| `tool_type` | `string` | Optional tool type tag (e.g. `'mcp'`, `'function'`). |

---

### `RemoteToolCallBlock`

Like `ToolCallBlock` but specifically for tools that execute on the client side (browser). When the server needs the client to run a tool, it returns a message containing `RemoteToolCallBlock` entries. The client's `invoke()` loop detects these, executes the registered handlers, and sends the results back.

```ts
class RemoteToolCallBlock {
  type: 'remote_tool_call';
  id: string;
  name: string;
  args: Record<string, any>;
  tool_type: string; // always 'remote'
}
```

You do not create these manually. They arrive from the server inside `invoke()` responses.

---

### `ToolResultBlock`

The result of executing a tool call. When using remote tools the client creates these automatically. You only need to construct them manually if you are building custom tool-loop logic.

```ts
class ToolResultBlock {
  type: 'tool_result';
  call_id: string;
  output: any;
  is_error: boolean;
  status?: 'completed' | 'failed';
}

// Constructor takes an object:
new ToolResultBlock({
  call_id: 'call_abc123',
  output: { temperature: 22.5 },
  status: 'completed',
  is_error: false,
})
```

| Field | Type | Description |
|---|---|---|
| `call_id` | `string` | Must match the `id` of the corresponding `ToolCallBlock` or `RemoteToolCallBlock`. |
| `output` | `any` | The return value of the tool function. Can be any JSON-serialisable value. |
| `is_error` | `boolean` | Set to `true` when the tool execution failed. |
| `status` | `'completed' \| 'failed'` | Status signal sent back to the server. |

---

### `ReasoningBlock`

Extended-thinking / chain-of-thought reasoning steps emitted by models that support it (e.g. Claude 3+).

```ts
class ReasoningBlock {
  type: 'reasoning';
  summary: string;
  details?: string[];
}
```

| Field | Type | Description |
|---|---|---|
| `summary` | `string` | Short summary of the reasoning step. |
| `details` | `string[]` | Optional detailed reasoning steps. |

---

### `AnnotationBlock`

Citations or notes appended to message content.

```ts
class AnnotationBlock {
  type: 'annotation';
  kind: 'citation' | 'note';
  refs: AnnotationRef[];
  spans?: [number, number][];
}
```

| Field | Type | Description |
|---|---|---|
| `kind` | `'citation' \| 'note'` | Whether this is a citation to a source or an inline note. |
| `refs` | `AnnotationRef[]` | List of sources or note references. |
| `spans` | `[number, number][]` | Character offset spans within `TextBlock.text` that this annotation covers. |

---

### `ErrorBlock`

Represents an error that occurred during graph execution, embedded in a message.

```ts
class ErrorBlock {
  type: 'error';
  message: string;
  code?: string;
  data?: Record<string, any>;
}
```

---

## Helper types

### `MediaRef`

A reference to a media file. Supports three kinds: an external URL, an uploaded `file_id`, or inline base64 data.

```ts
class MediaRef {
  kind: 'url' | 'file_id' | 'data';
  url?: string;               // when kind = 'url'
  file_id?: string;           // when kind = 'file_id'
  data_base64?: string;       // when kind = 'data'
  mime_type?: string;
  size_bytes?: number;
  sha256?: string;
  filename?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
  page?: number;
}
```

**Create a URL reference:**

```ts
const media = new MediaRef('url', 'https://example.com/image.png');
media.mime_type = 'image/png';
```

**Create a file_id reference (after uploading):**

```ts
const uploaded = await client.uploadFile(file);
const media = new MediaRef('file_id');
media.file_id = uploaded.data.file_id;
media.mime_type = uploaded.data.mime_type;
```

---

### `AnnotationRef`

A reference to a source or note target.

```ts
class AnnotationRef {
  url?: string;
  file_id?: string;
  page?: number;
  index?: number;
  title?: string;
}
```

---

### `TokenUsages`

LLM token usage statistics attached to assistant messages.

```ts
class TokenUsages {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  image_tokens?: number;
  audio_tokens?: number;
}
```

---

## Complete example

```ts
import {
  Message,
  TextBlock,
  ImageBlock,
  MediaRef,
} from '@10xscale/agentflow-client';

// 1. Simple text message
const greeting = Message.text_message('Hello!');

// 2. Message with mixed text and image
const multimodal = new Message('user', [
  new TextBlock('What is in this image?'),
  new ImageBlock(
    new MediaRef('url', 'https://example.com/photo.jpg'),
    'A street photo'
  ),
]);

// 3. System prompt
const system = Message.text_message(
  'You are a helpful assistant. Be concise.',
  'system'
);

// 4. Send them to the agent
const result = await client.invoke([system, greeting]);
console.log(result.messages);
```

---

## What you learned

- `Message` has four roles: `user`, `assistant`, `system`, and `tool`.
- `content` is always an array of typed `ContentBlock` objects.
- `Message.text_message()` is the easiest way to create a plain text message.
- `RemoteToolCallBlock` arrives from the server when a remote tool needs executing — the `invoke()` loop handles this automatically.
- Use `MediaRef` with `kind: 'file_id'` to reference files you have uploaded via `uploadFile()`.

## Next step

See [`reference/client/invoke`](invoke.md) to learn how to send messages and receive responses.
