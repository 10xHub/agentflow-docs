---
title: Replay-safe tools
description: How 10xGraph keeps a crashed run from executing finished tools twice, so a resumed run never charges a card or sends an email a second time.
section: Concepts
order: 155
updated: 2026-10-03T00:00:00.000Z
---

A process can die between two tool calls. When the run resumes, 10xGraph replays the interrupted step, but it checks a tool ledger first. Tools that already finished are skipped instead of executed again.

## Why this matters

Agents call tools with side effects: payments, emails, tickets, database writes. If a worker is killed after `charge_card` returns but before the run is saved as complete, a naive resume runs `charge_card` again and charges the customer twice.

## How the ledger works

1. Before a node runs, the run loop persists the current node.
2. Before each tool call, 10xGraph checks the checkpointer's tool ledger.
3. Each completed call is recorded as soon as it returns.
4. On resume, calls already in the ledger are skipped.

Ledger keys combine the assistant message that issued the call with the tool call id. Models often reuse ids like `call_1` on every turn, so keying on the call id alone would make different turns collide.

## Requirements

Replay safety needs a checkpointer, for example `PgCheckpointer` with PostgreSQL and Redis.

## Related protections

- **Versioned state writes.** Durable writes use an optimistic version check, so two runs on the same thread cannot overwrite each other.
- **Timeouts.** `node_timeout` and `tool_timeout` stop a hung tool from holding a worker forever.
