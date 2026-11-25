# **Mastra Tools: Getting Started Guide for Agent Beginners**

Researched on 2026-11-24 from the official Mastra docs. Mastra ships fast, so check the version of any page you read against the one you installed.

---

## **1. Running Example: A Weather Agent in Five Steps**

**Learn box**
- Goal: give an LLM agent one real capability (fetch weather) through a Mastra tool.
- You will build: one tool, one agent, one Mastra entry point, tested in Studio.
- Time: about 20 minutes with Node.js and one model provider key.

A **tool** is a typed function that an agent can decide to call. A **tool call** is the model saying "run this tool with these arguments". An **agent** is an LLM plus instructions plus tools. **Studio** is the local web UI Mastra gives you to chat with agents and inspect runs.

### **Step 1: Create the project**

```bash
npm create mastra@latest my-first-agent -- --llm anthropic
cd my-first-agent
```

The `--llm` flag takes `openai`, `anthropic`, `google` or `xai`. Put your provider key in `.env` (copy `.env.example` and rename it).

### **Step 2: Write the tool**

```ts
// ── 1. Weather tool ──
//    File: src/mastra/tools/weather-tool.ts

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const weatherTool = createTool({
  id: 'weather-tool',
  description: 'Fetches current weather for a city',

  // ── 2. What the model must send ──
  inputSchema: z.object({
    location: z.string().describe('City name, for example Pune'),
  }),

  // ── 3. What the tool promises to return ──
  outputSchema: z.object({
    location: z.string(),
    temperatureCelsius: z.number(),
    conditions: z.string(),
  }),

  // ── 4. The actual work ──
  execute: async ({ location }, { abortSignal }) => {
    const response = await fetch(`https://wttr.in/${location}?format=j1`, {
      signal: abortSignal,
    })
    const data = await response.json()

    return {
      location,
      temperatureCelsius: Number(data.current_condition[0].temp_C),
      conditions: data.current_condition[0].weatherDesc[0].value,
    }
  },
})
```

A **schema** describes the shape of data. **Zod** is the TypeScript library used here to write schemas. `execute` is the function that runs when the tool is called.

### **Step 3: Give the tool to an agent**

```ts
// ── 5. Weather agent ──
//    File: src/mastra/agents/weather-agent.ts

import { Agent } from '@mastra/core/agent'
import { weatherTool } from '../tools/weather-tool'

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `
    You are a helpful weather assistant.
    Use the weatherTool to fetch current weather data.`,
  model: 'anthropic/claude-sonnet-5-5',
  tools: { weatherTool },
})
```

Model strings use the `provider/model-name` form. Copy a current one from https://mastra.ai/models, since example IDs in docs change quickly.

### **Step 4: Register the agent**

```ts
// ── 6. Mastra entry point ──
//    File: src/mastra/index.ts

import { Mastra } from '@mastra/core'
import { weatherAgent } from './agents/weather-agent'

export const mastra = new Mastra({
  agents: { weatherAgent },
})
```

### **Step 5: Run it**

```bash
npm run dev
```

Open `http://localhost:4111`, pick the weather agent, and ask "What is the weather in Pune?". Studio shows the tool call, the arguments the model sent, and the result. Edits under `src/mastra/` restart the dev server automatically. The same server exposes an HTTP API at `http://localhost:4111/api`.

If the files your CLI generated differ from the above, the CLI version has moved on. The manual install page in the sources reproduces this exact layout from scratch.

---

## **2. What Happens During a Tool Call**

```
user message
   ↓
model reads each tool's description and schema
   ↓
model decides to call a tool and emits JSON arguments
   ↓
Mastra validates the arguments against inputSchema
   ↓
execute() runs and returns a result
   ↓
Mastra validates the result against outputSchema
   ↓
model reads the result and writes the final answer
```

Two consequences matter early:
- The model never sees your code. It only sees the `description` and the schema, so those two fields are your prompt for the tool.
- If either validation step fails, the model receives a validation error and may retry the call.

---

## **3. Anatomy of createTool**

| Field | Required | What it does |
| --- | --- | --- |
| `id` | yes | Unique identifier for the tool |
| `description` | yes | Tells the agent when to use the tool |
| `inputSchema` | usually | Shape of the arguments the model sends |
| `outputSchema` | optional | Shape of what `execute` returns |
| `execute` | usually | The logic. First parameter is the validated input, second is the execution context |
| `requireApproval` | optional | Pauses the call until a human approves it |
| `outputValidation` | optional | `'strict'` (default) or `'warn'` when the result fails `outputSchema` |
| `toModelOutput` | optional | Sends the model a smaller or multimodal version of the result |
| `strict` | optional | Asks supported providers to generate arguments that match the schema exactly |
| `mcp` | optional | Annotations such as `readOnlyHint` when the tool is exposed over MCP |

