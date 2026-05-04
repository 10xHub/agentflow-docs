# Dev.to / Hashnode cross-post template

Cross-posting cornerstone blog posts to Dev.to / Hashnode / Medium gets you:

- A backlink with anchor text you control
- Distribution to a different audience (Dev.to has its own SEO and feed)
- A canonical link back to the docs site so Google indexes the canonical, not the duplicate

## The two rules

1. **Always set `canonical_url`** to the original docs-site URL.
2. **Wait 3–7 days** after publishing on the docs site before cross-posting. Lets Google index the canonical first.

## Dev.to YAML front matter

Dev.to uses YAML front matter at the top of the post:

```yaml
---
title: "How to Build an AI Agent in Python — A 2026 Guide"
published: true
canonical_url: https://agentflow.10xscale.ai/blog/how-to-build-an-ai-agent-in-python
description: A practical 2026 guide to building an AI agent in Python — graphs, tools, memory, streaming, and production deployment.
tags: python, ai, agents, tutorial
cover_image: https://agentflow.10xscale.ai/img/agentflow-social-card.png
---
```

Dev.to limits tags to 4 and 24 chars each. Pick the tags that match the dev.to feed (`python`, `ai`, `webdev`, `tutorial`, `programming`).

## Hashnode

Hashnode supports canonical URLs in the post settings (not the YAML). Set:

- **Original article URL** = the docs-site URL
- **Cover image** = the same OG image
- **Tags** = same as Dev.to

## What to change in the body

- **Intro hook**: rewrite the first paragraph to address the dev.to audience specifically. "If you write Python and have been hearing about agents..." reads differently from "An agent is..."
- **CTA**: end with "Read the rest at [the docs site]" only if you've shortened the post. If you cross-post the full text, end with the same CTAs as the original.
- **Code blocks**: keep them. Both platforms render fenced code well.
- **Internal links**: keep them as full URLs to the docs site.

## Cross-post schedule (10 cornerstone posts)

| Original publish | Cross-post on Dev.to | Cross-post on Hashnode |
|---|---|---|
| 2026-03-02 (How to build…) | 2026-03-09 | 2026-03-16 |
| 2026-03-09 (Multi-agent patterns) | 2026-03-16 | 2026-03-23 |
| 2026-03-16 (LangGraph alternatives) | 2026-03-23 | 2026-03-30 |
| 2026-03-23 (Memory + checkpointing) | 2026-03-30 | 2026-04-06 |
| 2026-03-30 (Streaming + SSE) | 2026-04-06 | 2026-04-13 |
| 2026-04-06 (Production agents) | 2026-04-13 | 2026-04-20 |
| 2026-04-13 (ReAct + real APIs) | 2026-04-20 | 2026-04-27 |
| 2026-04-20 (Deploy to AWS) | 2026-04-27 | 2026-05-04 |
| 2026-04-27 (LangGraph migration) | 2026-05-04 | 2026-05-11 |
| 2026-05-04 (Agents vs workflows) | 2026-05-11 | 2026-05-18 |

Stagger by a week each so you're not posting two pieces on the same day.

## Don't

- **Do not** cross-post without the canonical. Google will see two copies and may rank the wrong one.
- **Do not** just copy the markdown without rewriting the intro. Algorithm prefers original-feeling content.
- **Do not** cross-post a piece that's not doing well in week 1 on the docs site. Diagnose first; cross-posting won't fix a weak post.

## After the cross-post

- Reply to comments on the dev.to / hashnode version. Often more engagement than the original.
- If a cross-post takes off, check Search Console — sometimes the dev.to URL outranks the canonical for a while. Usually self-corrects within 2–4 weeks.
