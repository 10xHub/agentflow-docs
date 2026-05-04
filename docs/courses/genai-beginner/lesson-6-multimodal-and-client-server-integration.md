---
title: "Lesson 6: Multimodal and Client/Server Integration"
description: Connect your agent to frontends, handle files, and build full-stack GenAI applications. Part of the AgentFlow genai course guide for production-ready Python AI.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - lesson 6 multimodal and client/server integration
---


# Lesson 6: Multimodal and Client/Server Integration

## Learning Outcome

By the end of this lesson, you will be able to:
- Build multimodal agents that handle images and files
- Connect agents to frontend clients via API
- Design clean separation between UI and agent logic

## Prerequisites

- Lesson 5: State and memory
- [Streaming concepts](/docs/concepts/streaming.md)

---

## Concept: GenAI Apps Are Not Just Text Chat

Modern GenAI applications handle multiple modalities:

```mermaid
flowchart LR
    subgraph Inputs["Multi-modal Inputs"]
        Text["Text\nChat, documents"]
        Image["Images\nScreenshots, photos"]
        Audio["Audio\nTranscription"]
        Video["Video\nFrame extraction"]
        File["Files\nPDF, CSV, code"]
    end
    
    subgraph Outputs["Multi-modal Outputs"]
        TOut["Text\nResponses, code"]
        IOut["Images\nGenerated art"]
        AOut["Audio\nTTS responses"]
        FileOut["Files\nReports, exports"]
    end
    
    Inputs --> Agent["Agent"]
    Agent --> Outputs
```

### Common Multimodal Patterns

| Pattern | Input | Output | Use Case |
|---------|-------|--------|----------|
| **Vision + Chat** | Image + text | Text | Screenshot analysis |
| **Document Q&A** | PDF + question | Text + citations | Contract review |
| **Image Generation** | Text prompt | Image | Creative tools |
| **Voice Assistant** | Audio | Audio | Hands-free interaction |

---

## Concept: File Upload Workflows

### Typical File Handling Pipeline

```mermaid
flowchart TB
    subgraph Upload["1. Upload"]
        File["User File"]
        Validate["Validate\nType/Size"]
        Store["Secure Storage"]
    end
    
    subgraph Process["2. Process"]
        Embed["Generate\nEmbeddings"]
        Extract["Extract\nContent"]
    end
    
    subgraph Context["3. Add to Context"]
        Build["Build Prompt\nwith File"]
        Generate["Generate\nResponse"]
    end
    
    File --> Validate --> Store --> Embed & Extract
    Embed & Extract --> Build --> Generate
```

### File Type Handling

| File Type | How to Handle | Considerations |
|-----------|--------------|----------------|
| **Images** | Vision API, base64 encoding | Size limits, processing cost |
| **PDF** | Text extraction, OCR | Complex layouts harder |
| **Code files** | Direct text reading | Preserve syntax |
| **CSV/JSON** | Structured parsing | Validate schema |
| **Documents** | Convert to markdown | Preserve formatting |

---

## Concept: Client/Server Architecture

### Clean Separation of Concerns

```mermaid
flowchart TB
    subgraph Client["Frontend (Client)"]
        UI["User Interface"]
        Stream["Streaming Display"]
        State["Local State"]
    end
    
    subgraph Server["Backend (AgentFlow API)"]
        API["REST API"]
        Graph["Agent Graph"]
        LLM["LLM"]
        Tools["Tools"]
        Check["Checkpointer"]
    end
    
    subgraph External["External Services"]
        Vector["Vector Store"]
        Files["File Storage"]
    end
    
    UI --> Stream --> State
    State --> |"HTTP/WebSocket"| API
    API --> Graph
    Graph --> LLM & Tools & Check
    Graph --> Vector & Files
```

### Responsibilities

| Layer | Responsibilities |
|-------|-----------------|
| **Client** | UI rendering, user input, streaming display, local caching |
| **API** | Request routing, auth, rate limiting, response formatting |
| **Agent** | LLM calls, tool execution, state management |
| **Storage** | File storage, vector store, checkpoint storage |

---

## Example: Multimodal Agent

### Image Understanding

