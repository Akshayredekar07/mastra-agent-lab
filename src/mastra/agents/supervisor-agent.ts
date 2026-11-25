// src/mastra/agents/supervisor-agent.ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";
import { researchAgent } from "./research-agent.ts";

// same Nebius setup you already use
const env = (globalThis as any).process?.env ?? {};
const nebiusApiKey = env.NEBIUS_API_KEY?.trim();
const nebiusModel = env.NEBIUS_MODEL?.trim();
const nebiusBaseUrl = (env.NEBIUS_BASE_URL?.trim() || "https://api.tokenfactory.nebius.com/v1").replace(/\/+$/, "");

if (!nebiusApiKey || !nebiusModel) {
  throw new Error("NEBIUS_API_KEY or NEBIUS_MODEL is missing.");
}

const nebius = createOpenAICompatible({
  name: "nebius",
  apiKey: nebiusApiKey,
  baseURL: nebiusBaseUrl,
});

export const supervisorAgent = new Agent({
  id: "supervisor-agent",
  name: "Supervisor Agent",

  description:
    "Coordinates research and other specialized agents. Delegates deep research tasks to the Research Agent.",

  instructions: `
You are a supervisor that coordinates specialized agents.

Your main specialist is the Research Agent.
- Use the Research Agent for any web research, documentation lookup, multi-step investigation, or when the user asks to search and save notes.
- Answer simple questions yourself (greetings, definitions, short clarifications).
- For complex research requests, delegate to the Research Agent with a clear, focused task description.
- After the Research Agent returns results, synthesize a clean final answer for the user.
- Never invent facts. Prefer tool-backed answers from the Research Agent.
- Be concise and beginner-friendly.
`,

  model: nebius(nebiusModel),

  // This is the key multi-agent part
  agents: {
    researchAgent,
  },
});