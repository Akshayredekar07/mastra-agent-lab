# **Agent Fundamentals & Model Integration**

Agent lifecycle, model providers, execution, generation, error handling, and Mastra Studio.

## **1. What is a Mastra agent?**

A Mastra agent is a TypeScript object that combines:

- **Instructions** — the agent’s role, rules, tone, and constraints.
- **Model** — the LLM that reasons and generates responses.
- **Tools** — functions the agent can call to fetch data or perform actions.
- **Memory** — optional context retained across interactions.
- **Workflows** — optional deterministic multi-step processes.

An agent is not just a prompt. It is a runtime component that decides how to respond, when to call tools, and how to combine results into an answer.

### **Core mental model**

```text
User input
   ↓
Agent instructions + conversation context
   ↓
Model reasoning
   ↓
Tool calls (if needed)
   ↓
Final response
```

## **2. Agent lifecycle**

A typical agent request follows these stages:

1. **Input received**  
   The application sends a user message to the agent.

2. **Context assembly**  
   Mastra prepares the system instructions, conversation history, memory, and relevant tool definitions.

3. **Model request**  
   The selected model receives the prompt and available tools.

4. **Model decision**  
   The model either generates a direct response or requests a tool call.

5. **Tool execution**  
   If a tool is requested, Mastra validates its input using the tool’s Zod schema and runs its `execute()` function.

6. **Result return to model**  
   The tool output is returned to the model as additional context.

7. **Final generation**  
   The model produces the final answer using the original request and tool results.

8. **Response returned**  
   The application receives the generated text, metadata, and any relevant execution details.

### **Example lifecycle**

```text
User: “What is the weather in Pune?”
  → Agent receives prompt
  → Model decides to call get-weather
  → Tool validates { location: "Pune" }
  → Tool returns temperature and conditions
  → Model writes final answer
  → User sees response
```

## **3. Creating an agent**

Use the `Agent` class from `@mastra/core/agent`.

```ts
import { Agent } from "@mastra/core/agent";

export const weatherAgent = new Agent({
  id: "weather-agent",
  name: "Weather Agent",
  instructions: `
    You are a helpful weather assistant.
    Use the weather tool to get current weather information.
    Keep answers concise and accurate.
  `,
  model: "openai/gpt-6.1-sol",
  tools: {
    weatherTool,
  },
});
```

### **Important fields**

| Field | Purpose |
|---|---|
| `id` | Stable identifier used to retrieve the agent |
| `name` | Human-readable agent name |
| `instructions` | System-level behavior and rules |
| `model` | Model router string, such as `openai/gpt-6.1-sol` |
| `tools` | Tools the agent may use |

## **4. Model providers**

Mastra uses a model router format:

```ts
provider/model
```

Examples:

```ts
model: "openai/gpt-6.1-sol";
model: "anthropic/claude-sonnet-5.5";
model: "google/gemini-3.8-flash";
```

Use `/`, not `:`.

```ts
// Correct
model: "openai/gpt-6.1-sol";

// Incorrect
model: "openai:gpt-6.1-sol";
```

### **Environment variables**

Mastra looks for provider-specific API keys in environment variables.

| Provider | Environment variable |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google | `GOOGLE_API_KEY` |

Example:

```bash
OPENAI_API_KEY=your_api_key
```

Never commit API keys to Git. Store them in a local `.env` file and add `.env` to `.gitignore`.

## **5. Registering agents**

Create a Mastra entry point and register agents there.

```ts
import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weather-agent.ts";

export const mastra = new Mastra({
  agents: {
    weatherAgent,
  },
});
```

Retrieve an agent by its ID:

```ts
const agent = mastra.getAgentById("weather-agent");
```

## **6. Execution and generation**

Use `agent.generate()` to run an agent directly.

```ts
const response = await agent.generate("What is the weather in Pune?");

console.log(response.text);
```

### **Generation options**

`generate()` is the main execution method for producing a response.

```ts
const response = await agent.generate(prompt, {
  // Optional generation/runtime settings may be added here
});
```

The response commonly includes:

- `text` — the final generated answer.
- Tool-call information, when tools were used.
- Metadata about the generation process.

### **Direct execution example**

```ts
// run.mjs
import { mastra } from "./src/mastra/index.ts";

const agent = mastra.getAgentById("weather-agent");
const response = await agent.generate("Weather in San Francisco?");

console.log(response.text);
```

## **7. Tools and model integration**

Tools let an agent interact with external systems.

