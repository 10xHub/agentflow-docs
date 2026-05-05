---
title: Files — AgentFlow Python AI Agent Framework
sidebar_label: Files
description: Reference for file upload and media access methods on AgentFlowClient. Part of the AgentFlow typescript client reference guide for production-ready Python AI.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - files
sidebar_position: 7
---


# Files

The files API lets you upload images, audio clips, documents, and other binary files to the AgentFlow server so they can be referenced in multimodal messages. The server stores files and returns a `file_id` and an access URL that you embed in `ImageBlock`, `AudioBlock`, or `DocumentBlock` content.

**Endpoints base path:** `/v1/files`  
**Source:** `src/endpoints/files.ts`

---

## Upload flow

1. Call `uploadFile(file)` with a `File`, `Blob`, or `{ data: Blob; filename: string }` object.
2. Receive a `file_id` and a `url` in the response.
3. Embed the access URL (or `file_id`) inside a `MediaRef` in the appropriate content block.
4. Send the message containing the block via `invoke()` or `stream()`.

---

## `uploadFile(file)`

Upload a file to the server.

**Endpoint:** `POST /v1/files/upload`

```ts
// From a browser file input
const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
const file = input.files![0];
const response = await client.uploadFile(file);

// From a Blob with a custom filename
const blob = new Blob([imageBytes], { type: 'image/png' });
const response = await client.uploadFile({ data: blob, filename: 'screenshot.png' });
```

### Accepted input types

| Type | How file is named |
|---|---|
| `File` | Uses `file.name` automatically. |
| `Blob` | Fallback filename `'upload'` is used. Specify `{ data: blob, filename: '...' }` if the name matters. |
| `{ data: Blob; filename: string }` | Uses the `filename` field. |

### `FileUploadResponse`

```ts
interface FileUploadResponse {
  data: {
    file_id: string;           // Unique identifier for the uploaded file
    mime_type: string;         // Detected MIME type (e.g. 'image/jpeg')
    size_bytes: number;        // File size in bytes
    filename: string;          // Name as stored on the server
    extracted_text: string | null; // Text extracted from documents (PDF, DOCX), if supported
    url: string;               // Access URL — use this in MediaRef
    direct_url?: string | null;       // Direct URL (e.g. S3 presigned URL) if cloud-backed
    direct_url_expires_at?: number | null; // Unix timestamp when direct_url expires
  };
  metadata?: {
    request_id: string;
    timestamp: string;
    message: string;
  };
}
```

**Use the response in a message:**

```ts
const upload = await client.uploadFile(imageFile);

// Reference by URL (simplest)
const imageBlock = new ImageBlock(
  new MediaRef('url', upload.data.url),
  'Uploaded image'
);

// Reference by file_id (more portable; the server resolves the URL)
const mediaRef = new MediaRef('file_id');
mediaRef.file_id = upload.data.file_id;
mediaRef.mime_type = upload.data.mime_type;

const imageMsg = new Message('user', [
  new TextBlock('What is in this image?'),
  new ImageBlock(mediaRef),
]);

const result = await client.invoke([imageMsg]);
```

---

## `getFile(fileId)`

Download a file by its `file_id`. Returns a raw `Blob`.

**Endpoint:** `GET /v1/files/{fileId}`

