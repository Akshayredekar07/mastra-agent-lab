# Mastra Streaming — Summary

Researched from the live Mastra docs (mastra.ai). All claims below are taken from pages fetched on the date of research; anything not directly stated in the docs is flagged in the "Unverified" notes at the end.

## Overview

Mastra supports real-time, incremental responses from **agents** and **workflows**.

- **Agent streaming** — `agent.stream()` returns a `MastraModelOutput` that exposes `textStream` for progressive text plus promises (`text`, `steps`, `usage`) that resolve when the stream finishes.
- **Workflow streaming** — `run.stream()` returns a `WorkflowRunOutput` whose `fullStream` is a `ReadableStream` of **lifecycle events** (not text chunks), so you can track workflow progress in real time.

The same streaming guide content is published at several paths: `/docs/streaming`, `/docs/agents/streaming`, and `/docs/guides/streaming`.

## How streaming works

**1. Mastra's native chunk format ("mastra" format).**
Mastra emits typed chunk objects described by the `ChunkType` union. Every chunk (except custom `data-*` chunks) carries base properties: `type`, `runId`, `traceId` (when tracing is enabled) and `from` (`'AGENT' | 'USER' | 'SYSTEM' | 'WORKFLOW' | 'NETWORK'`), plus a `payload`.

Common **agent** chunk types: `start`, `text-start` / `text-delta` / `text-end`, `reasoning-start` / `reasoning-delta` / `reasoning-end`, `reasoning-signature`, `tool-call`, `tool-result`, `tool-call-input-streaming-start` / `tool-call-delta` / `tool-call-input-streaming-end`, `tool-error`, `source`, file chunks, `step-start` / `step-finish`, `finish`, plus custom `data-*` chunks and `background-task-*` chunks.

Common **workflow** event types: `workflow-start`, `workflow-step-start`, `workflow-step-output`, `workflow-step-progress`, `workflow-step-result`, `workflow-finish`, `workflow-paused`, `workflow-step-suspended`, `workflow-canceled`. Workflow events include `runId` and `from` at the **top level**, so you can identify the run without inspecting the payload:

```typescript
{
  type: 'workflow-start',
  runId: '1eeaf01a-d2bf-4e3f-8d1b-027795ccd3df',
  from: 'WORKFLOW',
  payload: { workflowId: 'testWorkflow' }
}
```

**2. Conversion to the AI SDK UI message stream.**
`toAISdkStream()` (from `@mastra/ai-sdk`) converts a Mastra stream (agent / network / workflow) into AI SDK-compatible UI message stream parts. Options verified on the reference page:

- `version`: `'v5' | 'v6' | 'v7'` — **default `'v5'`** ("keeps the existing AI SDK v5/default behavior"). Pass the version matching your installed AI SDK.
- `from`: `'agent' | 'network' | 'workflow'` (default `'agent'`)
- agent-only: `lastMessageId`, `sendStart` (default `true`), `sendFinish` (default `true`), `sendReasoning` (default `false`), `sendSources` (default `false`), `includeSubAgentMetadata` (default `false`; `handleChatStream()`/`chatRoute()` enable it), `messageMetadata`, `onError`
- workflow-only: `includeTextStreamParts` (default `true`)

When the agent stream has a final structured output, it is emitted as a `data-structured-output` UI data part; partial structured-output chunks are not emitted.

**3. Transport.** The AI SDK UI message stream is served over **SSE** using `createUIMessageStreamResponse()` from the `ai` package. Mastra also ships `withSseHeartbeat()`, which wraps the encoded `Response` and injects `: heartbeat` SSE comments while the stream is idle (to stop proxies/load balancers dropping connections during long reasoning bursts or slow tool calls). `chatRoute()` applies the same wrapper internally via its `heartbeatMs` option.

## Core APIs

### Agent — `agent.stream()`

```typescript
const stream = await agent.stream([{ role: 'user', content: 'Help me organize my day' }])

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk)
}
```

`MastraModelOutput` members (from the `MastraModelOutput` reference):

| Kind | Members |
| --- | --- |
| Streaming props | `fullStream` (`ReadableStream<ChunkType<OUTPUT>>`), `textStream` (`ReadableStream<string>`), `objectStream` (`ReadableStream<Partial<OUTPUT>>`), `elementStream` (array-element stream) |
| Promise props | `text`, `object`, `reasoning` (`ReasoningChunk[]`), `reasoningText`, `toolCalls`, `toolResults`, `usage` (`inputTokens`/`outputTokens`/`totalTokens`/`reasoningTokens`/`cachedInputTokens`), `finishReason`, `response` (incl. `response.uiMessages`) |
| Error | `error` (`Error \| undefined`) |
| Methods | `getFullOutput()` (text, object, toolCalls, toolResults, usage, reasoning, reasoningText, finishReason, response), `consumeStream({ onError })` |

