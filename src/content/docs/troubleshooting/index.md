---
title: Troubleshooting
seoTitle: "Troubleshooting 10xGraph: find your problem"
description: "Find the right 10xGraph troubleshooting page by symptom: install failures, provider keys, server startup, client connections, playground and error codes."
section: Troubleshooting
order: 10
label: Overview
updated: "2026-10-06"
---

Most 10xGraph problems fall into five groups: the install, the environment, the API server, the client, and errors raised while a graph runs. Each group has one page with symptoms, likely causes and fixes. Start from what you see on screen, pick the matching row below, and work through that page top to bottom before changing anything else.

## Find your problem

| What you see | Go to |
|---|---|
| `pip install` fails, the CLI command is not found, or imports fail after install | [Installation troubleshooting](/docs/troubleshooting/installation) |
| A feature works until you use Postgres, Redis or another optional integration, then a package is missing | [Installation troubleshooting](/docs/troubleshooting/installation), section on optional features |
| Provider API keys look unset, or `.env` seems ignored | [Installation troubleshooting](/docs/troubleshooting/installation), section on environment variables. Check the `env` field in `10xgraph.json` and where you start the server |
| The server does not start, refuses to boot over unprotected routes, rejects a CORS setting, or the port is in use | [API server troubleshooting](/docs/troubleshooting/api-server) |
| A request returns `403 Missing required scope`, a WebSocket closes at once, or `/ping` works but graph routes fail | [API server troubleshooting](/docs/troubleshooting/api-server) |
| Every client request fails, the browser fails but curl works, threads lose continuity, or streaming differs from invoke | [Client troubleshooting](/docs/troubleshooting/client) |
| The browser opens but the playground cannot connect, the Live page will not start, or the microphone does not work | [Playground troubleshooting](/docs/troubleshooting/playground) |
| A run stops on a step limit, a node times out, a thread is not found, or a checkpoint fails to save | [Error codes reference](/docs/reference/error-codes), which has a symptom lookup table |

If a message contains a code such as `RECURSION_000` or `NODE_TIMEOUT_000`, go straight to the error codes page. It lists every code, the exception behind it and the structured error response the server returns.

## Before you report an issue

Reproduce the problem with the smallest agent and `10xgraph.json` you can. Note your Python version (3.12 or newer is required), the installed versions of `10xgraph` and `10xgraph-api`, and the full error text or error code. Remove secrets from anything you paste.

## How to report an issue

Search the [GitHub issues](https://github.com/10xGraph/10xGraph/issues) first, since your problem may already have a fix or workaround. If not, open a new issue with the minimal reproduction, the versions above, what you expected and what happened. For security problems, follow the [security policy](/docs/project/security) instead of filing a public issue. Other ways to get help are on the [support page](/docs/project/support).
