# **Mastra Memory System**

## **1. Running example: an agent that remembers**

**Learn box**

- Memory is keyed by two IDs: a **resource** (who owns it) and a **thread** (which conversation).
- Four layers stack on top of each other: message history, observational memory, working memory, semantic recall.
- Every call must pass the same `resource` and `thread` to see the same memory.

The smallest working setup, end to end:

```typescript
// ── 1. Storage on the Mastra instance ──
//    Memory needs a storage provider to persist anything.
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
})

// ── 2. An agent with memory ──
//    lastMessages keeps the most recent messages in context.
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'

export const memoryAgent = new Agent({
  id: 'memory-agent',
  name: 'Memory Agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-6-luna',
  memory: new Memory({
    options: { lastMessages: 20 },
  }),
})

// ── 3. Two calls on the same thread ──
//    The second call can answer only because the first was stored.
const ids = { resource: 'user-123', thread: 'conversation-123' }

await memoryAgent.generate('Remember my favorite color is blue.', { memory: ids })

const reply = await memoryAgent.generate("What's my favorite color?", { memory: ids })
console.log('Answer:', reply.text)
```

What happened, step by step:

1. The first call created thread `conversation-123` owned by resource `user-123` and saved both messages.
2. The second call loaded those saved messages into the context window before the model ran.
3. The model saw "favorite color is blue" in its context and answered from it.

Change either ID on the second call and the agent forgets. That is the whole mental model; everything below adds more ways to decide what gets loaded and how it is compressed.

## **2. Core concepts**

### **2.1 Thread and resource**

- A **thread** is one conversation session, a sequence of messages.
- A **resource** is the entity that owns the thread: a user, an organization, a project, a document.
- Studio generates both IDs for you. When you call `generate()` or `stream()` yourself, pass them explicitly.
- A thread has exactly one owner. The `resourceId` cannot change after creation, and reusing one thread ID under different owners causes errors on query.

### **2.2 The four memory layers**

| Layer | What it stores | Default state | Best for |
| --- | --- | --- | --- |
| Message history | Recent raw messages | On (last 10) | Short and medium conversations |
| Observational Memory (OM) | Dense dated observations that replace old raw messages | Off | Long threads, coding and browser agents (recommended) |
| Working memory | Structured facts about the user or task | Off | Names, preferences, goals that must always be visible |
| Semantic recall | Vector search over older messages | Off | Finding old details by meaning |

Multi-user threads are not a layer. They are a pattern for sharing one thread between people (section 10).

### **2.3 What the model actually sees**

Memory adds context in two places:

- **System messages:** agent instructions, working memory, cross-thread semantic recall matches, and the OM log (reflections and observations).
- **Conversation messages:** message history and same-thread semantic recall matches (interleaved by timestamp), then call-time `context` messages, then your new message last.

Details that matter:

- Conversation messages are ordered by timestamp and deduplicated by message ID, so recalled older messages appear before recent history.
- Messages in the `context` array of a call (for example `agent.generate(msg, { context: [...] })`) are one-off background such as app state or your own RAG results. They are stamped with the current time and never saved to memory.
- Under OM, only messages not yet observed stay in the conversation. A short continuation reminder sits at the start of the conversation messages.

## **3. Setup**

### **3.1 Install**

```bash
# ── Install memory and a storage adapter ──
#    libsql stores data in a local file, good for learning.
npm install @mastra/memory@latest @mastra/libsql@latest
```

### **3.2 Storage rules**

- Memory requires a storage provider. Add it to the main `Mastra` instance to enable memory across all agents, or pass `storage` to a `Memory` or `Agent`.
- Add an `id` to `LibSQLStore`. Use `url: ':memory:'` for throwaway runs and `url: 'file:./mastra.db'` to persist.
- Each layer has its own adapter support:
  - OM: `@mastra/libsql`, `@mastra/pg`, `@mastra/mysql`, `@mastra/mongodb`, `@mastra/convex`, `@mastra/oracledb`, `@mastra/mssql`. With any other adapter OM turns off without a warning.
  - Resource-scoped working memory: libSQL, PostgreSQL, OracleDB, Upstash, MongoDB (needs the `mastra_resources` table).
  - Semantic recall with `scope: 'resource'`: LibSQL, OracleDB, PostgreSQL, MongoDB, Upstash.

### **3.3 Identifying memory: `memory` object or `scopes`**

The usual way:

```typescript
// ── Memory object ──
//    resource: stable user or entity. thread: one conversation.
await memoryAgent.generate('Hello', {
  memory: { resource: 'user-123', thread: 'conversation-123' },
})
```

The alternative is **scopes**: addresses a run acts as, written `<type>:<value>`. Memory reads the resource from a `resource:` scope and the thread from a `thread:` scope. Other scopes such as `org:acme` go to tools and processors.

```typescript
// ── Scopes ──
//    Same identity, expressed as scopes.
await memoryAgent.generate('Remember my favorite color is blue.', {
  scopes: ['org:acme', 'resource:user-123', 'thread:conversation-123'],
})
```

Rules for scopes:

- Scopes can come from the call, the request context, and the agent. Call and request context scopes arrive first; the agent's `scopes` option then adds a list or a function that returns the final set.
- The resolver's inputs must come from the server (auth middleware), not the client. Request bodies can fill unreserved request context keys, so never trust them for identity. Trusted middleware can set scopes with the `MASTRA_SCOPES_KEY` request context key. Clients cannot send scopes in a body.
- You can mix scopes with `memory.resource`, `memory.thread`, or the request context keys, as long as they agree. A conflicting `resource:` or `thread:` value throws. A `scopes` function must return every `resource:` and `thread:` scope it receives.
- Tools, processors, and subagents receive the other scopes but not `resource:` and `thread:`. Each nested agent call picks its own resource and thread.

## **4. Message history**

Message history is the base layer: a view of recent messages in the context window.

### **4.1 How it loads**

- Threads and messages are created automatically on `generate()` and `stream()`. You can also create them manually with `createThread()` and `saveMessages()`.
- The default window is the last 10 messages. Change it with `lastMessages`.
- `lastMessages` counts every stored message, including tool calls, tool results, and signals, so one turn can add several.
- The window slides every turn once the thread passes the limit. The start of the prompt changes and invalidates the provider prompt cache. For long conversations use OM, which keeps the prefix stable.

