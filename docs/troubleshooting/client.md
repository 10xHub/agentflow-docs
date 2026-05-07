---
title: Client Troubleshooting — AgentFlow Python AI Agent Framework
sidebar_label: Client Troubleshooting
description: Symptoms, causes, and fixes for common AgentFlow TypeScript and HTTP client integration issues. Part of the AgentFlow agentflow troubleshooting guide for.
keywords:
  - agentflow troubleshooting
  - agent debugging
  - ai agent errors
  - agentflow
  - python ai agent framework
  - client troubleshooting
---


# Client troubleshooting

Use this page when your frontend or programmatic client cannot invoke, stream, or authenticate against an AgentFlow API.

## Client troubleshooting map

```mermaid
flowchart TD
    A[Client issue] --> B[Check base URL]
    B --> C[Check auth headers]
    C --> D[Check CORS and browser networking]
    D --> E[Check response shape and endpoint choice]
    E --> F[Retry with curl to isolate client vs server]
```

## Issue: every request fails immediately

**Symptoms**

- connection errors
- DNS or refused-connection errors

**Likely causes**

- wrong `baseUrl`
- server not running
- reverse proxy route mismatch

**Fix**

- verify the exact API URL with `curl /ping`
- verify the client points at the same URL

## Issue: browser client fails but curl works

**Symptoms**

- browser requests fail while curl succeeds

**Likely causes**

- CORS configuration issue
- missing browser auth header attachment
- mixed-content or HTTPS mismatch

**Fix**

- inspect browser devtools network tab
- verify `ORIGINS`
- verify the browser app is sending credentials and calling the correct scheme/host/port

## Issue: thread continuity is broken

**Symptoms**

- every message feels like a new conversation

**Likely causes**

- missing `thread_id`
- client generates a new thread per request
- no checkpointer configured on the server

**Error code**: `STORAGE_NOT_FOUND_000` (if server returns 404)

**Fix**

- reuse one `thread_id` across a conversation
- verify server-side checkpointing is enabled if persistence is required

---

## Issue: stream endpoint behaves differently from invoke

**Symptoms**

- invoke works, stream fails or vice versa

**Likely causes**

- wrong endpoint or client method
- client not handling SSE properly
- proxy buffering or timeout issues

**Fix**

- verify the client uses the correct stream method
- test with `curl --no-buffer`
- check intermediary proxy behavior if deployed

---

## Error Code Quick Reference

| Symptom | Error Code | Action |
|---------|------------|--------|
| Resource not found | `STORAGE_NOT_FOUND_000` | Check thread_id validity |
| Transient failure | `STORAGE_TRANSIENT_000` | Retry request |
| Validation error | `VALIDATION_000` | Check request format |

See [Error Codes Reference](/docs/troubleshooting/error-codes) for full documentation.

---

## Related docs

- [Connect Client](/docs/get-started/connect-client)
- [TypeScript Client Reference](/docs/reference/client/agentflow-client)
- [API Server Troubleshooting](/docs/troubleshooting/api-server)
- [Error Codes Reference](/docs/troubleshooting/error-codes)

## What you learned

- How to isolate client-side failures from server-side failures.
- Why base URL, headers, CORS, and `thread_id` are the first client debugging checkpoints.
