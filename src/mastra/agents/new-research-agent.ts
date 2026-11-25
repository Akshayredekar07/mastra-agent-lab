import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";

import { localMcpClient } from "../mcp/local-mcp-client.ts";


// load env

const env = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const nebiusApiKey = env.NEBIUS_API_KEY?.trim();
const nebiusModel = env.NEBIUS_MODEL?.trim();

if (!nebiusApiKey) {
    throw new Error("NEBIUS_API_KEY is missing.");
}

if (!nebiusModel) {
    throw new Error("NEBIUS_MODEL is missing.");
}

const nebiusBaseUrl = (
    env.NEBIUS_BASE_URL?.trim() ||
    "https://api.tokenfactory.nebius.com/v1"
).replace(/\/+$/, "");

const nebius = createOpenAICompatible({
    name: "nebius",
    apiKey: nebiusApiKey,
    baseURL: nebiusBaseUrl,
});

const nebiusModelInstance = nebius(nebiusModel);

export const newResearchAgent = new Agent({
    id: "research-agent",
    name: "Research Agent",

    instructions: `
You are a concise research and problem-solving assistant.

Response rules:
- Give a direct answer first.
- Use concise, beginner-friendly explanations.
- Use bullet points or short sections when helpful.
- Cite source URLs immediately after relevant claims.
- Do not expose private reasoning or tool-call details.
`,

    model: nebiusModelInstance,
    
    tools: {
        ...(await localMcpClient.listToolsWithErrors().then((result) => {
            console.log("LOCAL MCP TOOLS:", Object.keys(result.tools));
            console.log("LOCAL MCP ERRORS:", result.errors);

            return result.tools;
        })),
    },
});