```python
from agentflow.core.llm import OpenAIModel
from agentflow.core.state import Message
import base64

def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode()

class VisionAgent:
    def __init__(self):
        self.llm = OpenAIModel("gpt-4o")  # Vision-capable model
    
    def analyze_image(self, image_path: str, question: str) -> str:
        """Analyze an image and answer questions about it."""
        image_data = encode_image(image_path)
        
        messages = [
            Message(role="user", content=[
                {
                    "type": "text",
                    "text": question
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_data}"
                    }
                }
            ])
        ]
        
        return self.llm.generate(messages=messages)
```

### Document Q&A

```python
from agentflow.core.tools import tool, ToolResult
import PyPDF2

class DocumentProcessor:
    def extract_text(self, file_path: str, max_pages: int = 10) -> str:
        """Extract text from PDF."""
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for i, page in enumerate(reader.pages[:max_pages]):
                text += page.extract_text() + "\n\n"
        return text

@tool(name="read_document", description="Read text from a document file")
def read_document(file_path: str, question: str = None) -> ToolResult:
    """Read and optionally answer questions about a document."""
    processor = DocumentProcessor()
    
    try:
        content = processor.extract_text(file_path)
        
        if question:
            # Answer question about document
            response = llm.generate(
                f"Based on this document, answer: {question}\n\n{content}"
            )
            return ToolResult(result=response)
        else:
            return ToolResult(result=content[:5000])  # Limit output
    except Exception as e:
        return ToolResult(error=str(e))
```

---

## Example: API Server with Streaming

### FastAPI Server Setup

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    thread_id: str
    user_id: Optional[str] = None

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint."""
    result = await agent.ainvoke(
        thread_id=request.thread_id,
        message=request.message,
        user_id=request.user_id
    )
    return {"response": result["response"], "thread_id": request.thread_id}

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat endpoint."""
    async def generate():
        async for chunk in agent.astream(
            thread_id=request.thread_id,
            message=request.message
        ):
            yield f"data: {chunk.json()}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

### File Upload Endpoint

```python
from fastapi import UploadFile, File

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file for processing."""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "application/pdf", "text/plain"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"File type {file.content_type} not allowed")
    
    # Save file securely
    file_id = save_file(file)
    
    return {"file_id": file_id, "filename": file.filename}

def save_file(file: UploadFile) -> str:
    """Save uploaded file to secure storage."""
    import uuid
    import os
    
    file_id = str(uuid.uuid4())
    path = f"/secure_storage/{file_id}"
    
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    with open(path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return file_id
```

---

## Example: Frontend Client Integration

### React Client Component

```tsx
import { useState } from 'react';
import { AgentFlowClient } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000'
});

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId] = useState('user-123-thread-1');

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Streaming response
      const stream = client.streamChat({
        threadId,
        message: input
      });

      const assistantMessage = { role: 'assistant' as const, content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      for await (const chunk of stream) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content += chunk.content;
          return updated;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

---

## Exercise: Build a Full-Stack Chat App

### Your Task

Build a complete chat application with:

1. **Backend** — FastAPI server with:
   - Chat endpoint (streaming)
   - File upload endpoint
   - Thread management

2. **Frontend** — React component with:
   - Message display
   - Streaming text
   - File upload button

### Template Structure

```
my-agent-app/
├── backend/
│   ├── main.py          # FastAPI app
│   ├── agent.py         # Agent logic
│   └── models.py        # Pydantic models
├── frontend/
│   ├── Chat.tsx         # Main component
│   └── api.ts           # Client wrapper
└── docker-compose.yml
```

---

## What You Learned

1. **GenAI is multimodal** — Text is just one modality
2. **Files need processing** — Extract content, generate embeddings
3. **Clean architecture** — Separate client, API, and agent responsibilities
4. **Streaming improves UX** — Send tokens as they arrive

---

## Common Failure Mode

**Thick frontend, thin backend**

Don't put business logic in the frontend:

```python
# ❌ Thin backend - logic in frontend
@app.post("/chat")
def chat(message: str):
    return {"response": "OK"}  # Frontend does everything!

# ✅ Thick backend - logic in agent
@app.post("/chat")
def chat(message: str, thread_id: str):
    result = agent.process(thread_id, message)
    return {"response": result}
```

---

## Next Step

Continue to [Lesson 7: Evals, safety, cost, and release](./lesson-7-evals-safety-cost-and-release.md) to learn how to ship with confidence.

### Or Explore

- [Connect Client Tutorial](/docs/get-started/connect-client.md) — Full client integration
- [Playground Tutorial](/docs/get-started/open-playground.md) — Using the playground