```typescript
// ── Thread with title and metadata ──
//    Metadata is useful for filtering threads later.
await agent.generate('Hello', {
  memory: {
    thread: {
      id: 'thread-123',
      title: 'Support conversation',
      metadata: { category: 'billing' },
    },
    resource: 'user-456',
  },
})
```

### **4.2 Sending messages from a client**

- Send only the new message. Mastra loads previous messages from storage.
- If a client echoes the whole history, `MemoryInputFilter` trims it. When message IDs match, the stored copy is the base, which keeps stored timestamps and provider metadata and retains new tool results.
- If you assemble the input yourself and need it processed exactly as sent, set `retainFullInput: true` in `memory.options` for that call, or in the constructor for the whole agent. This disables input filtering while stored history still loads, and every input message not already stored is saved, including few-shot examples.

### **4.3 Limit history by tokens**

Message count is a poor proxy for context size, because a tool result can be a few tokens or thousands.

```typescript
// ── Token budget for history ──
//    Trim in chunks so the prompt prefix stays stable across turns.
memory: new Memory({
  options: {
    messageHistory: { maxTokens: 8_000, atMaxRemoveTokens: 2_000 },
  },
})
```

How it works:

1. Mastra counts the complete prompt against `maxTokens`: history, system instructions, context, and the current turn.
2. When over budget, it removes the oldest remembered messages until the prompt is at most `maxTokens - atMaxRemoveTokens`.
3. `atMaxRemoveTokens` defaults to 25% of `maxTokens`. Chunked removal keeps the prefix stable and prompt caches warm.
4. System messages, context, the current input, and agent responses are never trimmed. Linked tool calls and results are removed together.
5. Trimmed messages stay in storage. A per-thread boundary excludes them from later turns.
6. Setting `messageHistory` without `lastMessages` disables the default 10-message cap. Set both to combine a count cap with a token budget. `maxTokens: 0` disables message history.

### **4.4 Thread title generation**

```typescript
// ── Titles ──
//    Use a smaller model and custom instructions to save cost.
memory: new Memory({
  options: {
    generateTitle: {
      model: 'openai/gpt-6-luna',
      instructions: 'Generate a one-word title.',
      emitEvent: true,
    },
  },
})
```

- `generateTitle: true` runs asynchronously after the response and does not affect response time.
- `emitEvent: true` makes the stream wait for the title and emit a transient `data-thread-title` chunk before `finish`, so a UI can rename a sidebar entry without polling. It delays `finish` on the turn that generates the title.
- `emitEvent` applies to `stream()` only. `generate()` and durable or evented agents do not emit the chunk, though the title is still generated and saved.
- Subagent threads created by delegation do not get titles unless the subagent has its own memory configuration.

### **4.5 Querying**

Get the memory instance first:

```typescript
// ── Access memory ──
//    Needed for querying, cloning, and deleting.
const agent = mastra.getAgentById('test-agent')
const memory = await agent.getMemory()
```

The memory system does not enforce access control. Verify in your own code that the current user may read the `resourceId` before querying.

```typescript
// ── 1. Threads ──
//    Filter by resource and metadata, paginate, sort.
const result = await memory.listThreads({
  filter: { resourceId: 'user-123', metadata: { status: 'active' } },
  orderBy: { field: 'createdAt', direction: 'DESC' },
  page: 0,
  perPage: 10,
})
console.log('Threads:', result.threads)
console.log('Has more:', result.hasMore)

// ── 2. One thread ──
const thread = await memory.getThreadById({ threadId: 'thread-123' })

// ── 3. Messages ──
//    perPage false returns everything. Date and metadata filters supported.
const { messages } = await memory.recall({
  threadId: 'thread-123',
  perPage: false,
  filter: {
    dateRange: { start: new Date('2025-01-01'), end: new Date('2025-06-01') },
    metadata: { category: 'billing', escalated: true, priority: 2, archivedAt: null },
  },
})

// ── 4. Specific messages with context ──
const around = await memory.recall({
  threadId: 'thread-123',
  include: [
    { id: 'msg-123' },
    { id: 'msg-456', withPreviousMessages: 3, withNextMessages: 1 },
  ],
})
```

Facts about `recall()`:

- Returns `MastraDBMessage[]`. Convert for your UI, for example with `toAISdkV5Messages`.
- Hides reminder signals by default. Pass `hideSignals: false` to include them, `true` to hide all recognized signals, or an array to omit selected types.
- Metadata filters match shallow scalar values only (`string`, finite `number`, `boolean`, `null`). All keys use AND semantics. A `null` filter matches only an explicit `null`; a missing key does not match.
- Metadata keys must start with a letter or underscore, use only alphanumerics, be 128 characters or fewer, and avoid reserved keys such as `__proto__`, `constructor`, `prototype`.
- Performance depends on the backend. Some push filters into the database, others scan candidates after thread, resource, and date constraints but before pagination.
- With `vectorSearchString` and `threadConfig: { semanticRecall: true }` it does semantic search (section 7).

### **4.6 Cloning, copying, deleting**

```typescript
// ── Branch a conversation ──
//    Useful for checkpoints or testing variations.
const { thread, clonedMessages } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  title: 'Branched conversation',
})
```

- `cloneThread()` supports filtering cloned messages by count or date range and custom thread IDs. Clone utilities inspect relationships.
- `copyThread()` never returns message payloads. On LibSQL and PostgreSQL the rows are copied inside the database. With semantic recall on, copied messages are still read back in batches to generate embeddings. Use it to fork long threads.
- `deleteMessages()` removes messages by ID or clears a thread.

## **5. Observational Memory**

Observational Memory (OM) added in `@mastra/memory@1.1.0`. It lets an agent work in one thread for as long as the task takes, with a small, focused, cache-friendly context.

### **5.1 The two background agents**

- **Observer:** turns older messages into short dated observations.
- **Reflector:** condenses the observation log when it grows.

The agent then sees three layers: recent messages (exact), observations (since the last reflection), and reflections (condensed older history).

### **5.2 Quickstart**

```typescript
// ── Enable OM ──
//    Needs supported storage, a thread on every call, and the flag.
import { Agent } from '@mastra/core/agent'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const memory = new Memory({
  storage: new LibSQLStore({ id: 'memory-storage', url: 'file:./memory.db' }),
  options: { observationalMemory: true },
})

const agent = new Agent({
  id: 'memory-agent',
  name: 'Memory Agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-6-luna',
  memory,
})
```

Nothing is observed in a short exchange. Once unobserved history passes 30,000 tokens, OM starts replacing older messages with observations. To watch it, open the **Memory** tab of the agent in Studio, where progress bars show the thresholds and **Analyze observations** opens the log.

