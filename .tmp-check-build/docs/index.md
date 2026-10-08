# Introduction

> 10xGraph is an open-source Python framework for production multi-agent AI: a core library, an API server and CLI, and a TypeScript client.

Source: https://10xgraph.com/docs
Last updated: 2026-10-08

10xGraph is an open-source Python framework for production multi-agent AI. You build agents and graphs in Python; 10xGraph generates a production server that handles authentication, scoped access control, durable state, replay-safe tools, and deployment to Docker or Kubernetes. It has three packages: a core library, an API server and CLI, and a TypeScript client.

## The three packages

10xGraph ships as three packages that work together or standalone.

**Core library** (`10xgraph`, import `tenxgraph`) is the foundation. You use `StateGraph` to define a graph of agents and nodes, `ReactAgent` for the standard tool-calling loop, and custom nodes for control flow, human approval, or data transformation. Tools are ordinary Python functions. Models come from OpenAI, Google Gemini, or Anthropic. The library handles state management, checkpointing to memory, SQLite or Postgres, tool replay on failure, streaming, MCP servers, and dependency injection. Its required dependencies are small (InjectQ, Pydantic, Pillow, PyYAML and python-dotenv), and you add the provider SDK you choose as an extra, such as `10xgraph[openai]`. You can run your agent entirely within Python with no server.

**API server and CLI** (`10xgraph-api`, import `tenxgraph_api`, command `10xgraph`) wraps your graph in a FastAPI server. You point `10xgraph.json` at your compiled graph, and the server auto-generates REST and WebSocket endpoints, Swagger UI, authentication, rate limits, thread and memory management, file uploads, and observability hooks. The `10xgraph` CLI scaffolds a new project, runs the server in development or production, serves the built-in playground, tests your agent, evaluates against test sets, and generates Docker and Kubernetes files. Running `10xgraph api` starts the server on port 8000.

**TypeScript client** (`@10xgraph/client`) is a typed SDK for Node.js and browsers. It handles authentication, invokes the graph over REST or WebSocket, streams responses, manages threads and memory, uploads files, and abstracts the transport. It works with Next.js, React, plain TypeScript and Node backends. You can also call the server with plain HTTP or curl.

All three are optional. You can use the library standalone (no server), the server without the client (curl is fine), or the client with any compatible API.

## Get started

The fastest path depends on what you want to build.

> **New to multi-agent AI?**
> Start with [Get Started](/docs/get-started) for installation, a quickstart agent, and what the production template generates. Then move to [Concepts](/docs/concepts) to understand state, checkpointing, and the runtime model.

> **Coming from LangGraph?**
> 10xGraph is inspired by LangGraph but simpler. Read [10xGraph vs LangGraph](/docs/compare/10xgraph-vs-langgraph) for a side-by-side comparison. Then follow the [quickstart](/docs/get-started/first-agent) and read [Concepts](/docs/concepts) to see how `StateGraph` and streaming map across.

> **Ready to deploy to production?**
> Begin with [Server](/docs/server) to understand the API server and CLI. Then tackle [authentication](/docs/server/auth), [durable checkpointing](/docs/guides/set-up-checkpointing), and [deployment](/docs/server/deploy). Read [Replay-safe tools](/docs/concepts/replay-safe-tools) before giving your agent tools that move money or send email.

## What the docs cover

Navigate by the question you want to answer.

**[Get Started](/docs/get-started).** Installation, your first agent, the production template, and how to migrate from Agentflow. Read this first.

**[Concepts](/docs/concepts).** The mental model: graphs, state, messages, agents, tools, threads, checkpointers, memory, context, interrupts, streaming, serving and events. Understand how 10xGraph works.

**[Build Agents](/docs/guides).** How-to guides for building: custom graphs, prebuilt agents, tools, MCP, state, dependency injection, memory, context, multi-agent orchestration, streaming, media, authentication, interrupts, testing and observability. Each guide is a complete recipe with code.

**[API Server](/docs/server).** Run and configure the server: the CLI, configuration file, authentication, authorization, rate limiting, REST and WebSocket endpoints, files and multimodal, observability, deployment to Docker and Kubernetes, and production checklist. Use this when you need to serve your agent over HTTP.

**[TypeScript Client](/docs/client).** Call the server from a Node.js backend or browser frontend: create a client, invoke the graph, stream responses, manage threads, upload files, retrieve memory. Works with Next.js, React and plain TypeScript.

**[Testing and Evaluation](/docs/testing).** Unit test with mocked models, run eval sets against your agent, define criteria, simulate users, and generate reports. Verify your agent works before it ships.

**[Integrations](/docs/integrations).** Connect to models (OpenAI, Google, Anthropic), frameworks (FastAPI, Next.js, CopilotKit), storage (Postgres, Redis), and coding assistants. Each integration shows how and when to use it.

**[Examples](/docs/examples).** Runnable code you can clone and modify: simple agents, custom state, tools, streaming, MCP, multi-agent, memory, media, production patterns. Build on these rather than from scratch.

**[Reference](/docs/reference).** Exact signatures, parameters and return types for the Python library, REST API, CLI, configuration and TypeScript client. Use this when you need to check an option or understand an error.

**[Troubleshooting](/docs/troubleshooting).** Symptoms, causes and fixes. Common errors with solutions. Error code reference. Start here if something is not working.

**[Glossary](/docs/glossary).** Plain definitions of AI agent concepts: what is a ReAct agent, state graph, durable execution, idempotent tools, interrupts.

**[Compare](/docs/compare).** 10xGraph vs LangGraph, CrewAI, AutoGen, LlamaIndex and Google ADK. Honest side-by-sides, including where other frameworks are stronger.

**[Project](/docs/project).** Roadmap, security policy, upgrade guides, support and how to contribute.

> **Formerly Agentflow**
> 10xGraph was published as Agentflow until 2026. The Python packages are now imported as `tenxgraph` (core library) and `tenxgraph_api` (server), as in `from tenxgraph import StateGraph`. The old `agentflow` and `agentflow_cli` imports stay available as deprecated aliases until 2.0. See [Coming from Agentflow](/docs/get-started/coming-from-agentflow) for the full migration path.

## Frequently asked questions

### Is 10xGraph production-ready?

10xGraph is pre-1.0, so pin versions and read the changelog before each upgrade. The production layer (API server, JWT or custom auth, rate limits, replay-safe tools, Docker and Kubernetes files) ships as the `10xgraph-api` package alongside the core library.

### Do I need LangChain to use 10xGraph?

No. 10xGraph has no LangChain dependency. You build graphs with its own StateGraph and Agent classes and call model providers through its own interface.

### Which models does 10xGraph support?

OpenAI, Google Gemini (including Vertex AI) and Anthropic (direct API, Vertex AI and Amazon Bedrock), plus any OpenAI-compatible endpoint such as Ollama or vLLM. Swapping the model string does not change your graph or tools.

### Can I self-host 10xGraph?

Yes. 10xGraph is MIT licensed and self-hosted, with no hosted platform required. The `10xgraph build` command writes a Dockerfile and, with flags, a docker-compose.yml and a Kubernetes manifest so you can run it on your own infrastructure.
