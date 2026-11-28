// src/mastra/llm/nebius.ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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

export const nebiusModelInstance = nebius(nebiusModel);