### **5.3 What observations look like**

```md
Date: 2026-01-15

- 🔴 12:10 User is building a Next.js app with Supabase auth, due in 1 week (meaning January 22nd 2026)
  - 🔴 12:10 App uses server components with client-side hydration
  - 🟡 12:12 User asked about middleware configuration for protected routes
  - 🔴 12:15 User stated the app name is "Acme Dashboard"
```

- Observed messages leave the context and observations replace them, typically 5 to 40 times smaller. A browser agent that sees 50,000 tokens per page snapshot ends up carrying a few hundred tokens about what it saw and did.
- During synchronous observation the Observer also records a **current task** and a **suggested response** so the agent can pick up where it left off. With `observation.threadTitle` enabled it can suggest a new thread title when the topic changes.
- The Observer sees attachments. The transcript keeps placeholders such as `[Image #1: reference-board.png]` and the attachments are forwarded beside the text.

### **5.4 The context cycle with default settings**

1. **0 to 30,000 tokens:** message history grows. In the background the Observer prepares observations about every 6,000 tokens (`observation.bufferTokens: 0.2`).
2. **30,000 reached:** prepared observations activate. About 6,000 tokens of recent messages stay (`observation.bufferActivation: 0.8` clears 80%).
3. **Repeat:** history grows back toward 30,000 and shrinks again. Each cycle adds a little to the log.
4. **Observations reach 40,000:** the Reflector rewrites the log into a smaller one. The log stays near the reflection threshold however long the thread runs.

Thresholds mark when work starts. History can run past 30,000 when background observation falls behind. At `observation.blockAfter` (default `1.2`, which is 36,000 tokens) the agent waits for a synchronous observation. Token counts are local `tokenx` estimates; the provider's count is often higher, especially with attachments.

### **5.5 Settings that matter**

| Setting | Default | Meaning |
| --- | --- | --- |
| `observation.messageTokens` | 30,000 | Unobserved message tokens before observing |
| `reflection.observationTokens` | 40,000 | Log size before reflecting |
| `observation.bufferTokens` | 0.2 | Background observation interval as a fraction of `messageTokens`, or an absolute count such as `5000`. `false` turns buffering off |
| `observation.bufferActivation` | 0.8 | Share of the message window cleared on activation |
| `observation.blockAfter` | 1.2 | When to wait for synchronous observation. Fraction of `messageTokens`, or an absolute count of 100 or more. `1` observes synchronously at `messageTokens` |
| `observation.observeOnContextOverflow` | true | Recover when the provider rejects a request for being too large |
| `observation.observeAttachments` | `['image/*', 'application/pdf']` | Which attachments the Observer receives |
| `activateAfterIdle` | unset | Activate prepared observations after an idle period (see 5.8) |
| `retrieval` | off | Gives the agent a `recall` tool (see 5.9) |

```typescript
// ── Change thresholds ──
//    bufferTokens, bufferActivation, blockAfter scale with messageTokens.
const memory = new Memory({
  options: {
    observationalMemory: {
      observation: { messageTokens: 30_000 },
      reflection: { observationTokens: 40_000 },
    },
  },
})
```

### **5.6 Choosing models**

The Observer and Reflector are model calls that run beside the agent. The default `model: 'auto'` resolves each time a role runs:

1. `google/gemini-2.5-flash` when Google is usable (`GOOGLE_GENERATIVE_AI_API_KEY` set, or `canUseProvider` returns true for `'google'`).
2. Otherwise a low-cost model from the main model's provider, such as `anthropic/claude-haiku-4-5` for an Anthropic agent.
3. Otherwise the main model itself. This also happens when the main model has a custom URL, key, or gateway, because a sibling model is not known to share that route.

Use a model with a 128,000 token or larger context window that is fast enough for background work. Mastra has tested `google/gemini-2.5-flash`, `openai/gpt-6-luna`, `anthropic/claude-haiku-5.5`, and `deepseek/deepseek-flash`.

```typescript
// ── One model for both roles ──
const memory = new Memory({
  options: {
    observationalMemory: { model: 'deepseek/deepseek-flash' },
  },
})
```

- For different models per role, set `observation.model` and `reflection.model` and leave the top-level `model` out. Setting both throws.
- Some models keep so much detail that reflections stay above the threshold. `google/gemini-2.5-flash` did this in testing. A common split is a detail-preserving Observer with a Reflector that condenses harder, such as `deepseek/deepseek-flash`.
- Tune `auto` with `autoModels` (replace the low-cost pick per provider), `canUseProvider` (per-tenant credentials), and `resolveModel` (build the model with your own routing; it never receives `'auto'`). `resolveAutoModelId(mainModelId, { autoModels })` shows what `auto` would pick.

Token-tiered models (added in `@mastra/memory@1.10.0`) choose a model by the size of each call:

```typescript
// ── Pick a model by input size ──
//    Each upTo key is an inclusive bound. A call above the biggest key throws.
import { Memory, ModelByInputTokens } from '@mastra/memory'

const memory = new Memory({
  options: {
    observationalMemory: {
      observation: {
        model: new ModelByInputTokens({
          upTo: {
            5_000: 'openrouter/mistralai/ministral-8b-2512',
            20_000: 'openrouter/mistralai/mistral-small-2603',
            40_000: 'openai/gpt-6-luna',
            1_000_000: 'google/gemini-3.8-flash',
          },
        }),
      },
    },
  },
})
```

Each tier needs a concrete model ID, never `'auto'`.

For a text-only Observer, control attachments with `observation.observeAttachments`: `false` sends none, `true` sends all, a MIME list such as `['image/*']` sends matches (case-insensitive, `*` matches any subtype), and `'auto'` sends them when the provider registry says the model accepts multimodal input (everything is sent if there is no data). The same filter applies to images and files inside tool results. Attachments recorded as unavailable are never sent.

### **5.7 Cost and latency**

- With defaults a thread costs one Observer call per about 6,000 new tokens and one Reflector call each time the log reaches 40,000.
- In return every main-agent call reads a context of at most a few tens of thousands of tokens, and the stable observation prefix keeps prompt caching working. Users report 97 to 99% cache hit rates.
- For long chains of tool calls (coding and browser agents), raise `observation.messageTokens` to 60,000 to 80,000 so OM compresses less often and more of each run stays cached. Keep it within the main model's context window.
- **Synchronous mode:** `observation.bufferTokens: false` turns off background buffering for observations and reflections, and the agent pauses while each runs.
- `shareTokenBudget: true` lets history borrow the unused observation budget, keeping up to about 70,000 message tokens before observing while the log is small. It requires `observation.bufferTokens: false`.

