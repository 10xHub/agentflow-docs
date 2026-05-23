# File Tools

Prebuilt tools for reading, writing, and searching files within a configured workspace root.

**Import path:** `agentflow.prebuilt.tools`

All three tools are workspace-scoped: every path is resolved relative to a configured root directory and paths that escape the root are rejected. The root is read from `config["file_tool_root"]` or `config["workspace_root"]`; if neither is set, the current directory (`.`) is used.

---

## `file_read`

Reads a UTF-8 text file and returns its content.

### What it does

- Resolves the path under the workspace root (rejects path traversal)
- Detects binary files and refuses to read them
- Supports optional line-range selection (`start_line` / `end_line`, 1-based)
- Truncates content to `max_chars` and reports `truncated: true` if cut

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Relative (or absolute within root) file path |
| `start_line` | `int` | `1` | First line to include (1-based) |
| `end_line` | `int` | `0` | Last line to include; `0` means end of file |
| `max_chars` | `int` | `20000` | Maximum characters returned |
| `config` | `dict` | `None` | Runtime config; supports `file_tool_root` / `workspace_root` |

### Example response

```json
{
  "path": "src/main.py",
  "start_line": 1,
  "end_line": 30,
  "content": "import asyncio\n...",
  "truncated": false
}
```

### Usage

```python
from agentflow.prebuilt.tools import file_read
from agentflow.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([file_read]),
)
```

To set the workspace root at runtime, pass it through the agent config:

```python
result = await app.ainvoke(
    {"message": "Show me the first 20 lines of README.md"},
    config={"thread_id": "t1", "file_tool_root": "/home/user/project"},
)
```

---

## `file_write`

Writes UTF-8 text to a file under the workspace root.

### What it does

- Three modes: `create` (fails if the file exists), `overwrite` (replaces), `append`
- Optionally creates parent directories with `create_dirs=True`
- Content is capped at 200 000 characters
- Returns the written path, byte count, and mode used

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Target file path (relative to workspace root) |
| `content` | `str` | required | UTF-8 text to write |
| `mode` | `str` | `"create"` | `"create"`, `"overwrite"`, or `"append"` |
| `create_dirs` | `bool` | `False` | Create missing parent directories |
| `config` | `dict` | `None` | Runtime config; supports `file_tool_root` / `workspace_root` |

### Example response

```json
{
  "status": "written",
  "path": "output/report.md",
  "bytes": 1024,
  "mode": "create"
}
```

### Usage

```python
from agentflow.prebuilt.tools import file_read, file_write
from agentflow.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([file_read, file_write]),
    system_prompt=[{
        "role": "system",
        "content": "You are a coding assistant. Read files to understand context, "
                   "write files to save your output.",
    }],
)
```

---

## `file_search`

Searches text files under the workspace root by filename and content.

### What it does

- Matches file names and file content against a case-insensitive query
- Supports a glob pattern to restrict the file set (default `**/*`)
- Skips common non-source directories: `.git`, `node_modules`, `__pycache__`, `dist`, etc.
- Skips binary files and files larger than 1 MB
- Returns relative paths, line numbers, match types (`filename` or `content`), and short previews

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Search term (case-insensitive) |
| `path` | `str` | `""` | Sub-directory to search within (relative to root) |
| `glob` | `str` | `"**/*"` | Filename glob pattern, e.g. `"*.py"` |
| `max_results` | `int` | `20` | Maximum matches to return (capped at 100) |
| `config` | `dict` | `None` | Runtime config; supports `file_tool_root` / `workspace_root` |

### Example response

```json
{
  "query": "asyncio",
  "root": ".",
  "results": [
    {"path": "src/server.py", "match_type": "content", "line": 3, "preview": "import asyncio"},
    {"path": "tests/test_async.py", "match_type": "filename", "line": null, "preview": "test_async.py"}
  ]
}
```

### Usage

```python
from agentflow.prebuilt.tools import file_read, file_search
from agentflow.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([file_read, file_search]),
    system_prompt=[{
        "role": "system",
        "content": "You are a codebase assistant. Use file_search to locate relevant files, "
                   "then file_read to inspect them.",
    }],
)
```

---

## Using all three file tools together

```python
from agentflow.prebuilt.tools import file_read, file_write, file_search
from agentflow.prebuilt.agent import ReactAgent

agent = ReactAgent(
    model="gpt-4o-mini",
    tools=[file_read, file_write, file_search],
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a code-editing assistant. "
            "Search for files with file_search, read them with file_read, "
            "and write changes with file_write."
        ),
    }],
)
app = agent.compile()

result = await app.ainvoke(
    {"message": "Find all Python files that import asyncio and list them."},
    config={"thread_id": "t1", "file_tool_root": "/home/user/project"},
)
```
