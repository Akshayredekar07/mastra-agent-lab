
import { Agent } from "@mastra/core/agent";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const nebiusApiKey = env.NEBIUS_API_KEY?.trim();
const nebiusModel = env.NEBIUS_MODEL?.trim();

if (!nebiusApiKey) {
    throw new Error("NEBIUS_API_KEY is missing. Copy .env.example to .env and set your Nebius API key.");
}

if (!nebiusModel) {
    throw new Error("NEBIUS_MODEL is missing. Add NEBIUS_MODEL to .env.");
}

const nebiusBaseUrl = (env.NEBIUS_BASE_URL?.trim() || "https://api.tokenfactory.nebius.com/v1")
    .replace(/\/+$/, "");

const nebiusModelConfig = {
    specificationVersion: "v1",
    provider: "nebius",
    modelId: nebiusModel,
    doGenerate: async ({ prompt }: { prompt: unknown }) => {
        const messages = typeof prompt === "string"
            ? [{ role: "user", content: prompt }]
            : (prompt as Array<{ role: string; content: unknown }>).map(message => ({
                role: message.role,
                content: typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content),
            }));

        const response = await fetch(`${nebiusBaseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${nebiusApiKey}`,
            },
            body: JSON.stringify({ model: nebiusModel, messages }),
        });

        if (!response.ok) {
            throw new Error(`Nebius request failed: ${response.status} ${await response.text()}`);
        }

        const result = await response.json() as {
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const choice = result.choices?.[0];

        return {
            text: choice?.message?.content ?? "",
            finishReason: choice?.finish_reason ?? "stop",
            usage: {
                promptTokens: result.usage?.prompt_tokens ?? 0,
                completionTokens: result.usage?.completion_tokens ?? 0,
            },
            rawCall: { rawPrompt: prompt, rawCall: {} },
        };
    },
} as any;

export const researchAgent = new Agent({
    id: "research-agent",
    name: "Research Agent",

    instructions: `
    You are concise research assistant
    Rules:
    - Answer clearly and directly.
    - If you do not have enough information, say what is missing.
    - Never invent facts, sources, numbers, or citations.
    - Keep answers short unless the user asks for detail
    `,

    model: nebiusModelConfig,

});