A tool must be created using `createTool()`. Plain object tool definitions do not execute reliably.

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    location: z.string(),
    temperatureCelsius: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ location }) => {
    return {
      location,
      temperatureCelsius: 21,
      conditions: "Sunny",
    };
  },
});
```

### **Tool anatomy**

| Part | Purpose |
|---|---|
| `id` | Unique tool identifier |
| `description` | Tells the model when and how to use the tool |
| `inputSchema` | Zod validation for tool input |
| `outputSchema` | Optional validation for tool output |
| `execute()` | Actual function that performs the work |

### **Tool execution signature**

```ts
execute: async (inputData, context) => {
  // inputData contains validated input
  // context contains runtime execution metadata
}
```

The first argument is the validated input. The second is the execution context, which can include `requestContext`, `tracingContext`, and `abortSignal`.

## **8. Error handling**

Agents should fail safely. Do not assume a model, API, or tool will always work.

### **Common failure points**

- Missing or invalid API key.
- Invalid model ID.
- Network failure while calling an external API.
- Tool input that fails schema validation.
- Tool returning an unexpected response.
- Model attempting to call a tool incorrectly.
- Rate limits or provider outages.
- Timeout on long-running operations.

### **Tool-level error handling**

```ts
execute: async ({ location }) => {
  try {
    const response = await fetch(
      `https://example.com/weather?city=${encodeURIComponent(location)}`
    );

    if (!response.ok) {
      throw new Error(`Weather API failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      location,
      temperatureCelsius: data.temperature,
      conditions: data.conditions,
    };
  } catch (error) {
    throw new Error(
      `Unable to fetch weather for "${location}". Please try again later.`
    );
  }
}
```

### **Agent-level error handling**

```ts
try {
  const response = await agent.generate("What is the weather in Pune?");
  console.log(response.text);
} catch (error) {
  console.error("Agent execution failed:", error);
}
```

### **Error-handling principles**

- Validate all external inputs with Zod.
- Return clear, user-friendly error messages.
- Log technical errors for debugging.
- Add timeouts for external API calls.
- Do not expose API keys or raw stack traces to users.
- Make tool failures recoverable where possible.
- Test missing keys, invalid inputs, and API failures.

## **9. Mastra Studio**

Mastra Studio is the local development interface for building, testing, and managing agents, workflows, and tools.

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:4111
```

### **What Studio helps with**

- Visually inspect registered agents.
- Send test prompts.
- Observe agent behavior.
- Test tools and workflows.
- Debug prompts and agent instructions.
- Iterate quickly without writing a custom UI first.

### **Development workflow**

1. Start the Mastra dev server.
2. Open Studio.
3. Select the agent.
4. Send a prompt.
5. Inspect the response and tool calls.
6. Update instructions or tools.
7. Repeat.

## **10. Current lab checklist**

- [ ] Create an agent using `Agent`.
- [ ] Register the agent in the `Mastra` instance.
- [ ] Use a valid `provider/model` string.
- [ ] Store the provider API key in an environment variable.
- [ ] Create a tool using `createTool()`.
- [ ] Add Zod input validation.
- [ ] Call the agent using `agent.generate()`.
- [ ] Print or return `response.text`.
- [ ] Add `try/catch` around execution.
- [ ] Handle tool and API errors.
- [ ] Test the agent in Mastra Studio.
- [ ] Verify tool calls appear as expected.
- [ ] Test invalid input and missing API key scenarios.

## **11. Practice tasks**

### **Task 1: Weather agent**

Build an agent that answers weather questions using a weather tool.

Requirements:

- Accept a city name.
- Validate the input with Zod.
- Return temperature and conditions.
- Handle invalid city input.

### **Task 2: GitHub repo agent**

Build an agent that analyzes a public GitHub repository.

Requirements:

- Accept a repository URL.
- Fetch README content.
- Summarize the project purpose.
- Identify technologies used.
- Return setup instructions.

### **Task 3: Error-resilient agent**

Improve an existing agent so it:

- Validates all user input.
- Handles API failures.
- Returns a useful fallback response.
- Logs errors without exposing secrets.

### **Task 4: Studio testing**

Test your agent with at least 10 prompts:

- Normal request.
- Missing required field.
- Invalid URL.
- Unsupported city or repository.
- Request requiring a tool call.
- Request that should not call a tool.
- Ambiguous request.
- Long input.
- Empty input.
- Prompt injection attempt.

## **12. Key takeaways**

- An agent combines instructions, a model, tools, and optional memory.
- Mastra models use the `provider/model` format.
- Provider API keys are read from environment variables.
- `agent.generate()` is the primary way to execute an agent directly.
- Tools must use `createTool()` with Zod schemas and an `execute()` function.
- Error handling belongs at both the tool and application level.
- Mastra Studio is the fastest place to test and debug agents locally.
