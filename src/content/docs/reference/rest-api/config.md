---
title: Configuration endpoints
description: "Reference for the 10xGraph REST config endpoint GET /v1/config/multimodal: permission, response fields, defaults, errors and a curl example."
section: Reference
group: "REST API"
order: 370
label: Config
updated: "2026-10-08"
---

The config endpoint lets a client read the server's media settings at runtime. `GET /v1/config/multimodal` returns the storage backend, the maximum upload size and the document handling strategy, so a UI can check limits before it uploads a file. It needs the `config:read` permission.

## Get the multimodal configuration

`GET /v1/config/multimodal` returns the three media settings the server loaded from its environment. The request takes no parameters and no body. The values are read-only: you change them with environment variables and a server restart.

| Item | Value |
| --- | --- |
| Method and path | `GET /v1/config/multimodal` |
| Permission | `config:read` |
| Request body | None |

```bash
# Read the media configuration (replace $TOKEN with a valid bearer token)
curl http://127.0.0.1:8000/v1/config/multimodal \
  -H "Authorization: Bearer $TOKEN"
```

Example response. The `metadata` values shown in angle brackets vary per request.

```json
{
  "data": {
    "media_storage_type": "local",
    "media_max_size_mb": 25.0,
    "document_handling": "extract_text"
  },
  "metadata": {
    "request_id": "<request id>",
    "timestamp": "<timestamp>",
    "message": "OK"
  }
}
```

## Response fields

Each field in `data` maps to one environment variable on the server. The defaults apply when the variable is unset.

| Field | Type | Env var | Default | Description |
| --- | --- | --- | --- | --- |
| `media_storage_type` | string | `MEDIA_STORAGE_TYPE` | `local` | Where uploaded files are stored: `memory` (in process, lost on restart), `local` (filesystem, path set by `MEDIA_STORAGE_PATH`) or `cloud` (configured with the `MEDIA_CLOUD_*` variables). |
| `media_max_size_mb` | number | `MEDIA_MAX_SIZE_MB` | `25.0` | Maximum upload size in megabytes. Larger uploads are rejected with `413`. |
| `document_handling` | string | `DOCUMENT_HANDLING` | `extract_text` | How uploaded documents are handled. The server documents the options `extract_text`, `pass_raw` and `skip`. The value is returned as a plain string and is not validated by this endpoint. |

## Error responses

The endpoint returns an error when the caller is not authenticated or lacks the permission.

| Status | Description |
| --- | --- |
| `401` | Missing or invalid authentication token |
| `403` | Caller lacks the `config:read` permission |

## Related

- [File upload endpoints](/docs/reference/rest-api/files): upload files and fetch them by ID
- [Files and multimodal on the server](/docs/server/files-and-multimodal): storage backends, size limits and signed URLs
- [Environment variables](/docs/reference/api-cli/environment): every server setting