### **5.8 Idle activation**

Once the provider's prompt cache expires, the next request pays full price anyway. `activateAfterIdle` activates prepared observations after a thread has been idle that long, so the next request sends a smaller context.

```typescript
// ── Activate after the cache expires ──
//    'auto' uses the provider's TTL, such as 5 minutes for Anthropic.
const memory = new Memory({
  options: {
    observationalMemory: { activateAfterIdle: 'auto' },
  },
})
```

### **5.9 Thread scope, retrieval mode, and the deprecated resource scope**

**Thread scope (default).** Each thread has its own observations. Every call needs a thread; without one OM throws `OBSERVATIONAL_MEMORY_THREAD_ID_REQUIRED`.

**Retrieval mode.** Observations drop original wording. Retrieval keeps each observation group linked to its source messages and gives the agent a `recall` tool to read them back, including exact wording and tool output.

- `retrieval: true` lets the agent browse raw messages, list the resource's threads, and read other threads. No vector store needed.
- `retrieval: { vector: true }` adds semantic search over observation groups using the vector store and embedder on `Memory`. New groups are indexed in the background. The search matches observation groups, not raw messages, so a detail the summary dropped may not turn up, and each hit links back to its messages.
- The tool's scope is `'resource'` by default. Use `retrieval: { scope: 'thread' }` to limit it to the current thread, and `retrieval.instructions` to add app guidance.

```typescript
// ── Retrieval with vector search ──
const memory = new Memory({
  storage,
  vector: myVectorStore,
  embedder: myEmbedder,
  options: {
    observationalMemory: { retrieval: { vector: true } },
  },
})
```

**Resource scope (deprecated).** `scope: 'resource'` shares one observation record across all of a resource's threads and will be removed. It breaks prompt caching (observing one thread changes the context of the others), confuses the agent (it may continue work another thread started), is slow for users with many threads, and turns off async buffering. Remove the `scope` option and use retrieval mode. Switching does not migrate old records: each thread uses its own thread-scoped record or starts empty, and already observed messages are not observed again.

### **5.10 Extractors**

Extractors persist specific values alongside observations. Current task, suggested response, and thread title use the same pipeline.

```typescript
// ── A user profile extractor ──
//    A schema makes it a follow-up structured-output request.
import { Extractor, Memory } from '@mastra/memory'
import { z } from 'zod'

const memory = new Memory({
  options: {
    observationalMemory: {
      observation: {
        extract: [
          new Extractor({
            name: 'User profile',
            instructions: 'Extract stable user profile facts that should be remembered.',
            schema: z.object({
              preferredName: z.string().optional(),
              timezone: z.string().optional(),
              tools: z.array(z.string()).optional(),
            }),
          }),
        ],
      },
    },
  },
})
```

- Without a `schema` it is an inline string extractor emitted directly in the Observer or Reflector response.
- By default the extractor sees its previous value. Set `includePreviousExtraction: false` to hide it.
- `instructions` and `schema` can be functions of runtime context (memory instance, request context).
- `onExtracted` normalizes a value before it is saved, and receives `previous` and `sendSignal`. It runs on every extraction, so compare `previous` with `current` before sending a signal or every observation sends another.
- A failed extractor is reported in OM markers and does not drop values from extractors that succeeded.

Read results from a stream:

```typescript
// ── Read extracted values ──
//    Both chunk types carry extractedValues keyed by extractor slug.
const stream = await assistant.stream('Remember that I prefer dark mode.', {
  memory: { resource: 'user-123', thread: 'conversation-123' },
})

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'data-om-observation-end' || chunk.type === 'data-om-buffering-end') {
    const { operationType, extractedValues = {}, extractionFailures = [] } = chunk.data

    for (const [slug, value] of Object.entries(extractedValues)) {
      console.log(`${operationType} extractor ${slug}:`, value)
    }
    for (const failure of extractionFailures) {
      console.error(`Extractor ${failure.slug} failed:`, failure.error)
    }
  }
}
```

`data-om-observation-end` reports a synchronous completion. `data-om-buffering-end` reports finished background work: values persist at once but the buffered observations stay inactive until activation.

### **5.11 Gateway models**

- Mastra Gateway handles model access only. With a Gateway key (`msk-gateway-...` or `mskv2_...`) OM runs locally against your configured storage, same as any other model.
- Keys starting `msk_` belong to the previous Memory Gateway, which shuts down on December 31, 2026. With an `msk_` key Mastra skips local OM for `mastra/` models. Memory Gateway runs OM server-side only when it serves the request with its own provider keys and memory is enabled for the project. Your storage still gets the thread record but not its messages or observations, so `memory.recall()` returns none.
- If an `msk_` request uses your own provider key or memory is disabled for the project, nobody stores the conversation. Move to a Gateway key or a directly configured provider model.

### **5.12 Context-overflow recovery**

When a provider rejects a request as too large before OM's estimate hits the threshold, OM activates prepared observations, observes everything pending, and retries once with the smaller context. It skips read-only requests and retries only when it observed or activated something. Set `observeOnContextOverflow: false` to let the error reach your code instead.

## **6. Working memory**

Working memory is the agent's active scratchpad: a small block of Markdown (or JSON) it keeps current about the user or task, always injected into context.

### **6.1 Quickstart and scope**

```typescript
// ── Enable working memory ──
//    Template guides what the agent tracks.
const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# User Profile
- **Name**:
- **Location**:
- **Interests**:
- **Preferences**:
- **Long-term Goals**:
`,
    },
  },
})
```

- **Resource scope (default):** persists across all threads of the same user. Pass `resource` on every call.
- **Thread scope:** isolated per conversation. Good for temporary or session-specific information and for ephemeral, unrelated threads.
- Switching scopes means the agent no longer sees the other scope's memory.
- If you use OM, `observationalMemory.observation.manageWorkingMemory` lets OM update working memory for the agent.

### **6.2 Template or schema**

You may set `template` or `schema`, never both. If you set neither, Mastra uses a default template.

| | Template (Markdown) | Schema (JSON) |
| --- | --- | --- |
| Update style | Replace: agent must send the full content each time | Merge: agent sends only changed fields |
| Best for | Free-form profile or scratchpad | Typed, validated, programmatic data |
| Schema libraries | not applicable | Any Standard JSON Schema: Zod v3 or v4, Valibot, ArkType, JSON Schema |

Merge semantics for schemas:

- Objects are deep merged. Only provided fields change.
- Setting a field to `null` deletes it.
- Arrays are replaced entirely, never merged element by element.

```typescript
// ── Schema-based working memory ──
//    Do not also set template.
import { z } from 'zod'

const userProfileSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  preferences: z
    .object({
      communicationStyle: z.string().optional(),
      projectGoal: z.string().optional(),
      deadlines: z.array(z.string()).optional(),
    })
    .optional(),
})

const memory = new Memory({
  options: {
    workingMemory: { enabled: true, schema: userProfileSchema },
  },
})
```

Concurrent updates: with `scope: 'resource'` and an adapter that supports atomic merges (currently `@mastra/pg`), each merge runs in a row-locked transaction, so concurrent updates to different fields from separate processes are all kept. Other adapters merge in the application, which only serializes writers inside one process. From your own code:

```typescript
// ── Merge from code ──
//    Throws unless schema-based, resource-scoped, and the adapter supports it.
await memory.mergeWorkingMemory({
  threadId: 'thread-1',
  resourceId: 'user-123',
  workingMemory: { preferences: { tone: 'formal' } },
})

// Check first if you need a fallback.
const atomic = await memory.supportsAtomicWorkingMemoryMerge()
console.log('Atomic merge:', atomic)
```

### **6.3 Designing good templates**

- Short, focused labels (`## Personal Info`, `- Name:`), so updates are readable and not truncated.
- Consistent casing across headings and labels.
- Minimal placeholder text such as `[e.g., Formal]` or `[Date]`.
- Abbreviate long values with guidance like `- Name: [First name or nickname]`.
- Put update rules in the agent's `instructions` if it is not updating memory when you expect.
- Short alternatives exist: a one-block fact list or a short narrative paragraph.

### **6.4 Setting and updating it yourself**

```typescript
// ── 1. Initial value through thread metadata ──
const thread = await memory.createThread({
  threadId: 'thread-123',
  resourceId: 'user-456',
  title: 'Medical Consultation',
  metadata: {
    workingMemory: `# Patient Profile
- Name: John Doe
- Allergies: Penicillin
`,
  },
})

// ── 2. Update through the thread ──
await memory.updateThread({
  id: 'thread-123',
  title: thread.title,
  metadata: { ...thread.metadata, workingMemory: '# Patient Profile\n- Name: John Doe' },
})

// ── 3. Direct update ──
//    resourceId is required for resource-scoped memory.
await memory.updateWorkingMemory({
  threadId: 'thread-123',
  resourceId: 'user-456',
  workingMemory: 'Updated memory content...',
})
```

### **6.5 Read-only, custom instruction, state signals**

- **Read-only:** pass `memory.options.readOnly: true` on a call to provide working memory without letting the agent change it. Good for routing agents and subagents that reference but do not own the profile.
- **Custom instruction:** extend `Memory` and override `getWorkingMemoryToolInstruction({ template, data })`. Other hooks: `getReadOnlyWorkingMemoryInstruction()` (for `readOnly: true` or `agentManaged: false`) and `__experimental_getWorkingMemoryToolInstructionVNext()` (for `version: 'vnext'`). A custom `MastraMemory` can override `getWorkingMemoryInstruction()` and return `undefined` to keep the built-in text. If you add a `WorkingMemory` processor yourself, pass `instructionProvider: memory` or overrides do not apply.
- **State signals (experimental):** `useStateSignals: true` delivers working memory as a `state` signal (`stateId: 'working-memory'`) instead of in the system message. Storage is identical, the tool is renamed `setWorkingMemory`, identical snapshots are deduplicated by `cacheKey`, and older snapshots are re-injected when they roll out of the window. Not supported with template `version: 'vnext'`. OM's `manageWorkingMemory` turns it on by default, and then the instruction overrides are not called.

## **7. Semantic recall**

Semantic recall is built-in RAG over earlier messages: it embeds the new message, searches a vector store for similar older messages, and adds the best matches to context. It finds "Let's give them their money back" when the user later asks "What did we decide about the refund?".

### **7.1 Setup**

Disabled by default. Enable it with a `vector` store and an `embedder`.

```typescript
// ── Semantic recall with LibSQL ──
//    Storage, vector store, and embedder are three separate pieces.
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore, LibSQLVector } from '@mastra/libsql'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'

const agent = new Agent({
  id: 'support-agent',
  name: 'SupportAgent',
  instructions: 'You are a helpful support agent.',
  model: 'openai/gpt-6.1-sol',
  memory: new Memory({
    storage: new LibSQLStore({ id: 'agent-storage', url: 'file:./local.db' }),
    vector: new LibSQLVector({ id: 'agent-vector', url: 'file:./local.db' }),
    embedder: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
    options: { semanticRecall: true },
  }),
})
```

- Flow: new messages query the vector DB; after the model responds, all new messages (user, assistant, tool calls and results) are embedded and inserted for later.
- Supported vector stores: Astra, Chroma, Cloudflare Vectorize, Convex, Couchbase, DuckDB, Elasticsearch, LanceDB, libSQL, MongoDB, OpenSearch, OracleDB, Pinecone, PostgreSQL, Qdrant, S3 Vectors, Turbopuffer, Upstash.
- Every call adds latency (embedding plus a vector query). Keep it off for realtime audio and other latency-sensitive apps, or when message history already gives enough context.

### **7.2 Recall configuration**

```typescript
// ── Recall options ──
//    topK matches, messageRange neighbors, scope, metadata filter.
memory: new Memory({
  options: {
    semanticRecall: {
      topK: 3,
      messageRange: 2,
      scope: 'resource',
      filter: {
        $and: [{ projectId: { $eq: 'project-a' } }, { priority: { $gte: 3 } }],
      },
    },
  },
})
```

- `topK`: how many similar messages to retrieve.
- `messageRange`: surrounding messages included with each match.
- `scope`: current thread or all threads of the resource.
- `filter`: restricts results by thread metadata. Operators: `$and`, `$or`, `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`.
- Filters match the metadata stored on embeddings at save time. If thread metadata changes later, old embeddings keep the old metadata until re-saved or re-indexed. Messages saved by older versions do not match a filter until re-saved.
- Matches from the current thread arrive as regular messages interleaved by timestamp. Matches from other threads are formatted into a system message.

### **7.3 Long messages**

