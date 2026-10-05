---
title: GitHub MCP
seoTitle: "GitHub MCP tutorial: query repositories"
description: Use a remote GitHub MCP server from 10xGraph so an agent can list commits and download repository files such as README.md through MCP tools.
section: Tutorials
group: From examples
order: 1280
label: GitHub MCP
updated: "2026-07-21"
---

**Source examples:** [`agentflow/examples/github-mcp/git_mcp.py`](https://github.com/10xHub/Agentflow/blob/main/examples/github-mcp/git_mcp.py) and [`mcp_file_download.py`](https://github.com/10xHub/Agentflow/blob/main/examples/github-mcp/mcp_file_download.py)

## What you will build

A ReAct agent that connects to the GitHub Copilot MCP endpoint and asks it to retrieve repository commit data through MCP tools.

## Prerequisites

- Python 3.12 or later
- `10xgraph` installed
- `fastmcp` installed
- a Google model key such as `GEMINI_API_KEY`
- `GITHUB_TOKEN` with access to the GitHub MCP endpoint

Install:

```bash
pip install fastmcp
```

Set environment variables:

```bash
export GITHUB_TOKEN=your_token_here
export GEMINI_API_KEY=your_google_key_here
```

## External service requirement

This tutorial depends on a remote hosted MCP service:

```text
https://api.githubcopilot.com/mcp/
```

If your token is missing or invalid, the MCP tool discovery or invocation will fail.

## Architecture

```mermaid
flowchart LR
    A[User prompt] --> B[10xGraph Agent]
    B --> C[ToolNode with GitHub MCP client]
    C --> D[GitHub Copilot MCP endpoint]
    D --> E[GitHub repository tools]
    E --> B
```

## Step 1: Configure the remote MCP server

The example registers a `github` server:

```python
config = {
    "mcpServers": {
        "github": {
            "url": "https://api.githubcopilot.com/mcp/",
            "headers": {"Authorization": f"Bearer {os.getenv('GITHUB_TOKEN')}"},
            "transport": "streamable-http",
        },
    }
}
```

This is the same pattern as the local MCP examples, but with:

- a hosted remote endpoint
- auth headers

## Step 2: Build an MCP-backed ToolNode

```python
client_http = Client(config)
tool_node = ToolNode(tools=[], client=client_http)
```

The agent then uses that `tool_node` like any other tool source.

## Step 3: Create the ReAct graph

The graph is a standard `MAIN -> TOOL -> MAIN` loop:

```python
main_agent = Agent(
    model="gemini-2.0-flash",
    provider="google",
    system_prompt=[...],
    tool_node=tool_node,
    trim_context=True,
)
```

The routing function checks whether the assistant emitted tool calls and either routes to `TOOL` or ends the run.

## GitHub MCP execution flow

```mermaid
sequenceDiagram
    participant User
    participant MAIN as Agent
    participant TOOL as ToolNode
    participant MCP as GitHub MCP
    participant GitHub as GitHub repo data

    User->>MAIN: ask for repository commits
    MAIN-->>TOOL: tool call selected by model
    TOOL->>MCP: call remote GitHub tool
    MCP->>GitHub: fetch repository data
    GitHub-->>MCP: commits
    MCP-->>TOOL: structured result
    TOOL-->>MAIN: tool message
    MAIN-->>User: summary of commits
```

## Step 4: Ask for repository data

The example asks the agent to list commits:

```python
inp = {
    "messages": [
        Message.text_message(
            "Please call the list_commits function for the github repo "
            "'https://github.com/suchith83/portfolio' of the 'suchith83' username, "
            "and give me the all commits in that repo."
        )
    ]
}
config = {"thread_id": "12345", "recursion_limit": 10}

res = app.invoke(inp, config=config)
```

## Step 5: Print message history

The example includes a pretty-printer to inspect:

- role
- content
- tool calls
- metadata

That is useful when integrating remote MCP tools, because it helps you see:

- which tool was chosen
- how the tool call arguments were structured
- what data came back from the server

## Verification

Successful behavior should include:

- the graph completes without auth errors
- the message history contains at least one tool call
- the final assistant message summarizes repository commit information

## Common mistakes

- Missing `GITHUB_TOKEN`.
- Using a token that lacks the required access.
- Assuming all GitHub MCP tools are always available.
- Treating remote MCP latency like local function-call latency.

## Variant: download a repository file

`mcp_file_download.py` uses the same config, `ToolNode(tools=[], client=client_http)` and graph. Only the prompt changes: the agent picks a remote file-access tool instead of `list_commits`.

```python
inp = {
    "messages": [
        Message.text_message(
            "Get Readme.md file form the github repo "
            "'https://github.com/suchith83/portfolio' of the 'suchith83' username,."
        )
    ]
}
config = {"thread_id": "12345", "recursion_limit": 10}

res = app.invoke(inp, config=config)
```

This variant also turns on debug logging, which helps with tool discovery and remote invocation failures:

```python
logging.basicConfig(level=logging.INFO)
logging.getLogger("agentflow").setLevel(logging.DEBUG)
```

Check that the message history contains a tool call, a tool result tied to the file, and a final assistant message that references the README content. Remote tools may return structured data rather than plain text, and the file path must match what the remote tool expects. Treat this as a remote call, not a local filesystem read.

## Key concepts

| Concept | Details |
|---|---|
| hosted MCP endpoint | Remote shared tool service |
| auth header | Required to access protected MCP tools |
| MCP-backed ReAct graph | Standard 10xGraph loop with remote tool execution |

## What you learned

- How to connect 10xGraph to a hosted MCP server.
- How to authorize GitHub MCP requests.
- How to inspect a graph run that depends on remote repository tooling.

## Next step

→ [Memory](/docs/tutorials/from-examples/memory) to add long-term user memory to a graph.
