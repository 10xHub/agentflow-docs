---
title: ID Generator — AgentFlow Python AI Agent Framework
sidebar_label: ID Generator
description: AgentFlow uses ID generators to create unique identifiers for threads, messages, and other persisted records.
keywords:
  - agentflow api reference
  - rest api documentation
  - agent cli reference
  - agentflow
  - python ai agent framework
  - id generator
---

# ID Generator

AgentFlow uses ID generators to create unique identifiers for threads, messages, and other persisted records. The generator determines both the ID format and the ID type used in the system.

## Base ID generator interface

The core interface is `BaseIDGenerator` in `agentflow/agentflow/utils/id_generator.py`. It defines:

- `id_type` — the ID type returned by the generator (`STRING`, `INTEGER`, or `BIGINT`).
- `generate()` — method that returns a new unique ID.

This interface lets AgentFlow support standard UUIDs, timestamp-based integers, and Snowflake-style distributed IDs.

## Built-in generators

AgentFlow includes several built-in ID generators:

- `DefaultIDGenerator`
  - Returns an empty string.
  - This signals the framework to use a default UUID-based generator elsewhere in the stack.
  - Use this when you want a normal UUID fallback.

- `UUIDGenerator`
  - Produces UUID version 4 strings.
  - ID type: `STRING`.
  - Good for global uniqueness without coordination.

- `BigIntIDGenerator`
  - Produces a large integer based on current Unix time in nanoseconds.
  - ID type: `BIGINT`.
  - Sortable by creation time, but not ideal for extremely high-concurrency distributed systems.

## Snowflake ID generator

The API package includes `SnowFlakeIdGenerator` in `agentflow-api/agentflow_cli/src/app/utils/snowflake_id_generator.py`.

This generator uses the optional `snowflakekit` dependency and returns a 64-bit integer suitable for distributed systems.

### Configuration options

If you do not pass explicit constructor values, `SnowFlakeIdGenerator` reads these environment variables:

- `SNOWFLAKE_EPOCH` — default `1723323246031`
- `SNOWFLAKE_TOTAL_BITS` — default `64`
- `SNOWFLAKE_TIME_BITS` — default `39`
- `SNOWFLAKE_NODE_BITS` — default `7`
- `SNOWFLAKE_NODE_ID` — default `0`
- `SNOWFLAKE_WORKER_ID` — default `0`
- `SNOWFLAKE_WORKER_BITS` — default `5`

It reads `os.environ` directly, so these are process environment variables. A `.env` file loaded
through `agentflow.json` is loaded before the graph module is imported, which covers the normal
case where the generator is constructed inside your graph module.

### The constructor is all-or-nothing

There are exactly two supported ways to construct it:

1. **Pass nothing.** All seven parameters are `None`, so the generator builds its config from the
   environment variables above.
2. **Pass all seven.** `snowflake_epoch`, `total_bits`, `snowflake_time_bits`,
   `snowflake_node_bits`, `snowflake_node_id`, `snowflake_worker_id`, and
   `snowflake_worker_bits` must all be supplied.

:::danger Passing only some arguments silently skips your configuration
The constructor tests for "all `None`" and then for "all not `None`". A partial call satisfies
neither branch, so no config object is built and the generator is constructed with `config=None`.
Your values are discarded without an error, and the environment variables are not consulted
either.

```python
# Wrong: only two arguments. Both are ignored.
gen = SnowFlakeIdGenerator(snowflake_node_id=3, snowflake_worker_id=1)

# Right: environment-driven
gen = SnowFlakeIdGenerator()

# Right: fully explicit
gen = SnowFlakeIdGenerator(
    snowflake_epoch=1723323246031,
    total_bits=64,
    snowflake_time_bits=39,
    snowflake_node_bits=7,
    snowflake_node_id=3,
    snowflake_worker_id=1,
    snowflake_worker_bits=5,
)
```

To vary only the node id, use the environment variables and pass nothing.
:::

:::caution The Settings model declares different SNOWFLAKE_* defaults
The server's `Settings` model also declares `SNOWFLAKE_*` fields, and its defaults do **not**
match the ones above: `SNOWFLAKE_EPOCH=1609459200000`, `SNOWFLAKE_NODE_ID=1`,
`SNOWFLAKE_WORKER_ID=2`, `SNOWFLAKE_NODE_BITS=5`, `SNOWFLAKE_WORKER_BITS=8`, and no
`SNOWFLAKE_TOTAL_BITS` at all.

`SnowFlakeIdGenerator` never reads that model. The values in this page are the ones that take
effect. Do not infer the generator's behaviour from `get_settings()`, and set every variable
explicitly in any deployment running more than one node or worker rather than relying on either
set of defaults.
:::

### Example usage

```python
from agentflow_cli import SnowFlakeIdGenerator

id_generator = SnowFlakeIdGenerator()
```

Or configure explicitly:

```python
id_generator = SnowFlakeIdGenerator(
    snowflake_epoch=1723323246031,
    total_bits=64,
    snowflake_time_bits=39,
    snowflake_node_bits=7,
    snowflake_node_id=1,
    snowflake_worker_id=2,
    snowflake_worker_bits=5,
)
```

### Deployment notes

- Assign a unique `SNOWFLAKE_NODE_ID` per host or cluster node.
- Assign a unique `SNOWFLAKE_WORKER_ID` per worker process on the same host.
- Do not reuse node or worker IDs while old IDs are still valid in storage.
- Install the optional dependency with `pip install snowflakekit`.

## When to use Snowflake IDs

Choose `SnowFlakeIdGenerator` when you need:

- globally unique IDs across multiple servers,
- time-sortable identifiers,
- IDs without a central coordination service.

For local development, `UUIDGenerator` is usually sufficient.