Event-style iteration over all chunks:

```typescript
for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case 'text-delta': process.stdout.write(chunk.payload.text); break
    case 'tool-call': console.log(`Calling ${chunk.payload.toolName}...`); break
    case 'finish': console.log(`Done! Reason: ${chunk.payload.stepResult.reason}`); break
  }
}
```

### Agent — `agent.streamLegacy()` (deprecated)

- **Deprecated**, and **only works with V1 models** (AI SDK v4, `specificationVersion: 'v1'`). For V2 models use `.stream()`. The framework auto-detects the model version and **throws on mismatch**.
- Returns AI SDK v4 types: `StreamTextResult` / `StreamObjectResult`.
- Shape differs from the new API: `textStream` is an **`AsyncGenerator<string>`** and `fullStream` is a **`Promise<ReadableStream>`** (the new API exposes both as plain readable streams).
- Also returns `text`, `usage`, `finishReason`, `toolCalls` promises.
- Legacy-only options: `temperature`/`topP`/`topK`/`maxTokens`/`presencePenalty`/`frequencyPenalty`/`stopSequences`/`seed`/`headers` as top-level options, `providerOptions`, `experimental_output`, `output`, `memoryOptions`, `resourceId`, `threadId`, `toolChoice`, `toolsets`, `clientTools`, `hooks`, `savePerStep`, `maxRetries`.

### Agent — `untilIdle` / `streamUntilIdle()`

- `agent.streamUntilIdle()` is **deprecated**; use `stream()` with the **`untilIdle: true`** option instead (added via `@mastra/core@1.29.0`).
- Keeps the stream open until every background task dispatched during the run completes, then auto-continues the agentic loop. Requires **agent memory** (and a `BackgroundTaskManager`) plus `untilIdle: { maxIdleMs }` (default 5 minutes).
- Caveat (from `streamUntilIdle()` reference): aggregate properties (`text`, `toolCalls`, `toolResults`, `finishReason`, `getFullOutput()`) resolve against the **first turn only**; only `fullStream` spans every continuation.

```typescript
const result = await agent.stream('Research solana for me', {
  untilIdle: true,
  memory: { thread: 't1', resource: 'u1' },
})
```

### Workflow — `run.stream()`

```typescript
const run = await testWorkflow.createRun()

const stream = run.stream({ inputData: { value: 'initial data' } })

for await (const chunk of stream.fullStream) {
  console.log(chunk)
}

const result = await stream.result
```

`WorkflowRunOutput` members:

- `fullStream` — `ReadableStream<WorkflowStreamEvent>` (the run object is itself async-iterable, so you can `for await (const chunk of stream)`)
- `result` — `Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>`
- `status` — `WorkflowRunStatus`: `'running' | 'suspended' | 'success' | 'failed' | 'canceled' | 'tripwire'`
- `usage` — `Promise<{ inputTokens, outputTokens, totalTokens, reasoningTokens?, cachedInputTokens? }>`

Related workflow stream methods in the reference index: `run.resumeStream()` (observe events after a stream is closed/interrupted; returns a new stream), `run.observeStream()`, `run.timeTravelStream()`.

> `run.streamLegacy()` **does exist in the Mastra source** (`packages/core/src/workflows/workflow.ts`) and returns the legacy `{ stream, getWorkflowState }` shape, but it has **no page in the public reference index** (`/reference/streaming/workflows/streamLegacy` returns 404). Verified via the repo source and PR #9092 (“merge streamVNext into regular stream”, merged 2025-10-22).

### The `writer` API (tools + workflow steps)

Tools get `context.writer`; workflow steps get a `writer` argument in `execute`.

- `await context.writer.write({ type: 'custom-event', status: 'pending' })` — emits custom events/data into the active stream.
- `await context.writer.custom({ type: 'data-tool-progress', ... })` — emits top-level stream chunks (useful for UI frameworks).
- `transient: true` on a `data-*` chunk → streamed to the client in real time but **not persisted to storage**. (Default: `data-*` chunks *are* persisted as part of message history.)

## Options & configuration

### `agent.stream(messages, options)` — options seen in the reference

