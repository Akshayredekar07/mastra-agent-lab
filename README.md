# Mastra Agent Lab

A hands-on lab for building production-ready AI agents with **[Mastra](https://mastra.ai/ai-agent-framework)** — a TypeScript-first framework for agents, tools, workflows, memory, RAG, evaluation, observability, and deployment.

This repository documents my learning journey from first agent to production-ready agent systems. Each project is small, focused, and designed to demonstrate a real engineering concern: typed tools, structured output, safe execution, memory, workflows, multi-agent coordination, retrieval, evaluation, and deployment.

---

## Why this lab exists

AI agents are easy to demo but difficult to operate reliably.

The goal of this lab is not simply to call an LLM. It is to build agent systems that are:

- Type-safe and testable
- Observable and debuggable
- Secure by default
- Cost- and latency-aware
- Evaluated against real quality criteria
- Safe around external systems and user data
- Deployable with CI/CD and production monitoring

Mastra provides the core building blocks: agents, tools, workflows, memory, evaluation, tracing, and Studio. This repository applies those primitives to practical engineering problems.

---

## What you will find here

| Area | Projects | Core Mastra concepts |
|---|---|---|
| Agent fundamentals | CLI research assistant | Agents, model routing, streaming, Studio |
| Tools and safety | Operations assistant | `createTool`, Zod schemas, authorization, MCP |
| Structured output | Resume/job-fit analyzer | Zod validation, structured output, retries |
| Memory | Persistent support assistant | Conversation history, working memory, semantic recall |
| Real-time UX | Streaming agent service | SSE, APIs, cancellation, frontend integration |
| Deterministic workflows | Invoice-processing workflow | Workflow steps, branches, suspension, approvals |
| Multi-agent systems | Software delivery assistant | Delegation, supervisor pattern, typed handoffs |
| Knowledge systems | Enterprise knowledge-base agent | RAG, embeddings, retrieval, citations, MCP |
| Production readiness | Evaluation and safety package | Evals, scorers, guardrails, tracing |
| Deployment | Team agent platform | Studio, CI/CD, secrets, observability |

---

## Tech stack

- **Language:** TypeScript
- **Agent framework:** [Mastra](https://mastra.ai/ai-agent-framework)
- **Runtime:** Node.js 22+
- **Schema validation:** Zod
- **Testing:** Vitest
- **Package management:** npm or pnpm
- **Observability:** Mastra tracing and OpenTelemetry-compatible tooling
- **Deployment targets:** Node.js, Bun, Deno, Cloudflare, and other Node-compatible environments

---

## Repository structure

```text
mastra-agent-lab/
│
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
│
├── docs/
│   ├── 00-roadmap.md
│   ├── 01-architecture-decisions.md
│   ├── 02-evaluation-checklist.md
│   └── 03-production-checklist.md
│
├── src/
│   ├── mastra/
│   │   ├── index.ts
│   │   ├── agents/
│   │   ├── tools/
│   │   ├── workflows/
│   │   ├── memory/
│   │   ├── evals/
│   │   └── integrations/
│   │
│   ├── services/
│   ├── api/
│   └── shared/
│
├── projects/
│   ├── 01-cli-research-assistant/
│   ├── 02-operations-assistant/
│   ├── 03-resume-job-fit-analyzer/
│   ├── 04-persistent-support-assistant/
│   ├── 05-streaming-agent-service/
│   ├── 06-invoice-processing-workflow/
│   ├── 07-software-delivery-assistant/
│   ├── 08-enterprise-knowledge-base-agent/
│   ├── 09-production-readiness-package/
│   └── 10-team-agent-platform/
│
└── tests/
```

---

## Learning roadmap

### Phase 1 — Agent fundamentals

Build a command-line research assistant.

Learn:

- Creating a Mastra `Agent`
- Model routing and provider configuration
- Instructions and system prompts
- `agent.generate()` and `agent.stream()`
- Inspecting tool calls, steps, usage, and traces
- Running and debugging agents in Mastra Studio

### Phase 2 — Tools and safe execution

Build an operations assistant that can search, fetch, query, save, and retrieve information.

Learn:

- Type-safe tools with `createTool()`
- Zod input and output schemas
- Tool authorization and least privilege
- Timeouts, retries, and idempotency
- Tool-call limits and execution budgets
- MCP integration
- Testing tools independently from the model

### Phase 3 — Structured output

Build a resume and job-fit analyzer.

Learn:

- Structured output with Zod
- Required, optional, constrained, and nested fields
- Validation, retries, and fallback behavior
- Separating syntactic validation from business rules
- Testing output contracts without live model calls

### Phase 4 — Memory and context

Build a persistent support assistant.

Learn:

- Conversation history
- Working memory
- Semantic recall
- Context-window limits
- Token budgets and compaction
- User and conversation isolation
- Secure persistence and data deletion

### Phase 5 — Streaming and APIs

Build a real-time agent service.

Learn:

- Streaming responses
- Tool-call and tool-result events
- Server-Sent Events
- Client disconnects and cancellation
- API integration with Next.js, Hono, or Express
- Frontend event contracts

### Phase 6 — Workflows and approvals

Build an invoice-processing workflow.

Learn:

- Sequential workflow steps
- Parallel branches
- Conditional routing
- Loops and termination conditions
- Human-in-the-loop approvals
- Workflow suspension and resume
- Persistence and replay

### Phase 7 — Multi-agent systems

Build a software delivery assistant.

Learn:

- When one agent is enough
- Agent delegation
- Programmatic handoffs
- Specialist agents
- Supervisor patterns
- Typed agent boundaries
- Failure handling across agents

### Phase 8 — RAG and MCP

Build an enterprise knowledge-base agent.

Learn:

- Document ingestion
- Chunking and metadata
- Embeddings and vector search
- Permission-aware retrieval
- Reranking
- Grounded answers and citations
- MCP tool integration
- Retrieval evaluation

### Phase 9 — Evaluation and safety

Build a production-readiness package.

Learn:

- Evaluation datasets
- Rule-based, statistical, and model-graded scorers
- Regression testing
- Input and output processors
- Guardrails
- Prompt-injection defenses
- Tool approvals
- Tracing, cost, latency, and error monitoring

### Phase 10 — Deployment and operations

Build a team agent platform.

Learn:

- Mastra Studio
- GitHub-based CI/CD
- Environment variables and secrets
- Managed databases
- Production observability
- Trace intelligence
- Rollbacks and incident response

---

## Architecture principles

### Agents are not applications

An agent decides how to pursue an open-ended goal. The application remains responsible for authentication, authorization, persistence, business rules, and external-system boundaries.

### Use the simplest architecture

Start with one agent and a few reliable tools. Add workflows, multiple agents, RAG, or MCP only when the requirement justifies the added complexity.

### Tools are trust boundaries

Every tool should have:

- A typed input schema
- A typed output schema
- Explicit authorization
- A timeout
- Controlled error handling
- A testable implementation

A prompt instruction is not a security control.

### Workflows for reliability

Use workflows when the process must be deterministic, inspectable, resumable, or auditable. Use agents for steps where reasoning and tool selection are genuinely needed.

### Evaluate before production

Every meaningful agent should have measurable evaluation criteria. Test retrieval quality, task completion, factual grounding, safety, latency, cost, and failure behavior.

---

## Getting started

### Prerequisites

- Node.js 22+
- npm or pnpm
- Git
- An LLM provider API key
- Basic TypeScript and Zod knowledge

### Install

```bash
git clone [https://github.com/Akshayredekar07/mastra-agent-lab.git](https://github.com/Akshayredekar07/mastra-agent-lab.git)
cd mastra-agent-lab

npm install
```

### Configure environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your provider credentials:

```env
OPENAI_API_KEY=your_openai_api_key
# or
ANTHROPIC_API_KEY=your_anthropic_api_key
# or
GOOGLE_API_KEY=your_google_api_key
```

Never commit API keys or real user data.

### Run the first agent

```bash
npm run dev
```

### Run tests

```bash
npm run test
```

---

## Example: first Mastra agent

```ts
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core";

const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Agent",
  instructions: `
You are a concise research assistant.

Rules:
- Answer only from information provided by tools or the user.
- If evidence is insufficient, say what is missing.
- Never fabricate sources, figures, or citations.
`,
  model: "openai/gpt-6.1-sol",
});

export const mastra = new Mastra({
  agents: {
    researchAgent,
  },
});
```

```ts
import { mastra } from "./mastra/index.ts";

const agent = mastra.getAgentById("research-agent");

const response = await agent.generate(
  "Explain the difference between an agent and a workflow in two sentences."
);

console.log(response.text);
console.log(response.usage);
```

---

## Production checklist

Before deploying an agent, verify:

- [ ] The agent has a narrow, documented responsibility
- [ ] Instructions are version-controlled and reviewed
- [ ] Model, provider, token limits, and fallback behavior are configurable
- [ ] Every tool has typed input and output schemas
- [ ] Tools enforce authorization outside prompts
- [ ] High-risk tools require approval or are blocked
- [ ] Conversation and workflow state are securely persisted
- [ ] User data is isolated by tenant, user, or workspace
- [ ] Retrieved documents are permission-filtered before reaching the model
- [ ] Answers cite sources or clearly state insufficient evidence
- [ ] Evaluation datasets cover normal, edge, adversarial, and regression cases
- [ ] Traces capture model calls, tool calls, latency, errors, usage, and cost
- [ ] Alerts exist for latency, errors, spend, and abnormal tool usage
- [ ] Rollback and incident-response procedures are documented

---

## Security principles

- Use least-privilege access for every tool and external service.
- Treat model output, retrieved documents, and MCP tool output as untrusted input.
- Enforce authorization in application code, not prompts.
- Use tool approval for destructive or high-impact actions.
- Store secrets in a secret manager or environment configuration.
- Isolate tenant, user, and workspace data.
- Log enough to debug failures without exposing sensitive content.
- Test prompt injection, data leakage, unsafe tool use, and permission bypass scenarios.

---

## Evaluation strategy

Every project should be evaluated across multiple dimensions:

| Dimension | Example question |
|---|---|
| Task completion | Did the agent accomplish the requested task? |
| Factual grounding | Are claims supported by retrieved evidence or tool results? |
| Tool selection | Did the agent choose the correct tool? |
| Tool arguments | Were the arguments valid, safe, and complete? |
| Structured output | Does the response satisfy the declared schema? |
| Safety | Did the agent avoid unsafe, unauthorized, or harmful actions? |
| Latency | Is response time acceptable for the use case? |
| Cost | Are token usage and model costs within budget? |
| Reliability | Does the system behave correctly during failures and retries? |

---

## Roadmap status

| Phase | Project | Status |
|---|---|---|
| 1 | CLI research assistant | Planned |
| 2 | Operations assistant | Planned |
| 3 | Resume/job-fit analyzer | Planned |
| 4 | Persistent support assistant | Planned |
| 5 | Streaming agent service | Planned |
| 6 | Invoice-processing workflow | Planned |
| 7 | Software delivery assistant | Planned |
| 8 | Enterprise knowledge-base agent | Planned |
| 9 | Production-readiness package | Planned |
| 10 | Team agent platform | Planned |

---

## Contributing

This is primarily a personal learning and engineering repository, but suggestions, improvements, and issue reports are welcome.

1. Fork the repository
2. Create a feature branch
3. Make your change
4. Add or update tests
5. Open a pull request

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

## Resources

- [Mastra AI Agent Framework](https://mastra.ai/ai-agent-framework)
- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra Agents](https://mastra.ai/docs/agents/overview)
- [Mastra Tools](https://mastra.ai/docs/agents/tools)
- [Mastra Workflows](https://mastra.ai/docs/workflows/overview.md)
- [Mastra Platform](https://mastra.ai/ai-agent-platform)
- [Zod Documentation](https://zod.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)