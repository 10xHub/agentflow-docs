# File Upload & Multimodal

Upload images, audio, and documents to use in multimodal agent conversations.

## Overview

The AgentFlow client provides four file-related methods plus message helpers for composing multimodal requests:

| Method | Description |
|--------|-------------|
| `client.uploadFile(file)` | Upload a file, get metadata & `file_id` |
| `client.getFileAccessUrl(fileId)` | Get the best access URL for rendering or download |
| `client.getFile(fileId)` | Download a file as a `Blob` |
| `client.getFileInfo(fileId)` | Get file metadata (no download) |
| `client.getMultimodalConfig()` | Read server multimodal settings |
| `Message.withImage(text, url)` | Create an image message |
| `Message.withFile(text, fileId, mime)` | Create a file reference message |
| `Message.multimodal(blocks)` | Compose arbitrary content blocks |

---

## Quick Start

### Upload & Analyze an Image

```typescript
import { AgentFlowClient, Message } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

// Upload
const result = await client.uploadFile(imageFile);

// Build message referencing the upload
const msg = Message.withImage('What is in this image?', result.data.url);

// Send to agent
const response = await client.invoke({
  messages: [msg],
  thread_id: 'my-thread',
});
```

### Recommended Production Pattern

If you are building a real app, prefer this flow:

1. `client.uploadFile(file)`
2. `Message.withFile(text, upload.data.file_id, upload.data.mime_type)`
3. Use `upload.data.direct_url ?? upload.data.url` for UI rendering when needed
4. Use `client.getFileAccessUrl(fileId)` when you need a fresh best-access URL later

This is the most scalable path because the backend can store media externally and use cached signed URLs instead of shipping large base64 payloads through every model request.

### Upload & Summarize a PDF

```typescript
const upload = await client.uploadFile(pdfFile);

// withFile auto-detects the correct block type from MIME
const msg = Message.withFile(
  'Summarize the key findings',
  upload.data.file_id,
  'application/pdf'
);

const response = await client.invoke({
  messages: [msg],
  thread_id: 'my-thread',
});
```

---

## uploadFile()

Upload a file to the server for use in multimodal messages.

**Endpoint:** `POST /v1/files/upload`

```typescript
async uploadFile(
  file: File | Blob | { data: Blob; filename: string }
): Promise<FileUploadResponse>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `File \| Blob \| { data: Blob; filename: string }` | The file to upload |

### Response

```typescript
interface FileUploadResponse {
  data: {
    file_id: string;              // Unique identifier
    mime_type: string;             // Detected MIME type
    size_bytes: number;            // File size
    filename: string;              // Original filename
    extracted_text: string | null; // Extracted text (documents only)
    url: string;                   // agentflow:// URL for referencing
    direct_url?: string | null;    // Best direct access URL, often signed in cloud mode
    direct_url_expires_at?: number | null;
  };
  metadata: ResponseMetadata;
}
```

### Examples

```typescript
// From a File input
const fileInput = document.querySelector<HTMLInputElement>('#file-input');
const result = await client.uploadFile(fileInput!.files![0]);
console.log(result.data.file_id); // "abc123"
console.log(result.data.url);     // "agentflow://media/abc123"
console.log(result.data.direct_url); // "https://..." when available

// From a Blob with custom name
const blob = new Blob([csvData], { type: 'text/csv' });
const result = await client.uploadFile({ data: blob, filename: 'report.csv' });

// Document with text extraction
const pdfResult = await client.uploadFile(pdfFile);
if (pdfResult.data.extracted_text) {
  console.log('Extracted:', pdfResult.data.extracted_text.slice(0, 100));
}
```

---

## getFile()

Download a previously uploaded file.

**Endpoint:** `GET /v1/files/{file_id}`

```typescript
async getFile(fileId: string): Promise<Blob>
```

### Example

```typescript
const blob = await client.getFile('abc123');

// Display in browser
const url = URL.createObjectURL(blob);
const img = document.createElement('img');
img.src = url;

