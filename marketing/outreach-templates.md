# Outreach email templates

For listicle authors ("Best X frameworks 2026"), tutorial creators, podcast hosts, and prospective partners. The goal is genuine inclusion, not link-begging.

## Rules

1. **Write to a person, not a company.** Find the author's name. Reference something specific they wrote.
2. **Lead with a useful angle**, not a request. What new information do you have?
3. **Keep it under 120 words.** Anything longer reads like a press release.
4. **Don't ask for a link.** Offer information; let the link be their idea.
5. **Send from a real domain** (`name@10xscale.ai`), never a Gmail.

## Template 1 — Listicle inclusion

For someone who already wrote "Best Python agent frameworks in 2026" without listing AgentFlow.

> Subject: AgentFlow → for your "best Python agent frameworks" piece
>
> Hi [Name],
>
> I read your roundup of Python agent frameworks last week — the section on [specific point they made] was the clearest take I've seen.
>
> I wanted to flag AgentFlow in case you're updating it. It's an MIT-licensed runtime with a similar mental model to LangGraph, plus a built-in REST/SSE server and a typed TypeScript client. The honest "where each framework wins" comparison lives at https://agentflow.10xscale.ai/docs/compare.
>
> Happy to provide code samples in any specific shape (multi-agent, RAG, deployment) if that helps. Not asking for a link — if it's not a fit, no problem.
>
> Best,
> [Your name]

## Template 2 — Migration story angle

For someone who wrote about LangGraph, CrewAI, etc. and might write a follow-up on alternatives.

> Subject: One angle for your next agent-framework piece
>
> Hi [Name],
>
> Quick note — your post on [specific framework / pattern] was useful. I've been working with the same problem space.
>
> One angle that hasn't gotten coverage: teams that ported off [framework they wrote about] to AgentFlow because the production server / TS client friction was higher than expected. We have a step-by-step migration walkthrough (https://agentflow.10xscale.ai/blog/langgraph-to-agentflow-migration) and a few teams happy to talk on the record.
>
> If that's interesting to your readers, I can pull together the code diffs and a short interview thread. No pressure — just thought I'd flag it.
>
> Best,
> [Your name]

## Template 3 — Podcast / YouTube

> Subject: Open-source Python agent framework — possible guest topic
>
> Hi [Host],
>
> Long-time listener / [reference their last episode].
>
> I run AgentFlow, an open-source Python framework for production AI agents (alternative to LangGraph / CrewAI / AutoGen). We just shipped 1.0 with a built-in REST/SSE server and a typed TS client.
>
> If "production patterns for multi-agent systems" or "what teams hit when they go from prototype to deployed agent" sounds like a fit, I'd love to come on. Happy to send a 1-page outline first.
>
> Either way — keep up the good work.
>
> Best,
> [Your name]

## Template 4 — Comparison page mention

For someone who wrote "AgentFlow vs LangGraph" or similar — even mid-quality content that mentions the brand is worth engaging with.

> Subject: Thanks for the AgentFlow / [other framework] comparison
>
> Hi [Name],
>
> Saw your AgentFlow vs [framework] write-up. A couple of things that might be worth checking — the [specific feature] you mentioned was deprecated in 0.5; the current pattern is [link to docs page]. Happy to provide an updated example if useful.
>
> No pressure to update if you're moving on from the topic. Just wanted to keep it factual on the AgentFlow side.
>
> Best,
> [Your name]

## Template 5 — Researcher / academic

For someone who cited a competing framework in a paper.

> Subject: Open-source agent framework relevant to your [paper title]
>
> Hi [Name],
>
> Read your paper on [specific contribution]. The [specific section] resonated with what we hit in production.
>
> AgentFlow is open-source (MIT) and supports the [pattern they discussed] natively — `create_handoff_tool` + `recursion_limit` + Postgres checkpointing. If you're considering a follow-up paper or a benchmark, AgentFlow could be useful as an additional baseline.
>
> Repo: https://github.com/10xHub/Agentflow. Happy to support reproducibility — environments, scripts, code review on benchmark setups.
>
> Best,
> [Your name]

## Cold-email metrics to expect

| Metric | Realistic target |
|---|---|
| Open rate | 35–55% (depends on subject) |
| Reply rate | 5–15% (a thoughtful reply, not just "thanks") |
| Conversion to mention/link | 1–3% per send |

If your reply rate is below 5%, your subject and first line need work. If your conversion rate is below 1%, you're sending to the wrong people.

## Don't

- Don't use mail-merge templates that are obviously templated. They get marked as spam.
- Don't follow up more than twice. After two non-responses, move on.
- Don't pitch hard product features. The inbox is already full of those.
- Don't ask for the link directly. "Could you link to us?" is a no almost every time.

## Tracking

A simple Notion / Sheet:

| Date | Person | Outlet | Template | Reply? | Mention? |
|---|---|---|---|---|---|
| 2026-05-15 | Jane X | Dev.to | T1 | Yes | Pending |
| 2026-05-15 | John Y | YouTube | T3 | No | — |