```ts
const blob = await client.getFile('file-abc123');
const url = URL.createObjectURL(blob);
// Render in an <img> tag or download
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `fileId` | `string` | The file ID returned by `uploadFile()`. |

---

## `getFileInfo(fileId)`

Fetch metadata about a stored file without downloading its contents.

**Endpoint:** `GET /v1/files/{fileId}/info`

```ts
const info = await client.getFileInfo('file-abc123');
console.log(info.data.mime_type);       // 'application/pdf'
console.log(info.data.size_bytes);      // 204800
console.log(info.data.extracted_text);  // Text extracted from the PDF, or null
```

### `FileInfoResponse`

```ts
interface FileInfoResponse {
  data: {
    file_id: string;
    mime_type: string;
    size_bytes: number;
    filename?: string | null;
    extracted_text: string | null;
    direct_url?: string | null;
    direct_url_expires_at?: number | null;
  };
  metadata?: ResponseMetadata;
}
```

---

## `getFileAccessUrl(fileId)`

Get the best access URL for a file. For cloud-backed storage (S3, GCS, Azure) this returns a time-limited signed URL. For local or memory-backed storage it returns the normal API file route.

**Endpoint:** `GET /v1/files/{fileId}/url`

```ts
const result = await client.getFileAccessUrl('file-abc123');
console.log(result.data.url);             // The best URL to use right now
console.log(result.data.expires_at);      // Unix timestamp, or null if permanent
console.log(result.data.mime_type);
```

### `FileAccessUrlResponse`

```ts
interface FileAccessUrlResponse {
  data: {
    file_id: string;
    url: string;
    expires_at?: number | null;  // Unix timestamp in milliseconds; null = no expiry
    mime_type: string;
  };
  metadata?: ResponseMetadata;
}
```

:::tip Refreshing signed URLs
If you display a file in the UI and the user might have the page open for a long time, poll `getFileAccessUrl()` before rendering to ensure the URL has not expired. Compare `Date.now()` with `expires_at * 1000`.
:::

---

## `getMultimodalConfig()`

Fetch the server's multimodal configuration — which storage backend is active, the max upload size, and how documents are handled.

**Endpoint:** `GET /v1/files/config`

```ts
const config = await client.getMultimodalConfig();
console.log(config.data.media_storage_type);  // 'local' | 's3' | 'gcs' | 'azure_blob'
console.log(config.data.media_max_size_mb);   // 10
console.log(config.data.document_handling);   // 'extract' | 'raw'
```

### `MultimodalConfigResponse`

```ts
interface MultimodalConfigResponse {
  data: {
    media_storage_type: string;   // Storage backend identifier
    media_storage_path: string;   // Base path or bucket name
    media_max_size_mb: number;    // Maximum file size in megabytes
    document_handling: string;    // How documents are processed on upload
  };
  metadata?: ResponseMetadata;
}
```

---

## Supported MIME types

The server accepts any MIME type that your storage backend supports, but the graph can only process types that the underlying LLM supports. Common supported types:

| Category | MIME types |
|---|---|
| Images | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Audio | `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/webm` |
| Video | `video/mp4`, `video/webm` |
| Documents | `application/pdf`, `text/plain`, `text/markdown` |

Call `getMultimodalConfig()` to confirm the active storage settings before uploading.

---

## Complete example: image Q&A

```ts
import {
  AgentFlowClient,
  Message,
  ImageBlock,
  TextBlock,
  MediaRef,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

async function askAboutImage(imageFile: File, question: string) {
  // 1. Upload the image
  const upload = await client.uploadFile(imageFile);

  // 2. Build a multimodal message
  const userMsg = new Message('user', [
    new TextBlock(question),
    new ImageBlock(
      new MediaRef('url', upload.data.url),
      imageFile.name
    ),
  ]);

  // 3. Invoke and return the answer
  const result = await client.invoke([userMsg]);
  const answer = result.messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.content)
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('');

  return answer;
}
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `413` | File exceeds `media_max_size_mb`. | Check `getMultimodalConfig()` and reduce file size. |
| `AgentFlowError` status `415` | Unsupported MIME type. | Verify the file type is accepted by the storage backend. |
| `AgentFlowError` status `404` | `file_id` not found (deleted or wrong ID). | Re-upload the file. |
| Signed URL expired | `direct_url_expires_at` is in the past. | Call `getFileAccessUrl()` to refresh the URL. |

---

## What you learned

- `uploadFile()` accepts `File`, `Blob`, or `{ data, filename }`. It returns a `file_id` and `url`.
- Reference uploaded files in messages via `MediaRef('url', url)` or `MediaRef('file_id')` with `file_id` set.
- `getFileAccessUrl()` refreshes cloud-backed signed URLs.
- `getMultimodalConfig()` tells you the storage backend and max file size.

## Next step

See [`reference/client/auth`](auth.md) to learn how to configure authentication for the client.
