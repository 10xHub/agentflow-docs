---
title: Transformer Basics
description: Enough transformer architecture intuition to understand attention, context windows, and scaling implications for building GenAI systems.
---

# Transformer Basics

This page explains the transformer architecture at a conceptual level. You don't need to understand the math to build GenAI systems, but understanding *why* transformers handle sequences differently helps with design decisions.

**Prerequisites for:**
- [Beginner: Lesson 1 - Use cases, models, and the LLM app lifecycle](../genai-beginner/lesson-1-use-cases-models-and-app-lifecycle.md)
- [Beginner: Lesson 2 - Prompting and structured outputs](../genai-beginner/lesson-2-prompting-context-and-structured-outputs.md)
- [Advanced: Lesson 3 - Context engineering, long context, and caching](../genai-advanced/lesson-3-context-engineering-long-context-and-caching.md)

---

## The Evolution from RNNs to Transformers

Before transformers, sequence modeling relied on Recurrent Neural Networks (RNNs) like LSTMs and GRUs.

### RNN Processing: Sequential and Slow

```mermaid
flowchart LR
    subgraph RNN["RNN: Sequential Processing"]
        direction TB
        T1["Token 1"] --> H1["Hidden 1"]
        H1 --> T2["Token 2"]
        T2 --> H2["Hidden 2"]
        H2 --> T3["Token 3"]
        T3 --> H3["Hidden 3"]
        H3 --> TN["Token N"]
    end
    
    style RNN fill:#ffcccc
```

**The problem:** To understand Token 100, the model had to process Tokens 1-99 first. Information from early tokens had to "travel" through every intermediate step, getting diluted or lost along the way.

```mermaid
flowchart LR
    subgraph RNNProblem["RNN Long-Range Dependency Problem"]
        A["The"] --> B["cat"]
        B --> C["sat"]
        C --> D["on"]
        D --> E["the"]
        E --> F["mat"]
        
        F -.-> |"Information must\npass through\nall intermediate"| A
        
        note1["Token N needs\ncontext from Token 1"]
        note1 -.-> |"Must traverse\nall steps"| A
    end
```

### Transformer Processing: Parallel and Direct

```mermaid
flowchart LR
    subgraph Transformer["Transformer: Parallel Processing"]
        direction TB
        
        subgraph Tokens["All Tokens (Processed in Parallel)"]
            T1["Token 1"]
            T2["Token 2"]
            T3["Token 3"]
            TN["Token N"]
        end
        
        T1 -.-> |"Direct attention"| TN
        T2 -.-> |"Direct attention"| TN
        T3 -.-> |"Direct attention"| TN
        
        note2["Every token can directly\nattend to every other token"]
    end
    
    style Transformer fill:#ccffcc
```

**The breakthrough:** Transformers process all tokens simultaneously. Any token can directly "attend to" any other token in a single step—no sequential passing required.

---

## Self-Attention: The Key Innovation

Self-attention is the mechanism that allows each token to "look at" all other tokens simultaneously.

### How Attention Works: Query, Key, Value

Each token is represented as three vectors during attention:

```mermaid
flowchart TB
    subgraph QKV["Query-Key-Value Attention"]
        subgraph Token["Token Representation"]
            T["Token: 'sat'"]
        end
        
        subgraph Vectors["Three Vector Representations"]
            Q["Query (Q)\nWhat am I looking for?"]
            K["Key (K)\nWhat do I contain?"]
            V["Value (V)\nWhat information to extract?"]
        end
        
        T --> Q
        T --> K
        T --> V
    end
    
    subgraph Computation["Attention Computation"]
        Q1["Q from 'sat'"] --> Compare["Compare Q to all K"]
        K1["K from 'cat'"] --> Compare
        K2["K from 'on'"] --> Compare
        
        Compare --> Weights["Attention Weights"]
        Weights --> WeightedSum["Weighted Sum of V"]
        V1["V from 'cat'"] --> WeightedSum
        V2["V from 'on'"] --> WeightedSum
    end
```

### Why This Matters for Language Understanding

In the sentence "The cat sat on the mat", attention captures relationships:

```mermaid
flowchart TB
    subgraph Sentence["The cat sat on the mat"]
        Words["The" "cat" "sat" "on" "the" "mat"]
    end
    
    subgraph Relations["Attention Captures These Relations"]
        subgraph Direct["Direct Relationships"]
            R1["'sat' ←→ 'cat'\n(subject-verb agreement)"]
            R2["'sat' ←→ 'on the mat'\n(preposition phrase)"]
            R3["'the' ←→ 'mat'\n(determiner-noun)"]
        end
        
        subgraph Complex["Complex Relationships"]
            R4["'The' ←→ 'cat'\nEven though separated by 'cat sat on the'"]
        end
    end
```

Without sequential processing, the model can directly learn that "sat" relates to "cat" (subject-verb agreement), even though "cat" comes before "sat".

---

## Tokens and Positional Information

### What Are Tokens?

LLMs don't process words directly—they process **tokens**. A token is typically:

