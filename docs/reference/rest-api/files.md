---
title: REST API — Files — AgentFlow Python AI Agent Framework
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

**Supported types:**

| Format | MIME type |
| --- | --- |
| JPEG image | `image/jpeg` |
| PNG image | `image/png` |
| WebP image | `image/webp` |
| GIF image | `image/gif` |
| MP3 audio | `audio/mpeg` |
| WAV audio | `audio/wav` |
| OGG audio | `audio/ogg` |
| PDF document | `application/pdf` |
| Plain text | `text/plain` |

**Example:**

```bash
curl -X POST http://127.0.0.1:8000/v1/files/upload \
  -F "file=@photo.jpg"
```

**Response:**

```json
{
  "file_id": "f_abc123",
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 24576,
  "access_url": "/v1/files/f_abc123"
}
```

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
