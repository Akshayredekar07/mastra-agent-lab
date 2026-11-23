# Architecture Decisions

Mastra Agent Lab · Design guide and decision-record template

**Status:** Proposed guidance; not a claim about implemented repository features.  
**Reviewed:** 24 November 2026

## Purpose

Choose the simplest architecture that satisfies the requirement. Add complexity only when an evaluation, permission boundary, or operational requirement justifies it. This document contains project recommendations rather than guarantees supplied by the framework.

## Decision guide

| Requirement | Prefer | Avoid when |
|---|---|---|
| Fixed computation or predictable API lookup | Ordinary TypeScript function | Reasoning is genuinely required |
| Open-ended task with a few capabilities | One agent with typed tools | A fixed, auditable sequence is mandatory |
| Distinct expertise, context, or permissions | Multiple agents with typed handoffs | One agent already meets quality and cost targets |
| Explicit steps, branches, approvals, or recovery | Workflow | A single independent model call is sufficient |
| Answers grounded in a managed document corpus | RAG | All necessary evidence is already in the request |
| Portable external tool integration | MCP | A local function or existing API wrapper is simpler |
| Useful context across interactions | Memory | Requests are independent or retention is prohibited |

These choices combine: a workflow may call an agent that uses RAG and tools. MCP is an integration protocol, not a substitute for orchestration, retrieval, or authorization.

## One agent

**Default decision:** Start with one agent and the smallest useful toolset.

- Define a narrow responsibility and explicit completion criteria.
- Use typed tool inputs and validate outputs at application boundaries.
- Bound runtime, tool calls, retries, and spending.
- Keep business rules and authorization in application code.
- Test incorrect tool selection, missing evidence, and provider failures.

**Example:** A research assistant searches an approved source and produces evidence-backed notes. It must not claim to have verified facts when no retrieval tool was used.

## Multiple agents

Use specialist agents when separate context, models, permissions, or independent review provides a measurable benefit. Mastra agent networks can route work among agents, tools, and workflows; consult the installed version's documentation before adopting network APIs. [Agent networks](https://mastra.ai/docs/agents/networks)

Before adding an agent, record:

- Its responsibility and permitted tools.
- Its input and output schemas.
- The handoff policy and maximum delegation depth.
- Shared versus isolated state and credential boundaries.
- Behavior when a specialist fails or disagrees.
- Quality improvement against the single-agent baseline, including added cost and latency.

Agent names do not create security isolation. Enforce separate capabilities and authorization at execution boundaries.

## Workflows

Use workflows for explicit task sequences instead of asking one agent to infer the entire process. Mastra documents workflows as structured steps with controlled data movement and execution. [Workflows](https://mastra.ai/docs/workflows/overview)

**Example:** Extract invoice fields → validate → check purchase order → request approval → execute approved action → record outcome.

- Give each step a typed contract and clear failure outcome.
- Use deterministic code for arithmetic, permission checks, and business rules.
- Define bounded retries and distinguish transient from permanent failures.
- Make write operations idempotent and record idempotency keys.
- Configure persistent storage before relying on restart recovery.
- Test suspend/resume, duplicate delivery, cancellation, and deployment compatibility.
- Treat compensation as a separate business operation; a workflow cannot undo every external effect.

Conversation history is not a durable workflow checkpoint. Persistence must be configured and recovery tested in the target environment.

## RAG

Use retrieval-augmented generation when answers need evidence from a managed corpus.

Recommended flow:

```text
Documents → parse → chunk + metadata → embed → index
Request + identity → permission filters → retrieve → optional rerank
→ bounded evidence context → answer + source references
```

- Preserve document identity, version, source location, and access metadata.
- Apply tenant and permission filters before evidence reaches the model.
- Evaluate retrieval independently from answer generation.
- Require source references and an insufficient-evidence response.
- Test stale content, conflicting documents, deletion, and re-indexing.
- Treat retrieved instructions as untrusted content, not authority.

Use a database or API lookup instead when the task needs exact current structured records, such as an account balance.

## MCP

Use Model Context Protocol when tools or resources must be exposed through a reusable protocol boundary. Mastra supports exposing agents, workflows, and tools to MCP clients. [MCP server](https://mastra.ai/docs/server/mcp)

- Allowlist servers and tool capabilities.
- Authenticate callers and authorize every operation.
- Validate tool inputs and outputs regardless of server trust.
- Bound connection lifetime, runtime, payload size, and retries.
- Keep credentials server-side and scoped to the caller's permissions.
- Require approval for consequential actions.
- Separate development-only introspection from production exposure.

Prefer a direct tool wrapper when portability is unnecessary and a protocol server adds only operational overhead.

## Memory

Use memory for multi-turn context, relevant preferences, or intentionally retained facts. Skip it for independent requests or prohibited retention. Mastra distinguishes conversation history, working memory, and semantic recall. [Memory concepts — versioned reference](https://mastra.ai/docs/v0/agents/agent-memory)

| State | Purpose | Storage and control |
|---|---|---|
| Conversation history | Continue a thread | Persisted messages with ownership checks |
| Working memory | Maintain selected task or user context | Explicit scope, update policy, and size limit |
| Semantic recall | Retrieve relevant prior content | Permission-filtered index and retention policy |
| Workflow state | Resume an execution | Durable execution persistence |
| Authoritative records | Business truth | Application database, not model-generated memory |

- Derive user and tenant scope from authenticated identity.
- Verify thread ownership before reading or writing memory.
- Minimize retained data; document TTL, deletion, and consent requirements.
- Test cross-user leakage and malicious memory updates.
- Keep memory bounded and define conflict-resolution rules.

## Recommended progression

1. Build one agent with a small deterministic test suite.
2. Add typed tools and permission checks.
3. Add memory only when continuity is required.
4. Add a workflow for explicit control and approval.
5. Add RAG when external evidence is required.
6. Add MCP when portability is required.
7. Add specialist agents only after baseline measurements justify them.

## Architecture decision record

Copy this template for consequential decisions. Store records under `docs/adr/` when that directory is created.

```markdown
# ADR-001: Decision title

- Status: Proposed / Accepted / Superseded
- Date: YYYY-MM-DD
- Owner: Name

## Context
Requirement, constraints, data sensitivity, and expected load.

## Options
Alternatives considered, including the simplest baseline.

## Decision
Chosen approach and permission boundaries.

## Evidence
Evaluation results, cost, latency, and operational tests.

## Consequences
Trade-offs, failure modes, and maintenance cost.

## Revisit when
Measurable trigger for changing the decision.
```

## Acceptance checklist

- [ ] Simplest viable baseline evaluated.
- [ ] Inputs, outputs, ownership, and trust boundaries documented.
- [ ] Failure, retry, approval, and cancellation behavior defined.
- [ ] Quality, cost, and latency budgets recorded.
- [ ] Persistence and deletion behavior verified where applicable.
- [ ] Installed package versions pinned and relevant documentation checked.

## Related documents

- [Evaluation checklist](02-evaluation-checklist.md)
- [Production checklist](03-production-checklist.md)
