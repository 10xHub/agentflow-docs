## ID Generation in Agentflow

ID generators produce stable, traceable identifiers for runs, messages, tool calls, and background tasks.  Agentflow ships multiple strategies and lets you inject or override them to match infrastructure needs (UUIDs, integers, sortable timestamps, short IDs, async factories, etc.).

### Why It Matters

- Correlate logs, events, and persisted state across services
- Generate sortable or compact IDs for databases and analytics
- Produce deterministic or mock values during tests
- Support multi-tenant naming or custom sharding schemes

### Built-in Generators

| Class | ID Type | Output Shape | Typical Use |
|-------|---------|--------------|-------------|
| `UUIDGenerator` | `string` | 36-char UUID4 | General purpose globally unique IDs |
| `ShortIDGenerator` | `string` | 8-char base62 | Human-friendly references, URLs |
| `HexIDGenerator` | `string` | 32 hex chars | Compact cryptographic-looking IDs |
| `IntIDGenerator` | `integer` | 32-bit random int | Lightweight numeric handles (careful with collisions at scale) |
| `BigIntIDGenerator` | `bigint` | ~19–20 digit time-based | Time-sortable inserts and range queries |
| `TimestampIDGenerator` | `integer` | ~16–17 digit microsecond | Ordered events, temporal indexing |
| `AsyncIDGenerator` | `string` | UUID4 (async) | Async pipelines needing awaitable generation |
| `DefaultIDGenerator` | `string` (empty) | "" sentinel | Lets framework fall back to default UUID strategy |
| `SnowflakeIDGenerator` | `bigint` | 64-bit snowflake | Distributed unique IDs with shard/time encoding (use agentflow cli package) |

All implement `BaseIDGenerator`:

```python
class BaseIDGenerator(ABC):
	@property
	@abstractmethod
	def id_type(self) -> IDType: ...

	@abstractmethod
	def generate(self) -> str | int | Awaitable[str | int]: ...
```

`IDType` enum: `STRING`, `INTEGER`, `BIGINT`.

### How the Framework Uses Generators

During `StateGraph.compile()`, an ID generator is available in the DI container (`BaseIDGenerator`) and a concrete generated value also registers as `generated_id` plus metadata `generated_id_type`. These are consumed by publishers, checkpointers, and execution handlers to stamp events and state snapshots.

If the active generator returns an empty string (the `DefaultIDGenerator` case), the runtime substitutes a UUID4 automatically—so you always get a usable identifier.

### Injecting the Generator

```python
from injectq import Inject
from agentflow.utils.id_generator import BigIntIDGenerator, BaseIDGenerator


async def node(state, config, id_gen: BaseIDGenerator = Inject[BaseIDGenerator]):
    run_local_id = id_gen.generate()
    print("Run ID: ", run_local_id)
    return state
```

To supply a custom generator:

```python
from injectq import InjectQ
from agentflow.graph import StateGraph
from agentflow.utils.id_generator import BaseIDGenerator, IDType


class PrefixedUUIDGenerator(BaseIDGenerator):
    @property
    def id_type(self):
        return IDType.STRING

    def generate(self) -> str:
        import uuid
        return f"agent-{uuid.uuid4()}"


container = InjectQ.get_instance()
container.bind(BaseIDGenerator, PrefixedUUIDGenerator())

graph = StateGraph(container=container)
```

### Async Generation

If `generate()` returns an awaitable (e.g. `AsyncIDGenerator`), the runtime awaits it transparently when producing `generated_id`—your nodes/tools still see a resolved value.

### Selecting an ID Shape

| Requirement | Recommended Generator | Rationale |
|-------------|-----------------------|-----------|
| Strict global uniqueness | `UUIDGenerator` | Standard, collision-resistant |
| Ordered inserts (time-series) | `BigIntIDGenerator` or `TimestampIDGenerator` | Monotonic-ish ordering simplifies pruning/range scans |
| Readable short handles | `ShortIDGenerator` | Compact for logs and URLs |
| Deterministic prefixing | Custom (e.g. `PrefixedUUIDGenerator`) | Adds tenant/app metadata |
| Cryptic fixed-length tokens | `HexIDGenerator` | Clean hex aesthetic |

### Testing Strategies

Provide a fake deterministic generator to stabilise assertions:

```python
class FixedIDGenerator(BaseIDGenerator):
	@property
	def id_type(self):
		return IDType.STRING
	def generate(self):
		return "fixed-id"

container.bind(BaseIDGenerator, FixedIDGenerator())
```

### Pitfalls

- Avoid `IntIDGenerator` for very high concurrency without uniqueness safeguards.
- Don’t put non-serialisable objects in generated IDs (stick to primitives/strings).
- If you shard by prefix, document the format so downstream analytics can parse it.

### Extending

Implement `BaseIDGenerator`, bind it in the container, and (optionally) expose environment-based toggles (e.g. switch to short IDs in tests, full UUID in production).

---

See also: `Thread Name Generation` (thread-level naming) and `Response Conversion` (message identity mapping).
