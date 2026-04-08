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