| Text | Approximate Tokens | Why |
|------|-------------------|-----|
| "The" | 1 | Common word |
| "cat" | 1 | Common word |
| "AgentFlow" | 2-3 | Uncommon compound |
| "transformer" | 2-3 | Longer word |
| "🚀" | 2-5 | Emoji (varies by model) |

**Rule of thumb:** 1 token ≈ 4 characters in English ≈ 0.75 words

### Why Tokenization Matters

Different tokenizers behave differently:

```mermaid
flowchart LR
    subgraph Tokenizers["Tokenizer Differences"]
        T1["'unbelievable'"]
        
        subgraph OpenAI["OpenAI Tokenizer"]
            O1["un" "believe" "able"]
        end
        
        subgraph Generic["Generic Tokenizer"]
            G1["unbeliev" "able"]
        end
        
        T1 --> O1
        T1 --> G1
    end
```

**Implication:** Tokenization affects:
- Cost (more tokens = more money)
- Latency (more tokens = slower)
- Chunk boundaries (where you split documents)

### Positional Encoding: Adding Order Awareness

Self-attention has no inherent sense of order—it treats tokens as a "bag of words". **Positional encoding** fixes this by adding position information:

```mermaid
flowchart TB
    subgraph WithoutPE["Without Positional Encoding"]
        subgraph Input1["Input"]
            T1A["'Hello'"]
            T2A["'World'"]
        end
        subgraph Output1["Both inputs appear identical to model"]
            O1A["Attention: Same result regardless of order"]
        end
        T1A & T2A --> O1A
    end
    
    subgraph WithPE["With Positional Encoding"]
        subgraph Input2["Input + Position"]
            T1B["'Hello'[pos=1]"]
            T2B["'World'[pos=2]"]
        end
        subgraph Output2["Model knows order"]
            O1B["Attention: Different result based on position"]
        end
        T1B & T2B --> O1B
    end
    
    style WithoutPE fill:#ffcccc
    style WithPE fill:#ccffcc
```

**Important:** Without positional encoding, "Hello World" and "World Hello" would be treated identically. With it, the model knows the difference.

---

## Why Transformers Handle Long Sequences Better

### The Path Length Problem

```mermaid
flowchart TB
    subgraph Comparison["RNN vs Transformer Path Length"]
        subgraph RNNPath["RNN: O(N) Path Length"]
            R1["T1"] --> R2["T2"]
            R2 --> R3["T3"]
            R3 --> RDots["..."]
            RDots --> RN["TN"]
            
            RN -.-> |"N-1 steps to connect"| R1
            
            RNNNote["Information from T1\nmust pass through\nT2, T3, ..., TN-1"]
        end
        
        subgraph TFPath["Transformer: O(1) Path Length"]
            TT1["T1"]
            TT2["T2"]
            TT3["T3"]
            TTDots["..."]
            TTN["TN"]
            
            TT1 -.-> |"1 step"| TTN
            TT2 -.-> |"1 step"| TTN
            TT3 -.-> |"1 step"| TTN
            
            TFNote["T1 directly connects\nto TN in 1 step"]
        end
    end
    
    RN -.x R1
```

| Model | Path Length | Consequence |
|-------|-------------|-------------|
| RNN | O(N) | Long-range dependencies dilute |
| Transformer | O(1) | Direct connections regardless of distance |

**This is why modern LLMs can work with context windows of 128K+ tokens.**

---

## Why Long Context Still Has Tradeoffs

Despite transformers handling longer sequences better, long context has real quality and cost tradeoffs.

### Quality Tradeoffs

```mermaid
flowchart TB
    subgraph Quality["Long Context Quality Issues"]
        subgraph LostInMiddle["Lost in the Middle"]
            L1["Important info at beginning"]
            L2["Important info at end"]
            L3["Important info in middle"]
            
            L3 -.-> |"Often ignored"| Fail["Model pays\nless attention\nto middle"]
            
            L1 & L2 -.-> |"Usually retained"| Good["Retained"]
        end
        
        subgraph AttentionDilution["Attention Dilution"]
            AD["All tokens compete for attention budget"]
            AD2["10K tokens → less attention per token"]
            AD3["Results in lower quality per token"]
        end
    end
```

| Issue | Description | Mitigation |
|-------|-------------|-------------|
| **Lost in the middle** | Models often pay less attention to middle content | Put important info at beginning or end |
| **Attention dilution** | More tokens = less attention per token | Use retrieval instead of stuffing context |
| **Stale representations** | Models trained on shorter context may not generalize | Test with actual long context |

### Cost Tradeoffs

```mermaid
flowchart LR
    subgraph CostModel["Token Cost Model"]
        subgraph Input["Input Side"]
            I1["System prompt"]
            I2["Conversation history"]
            I3["Retrieved context"]
            I4["Current input"]
        end
        
        subgraph Output["Output Side"]
            O1["Response tokens"]
        end
        
        subgraph Total["Total = Sum of All"]
            Total["Total tokens × price per token"]
        end
        
        I1 & I2 & I3 & I4 --> Total
        Total --> O1
    end
```

