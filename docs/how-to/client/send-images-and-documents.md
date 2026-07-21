---
title: How to send images and documents — TypeScript client how-to
sidebar_label: How to send images and documents
description: Task-oriented guide to sending images, PDFs, and other media to an agent from TypeScript using uploadFile, Message.withImage, Message.withFile, and Message.multimodal.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - how to send images and documents
sidebar_position: 6.5
---


# How to send images and documents

Vision and document input work the same way on `invoke()`, `stream()`, and `wsStream()`. The path is always:

1. Upload the file with `client.uploadFile()` and keep the returned `file_id`.
2. Build a message whose content carries a media block referencing that `file_id`.
3. Send the message like any other message.

The server rewrites each `file_id` reference into an internal `agentflow://media/{file_id}` URL when the request arrives, then resolves it to real bytes or a provider URL at LLM-call time. You never have to inline base64 or expose a public URL.

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- The API server running with media storage configured. Verify with `getMultimodalConfig()` (step 1).
- A model that can actually read the media you send. Sending a PNG to a text-only model is a model error, not a client error.

---

## Step 1: Read the server's limits first

The limits belong to the server, not the client, so read them rather than hardcoding them:

```ts
const config = await client.getMultimodalConfig();

const {
  media_storage_type,   // 'memory' | 'local' | 'cloud' | 'pg'
  media_storage_path,
  media_max_size_mb,    // server default is 25
  document_handling,    // 'extract_text' | 'pass_raw' | 'skip'
} = config.data;
```

`document_handling` decides what happens to non-image files and is worth branching on in your UI:

| Value | Effect |
|---|---|
| `extract_text` | The server extracts the document's text at upload time and exposes it as `extracted_text`. A `DocumentBlock` carrying that `file_id` is replaced with the extracted text before the graph runs. This is the server default. |
| `pass_raw` | The document is passed through to the model as a media reference. Only useful with models that accept documents natively. |
| `skip` | Documents are not sent to the model at all. Offer image attachments only. |

```ts
const acceptsDocuments = config.data.document_handling !== 'skip';
const maxBytes = config.data.media_max_size_mb * 1024 * 1024;
```

Enforce `maxBytes` before uploading. The server rejects an oversized file, but checking locally saves the round trip.

---

## Step 2: Upload the file

`uploadFile()` takes exactly one argument: a `File`, a `Blob`, or `{ data: Blob; filename: string }`. There are no options — no `purpose`, no MIME override. The server infers the type from the upload itself.

```ts
// Browser: straight from a file input
const file = input.files![0];
const upload = await client.uploadFile(file);

// Node or programmatic: give the blob a filename
import { readFileSync } from 'fs';
const blob = new Blob([readFileSync('./chart.png')], { type: 'image/png' });
const upload = await client.uploadFile({ data: blob, filename: 'chart.png' });
```

The response nests everything under `data`:

```ts
upload.data.file_id;         // the id you put in messages
upload.data.mime_type;       // e.g. 'image/png'
upload.data.size_bytes;
upload.data.filename;
upload.data.extracted_text;  // string for documents under extract_text, otherwise null
upload.data.url;             // access URL, for rendering a preview in your own UI
```

Read `upload.data.file_id`, not `upload.file_id`.

---

## Step 3: Build the message

### One image

```ts
import { Message } from '@10xscale/agentflow-client';

const msg = Message.withFile(
  'What is shown in this image?',
  upload.data.file_id,
  upload.data.mime_type,   // 'image/png' → the helper builds an ImageBlock
);
```

`Message.withFile()` picks the block type from the MIME type: `image/*` gives an `ImageBlock`, `audio/*` an `AudioBlock`, `video/*` a `VideoBlock`, and anything else a `DocumentBlock`. Pass `upload.data.mime_type` straight through and it is always right. Omitting it produces a `DocumentBlock`, which is not what a vision model expects.

### One document

Same call — the MIME type steers it:

```ts
const upload = await client.uploadFile(pdfFile);

const msg = Message.withFile(
  'Summarize the key obligations in this contract.',
  upload.data.file_id,
  upload.data.mime_type,   // 'application/pdf' → DocumentBlock
);
```

Under `extract_text`, the extracted text is already sitting in `upload.data.extracted_text`. Sending the `file_id` is still the right move: the server swaps in the cached extraction itself, so you avoid shipping the whole document body up with the request.

### An image from a public URL

If the image is already on a URL the server can fetch, skip the upload entirely:

```ts
const msg = Message.withImage('Describe this', 'https://example.com/photo.jpg');
```

`withImage()` also accepts a `data:` URI for inline base64. Prefer `uploadFile()` plus `withFile()` for anything user-supplied — it keeps the request small and gives the server a stable id to enforce access control against.

### Several files, or a specific block order

`Message.multimodal()` takes the blocks verbatim, so you control the ordering the model sees:

```ts
import { Message, TextBlock, ImageBlock, MediaRef } from '@10xscale/agentflow-client';

const imageRef = (fileId: string, mime: string) => {
  const media = new MediaRef('file_id');
  media.file_id = fileId;
  media.mime_type = mime;
  return new ImageBlock(media);
};

const msg = Message.multimodal([
  new TextBlock('Which of these two floor plans has more storage?'),
  imageRef(first.data.file_id, first.data.mime_type),
  imageRef(second.data.file_id, second.data.mime_type),
  new TextBlock('Answer with A or B and one sentence of reasoning.'),
]);
```

The `MediaRef` constructor is positional — `(kind, url, file_id, data_base64, mime_type, ...)` — so building it by field name, as above, is far less error-prone than `new MediaRef('file_id', undefined, id, undefined, mime)`.

### Adding media to a message you already have

`attach_media()` appends a block to an existing message in place:

```ts
const msg = Message.text_message('Compare these screenshots');

for (const up of uploads) {
  const media = new MediaRef('file_id');
  media.file_id = up.data.file_id;
  media.mime_type = up.data.mime_type;
  msg.attach_media(media, 'image');   // 'image' | 'audio' | 'video' | 'document'
}
```

Any `as_type` outside those four values throws `Unsupported media type: <value>`.

---

## Step 4: Send it

### With `invoke()`

```ts
const result = await client.invoke([msg], {
  config: { thread_id: 'vision-demo-1' },
});

console.log(result.messages.at(-1)?.text());
```

### With `stream()`

Nothing about the message changes; only the call does:

```ts
import { StreamEventType } from '@10xscale/agentflow-client';

const stream = client.stream([msg], {
  config: { thread_id: 'vision-demo-1' },
  response_granularity: 'low',
});

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message?.delta) {
    process.stdout.write(chunk.message.text());
  }
}
```

`wsStream()` accepts the same message and options.

---

## Step 5: Keep the file across turns

The `file_id` stays valid, so a follow-up question about the same image does not need a re-upload:

```ts
const followUp = Message.withFile(
  'Now read the numbers along the bottom axis.',
  upload.data.file_id,
  upload.data.mime_type,
);

await client.invoke([followUp], { config: { thread_id: 'vision-demo-1' } });
```

Because the thread is checkpointed, the earlier turn is already in context; re-attaching the file just makes sure the model can look at the pixels again rather than relying on its own earlier description.

To render the file back in your own UI, use `getFileAccessUrl()` rather than caching `upload.data.url` — on cloud-backed storage that URL is signed and expires:

```ts
const { data } = await client.getFileAccessUrl(upload.data.file_id);
renderImage(data.url);   // data.expires_at is a UNIX timestamp when signed
```

---

## Complete example

```ts
import { AgentFlowClient, Message } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

async function ask(file: File, question: string, threadId: string): Promise<string> {
  const config = await client.getMultimodalConfig();

  if (file.size > config.data.media_max_size_mb * 1024 * 1024) {
    throw new Error(`File exceeds the server limit of ${config.data.media_max_size_mb} MB`);
  }

  const isImage = file.type.startsWith('image/');
  if (!isImage && config.data.document_handling === 'skip') {
    throw new Error('This server does not accept documents; attach an image instead');
  }

  const upload = await client.uploadFile(file);

  const message = Message.withFile(question, upload.data.file_id, upload.data.mime_type);

  const result = await client.invoke([message], { config: { thread_id: threadId } });
  return result.messages.at(-1)?.text() ?? '';
}
```

---

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `file_id` is `undefined` | Reading `upload.file_id` instead of `upload.data.file_id`. | The upload response nests everything under `data`. |
| The model answers as if there were no image | `Message.withFile()` was called without `mimeType`, so the image became a `DocumentBlock`. | Pass `upload.data.mime_type`. |
| The document's content never reaches the model | `document_handling` is `skip`. | Change the server setting, or send the text yourself in a `TextBlock`. |
| `extracted_text` is `null` on a PDF | `document_handling` is `pass_raw` or `skip`, or the PDF is scanned images with no text layer. | Use `extract_text` with a text-bearing PDF, or run OCR before uploading. |
| A rendered preview 403s after a while | The signed URL expired. | Fetch a fresh one with `getFileAccessUrl(file_id)`. |
| `AgentFlowError` with `statusCode` 413 | The file is larger than `media_max_size_mb`. | Compress it, or raise the limit on the server. |

---

## What you learned

- `uploadFile()` takes exactly one argument and returns everything under `response.data`.
- `Message.withFile(text, fileId, mimeType)` is the shortest correct path for an uploaded image or document; the MIME type is what selects the block type.
- `Message.withImage()` is for URLs and `data:` URIs; `Message.multimodal()` and `attach_media()` cover multi-file and custom orderings.
- The same message works unchanged across `invoke()`, `stream()`, and `wsStream()`.
- Read `getMultimodalConfig()` for the size limit and `document_handling` instead of hardcoding them.

## Next step

See [`reference/client/message`](../../reference/client/message.md) for every block type and factory signature, or [`reference/client/files`](../../reference/client/files.md) for the full files API.