- Memory splits long messages into chunks, one vector row each. `maxChunkChars` sets the largest chunk (default 16,384 characters, about 4,096 English tokens, which fits `openai/text-embedding-3-small` and its 8,191 token limit).
- The limit is in characters because each provider tokenizes differently. Lower it for CJK text and code, which use more tokens per character.
- If you do not set it and the embedder declares an input limit, Memory derives the size from that limit. FastEmbed models declare 512 tokens, so they need no configuration.
- Chunk row IDs derive from the message ID, so re-saving replaces rows. If you re-save shorter text with `saveMessages()`, rows past the new end stay searchable until you use `updateMessages()` or delete the message.
- Set `maxChunkChars` on the `Memory` constructor. Per-request options cannot change it.

### **7.4 Embedders**

- **Model router (recommended):** `new ModelRouterEmbeddingModel('openai/text-embedding-3-small')`. Supported: OpenAI (`text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`), Google (`gemini-embedding-001`), and OpenRouter. API keys come from `OPENAI_API_KEY`, `GOOGLE_API_KEY` (Google also falls back to `GOOGLE_GENERATIVE_AI_API_KEY`), `OPENROUTER_API_KEY`.
- **FastEmbed (local):** `npm install @mastra/fastembed@latest`, then `embedder: fastembed`. Runs on server CPU with a 512 token (about 2,000 to 2,500 English characters) limit per input; longer text is truncated. Set `MASTRA_FASTEMBED_THREADS=2` to cap threads per model when the CPU limit is not visible to the process.
- **Multilingual E5:** `fastembed.multilingualE5LargePassage` for indexing, `multilingualE5LargeQuery` for search. Memory uses one embedder for both storing and recalling, so pick one and use it consistently; use the query model only where you control both sides, such as a RAG workflow. It outputs 1024-dimensional vectors, so the index must match and cannot mix with other embedders.
- **Server-side embeddings:** some stores embed for you. MongoDB with Automated Embedding needs no `embedder`: `autoEmbed: { model: 'voyage-4' }` on `MongoDBVector`. Embedding runs in the background, so a message saved moments ago may not be recallable at once. Every other store requires an `embedder`; with neither you get an error naming both options.
- **Embedding dimension:** Memory probes the dimension once per instance with a short embedding. Set `embeddingDimension: 1536` to skip the probe. A wrong value throws `MASTRA_MEMORY_EMBEDDING_DIMENSION_MISMATCH` before any index is created or queried. Update it whenever you change the embedding model.

### **7.5 PostgreSQL index tuning**

Semantic recall always filters by thread or resource. PgVector uses the vector index for these only with HNSW on pgvector 0.8.0 or newer. With IVFFlat (the default) each search compares against every message in the thread or resource.

```typescript
// ── HNSW for pgvector ──
//    dotproduct suits OpenAI embeddings.
options: {
  semanticRecall: {
    topK: 5,
    messageRange: 2,
    indexConfig: {
      type: 'hnsw',
      metric: 'dotproduct',
      hnsw: { m: 16, efConstruction: 64 },
    },
  },
}
```

### **7.6 Manual recall by meaning**

```typescript
// ── recall() with vectorSearchString ──
const { messages: relevant } = await memory.recall({
  threadId: 'thread-123',
  vectorSearchString: 'What did we discuss about the project deadline?',
  threadConfig: { semanticRecall: true },
})
```

With tracing on, recalled messages appear in the trace beside recent history.

## **8. Memory processors**

Memory processors transform and filter messages as they pass through an agent. Mastra adds them automatically when memory is enabled.

### **8.1 The built-in processors**

| Processor | Added when | Input does | Output does |
| --- | --- | --- | --- |
| `MemoryInputFilter` | A store is available and stored history will load | Trims client-echoed history; existing thread keeps only the current user turn or new tool results; empty thread keeps full input and strips provider item metadata from assistant parts | None |
| `MessageHistory` | `lastMessages` configured | Fetches last N messages | Persists new messages |
| `SemanticRecall` | Semantic recall configured | Vector search and prepend | Embeds and stores new messages |
| `WorkingMemory` | Working memory enabled | Prepends state for the thread | None |

- `retainFullInput: true` makes `MemoryInputFilter` skip both the trim and the metadata strip.
- `MemoryInputFilter` runs first so the other processors receive only the new input they need.
- `lastMessages` does nothing under OM because OM replaces raw history itself and the `MessageHistory` processor is skipped.

### **8.2 Manual control**

If you add a memory processor to `inputProcessors` or `outputProcessors` yourself, Mastra does not add its own. That gives you full control of ordering.

```typescript
// ── Custom MessageHistory plus a token limiter ──
//    Your instance replaces the automatic one.
import { MessageHistory, TokenLimiter } from '@mastra/core/processors'

const customHistory = new MessageHistory({
  storage: new LibSQLStore({ id: 'memory-store', url: 'file:memory.db' }),
  lastMessages: 20,
})

const agent = new Agent({
  name: 'custom-memory-agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-6.1-sol',
  memory: new Memory({
    storage: new LibSQLStore({ id: 'memory-store', url: 'file:memory.db' }),
    options: { lastMessages: 10 },
  }),
  inputProcessors: [customHistory, new TokenLimiter({ limit: 4000 })],
})
```

When writing custom processors, do not mutate the input `messages` array or its objects.

### **8.3 Execution order and guardrails**

- **Input:** memory processors run first (`MemoryInputFilter`, then `WorkingMemory`, `MessageHistory`, `SemanticRecall`), then your `inputProcessors`. Memory loads history before your guardrails can validate input.
- **Output:** your `outputProcessors` run first, then memory processors (`SemanticRecall` embeddings, then `MessageHistory` persistence).

| Guardrail | Runs | If it calls `abort()` |
| --- | --- | --- |
| Input | After memory loads history | LLM not called, nothing saved |
| Output | Before memory saves | Nothing saved |

So a blocked response is never persisted to memory.

### **8.4 Aborted runs**

| What stops the run | Memory processors | Persisted |
| --- | --- | --- |
| `abortSignal` from the caller | Still run | The user message and the assistant text the user already saw |
| `abort()` inside a processor | Skipped | Nothing |

A caller cancellation stores the partial answer as an ordinary assistant message with no error part, so the next turn starts from what the user actually read. `onAbort` receives the completed steps and the text streamed for the in-flight step.