| Context Size | Approximate Cost | Latency Impact |
|-------------|-----------------|----------------|
| 4K tokens | 1x baseline | Baseline |
| 32K tokens | ~3-4x | +50-100% |
| 128K tokens | ~10-15x | +200-400% |

**Design implication:** Don't use 128K when 4K suffices. More tokens cost more and often produce worse results for focused tasks.

---

## Architecture Variants: Encoder, Decoder, and Combinations

There are three main transformer variants:

```mermaid
flowchart TB
    subgraph Variants["Transformer Architecture Variants"]
        subgraph Encoder["Encoder-Only (BERT)"]
            E1["Input\n'This is great'"]
            E2["All tokens attend\n(bidirectional)"]
            E3["Embedding Output"]
        end
        
        subgraph Decoder["Decoder-Only (GPT)"]
            D1["Input\n'Once upon'"]
            D2["Causal attention\n(can only see past)"]
            D3["Next token: 'a'"]
            D3 --> D4["Next: 'time'"]
            D4 --> D5["Next: ..."]
        end
        
        subgraph EncDec["Encoder-Decoder (T5)"]
            ED1["Input\n'Hello in French?'"]
            ED2["Encoder\n(bidirectional)"]
            ED3["Cross attention\nto encoder"]
            ED4["Decoder\n(auto-regressive)"]
            ED5["Output\n'Bonjour'"]
        end
    end
    
    style Encoder fill:#ffcccc
    style Decoder fill:#ccffcc
    style EncDec fill:#ffffcc
```

| Variant | Processing | Best For | Examples |
|---------|------------|----------|----------|
| **Encoder-only** | Bidirectional (sees all tokens) | Classification, extraction, embeddings | BERT, RoBERTa |
| **Decoder-only** | Causal (sees only past tokens) | Text generation, chat | GPT-4, Claude, Llama |
| **Encoder-decoder** | Encoder for input, decoder for output | Translation, summarization | T5, BART |

**Most modern LLMs are decoder-only** because they're optimized for generative tasks like chat and text completion.

---

## Practical Implications for GenAI Systems

### What This Means for Your Designs

```mermaid
flowchart TB
    subgraph Implications["Architecture → Design Implications"]
        subgraph Context["Context Design"]
            C1["Long context = higher cost"]
            C2["Important info at edges"]
            C3["Retrieval > stuffing"]
        end
        
        subgraph Performance["Performance"]
            P1["More tokens = more latency"]
            P2["Attention is compute-heavy"]
            P3["Caching helps repeated context"]
        end
        
        subgraph Quality["Quality"]
            Q1["Middle content often lost"]
            Q2["Focused context > vague context"]
            Q3["Test with real data"]
        end
    end
```

### Design Guidelines

| Guideline | Reason |
|-----------|--------|
| **Minimize context when possible** | Every token costs money and latency |
| **Put important info at start or end** | "Lost in the middle" phenomenon |
| **Use retrieval for specific information** | Targeted retrieval > long context |
| **Test with actual context lengths** | Quality degrades non-linearly |
| **Cache stable context** | System prompts can often be cached |

---

## Key Takeaways

1. **Transformers use self-attention** — Each token can attend to all other tokens in parallel, enabling direct long-range dependencies.

2. **Positional encoding adds order awareness** — Without it, "Hello World" and "World Hello" are identical.

3. **Long context has real tradeoffs** — More tokens mean higher cost, more latency, and often lower per-token quality.

4. **Retrieval beats stuffing for specific queries** — Targeted retrieval is usually cheaper and more accurate than long context.

5. **Architecture affects capability** — Most modern LLMs are decoder-only transformers optimized for generation.

---

## What You Learned

- Self-attention allows parallel processing and direct long-range dependencies
- Positional encoding gives transformers order awareness
- Long context has quality (lost in middle) and cost tradeoffs
- Most modern LLMs are decoder-only transformers
- Context design decisions directly impact cost and quality

---

## Prerequisites Map

This page supports these lessons:

| Course | Lesson | Dependency |
|--------|--------|------------|
| Beginner | Lesson 1: Use cases, models, and the LLM app lifecycle | Self-attention, context windows |
| Beginner | Lesson 2: Prompting and structured outputs | Cost and latency implications |
| Advanced | Lesson 3: Context engineering, long context, and caching | Full page |
| Advanced | Lesson 4: Advanced RAG | Why retrieval often beats long context |

---

## Next Step

Continue to [Tokenization and context windows](./tokenization-and-context-windows.md) to understand how text is split into tokens and how this affects your GenAI applications.

Or jump directly to a course:

- [Beginner: Lesson 1 - Use cases, models, and the LLM app lifecycle](../genai-beginner/lesson-1-use-cases-models-and-app-lifecycle.md)
- [Advanced: Lesson 3 - Context engineering, long context, and caching](../genai-advanced/lesson-3-context-engineering-long-context-and-caching.md)
