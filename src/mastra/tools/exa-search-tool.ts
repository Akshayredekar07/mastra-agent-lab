import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const env = (globalThis as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const exaApiKey = env.EXA_API_KEY?.trim();

if (!exaApiKey) {
  throw new Error(
    "EXA_API_KEY is missing. Add it to your .env file and restart the server."
  );
}

export const exaSearchTool = createTool({
  id: "exa-web-search",

  description:
    "Search the web using Exa for relevant pages, documentation, research material, and current information. Returns titles, URLs, and short relevant excerpts.",

  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        "The search query. Example: 'Mastra AI agent documentation'"
      ),

    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe(
        "Maximum number of search results to return. Use 3 to 5 for normal research."
      ),
  }),

  outputSchema: z.object({
    provider: z.literal("exa"),

    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })
    ),
  }),

  onInputAvailable: ({ input, toolCallId }) => {
    console.log(
      `[Exa] Tool call ${toolCallId} received query: "${input.query}"`,
      `maxResults: ${input.maxResults}`
    );
  },

  execute: async ({ query, maxResults }, { abortSignal }) => {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaApiKey,
      },

      body: JSON.stringify({
        query,
        type: "auto",
        numResults: maxResults,
        contents: {
          highlights: true,
        },
      }),

      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Exa search failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string | null;
        url?: string | null;
        highlights?: string[] | null;
        summary?: string | null;
        text?: string | null;
      }>;
    };

    const results = (data.results ?? []).map((result) => ({
      title: result.title ?? "Untitled result",
      url: result.url ?? "",
      snippet:
        result.highlights?.[0] ??
        result.summary ??
        result.text?.slice(0, 300) ??
        "",
    }));

    return {
      provider: "exa" as const,
      results,
    };
  },

  onOutput: ({ output, toolName, toolCallId }) => {
    console.log(
      `[Exa] Tool ${toolName} call ${toolCallId} returned ${output.results.length} results`
    );
  },
});