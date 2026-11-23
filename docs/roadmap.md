# **Mastra Agent Engineering: End-to-End Learning Roadmap**

**Research date:** 23 November 2026

**Verified against:** the official Mastra documentation index (`mastra.ai/llms.txt`), the doc pages linked in each phase, the Mastra GitHub repository, and the `@mastra/core` 1.83.x release line. Claims that come from a third-party article instead of Mastra's own pages are labelled "third-party".

---

## **1. What you are learning**

Mastra is an open-source TypeScript framework for building AI agents and applications. Its core pitch is that agents, workflows, memory, tools, evals and observability live in one framework and share one application configuration, so you are not stitching together libraries that were never designed to work together. [Mastra agent framework page](https://mastra.ai/ai-agent-framework).

Do not treat Mastra as one flat API. Learn it in layers:

| Layer | What it is | When to learn it |
|---|---|---|
| **Core** | `Agent`, `createTool`, the model router, `generate()` and `stream()`, the `Mastra` instance, structured output | First |
| **Memory and storage** | Message history, working memory, semantic recall, Observational Memory, storage adapters | Right after the first agent |
| **Workflows** | Typed graph of steps with parallel branches, conditions, loops, state, suspend and resume, snapshots, schedules | When the process is known in advance |
| **Multi-agent** | Supervisor agents with subagents, handoffs, councils built from workflows | Only when one agent stops being a good boundary |
| **Knowledge, MCP and integrations** | Knowledge (alpha), MCP client and server, vector stores, channels, sandboxes | As the project requires |
| **Safety layer** | Processors, guardrails, tool approval, auth | Before any real user touches the agent |
| **Quality layer** | Scorers, datasets, experiments, tracing, Studio | From the first working agent, deepen before production |
| **Harness** | Durable agents, background tasks, goals, schedules, signals, AgentController | When work outlives one request |
| **Mastra Platform** | Hosted Studio, Server, Observability, Gateway, Connect | Optional deployment choice |
| **External infrastructure** | PostgreSQL, Redis, vector database, Inngest or Temporal, Docker, cloud platform | As the project requires |

**Terminology trap:** "Harness" does not mean the same thing here as in Pydantic AI. In Pydantic AI it is an optional capability package. In Mastra it is a set of capabilities for managing an agent beyond a single uninterrupted run (durability, goals, schedules, signals), which you can adopt one at a time. [Harness overview](https://mastra.ai/docs/harness/overview.md).

### **Stability and versioning rule**

Mastra moves fast, and parts of it are explicitly pre-stable. Treat the version as part of your design.

- **Release pace (third-party):** a DevelopersDigest review counted 15 minor releases of `@mastra/core` in the six weeks before 17 October 2026, and `@mastra/core` 1.83.0 shipped on 12 November 2026. Pin exact versions, read the changelog before every upgrade, and wrap Mastra behind your own interfaces where a feature is young. [DevelopersDigest](https://developersdigest.tech/blog/mastra-whats-new-2026).
- **Maturity labels in the official docs:** Knowledge is alpha, durable agents are beta, the `@mastra/temporal` package is experimental, and the OpenAI-compatible Responses and Conversations routes are experimental. Do not build a production dependency on these without a fallback.
- **A breaking change you must know (1.83.0):** on a plain `Agent`, the `durable` option now controls resumable streams only. Checkpoint-backed durable execution moved to `createDurableAgent({ agent })`. Resumable streams let a client reconnect, but they are not crash recovery: if the process running a plain agent stops, the run stops. The official durable-agents page says the same about stored agents. [Durable agents](https://mastra.ai/docs/harness/durable-agents.md), plus a third-party release summary at [AI Agents Info](https://aiagentsinfo.com/blog/ai-agent-framework-release-november-2026-upgrade).
- **Your training data and most blog code are stale by default.** Mastra's docs tell you to trust the docs over model memory, and give a concrete example: tools must be defined with `createTool()`, and `execute` has exactly one signature, `execute(inputData, context)`. Plain object tools silently fail. Every docs page is available as markdown by appending `.md` to its URL, and the index is at `https://mastra.ai/llms.txt`. For a coding agent, install the official skills with `npx skills add mastra-ai/skills`.
- **Licence:** the framework is Apache 2.0. Code in any directory named `ee/` is source-available under the Mastra Enterprise License and needs a licence for production use. [GitHub repository](https://github.com/mastra-ai/mastra).

### **Pydantic AI to Mastra concept map**

This map is approximate. Use it to find where to look, then read the Mastra page, because the semantics differ in places.

| Pydantic AI | Closest Mastra concept | Where they differ |
|---|---|---|
| `Agent` | `Agent` from `@mastra/core/agent` | Registered on a central `Mastra` instance and looked up by id |
| `deps` and `RunContext` | `RequestContext` plus closures or factory functions | `RequestContext` is runtime key-value data passed to tools, processors and dynamic config. Decide your own typed dependency pattern and document it |
| `output_type` | `structuredOutput.schema`, read from `response.object` | Schema can be Zod, Valibot, ArkType or JSON Schema |
| Tools and toolsets | `createTool`, `tools` object, MCP client tools | No Python-style decorator. Tools carry `id`, schemas and `execute` |
| `message_history` | `Memory` with `resource` and `thread`, plus storage | Persistence is a framework feature, not only your database code |
| Pydantic Graph | Workflows (`createWorkflow`, `createStep`, `.then()`, `.parallel()`, `.branch()`) | Steps have Standard JSON Schema input and output contracts and built-in suspend and resume |
| Harness memory and guardrails | Memory, processors and guardrails in Core, plus Harness durability features | Guardrails are processors, not a separate package |
| `TestModel`, `FunctionModel` | A test-double language model passed as the agent `model` | Mastra's own tests use AI SDK mock models. Verify the mock class that matches your installed AI SDK version |
| Pydantic Evals | `@mastra/evals` scorers, datasets, experiments, `runEvals` | Scorers return 0 to 1 scores and plug into live sampling and CI |
| Logfire | Mastra tracing with exporters (OpenTelemetry, Langfuse, Datadog, Sentry and others) | Tracing is built in, and exporters are optional |
| Durable execution engines | `createDurableAgent`, `createInngestAgent`, workflow runners (Inngest, Temporal) | Temporal package is experimental |

---

## **2. Prerequisites and setup**

### **Required TypeScript and backend knowledge**

Before starting, be comfortable with:

- TypeScript strict mode, generics, type inference from schemas, discriminated unions, `satisfies` and utility types.
- Zod (or Valibot or ArkType). Mastra accepts any library that supports Standard JSON Schema for tool, workflow and output schemas.
- ES modules, `async` and `await`, async iterators (`for await`), Web Streams, `AbortSignal`.
- Error handling, retries, timeouts and cancellation.
- Vitest (Mastra's eval tooling integrates with it), mocks and fixtures.
- HTTP, `fetch`, JSON, headers, status codes, middleware, and one of Hono or Express.
- SQL basics and transactions.

### **Additional software, LLM and backend prerequisites**

- Git branches, pull requests and CI.
- Docker images, volumes and Compose.
- PostgreSQL basics, migrations and connection pooling.
- React basics if you want a chat UI.
- LLM tokens, context windows, temperature, top-p, stop conditions and pricing.
- Prompt injection, data leakage and least-privilege tool access.

Treat this as a checklist, not a reason to postpone starting. Learn a prerequisite when a project exposes the gap.

### **Runtime requirements**

- Node.js **v22.13.0 or later** is the documented minimum. Node.js 22.18.0 and later can run TypeScript files directly, which the quickstart uses. Bun, Deno and Cloudflare are also listed as supported runtimes. [Deployment overview](https://mastra.ai/docs/deployment/overview.md).
- The Mastra Client SDK needs TypeScript 4.7 or higher if you use TypeScript. [Mastra Client](https://mastra.ai/docs/server/mastra-client.md).

### **Create the learning workspace**

Two routes exist. The generator scaffolds a general-purpose agent with a workspace, shell tools, memory, task tracking, web access and recurring schedules, which is a lot to read on day one. For learning the primitives, start from the minimal manual setup and add pieces yourself.

```bash
mkdir mastra-lab
cd mastra-lab

npm init -y
npm pkg set type=module
npm install @mastra/core@latest zod@latest typescript@latest @types/node@latest mastra@latest
npm install --save-dev vitest
```

Use the generator later, when you want to compare your structure to the official one:

```bash
npm create mastra@latest
```

Add the provider key as an environment variable. Mastra reads the key for whichever provider appears in the model string: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GOOGLE_API_KEY`. Never commit keys.

Suggested environment variables:

```text
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
DATABASE_URL=...
```

Use one inexpensive, reliable model for early exercises. Later test at least two providers to see provider-specific differences, especially around structured output with tools.

### **First runnable agent**

Create `src/mastra/index.ts`:

```ts
// ── 1. First agent ──
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'

export const assistant = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'Answer clearly and keep responses concise.',
  // Format is provider/model. Pick a real id from https://mastra.ai/models
  model: 'openai/YOUR_MODEL',
})

export const mastra = new Mastra({ agents: { assistant } })
```

Create `run.ts`:

```ts
// ── 2. Run it ──
import { mastra } from './src/mastra/index.ts'

const agent = mastra.getAgentById('assistant')
const response = await agent.generate('Explain what an AI agent is in two sentences.')

console.log('Text:', response.text)
```

Run it with `node run.ts`. Then start Studio with `npx mastra dev`, open `localhost:4111`, and run the same agent there. The interactive REST documentation is at `localhost:4111/swagger-ui`.

Model strings use `provider/model`, never `provider:model`, and no provider object import. Counts of supported models differ between Mastra pages (the landing page says more than 1,000 models, the GitHub README says 40+ providers), so check the live [models directory](https://mastra.ai/models) instead of trusting a number.

---

## **How to choose the right architecture**

Mastra's own guidance is to start with one agent and add structure only when it improves quality, speed or reliability. This table prevents overengineering:

| Requirement | Prefer | Why |
|---|---|---|
| Open-ended task, steps unknown in advance | One `Agent` with tools | The agent decides which tools to call and when to stop |
| Process defined upfront, fixed order | Workflow | Explicit control, typed data flow, easy to audit |
| Mostly fixed process with reasoning at a few steps | Workflow with agent steps | Models where you need reasoning, plain functions elsewhere |
| Reusable tools shared across agents or other systems | `createTool` plus MCP | Separates the tool provider from the agent application |
| Specialist roles that adapt during the task | Supervisor agent with subagents | One lead agent delegates and synthesizes |
| Ownership should move between specialists | Handoff built from agents, workflows and memory | The next specialist continues directly |
| High-stakes or ambiguous question | Council: parallel agents then a synthesis step | Quality over speed and cost |
| Remember a conversation | Memory (message history, Observational Memory) | Thread-scoped recall |
| Shared organizational facts and policies | Knowledge (alpha) or RAG over a vector store | Lives outside any one conversation |
| Client may disconnect mid-run | Resumable streams on a registered agent | Reconnect and observe the same run |
| Run must survive a process crash | `createDurableAgent`, a workflow runner such as Inngest | Resumable streams are not crash recovery |
| Recurring work | Scheduled workflows or Harness schedules | Cron-based starts |
| Human approval before a risky action | Tool approval or workflow suspend | State is captured in a snapshot |

Multiple agents are not automatically better. Add them only when separate roles, context boundaries, models, guardrails or evaluation targets justify the extra latency, cost and failure modes.

---

# **3. The learning roadmap**

## **Phase 1: Core agent model and execution**

**Suggested time:** Week 1

**Build:** A command-line assistant with a clean execution boundary.

### **Learn**

1. What an agent is in Mastra: an LLM plus tools in a loop that continues until the model gives a final answer or a stop condition is met. When to use an agent and when to use a workflow instead.
2. The project shape: a `Mastra` instance in `src/mastra/index.ts` that registers agents, and how you retrieve them with `getAgent` and `getAgentById`.
3. `Agent` construction: `id`, `name`, `instructions`, `model`, then `tools` and `memory` later.
4. The model router: `provider/model` strings, provider environment variables, gateways, and where to find valid model ids.
5. Static instructions versus instructions resolved at runtime from `RequestContext`. Time-dependent values must be computed inside a callback, not at construction.
6. `generate()` versus `stream()`, and what the result exposes (`text`, `object`, `steps`, finish reason, usage on streams).
7. Step limits (`maxSteps`) and stop conditions.
8. The run lifecycle: a run, a loop iteration and a model step are three different things. Preparation, loop, finalization.
9. Default error processors that retry transient provider failures, and `maxProcessorRetries`.
10. Studio as a development loop: run the agent, switch models, change settings, read the trace.
11. How to read the docs: `.md` suffix, `llms.txt`, and the Reference section for exact signatures.

### **APIs and concepts to inspect**

- `Agent`, `Mastra`, `mastra.getAgent()`, `mastra.getAgentById()`
- `agent.generate()`, `agent.stream()`
- `RequestContext`
- `maxSteps`
- Error processors and `maxProcessorRetries`
- `npx mastra dev` and Studio

### **Project 1: CLI personal assistant**

Implement:

- A configurable model and instruction set read from environment configuration.
- A small command-line conversation loop using `stream()` and printing text as it arrives.
- Clear handling of provider and network errors that does not hide the underlying cause.
- Token usage reported after each run.
- Agent construction in one module and the CLI entry point in another.

**Acceptance criteria**

- The agent runs from a normal Node entry point and from Studio.
- Model and provider configuration live in one place.
- Errors are handled without swallowing the cause.
- Usage and the executed steps can be inspected.
- A Vitest test covers the CLI wrapper without a live model call.

**Do not move on until:** you can explain what happens from `agent.generate()` to the returned result, including how many model steps ran and why.

Primary reading: [Agents](https://mastra.ai/docs/agents/overview.md), [Agent lifecycle](https://mastra.ai/docs/guides/agent-lifecycle.md), [Models](https://mastra.ai/models.md), [Studio](https://mastra.ai/docs/studio/overview.md).

---

## **Phase 2: Structured output, validation and reliability**

**Suggested time:** Week 1 to 2

**Build:** A structured extraction service.

### **Learn**

1. Defining the output shape with `structuredOutput.schema` using Zod, Valibot, ArkType or plain JSON Schema.
2. The schema is input and the object is output: read the validated value from `response.object`.
3. Streaming structured output: `stream.object`, `stream.objectStream`, and the `object-result` chunk.
4. Required, optional, nullable and constrained fields. Represent unknown values explicitly instead of letting the model guess.
5. Enums, literals, unions and nested schemas.
6. The structuring model option: a second model turns the first model's natural language into the object. It costs another call and more latency, and it can improve accuracy on complex schemas.
7. Combining tools with structured output. Some models do not support both together. Know the three workarounds: `jsonPromptInjection`, a separate structuring `model`, or `prepareStep` to split the work.
8. `errorStrategy: 'fallback'` with a `fallbackValue`, and checking `response.usedFallbackValue`. A fallback value never went through the schema.
9. Separating syntactic validation (the schema) from business-rule validation (your code).
10. Output processors for post-generation checks.
11. Schema evolution and backwards compatibility.
12. Testing output contracts independently from model quality.

### **Project 2: Resume and job-fit analyzer**

Input: resume text plus a job description.

Return a validated object containing:

- Candidate profile.
- Skills and the evidence for each skill.
- Work experience and education.
- Required skills found and missing.
- Role-fit assessment with explicit criteria.
- Questions where the source document is ambiguous.
- Evidence snippets supporting important claims.

Add validation for score ranges, non-empty evidence and field consistency. Do not let the model invent missing candidate details.

**Acceptance criteria**

- Every successful run returns an object that matches the declared schema.
- A fallback result is distinguishable from a validated result.
- Business rules are tested without an LLM.
- The schema has tests and a documented versioning policy.
- You have tested the same schema against two providers and noted any difference.

Primary reading: [Structured output](https://mastra.ai/docs/agents/structured-output.md).

---

## **Phase 3: Tools, request context and the MCP client**

**Suggested time:** Week 2 to 3

**Build:** An agent that can safely interact with external services.

### **Learn**

1. `createTool` with `id`, `description`, `inputSchema`, `outputSchema` and `execute(inputData, context)`. The context carries `requestContext`, `tracingContext`, `abortSignal` and execution metadata.
2. Writing tool descriptions and schema names so the model chooses and calls tools correctly, and naming tools in the agent instructions.
3. Output validation: a result that fails `outputSchema` is replaced by a validation error and the model may retry. For tools whose side effects already happened, set `outputValidation: 'warn'` so a placed order is not retried.
4. Passing request-specific values (user, tenant, locale) through `RequestContext` instead of globals.
5. Dependency handling. Mastra has no typed dependency object like Pydantic AI's `deps`, so choose a pattern (factory functions that close over clients, or values set on `RequestContext`) and keep clients out of module-level globals inside `execute`.
6. Cancellation and timeouts with `abortSignal`.
7. Tool errors and retries, and idempotency for repeated tool calls.
8. Authorization inside the tool, not in the prompt.
9. Testing a tool directly: call `execute` in a unit test, or run `npx mastra api tool execute <tool-id> '<json>'` against a running `mastra dev` server.
10. The MCP client: `MCPClient` from `@mastra/mcp`, stdio and remote servers, `listTools()`, and generated types for stable servers.
11. Trust boundaries when using third-party MCP servers, and the MCP authentication and authorization guide.

### **Project 3: Research and operations assistant**

Give the agent tools to:

- Search a small internal knowledge source.
- Fetch a URL through a controlled fetcher with an allowlist.
- Query a read-only database.
- Save a research note.
- Retrieve a previously saved note.

Add permission checks in the tool layer. A prompt that says "do not modify data" is not an authorization system.

**Acceptance criteria**

- Tool schemas are typed and documented.
- Every tool is unit-tested without a model.
- External clients have an explicit lifecycle and are not created per call.
- Permission checks are enforced in code.
- Timeouts and failures produce controlled outcomes.
- One MCP server is connected and its tools are used by the agent.

Primary reading: [Tools](https://mastra.ai/docs/agents/tools.md), [MCP](https://mastra.ai/docs/connections/mcp.md), [Request context](https://mastra.ai/docs/server/request-context.md), [MCP authentication](https://mastra.ai/docs/guides/mcp-authentication-authorization.md).

---

## **Phase 4: Memory, storage and conversation state**

**Suggested time:** Week 3 to 4

**Build:** A multi-session assistant that remembers and resumes.

### **Learn**

1. Storage first. Memory, workflow snapshots, traces, scores, datasets, schedules and thread state all persist through storage adapters, organized in domains. The default in-memory store loses data when the process exits.
2. Choosing a backend by data shape: a transactional database for memory and workflows, an analytical store such as ClickHouse or DuckDB for high-volume observability, and composite storage to route domains to different backends.
3. The `Memory` class from `@mastra/memory` and the agent `memory` option.
4. Message history with `resource` (the user or entity) and `thread` (the conversation). A thread has an owner that cannot change after creation, so never reuse a thread id across owners.
5. Scopes as an alternative way to identify memory and to pass tenant information (`resource:user-123`, `thread:abc`, `org:acme`).
6. Working memory for persistent structured facts such as names and preferences.
7. Semantic recall and its cost.
8. Observational Memory: an Observer agent writes dated observations when unobserved messages pass a token threshold (30,000 by default), and a Reflector condenses them. It needs a supported storage adapter. Know why it keeps the context prefix stable for prompt caching.
9. Memory processors, and how they interact with your own processors. With memory on, memory loads history before your input processors, and your output processors run before memory saves. An output guardrail that aborts prevents the messages from being saved.
10. Multi-user threads.
11. Application-level ownership: derive the resource id from your auth layer, never from client input.
12. Data retention and deletion.
13. Conversation history versus long-term memory versus workflow state: three different things.

### **Project 4: Persistent support assistant**

Implement:

- User and conversation ids derived from authenticated identity.
- libSQL locally, then PostgreSQL.
- Conversation history retrieval and resumption after a process restart.
- Observational Memory turned on, with a long synthetic conversation to watch observations form in Studio.
- A bounded-history or compaction strategy you can explain.
- Tests proving one user's history cannot leak into another user's session.

**Acceptance criteria**

- A conversation survives application restart.
- A request resumes the correct thread for the correct user.
- History and observations are bounded and visible in the schema or Studio.
- Authorization is checked before any history is loaded.
- You can state which fact lives in message history, which in working memory, and which in the database.

Primary reading: [Memory](https://mastra.ai/docs/memory/overview.md), [Observational Memory](https://mastra.ai/docs/memory/observational-memory.md), [Working memory](https://mastra.ai/docs/memory/working-memory.md), [Storage](https://mastra.ai/docs/storage.md), [Context engineering](https://mastra.ai/docs/guides/context-engineering.md).

---