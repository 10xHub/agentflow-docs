---
title: File Tools
seoTitle: "File tools: file_read, file_write, file_search"
description: Safe, workspace-scoped file tools for agents to read, write, and search text files within a configured root directory.
section: "Build agents"
group: "Tools and MCP"
order: 190
label: File Tools
updated: "2026-10-08"
---

File tools give your agent filesystem access in a secure, controlled way. Three complementary tools handle reading text files, writing output, and searching by filename or content. All three are workspace-scoped: paths are resolved under a configured root directory, and paths that escape the root are rejected. This prevents agents from accessing sensitive files outside the intended workspace.

**Import path:** `tenxgraph.prebuilt.tools`

The workspace root is read from `config["file_tool_root"]`, then `config["workspace_root"]`, and defaults to the current directory (`.`) if neither is set. You can pass it at runtime via `invoke(config={"file_tool_root": "/path/to/root"})` or set it once in your agent's configuration.

## When to use file tools

File tools are essential for agents that need to:

- **Read and understand code or documents**: a coding assistant, documentation tool, or codebase analyzer
- **Generate files**: a code generator, report writer, or config file creator
- **Search a codebase**: finding relevant files before reading or editing them

Because these tools do not execute code or run arbitrary commands, they are safer than shell access. Binary files are detected and rejected, and large files are truncated to prevent context bloat.

## `file_read`: Read text files

Reads a UTF-8 text file from the workspace and returns its content, with optional line-range selection and truncation.

### What it does

- Resolves the file path under the workspace root (rejects absolute paths that escape the root)
- Checks that the path points to a file (not a directory)
- Detects binary files (looks for null bytes in the first 2 KB) and refuses to read them
- Reads the full file, then selects lines 1-based: `start_line` and `end_line` are inclusive
- Truncates content if it exceeds `max_chars` and reports `truncated: true` in the response
- Returns a JSON object with the path, line range, content, and truncation status

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | File path relative to the workspace root (or absolute within the root) |
| `start_line` | `int` | `1` | First line to read (1-based, inclusive) |
| `end_line` | `int` | `0` | Last line to read (1-based, inclusive); `0` means end of file |
| `max_chars` | `int` | `20000` | Maximum characters to return; longer files are truncated |
| `config` | `dict` | `None` | Runtime config dict; pass `file_tool_root` or `workspace_root` here |

### Return format

Returns a JSON string:

- On success:
  ```json
  {
    "path": "src/main.py",
    "start_line": 1,
    "end_line": 30,
    "content": "import asyncio\n...",
    "truncated": false
  }
  ```

- On error (file not found, binary, out of root, etc.):
  ```json
  {
    "error": "file does not exist",
    "path": "docs/missing.md"
  }
  ```

### Usage example

```python
from tenxgraph.prebuilt.tools import file_read
from tenxgraph.core.graph import Agent, ToolNode

# Create an agent with file_read access
agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([file_read]),
    system_prompt=[{
        "role": "system",
        "content": "You are a code reviewer. Read the provided files and give feedback.",
    }],
)
graph = agent.compile()

# Invoke with a workspace root
result = await graph.ainvoke(
    {"messages": [{"role": "user", "content": "Review src/utils.py"}]},
    config={"thread_id": "review-1", "file_tool_root": "/home/user/project"}
)
```

### Reading a range of lines

To avoid reading a huge file, specify a line range:

```python
# Read lines 50-100 of a large file
await agent.ainvoke(
    {"messages": [{"role": "user", "content": "Show me lines 50-100 of main.py"}]},
    config={"thread_id": "t1", "file_tool_root": "."}
)
```

The `max_chars` limit is applied **after** line selection, so reading a specific range can reduce truncation.

### Error cases

- **Binary file**: `{"error": "file appears to be binary", "path": "..."}`
- **Path outside root**: `{"error": "path must stay within the configured root: /root"}`
- **File doesn't exist**: `{"error": "file does not exist", "path": "..."}`
- **Path is a directory**: `{"error": "path is not a file", "path": "..."}`
- **start_line > end_line**: `{"error": "end_line must be greater than or equal to start_line"}`

---

## `file_write`: Write text files

Writes UTF-8 text to a file under the workspace root. Three modes control whether to create, replace, or append.

### What it does

