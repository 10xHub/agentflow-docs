## MessageContextManager: Professional Context Trimming in Agentflow

`MessageContextManager` is responsible for managing and trimming the message history (context) in agent interactions. It ensures efficient use of the context window, preserves conversation continuity, and supports robust edge case handling for production-grade agent workflows.

### Key Features

- **Context Trimming:** Keeps only the most recent N user messages, always preserving the initial system prompt.
- **Tool Message Removal:** Optionally removes tool-related messages (AI tool calls, tool results) only when a complete tool interaction sequence is present, ensuring no breakage in conversation flow.
- **Edge Case Handling:** Handles empty contexts, mixed message types, and incomplete tool sequences safely.
- **Async Support:** Provides both synchronous and asynchronous context trimming methods.

### Usage

```python
from agentflow.state.message_context_manager import MessageContextManager
from agentflow.state.agent_state import AgentState

# Create a manager to keep max 10 user messages, removing tool messages
mgr = MessageContextManager(max_messages=10, remove_tool_msgs=True)
state = AgentState(context=[...])
state = mgr.trim_context(state)
```

### Tool Message Removal Logic

- Only removes tool-related messages when a complete sequence is present:
	- AI tool call (role="assistant", tool_calls)
	- Tool result(s) (role="tool")
	- Final AI response (role="assistant", no tool_calls)
- Incomplete sequences are preserved to avoid breaking context.
- Handles multiple tool results and mixed scenarios.

### Edge Cases Covered

- Empty context: No trimming performed.
- Fewer user messages than max: No trimming, but tool messages may be removed if requested.
- Incomplete tool sequences: Preserved for reliability.
- Mixed system/user/assistant/tool messages: Only user messages are counted for trimming.

### Example: Trimming with Tool Removal

Suppose your context contains:

1. System prompt
2. User message
3. Assistant tool call
4. Tool result
5. Assistant final response
6. User message

With `remove_tool_msgs=True`, only the complete tool sequence (3, 4, 5) is removed, preserving conversation continuity.

### Testing & Validation

Comprehensive pytest coverage ensures all edge cases and production scenarios are handled. See `tests/state/test_message_context_manager.py` for examples.

### Best Practices

- Always set `max_messages` to balance context window size and conversation history.
- Use `remove_tool_msgs=True` for agents that rely on tool interactions, ensuring only complete sequences are removed.
- Validate with edge case tests before deploying to production.
