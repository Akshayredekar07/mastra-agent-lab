import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const env = (globalThis as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const tinyFishApiKey = env.TINYFISH_API_KEY?.trim();

if (!tinyFishApiKey) {
  throw new Error(
    "TINYFISH_API_KEY is missing. Add it to your .env file and restart the server."
  );
}

export const tinyFishSearchTool = createTool({
  id: "tinyfish-web-search",

  description:
    "Search the web using TinyFish for fast, structured results. Supports general web search, news search, and research-paper search. Returns titles, URLs, and snippets.",

  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "The search query. Example: 'latest AI agent frameworks 2026'"
      ),

    searchType: z
      .enum(["web", "news", "research_paper"])
      .default("web")
      .describe(
        "Type of search. Use 'web' for general results, 'news' for recent articles, and 'research_paper' for academic papers."
      ),

    page: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(0)
      .describe(
        "Result page number. Start with 0 for the first page."
      ),
  }),

  outputSchema: z.object({
    provider: z.literal("tinyfish"),

    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })
    ),

    totalResults: z.number(),
    page: z.number(),
  }),

  onInputAvailable: ({ input, toolCallId }) => {
    console.log(
      `[TinyFish] Tool call ${toolCallId} received query: "${input.query}"`,
      `searchType: ${input.searchType}, page: ${input.page}`
    );
  },

  execute: async ({ query, searchType, page }, { abortSignal }) => {
    const url = new URL("https://api.search.tinyfish.ai/");

    url.searchParams.set("query", query);
    url.searchParams.set("domain_type", searchType);
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      method: "GET",

      headers: {
        "X-API-Key": tinyFishApiKey,
      },

      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `TinyFish search failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string | null;
        url?: string | null;
        snippet?: string | null;
      }>;
      total_results?: number;
      page?: number;
    };

    const results = (data.results ?? []).map((result: any) => ({
      title: result.title ?? "Untitled result",
      url: result.url ?? "",
      snippet: result.snippet ?? "",
    }));

    return {
      provider: "tinyfish" as const,
      results,
      totalResults: data.total_results ?? results.length,
      page: data.page ?? page,
    };
  },

  onOutput: ({ output, toolName, toolCallId }) => {
    console.log(
      `[TinyFish] Tool ${toolName} call ${toolCallId} returned ${output.results.length} results`
    );
  },
});