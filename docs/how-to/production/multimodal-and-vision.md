---
title: Multimodal and Vision — Production how-to
sidebar_label: Multimodal and Vision
description: How to send images, audio, and documents to an AgentFlow agent over the API. Covers file upload, the file_id reference rewrite, document text extraction, and the MEDIA_* environment variables.
keywords:
  - agentflow multimodal
  - agentflow vision api
  - agent image input
  - agentflow document extraction
  - agentflow production
  - python ai agent framework
---

# Multimodal and vision

Image, audio, and document input is a first-class capability of the run endpoints. You upload a file once, get a `file_id`, and reference that id from a content block on any message you send to `POST /v1/graph/invoke`, `POST /v1/graph/stream`, or `WS /v1/graph/ws`. The server resolves the reference before the graph runs, so nodes and model adapters receive resolved media without knowing anything about the upload API.

This does **not** apply to `WS /v1/graph/live`. That socket carries audio frames and JSON control frames only; see [its scope section](../../reference/rest-api/live.md#scope-audio-and-text-only).

## The flow

1. `POST /v1/files/upload` stores the binary and returns a `file_id`.
2. You send a message whose content includes an `ImageBlock` (or `AudioBlock`, or `DocumentBlock`) carrying that `file_id`.
3. The server rewrites the block before execution:
   - **Images and audio** become a URL reference, `agentflow://media/{file_id}`, which the media reference resolver expands at model-call time.
   - **Documents** are replaced with a plain text block containing the extracted text, when an extraction is cached for that file.
4. The graph runs against the rewritten messages.

Step 3 runs inside the same input-preparation path that `invoke`, `stream`, and the `ws` socket all share, so behaviour is identical across all three.

Ownership is enforced during the rewrite: referencing a `file_id` uploaded by another user fails the request. The rewrite is a no-op when no media service is configured.

## Step 1: upload the file

```bash
curl -X POST http://127.0.0.1:8000/v1/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@invoice.png"
```

```json
{
  "success": true,
  "data": {
    "file_id": "b3f1c9d2e4a5",
    "mime_type": "image/png",
    "size_bytes": 184320,
    "filename": "invoice.png",
    "extracted_text": null,
    "url": "/v1/files/b3f1c9d2e4a5",
    "direct_url": null,
    "direct_url_expires_at": null
  }
}
```

The uploader is recorded as the file's owner in the file's own metadata, so ownership survives as long as the file does. Every read path (`GET /v1/files/{file_id}`, `/info`, `/url`, and the message rewrite) checks it, and a file owned by someone else returns `404` rather than `403`, so the API never confirms that a foreign `file_id` exists.

Two rejections to expect at upload:

| Status | Cause |
| --- | --- |
| `415` | The content type is not in `MEDIA_ALLOWED_CONTENT_TYPES` |
| `413` | The body exceeded `MEDIA_MAX_SIZE_MB`. The upload is read in 1 MiB chunks with a running size cap, so an oversized or chunked body is rejected before it is buffered whole. |

## Step 2: reference the file in a message

Send an image block whose media carries the `file_id`:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What is the total on this invoice?"},
        {"type": "image", "media": {"kind": "file_id", "file_id": "b3f1c9d2e4a5"}}
      ]
    }
  ],
  "config": {"thread_id": "invoices-1"}
}
```

Post that to `/v1/graph/invoke` or `/v1/graph/stream`, or send it as the `messages` array of a `fresh` frame on `WS /v1/graph/ws`. In every case the block reaches the graph as `agentflow://media/b3f1c9d2e4a5`.

Blocks that already carry an `agentflow://media/` URL are left alone, so re-sending a previously rewritten message is safe.

## Documents

Documents follow a different path because most models take text, not a file.

When `DOCUMENT_HANDLING=extract_text` (the default) and the uploaded MIME type is extractable, text extraction runs **at upload time** and the result comes back in `extracted_text`. It is also cached, keyed by `file_id`.

Extractable types:

`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/html`, `text/xml`, `application/xml`, `text/markdown`, `text/csv`, `application/json`, `text/plain`.

Later, when a message references that `file_id` in a document block, the block is replaced with the cached text. If no extraction is cached the block passes through untouched and the agent's own converter handles it.

The cache has two tiers: an in-process dictionary, plus the configured checkpointer's cache namespace (`media:extraction`, 24-hour TTL) when a checkpointer is available. Without a checkpointer the cache is per process, so a document uploaded through one worker may need re-extraction on another.

Extraction requires the media extra:

```bash
pip install "10xscale-agentflow-cli[media]"
```

`DOCUMENT_HANDLING` accepts three values:

| Value | Behaviour |
| --- | --- |
| `extract_text` | Extract text and substitute it for the document block. The default. |
| `pass_raw` | Leave the document block as-is and let the model adapter handle the raw file. |
| `skip` | Drop document blocks. |

## Reading the server's media configuration

`GET /v1/config/multimodal` reports the settings the server is actually running with, so a client can size its uploads and pick file types without hard-coding assumptions. It requires the `config:read` permission.

```json
{
  "success": true,
  "data": {
    "media_storage_type": "local",
    "media_storage_path": "./uploads",
    "media_max_size_mb": 25.0,
    "document_handling": "extract_text"
  }
}
```

The response deliberately does not include the content-type allowlist. Treat `415` as the signal that a type is refused.

## Environment variables

All media settings are read from the environment at startup.

### Core

| Variable | Default | Description |
| --- | --- | --- |
| `MEDIA_STORAGE_TYPE` | `local` | Where binaries live: `memory`, `local`, `cloud`, or `pg` |
| `MEDIA_STORAGE_PATH` | `./uploads` | Directory for the `local` store |
| `MEDIA_MAX_SIZE_MB` | `25.0` | Maximum upload size in megabytes. Exceeding it returns `413`. |
| `DOCUMENT_HANDLING` | `extract_text` | `extract_text`, `pass_raw`, or `skip` |
| `MEDIA_ALLOWED_CONTENT_TYPES` | `""` (empty) | Comma-separated MIME allowlist for uploads. **Empty means allow every type.** |

### `MEDIA_ALLOWED_CONTENT_TYPES`

The allowlist is empty by default, which accepts anything. That is a deliberate default for local development, and a deliberate decision you should revisit before exposing uploads to untrusted callers.

Entries may be exact (`image/png`) or a wildcard subtype (`image/*`). Matching is case-insensitive and ignores any `;charset=` suffix on the request's content type.

```bash
MEDIA_ALLOWED_CONTENT_TYPES=image/png,image/jpeg,image/webp,application/pdf
```

```bash
# Any image, plus PDFs
MEDIA_ALLOWED_CONTENT_TYPES=image/*,application/pdf
```

A rejected upload returns `415 Content type not allowed: <mime>`.

### Cloud storage

Used only when `MEDIA_STORAGE_TYPE=cloud`.

| Variable | Default | Description |
| --- | --- | --- |
| `MEDIA_CLOUD_PROVIDER` | `aws` | `aws` or `gcp` |
| `MEDIA_CLOUD_BUCKET` | `""` | Bucket name |
| `MEDIA_CLOUD_REGION` | `us-east-1` | Bucket region |
| `MEDIA_CLOUD_PREFIX` | `agentflow-media` | Key prefix inside the bucket |
| `MEDIA_CLOUD_ACCESS_KEY_ID` | `null` | AWS access key |
| `MEDIA_CLOUD_SECRET_ACCESS_KEY` | `null` | AWS secret key |
| `MEDIA_CLOUD_SESSION_TOKEN` | `null` | AWS session token |
| `MEDIA_CLOUD_PROJECT_ID` | `null` | GCP project id |
| `MEDIA_CLOUD_CREDENTIALS_JSON` | `null` | GCP service-account credentials JSON |

### Signed URLs

| Variable | Default | Description |
| --- | --- | --- |
| `MEDIA_SIGNED_URL_TTL_SECONDS` | `3600` | Lifetime of a signed direct URL |
| `MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS` | `60` | Re-sign this many seconds before expiry rather than handing out a URL about to die |

`GET /v1/files/{file_id}/url` returns a signed direct URL when the storage backend can produce one, falling back to the API-relative `/v1/files/{file_id}`. A signed URL bypasses the API entirely, so ownership is checked before one is issued.

## Production checklist

- Set `MEDIA_ALLOWED_CONTENT_TYPES` to the types your agent actually handles.
- Set `MEDIA_MAX_SIZE_MB` to the smallest value that works. It is independent of `MAX_REQUEST_SIZE`, which the middleware applies to non-chunked request bodies.
- Use `cloud` or `pg` storage for multi-worker deployments. The `local` store assumes a shared filesystem and `memory` loses everything on restart.
- Configure a checkpointer so the document extraction cache is shared across workers instead of being re-extracted per process.
- Set `MEDIA_REQUIRE_OWNER=true` if you need a hard guarantee that no file without a recorded owner can be read. Files uploaded before ownership tracking existed carry no owner and are otherwise allowed through with a warning.

## See also

- [REST API: Files](../../reference/rest-api/files.md)
- [REST API: Graph](../../reference/rest-api/graph.md)
- [Environment variables](./environment-variables.md)
