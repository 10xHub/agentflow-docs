---
title: REST API — Files — AgentFlow Python AI Agent Framework
sidebar_label: REST API
description: Reference for the file upload and retrieval endpoints. Part of the AgentFlow rest api reference guide for production-ready Python AI agents.
keywords:
  - rest api reference
  - agent http api
  - agentflow rest endpoints
  - agentflow
  - python ai agent framework
  - rest api — files
---


# REST API: Files

File endpoints allow you to upload images, audio, and documents, then reference them in graph messages by `file_id`.

Base path: `/v1/files`

---

## POST /v1/files/upload

Upload a file and receive a `file_id` to use in future messages.

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Description |
| --- | --- | --- |
| `file` | binary | The file to upload (required, must have a filename) |

**Accepted types:**

The server accepts **any** content type by default. `MEDIA_ALLOWED_CONTENT_TYPES` is empty out of the box, and an empty allowlist means allow everything. Set it to restrict uploads:

```bash
MEDIA_ALLOWED_CONTENT_TYPES=image/*,application/pdf
```

Entries may be exact (`image/png`) or wildcard subtype (`image/*`). A rejected type returns `415`.

Types commonly sent to an agent: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `audio/mpeg`, `audio/wav`, `audio/ogg`, `application/pdf`, `text/plain`.

**Size limit:** `MEDIA_MAX_SIZE_MB`, default `25.0`. Exceeding it returns `413`. The body is read in 1 MiB chunks with a running size cap, so an oversized or chunked upload is rejected before it is buffered whole.

**Example:**

```bash
curl -X POST http://127.0.0.1:8000/v1/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "file_id": "f_abc123",
    "mime_type": "image/jpeg",
    "size_bytes": 24576,
    "filename": "photo.jpg",
    "extracted_text": null,
    "url": "/v1/files/f_abc123",
    "direct_url": null,
    "direct_url_expires_at": null
  }
}
```

| Field | Description |
| --- | --- |
| `file_id` | Opaque storage key. Reference this from message content blocks. |
| `mime_type` | The content type the server recorded |
| `size_bytes` | Stored size |
| `filename` | Original filename |
| `extracted_text` | Extracted document text, when `DOCUMENT_HANDLING=extract_text` and the type is extractable. `null` otherwise. |
| `url` | API-relative retrieval path |
| `direct_url` | Signed direct URL, when the storage backend can produce one |
| `direct_url_expires_at` | Expiry of the signed URL, as a Unix timestamp |

The uploader is recorded as the file's owner. Every read path checks it, and a file owned by another user returns `404`, not `403`, so the API never confirms that a foreign `file_id` exists.

For how to reference an uploaded file from a message, see [Multimodal and vision](../../how-to/production/multimodal-and-vision.md).

---

## GET /v1/files/`{file_id}`

Retrieve a file by its ID.

**Response:** Raw file bytes with the correct `Content-Type` header.

```bash
curl http://127.0.0.1:8000/v1/files/f_abc123 --output photo.jpg
```

---

## GET /v1/files/`{file_id}`/info

Get metadata for a file without downloading it.

**Response:**

```json
{
  "file_id": "f_abc123",
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 24576,
  "created_at": "2026-04-08T10:00:00Z"
}
```

---

## Using a file_id in a message

Include the `file_id` in a message content array when invoking the graph:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image", "file_id": "f_abc123"}
      ]
    }
  ],
  "config": {"thread_id": "media-thread"}
}
```

The graph receives an `ImageBlock` (or `AudioBlock` for audio files) containing the file reference.

---

## Error responses

| Status | Description |
| --- | --- |
| `400` | Missing filename or empty file |
| `413` | File exceeds `MAX_REQUEST_SIZE` |
| `404` | `file_id` not found |

---

## Authentication

File uploads require `files:upload` permission. File reads require `files:read`.
