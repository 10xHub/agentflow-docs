---
title: How to upload files — AgentFlow Python AI Agent Framework
description: Step-by-step guide to uploading images, audio, and documents and using them in multimodal messages. Part of the AgentFlow agentflow typescript client guide for.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - how to upload files
sidebar_position: 6
---


# How to upload files

AgentFlow supports multimodal messages — messages that contain images, audio, documents, and other binary files alongside text. This guide shows you how to upload a file, reference it in a message, and send it to the agent.

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- The API server running with a media storage backend configured (check with `getMultimodalConfig()`).
- The underlying LLM must support the file type you are uploading (e.g. GPT-4V for images, Gemini for audio).

---

## Step 1: Check the server's multimodal configuration

Before uploading, confirm the server accepts files and check the size limit:

```ts
const config = await client.getMultimodalConfig();
console.log('Storage backend:', config.data.media_storage_type); // 'local', 's3', etc.
console.log('Max size (MB):', config.data.media_max_size_mb);    // e.g. 10
console.log('Document handling:', config.data.document_handling); // 'extract' or 'raw'
```

If `media_storage_type` is empty or the endpoint returns an error, media uploads are not configured on the server.

---

## Step 2: Upload a file

### From a browser file input

```ts
const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
const file = input.files![0];

const upload = await client.uploadFile(file);
console.log('File ID:', upload.data.file_id);
console.log('Access URL:', upload.data.url);
console.log('MIME type:', upload.data.mime_type);
```

### From a Blob (Node.js or programmatic)

```ts
import { readFileSync } from 'fs';

const buffer = readFileSync('./diagram.png');
const blob = new Blob([buffer], { type: 'image/png' });

const upload = await client.uploadFile({ data: blob, filename: 'diagram.png' });
```

### From a URL (fetch first)

```ts
const imageResponse = await fetch('https://example.com/photo.jpg');
const blob = await imageResponse.blob();

const upload = await client.uploadFile({ data: blob, filename: 'photo.jpg' });
```

---

## Step 3: Build a multimodal message

Use the `file_id` or `url` from the upload in a `MediaRef` inside the appropriate block:

### Image message

```ts
import { Message, ImageBlock, TextBlock, MediaRef } from '@10xscale/agentflow-client';

const imageMsg = new Message('user', [
  new TextBlock('What is shown in this image?'),
  new ImageBlock(
    new MediaRef('url', upload.data.url),
    'Uploaded image'  // alt text
  ),
]);
```

### Document message (PDF, DOCX)

```ts
import { DocumentBlock } from '@10xscale/agentflow-client';

const docMsg = new Message('user', [
  new TextBlock('Summarise the key points from this document.'),
  new DocumentBlock(
    new MediaRef('url', upload.data.url)
  ),
]);
```

If `document_handling` is `'extract'`, the server extracts text from the document at upload time and the extracted text is available in `upload.data.extracted_text`.

### Audio message

```ts
import { AudioBlock } from '@10xscale/agentflow-client';

const audioMsg = new Message('user', [
  new TextBlock('Please transcribe and summarise this audio.'),
  new AudioBlock(
    new MediaRef('url', upload.data.url)
  ),
]);
```

---

## Step 4: Send the message to the agent

```ts
const result = await client.invoke([imageMsg]);

const answer = result.messages
  .filter(m => m.role === 'assistant')
  .flatMap(m => m.content)
  .filter(b => b.type === 'text')
  .map(b => (b as any).text as string)
  .join('');

console.log('Agent says:', answer);
```

---

## Step 5: Verify file metadata

Check what the server knows about an uploaded file:

```ts
const info = await client.getFileInfo(upload.data.file_id);
console.log(info.data.mime_type);
console.log(info.data.size_bytes);
console.log(info.data.extracted_text);  // Non-null for documents with text extraction
```

---

## Step 6: Get a fresh access URL

For cloud-backed storage (S3, GCS, Azure Blob) the initial URL is a signed URL that expires. Always refresh it before rendering files that users might encounter a long time after upload:

```ts
const urlInfo = await client.getFileAccessUrl(upload.data.file_id);

// Check if the URL is still valid
const isExpired = urlInfo.data.expires_at
  ? Date.now() > urlInfo.data.expires_at
  : false;

const freshUrl = isExpired
  ? (await client.getFileAccessUrl(upload.data.file_id)).data.url
  : urlInfo.data.url;

renderImage(freshUrl);
```

---

## Step 7: Download a file

Retrieve the raw file bytes as a `Blob`:

```ts
const blob = await client.getFile(upload.data.file_id);

// Create a download link in the browser
const objUrl = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = objUrl;
link.download = 'downloaded-file';
link.click();
URL.revokeObjectURL(objUrl);
```

---

## Complete end-to-end example

```ts
import {
  AgentFlowClient,
  Message,
  ImageBlock,
  TextBlock,
  MediaRef,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

async function describeImage(imageFile: File): Promise<string> {
  // 1. Upload
  const upload = await client.uploadFile(imageFile);

  // 2. Build message
  const msg = new Message('user', [
    new TextBlock('Describe this image in detail.'),
    new ImageBlock(
      new MediaRef('url', upload.data.url),
      imageFile.name
    ),
  ]);

  // 3. Invoke
  const result = await client.invoke([msg]);

  // 4. Extract text response
  return result.messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.content)
    .filter(b => b.type === 'text')
    .map(b => (b as any).text as string)
    .join('');
}
```

---

## Supported file types

The server accepts any MIME type permitted by the configured storage backend. Common types:

| Category | MIME types |
|---|---|
| Images | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Audio | `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/webm` |
| Video | `video/mp4`, `video/webm` |
| Documents | `application/pdf`, `text/plain`, `text/markdown` |

The LLM also determines which types it can process. Check your model's documentation for supported media types.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `413` | File exceeds `media_max_size_mb`. | Compress the file or raise the server limit. |
| `AgentFlowError` status `415` | Unsupported MIME type. | Use a supported file type (see table above). |
| `AgentFlowError` status `404` on download | `file_id` not found (deleted or wrong). | Re-upload the file. |
| Signed URL expired | `direct_url_expires_at` is in the past. | Call `getFileAccessUrl(file_id)` to get a fresh URL. |
| `extracted_text` is `null` | Document handling is `'raw'` or the file has no extractable text. | Set `document_handling: 'extract'` on the server, or pass the text manually in the message. |

---

## What you learned

- `uploadFile()` accepts `File`, `Blob`, or `{ data: Blob; filename: string }`.
- Reference uploaded files in messages via `MediaRef('url', upload.data.url)`.
- For cloud-backed storage, refresh signed URLs with `getFileAccessUrl()` before rendering.
- `getFileInfo()` returns metadata including extracted text from documents.

## Next step

See [how-to/client/register-remote-tools](register-remote-tools.md) to learn how to register browser-side functions that the agent can call remotely.