The second `execute` parameter carries `requestContext`, `abortSignal` and other run metadata. Pass `abortSignal` into `fetch` as in the example so cancelled runs stop cleanly.

Schemas are not locked to Zod. Any library that supports Standard JSON Schema works, including Valibot and ArkType.

---

## **4. Writing Tools the Model Can Use Well**

### **Descriptions and field hints**

- Keep the tool description short and about the primary use case.
- Name schema fields descriptively and add `.describe('...')` text. The model always receives `.describe()` text.
- If a `.refine()` rule matters, state it in the description or `.describe()` text. Refine messages can be dropped from the error the model sees when `toModelOutput` is set.

### **Expected failures**

Returning `{ error: 'Customer not found' }` from a tool with an `outputSchema` fails output validation, and the model gets a validation error, not your message. For expected failures, either throw from `execute` or add the failure case to `outputSchema`.

### **Shaping what the model sees**

```ts
// ── 7. Send the model a short summary ──
//    The app still receives the full result.

toModelOutput: output => ({
  type: 'text',
  value: `${output.location}: ${output.temperatureCelsius}°C and ${output.conditions}`,
}),
```

### **Tool names come from object keys**

The name the model and the stream use is the key you pass, not the tool `id`.

```ts
tools: { weatherTool }                       // toolName: "weatherTool"
tools: { [weatherTool.id]: weatherTool }     // toolName: "weather-tool"
tools: { 'my-custom-name': weatherTool }     // toolName: "my-custom-name"
```

Pick one convention and keep it, because your instructions text must use the same names.

---

## **5. Attaching Tools to Agents**

- **Several tools:** add more keys to `tools`. The agent chooses based on the user message, the instructions, and each tool's description and schema.
- **Shared tools:** export the tool once and import it into each agent. Direct imports keep dependencies explicit.
- **Agents as tools:** pass subagents in `agents: { writer }`. Each becomes a tool named `agent-<key>`. Give each subagent a `description` so the supervisor knows when to delegate.
- **Workflows as tools:** pass `workflows: { research: researchWorkflow }`. Each becomes `workflow-<key>` and uses the workflow's own schemas.
- **Mention tools in `instructions`.** Saying what each tool is for helps the agent decide when to call it and when not to.

At call time you can steer selection too:

```ts
// ── 8. Control tool use per request ──

await agent.generate('Check the forecast', {
  toolChoice: 'required',
  activeTools: ['weatherTool'],
})
```

---

## **6. Built-in Tools Worth Knowing**

Import these from `@mastra/core/tools` instead of writing your own.

| Export | Purpose |
| --- | --- |
| `webFetchTool` | Fetch a URL and return its text |
| `webSearchTool` | Use the model provider's native web search (OpenAI, Anthropic, Gemini, xAI) |
| `askUserTool` | Pause the run and ask the user a question |
| `submitPlanTool` | Submit a plan file for user approval |

`webFetchTool` blocks `localhost` and private IP addresses, truncates responses at 100,000 characters, follows at most 5 redirects, and times out after 15 seconds. It reports failures as `isError: true` instead of throwing.

---

## **7. Making Risky Tools Safe**

### **Require approval before execution**

```ts
// ── 9. A tool that needs a human yes ──

export const deleteRecordTool = createTool({
  id: 'delete-record',
  description: 'Delete a record by ID',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ deleted: z.boolean() }),
  requireApproval: true,
  execute: async ({ id }) => {
    await db.delete(id) // db is your own database client
    return { deleted: true }
  },
})
```

The stream then emits a `tool-call-approval` chunk. Answer it with `agent.approveToolCall({ runId })` or `agent.declineToolCall({ runId })`. Use cases the docs list: destructive actions, cost-heavy calls, and anything that needs confirmation before it finishes.

Approval needs storage. Configure a storage provider on your Mastra instance, or you get a "snapshot not found" error. The default in-memory store loses suspended runs when the process exits.

### **Run logic around every tool call**

```ts
// ── 10. Log and block with hooks ──

hooks: {
  beforeToolCall: ({ toolName, input }) => {
    console.log('Running tool:', toolName, input)
  },
  afterToolCall: async ({ toolName, error }) => {
    console.log('Finished tool:', toolName, error ? 'failed' : 'ok')
  },
},
```

Return `{ proceed: false, output: '...' }` from `beforeToolCall` to skip the call and hand the model your message as the result.

---

## **8. Bringing in Tools From MCP Servers**

**MCP** (Model Context Protocol) is an open standard for connecting agents to external tools. Instead of writing a tool, you connect to a server that already offers them.

```bash
npm install @mastra/mcp@latest
```