| Option | Notes |
| --- | --- |
| `messages` | `string \| string[] \| CoreMessage[] \| AiMessageType[] \| UIMessageWithMetadata[]` |
| `onChunk` | `(chunk: ChunkType) => Promise<void> \| void` — called per chunk |
| `onError` | `({ error }: { error: Error \| string }) => Promise<void> \| void` |
| `onAbort` | `(event: { steps: any[]; text?: string }) => Promise<void> \| void` |
| `onFinish` | `StreamTextOnFinishCallback \| StreamObjectOnFinishCallback` |
| `onStepFinish` | Called after each execution step (unavailable for structured output) |
| `onIterationComplete` | Called after each iteration; can return `{ continue, feedback }` to steer/stop |
| `abortSignal` | `AbortSignal` to cancel the run (incl. in-flight subagent runs) |
| `activeTools` | Restrict which tools are usable this run |
| `prepareStep` | Callback before each step of multi-step execution |
| `context` | `ModelMessage[]` — additional context messages |
| `instructions` / `system` | Per-run override of agent instructions / custom system message(s) |
| `memory` | `{ thread: string \| { id, metadata?, title? }, resource: string, options: MemoryConfig }`; `options` covers `lastMessages`, `readOnly`, `semanticRecall`, `workingMemory`, `filterIncompleteToolCalls`; `memory.onTitleGenerated` callback |
| `modelSettings` | `temperature`, `maxOutputTokens` (AI SDK v5 naming), `maxRetries`, `topP`, `topK`, `presencePenalty`, `frequencyPenalty`, and `timeout` (`{ totalMs, stepMs, firstChunkMs }`) |
| `structuredOutput` | `{ schema, model?, errorStrategy?: 'strict'\|'warn'\|'fallback', fallbackValue?, instructions?, jsonPromptInjection?: boolean\|'system'\|'inline'\|'auto', providerOptions? }` |
| `maxSteps` | Max steps during execution |
| `scorers` / `isTaskComplete` / `returnScorerData` | Evaluation configuration |
| `delegation` | `{ onDelegationStart, onDelegationComplete, messageFilter }` for subagents |
| `inputProcessors` / `outputProcessors` | Override processors for this run |
| `includeRawChunks` | Include raw provider chunks (not all providers support it) |
| `scopes` | `string[]` like `org:acme`, `resource:user-123`, `thread:conversation-123` |
| `hideSignals` | `boolean \| AgentSignalType[]` — hide signals from this caller's `fullStream` |
| `format` | `'mastra'` (default) or `'aisdk'` (AI SDK v5-compatible output) |
| `providerOptions` | Provider-specific options (e.g. `openai: { store: true }`) |
| `stopWhen` | `({ steps, totalTokens }) => boolean` |
| `requireToolApproval` | Require approval for all tool calls |
| `untilIdle` | Keep stream open until background tasks finish (requires memory) |
| `tracingContext` / `requestContext` / `runId` | Tracing & request-scoped data |

Deprecated / removed in the new API: `output` → `structuredOutput.schema`; `experimental_output` → `structuredOutput`; `memoryOptions` → `memory`; `resourceId`/`threadId` → `memory.resource`/`memory.thread`; `temperature` and friends → `modelSettings`.

### `run.stream()` — options

`inputData`, `requestContext`, `tracingContext`, `tracingOptions` (`rootSpanName`, `metadata`, `requestContextKeys`, `traceId`, `parentSpanId`, `nestUnderParent`, `tags`), and **`closeOnSuspend`** (`boolean`, default `true` — whether the stream closes on suspend or stays open until the workflow finishes).

## Consuming streams in the frontend

Mastra's `@mastra/ai-sdk` package integrates with AI SDK UI's `useChat()`, `useCompletion()` and `useObject()` hooks.

```bash
npm install @mastra/ai-sdk@latest @ai-sdk/react ai
```

**Server side — Mastra's own server (custom API routes):**

```typescript
import { Mastra } from '@mastra/core'
import { chatRoute } from '@mastra/ai-sdk'

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({ path: '/chat', agent: 'weatherAgent' }),
    ],
  },
})
```

(`workflowRoute({ path, workflow })` and `networkRoute({ path, agent })` are the equivalents for workflows and networks.)

**Server side — framework-agnostic (Next.js App Router example from the docs):**

```typescript
import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse } from 'ai'
import { mastra } from '@/src/mastra'

export async function POST(req: Request) {
  const params = await req.json()
  const stream = await handleChatStream({
    mastra,
    agentId: 'weatherAgent',
    version: 'v7',
    params,
  })
  return createUIMessageStreamResponse({ stream })
}
```

