Critical errors (broken code / wrong APIs)
Get-started
get-started/index.md:33-35 — agentflow docker does not exist. The actual command is agentflow build (you describe it correctly later in serving-agents.md).
get-started/index.md:52 — Lists RouterAgent, SupervisorTeam, Swarm, PlanActReflect. Real names: SupervisorTeamAgent, SwarmAgent, PlanActReflectAgent. RouterAgent does not exist at all.
get-started/index.md:63 — Agent(model=..., tools=[...]) is wrong. Agent takes tool_node=..., not tools=.... Only ReactAgent takes tools=....
get-started/index.md:196 — Numbering jumps 1→2→4→5 and links to open-playground.md which doesn't exist on disk.
get-started/installation.md:143 — Links to first-python-agent.md; the file is first-agent.md.
get-started/first-agent.md:100 — from agentflow.core import Agent, StateGraph, ToolNode works, but from agentflow.utils.constants import END should be from agentflow.utils import END for consistency with the rest of the docs.
get-started/first-agent.md:72-76 — Uses {"messages": [...]} as input — that's correct, but result["messages"][-1].text() works (text is a method, OK).
get-started/first-agent.md:133 — last.tools_calls is the real attribute name (with the extra s). OK, but ugly — worth a one-line note since users will assume tool_calls.
get-started/connect-client.md:43-49, 51 — bearerAuth, basicAuth, headerAuth exist (good), and auth: bearerAuth(...) is valid. ✓
get-started/connect-client.md:58-66 — client.invoke([messages], { config: { thread_id }, recursion_limit }) — verify signature; the actual client takes (messages, options?). Likely OK but worth double-checking against the actual client tests.
get-started/connect-client.md:80 — Uses StreamEventType.MESSAGE. The TS enum has MESSAGE ✓ but in concept2/connecting-clients.md you switch to a different shape (onTextDelta, text_delta event). The two pages disagree.
concept2
concept2/index.md:213 — compiled.invoke({"context": [...]}, config) is wrong. The runtime expects {"messages": [...]}. This is the single most damaging error in the whole rewrite — it's the canonical example.
concept2/index.md:198 — StateGraph(state=MyState()) works (instance is accepted), but the prevailing style in the codebase passes the class. Worth picking one form and using it everywhere.
concept2/index.md:195 — last.has_tool_calls() does not exist on Message. There is no such method.
concept2/index.md:238-241 — ReactAgent(agent=Agent(...), tools=[...]) is wrong. ReactAgent takes model=... and tools=... directly — no nested Agent. The example in agents-tools-control.md:91-96 is correct; this one contradicts it.
concept2/memory.md:268 — chunk.event == StreamEvent.MESSAGE — the enum is StreamEvent ✓ but you call it StreamEventType in connect-client.md:72. Pick one.
concept2/memory.md:184 — from agentflow.storage.store.memory_config import MemoryConfig, RetrievalMode — RetrievalMode does not exist. The enum is ReadMode (values: NO_RETRIEVAL, PRELOAD, POSTLOAD). The MemoryConfig kwarg name needs to be checked against source too.
concept2/agents-tools-control.md:267 — graph.compile(lifecycle_hook=MyHook()) is wrong. compile() accepts callback_manager=...; the lifecycle hook is registered through CallbackManager.register_lifecycle_hook(...) (which you correctly describe at line 211).
concept2/agents-tools-control.md:106-114 — The prebuilt tools table lists google_web_search, vertex_ai_search, fetch_url, file_read, etc. The CLAUDE.md lists them as calculator, fetch, files, handoff, memory, search. The actual names need to be verified by reading agentflow/prebuilt/tools/__init__.py — at minimum these two lists disagree.
concept2/qa.md:237-241 — Criterion names. Source uses snake_case names like tool_name_match, trajectory, rouge_match, response_match, llm_judge, factual_accuracy, hallucination, safety — but the CLAUDE.md lists PascalCase FactualAccuracy, Hallucination, etc. Reconcile.
concept2/serving-agents.md:80 — Says Checkpointer prefix is /v1/checkpointer. The TS client (and CLAUDE.md) use /v1/threads. One of them is wrong.
concept2/serving-agents.md:91, 102-110 — JwtAuth (correct in this file). But CLAUDE.md says JWTAuth. Just a CLAUDE.md issue, this file is right.
concept2/serving-agents.md:425 — setup_tracing(graph, level=ObservabilityLevel.STANDARD). setup_tracing exists, but ObservabilityLevel was not found in the source. Verify (might be named differently, e.g. TracingLevel).
concept2/extensibility.md:223-232 — BaseContextManager.trim_context(state) — but concept2/memory.md:75-80 says it's trim_context(messages, max_tokens). The two pages contradict each other on signature. Need to look at the actual ABC.
concept2/connecting-clients.md:60-65 — client.invoke({ messages, thread_id }) (object form). But get-started/connect-client.md:58-66 uses client.invoke([messages], { config: {…} }) (positional). Pick one form — the actual TS API is positional (messages, options).
concept2/connecting-clients.md:206 — client.setApiKey(newToken) — this method does not exist on the client. Remove or replace with the real refresh mechanism.
concept2/connecting-clients.md:229 — useChat, useAgent from @10xscale/agentflow-client/a2ui. The actual exports are useA2UIClient, useAgentStatus, etc. — useChat/useAgent live in the separate @10xscale/agentflow-ui package (your CLAUDE.md confirms this).
concept2/extensibility.md:96-103 — Lists aclear_state and aclean_thread as required. CLAUDE.md lists arelease. Verify against the actual ABC; the wording "Required" vs "Optional" split should match the source.
Structural / consistency issues
Two contradictory client APIs. get-started/connect-client.md uses positional (messages, options) and async-iterator streaming; concept2/connecting-clients.md uses object-form ({messages, thread_id}) and callback-based streaming. Pick one (the positional + async-iterator form matches the actual TS client) and use it in both.
StreamEvent vs StreamEventType. Used interchangeably across the two folders. Source has StreamEvent (Python) and StreamEventType (TS client). Make that distinction explicit so readers don't think they're synonyms.
Prebuilt-agent names. index.md (get-started) drops the Agent suffix; agents-tools-control.md keeps it. The classes ship with the suffix — use the real names everywhere.
Missing open-playground.md referenced by index.md but not present on disk. Either write it or remove the link.
/v1/threads/ vs /v1/checkpointer/ — used inconsistently. The TS client calls /v1/threads/* so that's the real path; serving-agents.md should be updated.
tools_calls typo. This is a real attribute name in source code, but it looks like a bug. Worth flagging in docs as "yes, it really is tools_calls" — otherwise every reader will assume the docs are wrong.
Minor
Both folders have good structure, clean mermaid diagrams, and consistent voice — that part is solid.
Memory page is the strongest; QA page is also quite clean once the criterion names are reconciled.
Extensibility table at extensibility.md:48-65 is a nice reference, just verify each ABC path actually resolves.
Bottom line
The shape and writing quality is good. The code examples are not yet trustworthy — there are roughly a dozen places where a user copying the example will hit AttributeError or ImportError immediately. The most damaging ones are the canonical {"context": ...} example in concept2/index.md:213, the ReactAgent(agent=Agent(...)) form, the lifecycle_hook= compile kwarg, RetrievalMode, client.setApiKey, and useChat from the wrong package.

I'd recommend a focused fix pass before merging. Want me to apply these corrections to the files now? I'd group them as one pass per file to keep the diff reviewable.