- Resolves the target path under the workspace root (rejects path traversal)
- Enforces three write modes: `"create"` (fails if file exists), `"overwrite"` (replaces), `"append"` (adds to end)
- Checks that content does not exceed 200,000 characters
- Optionally creates missing parent directories if `create_dirs=True`
- Returns a JSON object with the written path, byte count, and mode

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Target file path (relative to workspace root) |
| `content` | `str` | required | UTF-8 text to write |
| `mode` | `str` | `"create"` | Write mode: `"create"`, `"overwrite"`, or `"append"` |
| `create_dirs` | `bool` | `False` | If `True`, create missing parent directories; if `False`, fail if parent doesn't exist |
| `config` | `dict` | `None` | Runtime config; pass `file_tool_root` or `workspace_root` here |

### Return format

Returns a JSON string:

- On success:
  ```json
  {
    "status": "written",
    "path": "output/report.md",
    "bytes": 1024,
    "mode": "create"
  }
  ```

- On error:
  ```json
  {
    "error": "file already exists",
    "path": "output/report.md"
  }
  ```

### Usage example

```python
from tenxgraph.prebuilt.tools import file_read, file_write
from tenxgraph.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([file_read, file_write]),
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a code editor. Read files to understand the codebase, "
            "then write files to make improvements."
        ),
    }],
)
graph = agent.compile()

result = await graph.ainvoke(
    {"messages": [{"role": "user", "content": "Create a new test file for utils.py"}]},
    config={"thread_id": "t1", "file_tool_root": "/home/user/project"}
)
```

### Creating nested directories

By default, `file_write` fails if the parent directory doesn't exist. Use `create_dirs=True` to create the full path:

```python
# Agent can now create nested directories automatically
agent = Agent(
    model="gpt-4o-mini",
    system_prompt=[{
        "role": "system",
        "content": "When writing files, always set create_dirs=True to ensure success.",
    }],
)
```

The agent will call `file_write(path="docs/api/endpoints.md", content="...", create_dirs=True)` and the directory structure `docs/api/` will be created.

### Write modes

- **`"create"`** (default): Fails if the file already exists. Use when you want to write a new file and prevent accidental overwrites.
- **`"overwrite"`**: Replaces the entire file. Use when updating existing output.
- **`"append"`**: Adds content to the end of the file (preserves existing content). Use for logs or incremental generation.

### Error cases

- **Content too large**: `{"error": "content is too large"}` (exceeds 200,000 characters)
- **File already exists** (in `"create"` mode): `{"error": "file already exists", "path": "..."}`
- **Parent directory doesn't exist** (with `create_dirs=False`): `{"error": "parent directory does not exist"}`
- **Path points to a directory**: `{"error": "path exists and is not a file", "path": "..."}`
- **Path outside root**: `{"error": "path must stay within the configured root: /root"}`

---

## `file_search`: Search files

Searches text files under the workspace root by filename and content. Skips binary files, large files, and common non-source directories.

### What it does

- Accepts a search query (case-insensitive) and optional filename glob pattern
- Matches query against file names first, then file contents line by line
- Skips directories: `.git`, `.hg`, `.mypy_cache`, `.pytest_cache`, `.ruff_cache`, `.tox`, `.venv`, `__pycache__`, `build`, `dist`, `htmlcov`, `node_modules`, `venv`
- Skips binary files (checks for null bytes in the first 2 KB)
- Skips files larger than 1 MB
- Truncates line previews to 240 characters
- Returns relative paths, line numbers, match types, and short previews (limited to `max_results`)

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Search term (case-insensitive, matched against filenames and content) |
| `path` | `str` | `""` | Sub-directory to search within (relative to root); empty string searches the root |
| `glob` | `str` | `"**/*"` | Filename glob pattern, e.g. `"*.py"` or `"*.md"`. Only simple patterns are supported. |
| `max_results` | `int` | `20` | Maximum matches to return (capped at 100) |
| `config` | `dict` | `None` | Runtime config; pass `file_tool_root` or `workspace_root` here |

### Return format

Returns a JSON string:

- On success:
  ```json
  {
    "query": "asyncio",
    "root": "src",
    "results": [
      {
        "path": "src/server.py",
        "match_type": "content",
        "line": 3,
        "preview": "import asyncio"
      },
      {
        "path": "src/test_async.py",
        "match_type": "filename",
        "line": null,
        "preview": "test_async.py"
      }
    ]
  }
  ```

- On error (invalid path, etc.):
  ```json
  {
    "error": "search path does not exist"
  }
  ```

The `match_type` is either `"filename"` (query found in the file name) or `"content"` (query found in a line of the file). The `line` field is the 1-based line number for content matches, or `null` for filename matches.