**Client side — `useChat()` (copied from the docs):**

```tsx
import { useChat } from '@ai-sdk/react'
import { useState } from 'react'
import { DefaultChatTransport } from 'ai'

export default function Chat() {
  const [inputValue, setInputValue] = useState('')
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:4111/chat',
    }),
  })

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage({ text: inputValue })
  }

  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleFormSubmit}>
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Name of the city"
        />
      </form>
    </div>
  )
}
```

**Client side — `useCompletion()` (copied from the docs):**

```typescript
import { useCompletion } from '@ai-sdk/react'

export default function Page() {
  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    api: '/api/completion',
  })

  return (
    <form onSubmit={handleSubmit}>
      <input name="prompt" value={input} onChange={handleInputChange} id="input" />
      <button type="submit">Submit</button>
      <div>{completion}</div>
    </form>
  )
}
```

**Converting Mastra streams manually:**

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { toAISdkStream } from '@mastra/ai-sdk'

const uiMessageStream = createUIMessageStream({
  originalMessages: messages,
  execute: async ({ writer }) => {
    for await (const part of toAISdkStream(stream, { from: 'agent', version: 'v7' })) {
      await writer.write(part)
    }
  },
})

return createUIMessageStreamResponse({ stream: uiMessageStream })
```

**Initial messages** for `useChat()`'s `initialMessages` come from `toAISdkMessages()` in `@mastra/ai-sdk/ui`:

```typescript
import { toAISdkMessages } from '@mastra/ai-sdk/ui'