```typescript
// ── Cancel a stream ──
//    The partial answer is saved to the thread.
const controller = new AbortController()
const stream = await agent.stream('Write the migration guide.', {
  memory: { thread: 'thread-1', resource: 'user-1' },
  abortSignal: controller.signal,
  onAbort: ({ steps, text }) => {
    console.log(`Aborted after steps: ${steps.length}, characters: ${text?.length ?? 0}`)
  },
})

let streamed = ''
for await (const chunk of stream.fullStream) {
  if (chunk.type !== 'text-delta') continue
  streamed += chunk.payload.text
  if (streamed.length > 200) controller.abort()
}
```

### **8.5 Large attachments**

Some stores limit record size, which base64 attachments can exceed: DynamoDB 400 KB, Convex 1 MiB, Cloudflare D1 1 MiB. PostgreSQL, MongoDB, and libSQL have higher limits. Fix it with an input processor that uploads attachments to external storage and replaces them with URLs before messages are persisted.

```typescript
// ── Upload then swap for a URL ──
import type { Processor } from '@mastra/core/processors'
import type { MastraDBMessage } from '@mastra/core/memory'

export class AttachmentUploader implements Processor {
  id = 'attachment-uploader'

  async processInput({ messages }: { messages: MastraDBMessage[] }) {
    return Promise.all(messages.map(message => this.processMessage(message)))
  }

  async processMessage(message: MastraDBMessage) {
    const attachments = message.content.experimental_attachments
    if (!attachments?.length) return message

    const uploaded = await Promise.all(
      attachments.map(async attachment => {
        if (!attachment.url?.startsWith('data:')) return attachment
        const url = await this.upload(attachment.url, attachment.contentType)
        return { ...attachment, url }
      }),
    )

    return { ...message, content: { ...message.content, experimental_attachments: uploaded } }
  }

  async upload(dataUri: string, contentType?: string): Promise<string> {
    throw new Error('Implement upload() with your storage provider')
  }
}
```

## **9. Memory in multi-agent systems**

### **9.1 Delegation scoping (automatic)**

When a supervisor delegates to a subagent, isolation happens on every delegation with no flag:

- **Thread ID:** fresh per delegation, so the subagent starts with clean message history every time.
- **Resource ID:** deterministic, `{parentResourceId}-{agentName}`. It is stable across delegations, so resource-scoped memory persists between calls: a subagent remembers facts from earlier delegations by the same user. Different subagents under one supervisor never share a resource ID this way.
- **Memory instance:** a subagent without its own memory inherits the supervisor's `Memory` and options. Its own memory takes precedence.
- The supervisor forwards conversation context so the subagent has background. Only the delegation prompt and the subagent's response are saved, not the full parent conversation. Control what reaches the subagent with the `messageFilter` callback.

### **9.2 Sharing memory between agents called directly**

Outside delegation, sharing is controlled by `resourceId` and `threadId`. Agents using the same values read and write the same data.

```typescript
// ── Resource-scoped sharing ──
//    Same resource, different threads: shared working memory and embeddings,
//    separate message histories.
await researcher.generate('Find information about quantum computing.', {
  memory: { resource: 'project-42', thread: 'research-session' },
})

await writer.generate('Write a summary from the research notes.', {
  memory: { resource: 'project-42', thread: 'writing-session' },
})
```

- Working memory and semantic recall default to `scope: 'resource'`, so they are shared through the resource.
- OM defaults to `scope: 'thread'`. Two agents using the same resource and thread share the full message history and see each other's exact outputs.

## **10. Multi-user threads**

One thread can be shared by several users. Send each message with `sendMessage()` and put the speaker in `attributes`. Mastra renders it as a `<user>` tag the model can read, now and when loaded from history.

Use cases: collaborative documents with editors and reviewers, group chats with one assistant, reviews where roles carry different authority.

Steps:

1. **Share one `resourceId`** keyed on the conversation, such as `doc_${docId}` or `room_${roomId}`, not a user ID. Everyone uses the same `resourceId` and `threadId`.
2. **Send with identity.** Attribute names must be valid XML names (`name`, `role`, `user_id`) or rendering fails with `Invalid signal XML attribute name`. Values are escaped for you and stored with the message.
3. **Explain the tag** in the agent's `instructions`.

```typescript
// ── Send as a speaker ──
//    The model receives: <user name="Alice" role="editor">...</user>
agent.sendMessage(
  {
    contents: 'Please make the cover page teal.',
    attributes: { name: 'Alice', role: 'editor' },
  },
  { resourceId: 'doc_42', threadId: 'doc_42' },
)

// ── Agent instructions that explain the tag ──
const instructions = `
You are a collaborative document assistant. Several people talk to you in the same thread.

Each user message arrives in a <user> tag whose attributes say who sent it:

  <user name="Alice" role="editor">...message text...</user>

Address people by name. Editors propose changes and reviewers approve them.
When you refer to something said earlier, name the person who said it.
`.trim()
```

- If the thread is idle, `sendMessage()` starts a run and `accepted` resolves with its output (`action: 'wake'`). If the agent is mid-answer, the message is delivered into the running turn and `accepted` resolves with `action: 'deliver'`. In a live app, render replies from the thread stream so every participant sees the same conversation.
- Short threads: message history alone (`lastMessages`) keeps attribution across turns. Long threads: OM, and leave `lastMessages` out. The Observer keeps attributes, labeling a message `User (name="Alice" role="editor")`. Messages without attributes are labeled plain `User`.
- **Security:** build `attributes` on the server from the authenticated user (use request context). Never take `name` from the request body or one user can impersonate another.

## **11. Observability and per-request memory**

### **11.1 Tracing**

Enable tracing to see exactly which messages and observations went into each request. In Studio open the **Observability** tab, open a recent agent trace, and look at the LLM call spans. This is the best way to verify retrieval and compression behave as expected.

### **11.2 Switch memory per request**

```typescript
// ── Memory chosen from request context ──
//    Useful for tiered plans.
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'

const premiumMemory = new Memory()
const standardMemory = new Memory()

export const memoryAgent = new Agent({
  id: 'memory-agent',
  name: 'Memory Agent',
  memory: ({ requestContext }) => {
    const tier = requestContext.get('user-tier')
    return tier === 'enterprise' ? premiumMemory : standardMemory
  },
})
```

## **12. Choosing a combination**

| Situation | Use |
| --- | --- |
| Short chat, a few turns | Message history only |
| Long task, coding or browser agent, hours of work | OM (raise `messageTokens` for tool-heavy runs) |
| Always-needed facts: name, goals, preferences | Working memory (schema for typed data) |
| Need old details by meaning, no OM | Semantic recall |
| Need exact wording behind observations | OM with `retrieval: true` or `{ vector: true }` |
| Several people in one thread | Multi-user threads plus message history or OM |
| Single-turn independent requests | No memory |