// Or download
const a = document.createElement('a');
a.href = url;
a.download = 'photo.jpg';
a.click();
```

---

## getFileInfo()

Get metadata about a file without downloading the binary.

**Endpoint:** `GET /v1/files/{file_id}/info`

```typescript
async getFileInfo(fileId: string): Promise<FileInfoResponse>
```

### Response

```typescript
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
  metadata: ResponseMetadata;
}
```

---

## getFileAccessUrl()

Get the best access URL for a file.

**Endpoint:** `GET /v1/files/{file_id}/url`

```typescript
async getFileAccessUrl(fileId: string): Promise<FileAccessUrlResponse>
```

### Response

```typescript
interface FileAccessUrlResponse {
  data: {
    file_id: string;
    url: string;
    expires_at?: number | null;
    mime_type: string;
  };
  metadata: ResponseMetadata;
}
```

### Notes

- In cloud-backed deployments, this is typically a short-lived signed URL.
- In local or memory-backed deployments, this may fall back to the API file route.

```typescript
const access = await client.getFileAccessUrl(upload.data.file_id);
img.src = access.data.url;
```

---

## getMultimodalConfig()

Read the server's multimodal configuration.

**Endpoint:** `GET /v1/config/multimodal`

```typescript
async getMultimodalConfig(): Promise<MultimodalConfigResponse>
```

### Response

```typescript
interface MultimodalConfigResponse {
  data: {
    media_storage_type: string;  // "memory" | "local" | "s3" | "gcs"
    media_storage_path: string;
    media_max_size_mb: number;
    document_handling: string;   // "extract_text" | "pass_raw" | "skip"
  };
  metadata: ResponseMetadata;
}
```

---

## Message Helpers

### Message.withImage()

Create a user message containing text and an image.

```typescript
static withImage(
  text: string,
  imageUrl: string,
  role?: 'user' | 'assistant' | 'system'  // default: 'user'
): Message
```

The `imageUrl` can be an HTTPS URL, base64 data URL, or `agentflow://` URL from `uploadFile`.

For production apps, prefer uploaded file references or remote URLs over inline base64.

```typescript
// URL
Message.withImage('Describe this', 'https://example.com/photo.jpg');

// Uploaded file
const r = await client.uploadFile(file);
Message.withImage('What do you see?', r.data.url);

// Base64
Message.withImage('Analyze', 'data:image/png;base64,iVBOR...');
```

### Should I Pass Base64 Directly?

Only for small/simple cases.

- Good: quick demos, tests, notebooks, tiny screenshots
- Not ideal: production uploads, repeated requests, large images

If you pass inline base64, the image stays inline unless your server explicitly offloads it. That means it does not benefit from the signed URL path or signed URL cache.

### Message.withFile()

Create a message referencing a file by ID. Automatically selects the right content block:

- `image/*` → `ImageBlock`
- `audio/*` → `AudioBlock`
- `video/*` → `VideoBlock`
- Everything else → `DocumentBlock`

```typescript
static withFile(
  text: string,
  fileId: string,
  mimeType?: string,
  role?: 'user' | 'assistant' | 'system'
): Message
```

```typescript
const upload = await client.uploadFile(pdfFile);
const msg = Message.withFile('Summarize', upload.data.file_id, 'application/pdf');
```

### Message.multimodal()

Compose a message from arbitrary content blocks.

```typescript
static multimodal(
  blocks: ContentBlock[],
  role?: 'user' | 'assistant' | 'system'
): Message
```

```typescript
import { TextBlock, ImageBlock, MediaRef, Message } from '@10xscale/agentflow-client';

const msg = Message.multimodal([
  new TextBlock('Compare these two images:'),
  new ImageBlock(new MediaRef('url', 'https://example.com/before.jpg')),
  new ImageBlock(new MediaRef('url', 'https://example.com/after.jpg')),
]);
```

---

## TypeScript Types

Key types exported from `@10xscale/agentflow-client`:

```typescript
import {
  // Content blocks
  TextBlock,
  ImageBlock,
  AudioBlock,
  VideoBlock,
  DocumentBlock,

  // Media reference
  MediaRef,

  // Response types
  FileUploadResponse,
  FileInfoResponse,
  MultimodalConfigResponse,
} from '@10xscale/agentflow-client';
```

### MediaRef

```typescript
class MediaRef {
  kind: 'url' | 'file_id' | 'data';
  url?: string;
  file_id?: string;
  data_base64?: string;
  mime_type?: string;
  size_bytes?: number;
  filename?: string;
  sha256?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
}
```

---

## Error Handling

| Error | Status | Cause |
|-------|--------|-------|
| `BadRequestError` | 400 | File too large or invalid format |
| `AuthenticationError` | 401 | Missing or invalid auth token |
| `NotFoundError` | 404 | File ID not found |
| `ValidationError` | 422 | Validation failed |
| `ServerError` | 500+ | Server-side issue |

```typescript
try {
  const result = await client.uploadFile(file);
} catch (err) {
  if (err instanceof BadRequestError) {
    console.error('Upload rejected:', err.message);
  }
}
```

---

## See Also

- [API Reference](api-reference.md) — All client methods
- [Multimodal How-To Guide](../../how-to/multimodal.md) — End-to-end usage examples
- [Python Media Reference](../library/media.md) — Server-side media processing