### Usage example

```python
from tenxgraph.prebuilt.tools import file_read, file_search
from tenxgraph.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([file_read, file_search]),
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a codebase assistant. Use file_search to locate relevant files, "
            "then file_read to inspect them in detail."
        ),
    }],
)
graph = agent.compile()

result = await graph.ainvoke(
    {"messages": [{"role": "user", "content": "Find all files that import asyncio"}]},
    config={"thread_id": "t1", "file_tool_root": "/home/user/project"}
)
```

### Searching with patterns

Search only Python files:

```python
# The agent calls: file_search(query="import", glob="*.py", max_results=50)
# Returns content matches from .py files only
```

Search in a specific directory:

```python
# Search only under src/: file_search(query="TodoList", path="src", max_results=20)
# The search respects the glob pattern within that directory
```

### Search behavior and limits

- **Filename matches are returned first**, then content matches, up to `max_results`.
- **Binary files are skipped**: the tool detects null bytes in the first 2 KB to filter binaries (e.g., `.pyc`, `.so`, `.jpg`).
- **Large files are skipped**: files over 1 MB are not searched to prevent timeouts.
- **Preview truncation**: line previews are limited to 240 characters; longer lines are cut with `...`.
- **Case-insensitive**: the query and file content are both lowercased before matching.
- **Result limit**: `max_results` is capped at 100 to avoid overwhelming output.

### Error cases

- **Query is empty**: `{"error": "query is required"}`
- **Search path doesn't exist**: `{"error": "search path does not exist"}`
- **Path outside root**: `{"error": "path must stay within the configured root: /root"}`

---

## Complete example: a codebase assistant

Here's an agent that combines all three file tools to search a codebase, read relevant files, and generate a report:

```python
from tenxgraph.prebuilt.tools import file_read, file_write, file_search
from tenxgraph.prebuilt.agent import ReactAgent

# Create the agent with all file tools
agent = ReactAgent(
    model="gpt-4o-mini",
    tools=[file_read, file_write, file_search],
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a codebase analyst. Your task is to analyze a Python project "
            "and generate a report.\n\n"
            "Steps:\n"
            "1. Use file_search to find all Python files and understand the structure.\n"
            "2. Read key files with file_read to understand the architecture.\n"
            "3. Generate a report and save it with file_write.\n\n"
            "Always use create_dirs=True when writing reports to ensure directories exist."
        ),
    }],
)
graph = agent.compile()

# Run the agent
result = await graph.ainvoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "Analyze the project and write a README.md with an overview of the structure."
            }
        ]
    },
    config={
        "thread_id": "analysis-1",
        "file_tool_root": "/home/user/my-project"
    }
)

print(result["messages"][-1]["content"])
```

The agent will:
1. Call `file_search(query="import", glob="*.py")` to find Python files
2. Call `file_read(path="src/main.py")` to examine key files
3. Call `file_write(path="README.md", content="...", mode="overwrite", create_dirs=True)` to save the report

---

## Workspace security and limits

### Path security

All three tools enforce **root path security**:
- Paths are resolved under the configured root directory.
- Absolute paths are allowed only if they fall within the root after resolution.
- Path traversal attempts (e.g., `"../../etc/passwd"`) are rejected with an error.

For example, if the root is `/home/user/project/`, the paths `"src/main.py"`, `"./docs/guide.md"`, and `/home/user/project/tests/test.py` are all valid. But `"../../../etc/passwd"` is rejected because it escapes the root.

### Limits and thresholds

| Limit | Value | Tool(s) | Notes |
|---|---|---|---|
| Max read size | 20,000 chars | `file_read` | Longer files are truncated; use `start_line`/`end_line` to read specific ranges |
| Max write size | 200,000 chars | `file_write` | Enforces a cap to prevent unbounded file generation |
| Max search file size | 1 MB | `file_search` | Larger files are skipped during search |
| Max search results | 100 | `file_search` | `max_results` is capped at 100 to keep output manageable |
| Binary detection window | 2 KB | `file_read`, `file_search` | Files with null bytes in the first 2 KB are considered binary |
| Preview length | 240 chars | `file_search` | Line previews are truncated to keep results compact |

---

## Related pages

- `/docs/guides/use-tool-decorator` — Define custom tools alongside the prebuilt ones
- `/docs/guides/prebuilt-tools` — Overview of all prebuilt tools (calculator, fetch, memory, handoff, web)
- `/docs/concepts/agents-and-tools` — How ToolNode dispatches tools and handles errors