const initialMessages = toAISdkMessages([{ role: 'user', content: 'Hello' }], { version: 'v7' })
```

**Streaming an agent inside a workflow step** (agent chunks forwarded to the UI stream in real time):

```typescript
execute: async ({ inputData, mastra, writer }) => {
  const testAgent = mastra?.getAgent('testAgent')
  const stream = await testAgent?.stream(`What is the weather in ${inputData.city}?`)
  await stream!.textStream.pipeTo(writer!)
  return { value: await stream!.text }
}
```

The AI SDK UI guide notes the variant `await response.fullStream.pipeTo(writer)` also forwards the agent's **text chunks and tool calls**.

## Legacy vs vNext / migration notes

Migration guide: **https://mastra.ai/reference/migrations/vnext-to-standard-apis** (applies as of `@mastra/core` **v0.20.0**).

**Renames:**

| Old | New |
| --- | --- |
| `.stream()` (AI SDK v4 era) | `.streamLegacy()` |
| `.generate()` (AI SDK v4 era) | `.generateLegacy()` |
| `.streamVNext()` | `.stream()` |
| `.generateVNext()` | `.generate()` |

**Model-version support (enforced at runtime with clear error messages):**

- Legacy (`generateLegacy` / `streamLegacy`) → **AI SDK v4** models only (`specificationVersion: 'v1'`).
- Standard (`generate` / `stream`) → **AI SDK v5+** models (`specificationVersion: 'v2' | 'v3' | 'v4'`).

**Return types:**

- `streamLegacy()` → `StreamTextResult` / `StreamObjectResult`.
- `stream()` → `MastraModelOutput<OUTPUT>` with `format: 'mastra'` (default) or `AISDKV5OutputStream<OUTPUT>` with `format: 'aisdk'`.
- `generate()` → calls `.stream()` internally and awaits `.getFullOutput()`.

**Format control** (standard APIs only): `format: 'mastra' | 'aisdk'`. Legacy APIs have no `format` option and always return AI SDK v4 types.

**Options only in the standard APIs:** `format`, `system`, `structuredOutput` (with `jsonPromptInjection`, `model`, `errorStrategy`, `fallbackValue`, `instructions`), `stopWhen`, `providerOptions`, `onChunk`, `onError`, `onAbort`, `activeTools`, `abortSignal`, `prepareStep`, `requireToolApproval`.

**Options that moved:** `temperature` & friends → `modelSettings`; `resourceId`/`threadId` → `memory.resource`/`memory.thread`.

**Deprecated/removed:** `experimental_output` → `structuredOutput`; `output` → `structuredOutput.schema`; `memoryOptions` → `memory`.

**Type changes:** legacy uses `CoreMessage[]`; standard uses `ModelMessage[]` and the AI SDK v5 `ToolChoice` type (`'auto' | 'none' | 'required' | { type: 'tool'; toolName }`).

**Workflow-side change (from the repo PR that consolidated the APIs):** `run.stream()` now returns a `WorkflowRunOutput` instead of `{ stream, getWorkflowState }`; piping requires `streamResult.fullStream.pipeTo(...)` instead of `streamResult.pipeTo(...)`; the old implementation is available as `run.streamLegacy()`. HTTP clients on the `/stream` endpoint get the new behavior; legacy was moved to `/stream-legacy`.

**AI SDK v4 → v5 guide (Mastra-specific parts):** https://mastra.ai/reference/migrations/ai-sdk-v4-to-v5 — Mastra converts v4 data on the fly via its internal `MessageList` (no DB migration needed); `convertMessages()` supports `'Mastra.V2' | 'AIV4.UI' | 'AIV4.Core' | 'AIV5.UI' | 'AIV5.Model' | 'AIV6.UI'`; type helpers `InferUITool` / `InferUITools` exist for tools.

## Gotchas

- **Always `await` writer calls.** `await context?.writer?.write(...)` / `await context?.writer?.custom(...)` — not awaiting locks the stream and throws `WritableStream is locked`.
- **`data-*` chunks are persisted by default.** Use `transient: true` for high-frequency/log-like data; transient chunks reach the client live but are gone after a page refresh.
- **Model/version mismatch throws.** `.stream()` requires V2 models; `.streamLegacy()` only works with V1 models.
- **Don't send the whole conversation from the client when memory is on.** Send only the newest message plus `memory.thread` / `memory.resource` — sending full history can cause message-ordering bugs from conflicting client/server timestamps. Mastra filters echoed history, but stored timestamps/reasoning win.
- **`useChat().stop()` does not cancel the agent run in resumable mode** — generation continues after the POST connection closes. Active-run discovery is **process-local**, so the reconnect must reach the same Mastra server process. Completed/unavailable runs return **204**, so load finished history from memory separately. Keep `chatId` stable across refreshes.
- **Resumable chats with a resource ID** must have auth middleware set `MASTRA_RESOURCE_ID_KEY` in the request context — the reconnecting `GET /chat/:chatId/stream` has no body to carry the resource ID.
- **Client tools:** don't `await addToolOutput(...)` inside `onToolCall` (deadlock). Subagents can't run client tools — define them on the agent the chat route talks to.
- **`streamUntilIdle` / `untilIdle`** aggregates resolve against the first turn only; `untilIdle` requires agent memory.
- **`modelSettings.maxOutputTokens`**, not `maxTokens` (AI SDK v5 convention).
- **SSE heartbeats** must be applied *after* encoding (`withSseHeartbeat(createUIMessageStreamResponse({ stream }), 15000)`); partial SSE frames are never split by a heartbeat.
- **Suspended tools** resume via `resumeData` + `runId` in the request body; `handleChatStream()`/`chatRoute()` then call `agent.resumeStream()` instead of starting a new run.

## Sources

- Streaming guide: https://mastra.ai/docs/streaming (also https://mastra.ai/docs/agents/streaming, https://mastra.ai/docs/guides/streaming)
- `Agent.stream()`: https://mastra.ai/reference/streaming/agents/stream
- `Agent.streamLegacy()`: https://mastra.ai/reference/streaming/agents/streamLegacy
- `Agent.streamUntilIdle()`: https://mastra.ai/reference/streaming/agents/streamUntilIdle
- `MastraModelOutput`: https://mastra.ai/reference/streaming/agents/MastraModelOutput
- `ChunkType`: https://mastra.ai/reference/streaming/ChunkType
- `Run.stream()` (workflows): https://mastra.ai/reference/streaming/workflows/stream
- Workflows overview (streaming section): https://mastra.ai/docs/workflows/overview
- AI SDK UI integration: https://mastra.ai/integrations/agentic-ui/ai-sdk-ui
- `toAISdkStream()`: https://mastra.ai/reference/ai-sdk/to-ai-sdk-stream
- AI SDK overview / `withMastra()`: https://mastra.ai/reference/ai-sdk/overview
- `withSseHeartbeat()`: https://mastra.ai/reference/ai-sdk/with-sse-heartbeat
- Migration guide — VNext → standard APIs: https://mastra.ai/reference/migrations/vnext-to-standard-apis
- Migration guide — AI SDK v4 → v5: https://mastra.ai/reference/migrations/ai-sdk-v4-to-v5
- Docs index: https://mastra.ai/llms.txt , https://mastra.ai/reference/llms.txt
- Repo PR consolidating stream APIs: https://github.com/mastra-ai/mastra/pull/9092