A common production stack: OM for the long thread, working memory for the stable user profile, and retrieval mode for cross-thread reach. Skip semantic recall unless you need it, because it costs latency on every call.

## **13. Pitfalls and limits**

- **Thread required under OM.** Thread scope throws `OBSERVATIONAL_MEMORY_THREAD_ID_REQUIRED` without a `threadId`.
- **Unsupported adapter.** OM turns off without a warning and stored history does not load. Check the adapter list in section 3.2.
- **First-turn cost on an existing thread.** Every stored message loads until the first observation completes, so a large thread pays a one-time context cost.
- **`lastMessages` is ignored under OM.** Do not tune it expecting an effect.
- **Leave `observeOnContextOverflow` at `true`.** With it off the overflowing request fails.
- **Lazy validation.** Some invalid options fail on first use, not on construction. `shareTokenBudget: true` with async buffering enabled fails on the first memory operation. Read the error instead of retrying.
- **Async buffering needs a flush.** Call `await memory.settled()` before closing storage or shutting down, or background work is lost.
- **The observation mutex is per process.** Across processes, coordination needs a shared PubSub backend with leases plus shared storage, and every process configured identically. The Observer runs inside the agent loop, which runs one loop per thread.
- **Debugging OM.** `OM_DEBUG=1` writes `om-debug.log`. Also use `getStatus()` and the `onDebugEvent` callback.
- **Thread owner is immutable.** Reusing a thread ID with a different `resourceId` errors.
- **No built-in access control.** Check authorization before any `listThreads` or `recall` call.
- **Do not trust client identity.** Scopes and attributes must come from server-side auth.
- **Sliding window breaks caching.** Fixed `lastMessages` invalidates the prompt cache every turn on long threads.
- **Semantic recall caveats.** Stale metadata on old embeddings, MongoDB's background embedding delay, wrong `embeddingDimension` after a model change, IVFFlat scanning the whole thread.
- **OM retrieval vector search matches observations, not raw messages.** A dropped detail may not surface, though browse mode can still find it.
- **Memory Gateway `msk_` keys** skip local OM and end on December 31, 2026.
- **Resource-scoped OM is deprecated.** Use thread scope plus retrieval.
- **Working memory template updates replace.** The agent must resend the whole block; use a schema for merge behavior.
- **Subagent titles.** Not generated for inherited delegation threads.

## **14. Self-test**

1. Which two IDs identify memory in a call, and which one can never change on an existing thread?
2. Why does a fixed `lastMessages` window hurt prompt caching, and what two features avoid it?
3. With default OM settings, at what sizes do observation and reflection trigger, and how much recent history remains after activation?
4. What is the difference between template and schema working memory when the agent updates it?
5. Which two settings give the OM agent a way to recover exact wording, and what does each need?
6. If an output guardrail calls `abort()`, what gets saved? What if the caller cancels with `abortSignal`?
7. A subagent is delegated to twice by the same user. What stays the same and what changes between the two runs?
8. Why must multi-user attributes be built on the server?

Answers:

1. `resource` and `thread`; the owning `resourceId` is immutable.
2. The oldest message leaves each turn, changing the prompt start. Observational Memory and token-budgeted `messageHistory` with `atMaxRemoveTokens` (chunked trimming).
3. Observation at 30,000 unobserved message tokens, reflection at 40,000 observation tokens; about 6,000 tokens of recent messages remain.
4. Template replaces (full content resent), schema merges (only changed fields, `null` deletes, arrays replaced).
5. `retrieval: true` (browse, no vector store) and `retrieval: { vector: true }` (semantic search, needs a vector store and embedder).
6. Nothing is saved on a processor `abort()`; on caller cancellation the user message and the text the user saw are saved.
7. The resource ID (`{parentResourceId}-{agentName}`) stays the same so resource-scoped memory persists; the thread ID is fresh each time.
8. Otherwise a client could set its own `name` and impersonate another user.

## **15. Sources**

- Mastra memory overview: https://mastra.ai/docs/memory/overview
- Message history: https://mastra.ai/docs/memory/message-history
- Observational Memory: https://mastra.ai/docs/memory/observational-memory
- Working memory: https://mastra.ai/docs/memory/working-memory
- Semantic recall: https://mastra.ai/docs/memory/semantic-recall
- Memory processors: https://mastra.ai/docs/memory/memory-processors
- Multi-user threads: https://mastra.ai/docs/memory/multi-user-threads
- Docs index: https://mastra.ai/llms.txt

## **Appendix A. Defaults cheat sheet**

| Item | Default |
| --- | --- |
| `lastMessages` | 10 |
| Message history | enabled |
| Observational Memory | disabled |
| Working memory | disabled; scope `resource` |
| Semantic recall | disabled; scope depends on config, `resource` when set |
| OM `messageTokens` | 30,000 |
| OM `observationTokens` (reflection) | 40,000 |
| OM `bufferTokens` | 0.2 (every 6,000 tokens) |
| OM `bufferActivation` | 0.8 |
| OM `blockAfter` | 1.2 (36,000 tokens) |
| OM scope | `thread` |
| OM recall tool scope | `resource` |
| OM `observeOnContextOverflow` | true |
| OM model | `'auto'` |
| `atMaxRemoveTokens` | 25% of `maxTokens` |
| `maxChunkChars` | 16,384 |
| Postgres vector index | IVFFlat |

## **Appendix B. Method reference**

| Method | Purpose |
| --- | --- |
| `agent.getMemory()` | Get the memory instance |
| `memory.createThread()` / `getThreadById()` / `listThreads()` / `updateThread()` | Thread CRUD |
| `memory.saveMessages()` / `updateMessages()` / `deleteMessages()` | Message CRUD |
| `memory.recall()` | Fetch messages, with pagination, filters, `include`, semantic search |
| `memory.cloneThread()` / `copyThread()` | Branch or fork a thread |
| `memory.updateWorkingMemory()` / `mergeWorkingMemory()` | Write working memory |
| `memory.supportsAtomicWorkingMemoryMerge()` | Check atomic merge support |
| `memory.settled()` | Flush background OM work before shutdown |
| `agent.sendMessage()` | Send attributed messages to a shared thread |
| `resolveAutoModelId()` | Show which model OM `auto` would choose |