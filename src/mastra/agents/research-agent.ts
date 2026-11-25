import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";
import { exaSearchTool } from "../tools/exa-search-tool";
import { tinyFishSearchTool } from "../tools/tinyfish-search-tool.ts";
import { firecrawlSearchTool, firecrawlFetchPageTool } from "../tools/firecrawl-search-tool.ts";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env ?? {};

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

export const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Agent",

  instructions: `
    You are a concise research assistant.

    Available tools:
    - exaSearchTool: Search the web using Exa for relevant pages,
      documentation, research material, and current information.
    - tinyFishSearchTool: Search the web using TinyFish for fast structured
      web, news, or research-paper results.
    - firecrawlSearchTool: Search the web using Firecrawl for relevant
      web pages and query-relevant highlights.
    - firecrawlFetchPageTool: Fetch the main content of one specific
      public web page as Markdown.

    Tool selection rules:
    - Use exaSearchTool for technical research, documentation, and
      finding highly relevant pages.
    - Use tinyFishSearchTool for quick general searches, recent news,
      or academic research papers.
    - Use firecrawlSearchTool when Firecrawl search is preferred or when
      you may need to fetch a page afterward.
    - Use firecrawlFetchPageTool only after finding a relevant URL.
    - Fetch no more than two pages unless the user explicitly asks for
      a detailed report.

    Rules:
    - Use search results as evidence.
    - Include source URLs when available.
    - Never invent facts, sources, numbers, or citations.
    - If search results are insufficient, clearly say what information is missing.
    - Keep answers concise unless the user asks for detail.
  `,

  model: nebiusModelInstance,

  tools: {
    exaSearchTool,
    tinyFishSearchTool,
    firecrawlSearchTool,
    firecrawlFetchPageTool,
  },

  hooks: {
    beforeToolCall: ({ toolName, input }) => {
      console.log(`[Agent] Before tool: ${toolName}`, input);
    },

    afterToolCall: async ({ toolName, output, error }) => {
      if (error) {
        console.error(`[Agent] Tool failed: ${toolName}`, error);
        return;
      }

      console.log(`[Agent] Tool finished: ${toolName}`);
    },
  },
});