```ts
// ── 11. Connect an MCP server ──

import { MCPClient } from '@mastra/mcp'

export const mcpClient = new MCPClient({
  id: 'my-mcp-client',
  servers: {
    wikipedia: {
      command: 'npx',
      args: ['-y', 'wikipedia-mcp'],
    },
  },
})

// ── 12. Hand its tools to an agent ──

export const assistant = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'Use the available tools and name your sources.',
  model: 'anthropic/claude-sonnet-5-5',
  tools: await mcpClient.listTools(),
})
```

- `listTools()` prefixes names as `serverName_toolName`, such as `wikipedia_search`, so servers cannot collide. Use it for fixed, shared configuration.
- `listToolsets()` keeps raw names and is passed to `generate()` or `stream()` at call time. Use it when credentials differ per user or request. Same-named tools from two servers collide there.
- A server entry with `command` runs as a child process of your app. A server entry with `url` connects over HTTP.
- Do not hand the agent every tool a server exposes. A third-party tutorial filters the list by name to keep the model's choice sharp, and Mastra documents dynamic tool search for large tool libraries.

---

## **9. Project Layout and Dev Loop**

```
src/
└── mastra/
    ├── agents/
    ├── tools/
    ├── workflows/
    ├── scorers/
    ├── mcp/
    └── index.ts
```

`src/mastra/index.ts` is where you register everything. Mastra is unopinionated about layout, so this is a convention, not a rule.

Mastra also supports **file-based agents**, where a folder such as `src/mastra/agents/writing-assistant/` holds `config.ts` and `instructions.md`, and extra files like `tools/<name>.ts` are discovered by convention. Discovery runs only through `mastra dev` or `mastra build`. If your app imports `mastra` directly, register agents in code instead.

To drive an agent from the terminal while the dev server runs:

```bash
npx mastra api --url http://localhost:4111 agent run agent '{"messages":"Hello"}'
npx mastra api --url http://localhost:4111 trace list
```

---

## **10. Pitfalls and Limits**

- **Old examples differ.** Docs for an earlier major version exist side by side with current ones. Current `execute` is `execute(inputData, context)`. If a tutorial shows a different signature, check which docs version it came from.
- **Module settings.** Mastra needs modern `module` and `moduleResolution` in `tsconfig.json`. `CommonJS` or `node` causes resolution errors. The manual install uses `ES2022` and `bundler`.
- **Zod version.** The manual install pins `zod@^4`.
- **Output mismatch triggers retries.** A result that fails `outputSchema` becomes a validation error and the model may call again. For tools whose side effects already happened (placing an order), set `outputValidation: 'warn'`.
- **Side effects can run twice.** A resumed tool call after a crash can execute again. Make side-effecting tools safe to repeat, for example with an idempotency key.
- **Approval without storage fails.** See section 7.
- **Subagents cannot run client tools.** A client tool is one with no `execute`. Give it to the supervisor, or use `suspend()` inside the subagent's tool.
- **Tool name mismatch.** Instructions that say `weather-tool` while the key is `weatherTool` confuse the model.
- **Secrets in results.** `transform` can redact tool input and output for browser streams and transcripts, while your code still sees the raw values.
- **Limits not verified here.** I did not run any code in this session. The examples are taken from the official docs, so test them before you rely on them.

---

## **11. Self-Test**

1. Which two tool fields does the model actually read when deciding whether to call a tool?
2. A tool returns `{ error: 'not found' }` but declares an `outputSchema` without an `error` field. What does the model receive?
3. You register `tools: { weatherTool }`. What `toolName` appears in the stream?
4. Which package and method load tools from an MCP server, and how are their names prefixed?
5. Why does `requireApproval: true` need a storage provider?

**Answers**
1. `description` and the schemas (mainly `inputSchema`).
2. A validation error, not your message. Throw instead, or add the case to `outputSchema`.
3. `weatherTool`, because the object key decides the name.
4. `@mastra/mcp`, `MCPClient.listTools()`, prefixed `serverName_toolName`.
5. The paused call is saved as a snapshot so it can resume after the decision.

---

## **12. Sources**

- Tools guide: https://mastra.ai/docs/agents/tools
- createTool reference: https://mastra.ai/reference/tools/create-tool
- Get started: https://mastra.ai/docs
- Manual install: https://mastra.ai/reference/manual-install
- Project structure: https://mastra.ai/reference/project-structure
- Develop and Studio: https://mastra.ai/docs/develop
- Human-in-the-loop: https://mastra.ai/docs/agents/human-in-the-loop
- MCP connections: https://mastra.ai/docs/connections/mcp
- MCPClient reference: https://mastra.ai/reference/tools/mcp-client
- Third-party tutorial on filtering MCP tools: https://dev.to/agentsearchhq/how-to-add-web-search-to-a-mastra-agent-free-no-api-key-31p