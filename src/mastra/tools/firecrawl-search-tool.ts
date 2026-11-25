import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const env = (globalThis as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const firecrawlApiKey = env.FIRECRAWL_API_KEY?.trim();

if (!firecrawlApiKey) {
  throw new Error(
    "FIRECRAWL_API_KEY is missing. Add it to your .env file and restart the server."
  );
}

export const firecrawlSearchTool = createTool({
  id: "firecrawl-web-search",

  description:
    "Search the web using Firecrawl. Returns relevant web pages with titles, URLs, and query-relevant highlights. Use this when you need general web search results.",

  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "The search query. Maximum 500 characters. Example: 'Firecrawl API documentation'"
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
    provider: z.literal("firecrawl"),

    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })
    ),

    creditsUsed: z.number(),
  }),

  onInputAvailable: ({ input, toolCallId }) => {
    console.log(
      `[Firecrawl] Tool call ${toolCallId} received query: "${input.query}"`,
      `maxResults: ${input.maxResults}`
    );
  },

  execute: async ({ query, maxResults }, { abortSignal }) => {
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlApiKey}`,
      },

      body: JSON.stringify({
        query,
        limit: maxResults,
        sources: [
          {
            type: "web",
          },
        ],
        highlights: true,
      }),

      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Firecrawl search failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as {
      data?: {
        web?: Array<{
          title?: string;
          url?: string;
          markdown?: string;
          description?: string;
        }>;
      };
      creditsUsed?: number;
    };

    const rawResults = data?.data?.web ?? [];

    const results = rawResults.map((result) => ({
      title: result.title ?? "Untitled result",
      url: result.url ?? "",
      snippet:
        result.markdown?.slice(0, 300) ??
        result.description ??
        "",
    }));

    return {
      provider: "firecrawl" as const,
      results,
      creditsUsed: data.creditsUsed ?? 0,
    };
  },

  onOutput: ({ output, toolName, toolCallId }) => {
    console.log(
      `[Firecrawl] Tool ${toolName} call ${toolCallId} returned ${output.results.length} results, credits used: ${output.creditsUsed}`
    );
  },
});


// firecrawl fetch tool

export const firecrawlFetchPageTool = createTool({
  id: "firecrawl-fetch-page",

  description:
    "Fetch the main content of one public web page and return it as Markdown. Use this after finding a relevant URL with a search tool.",

  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe(
        "The public web page URL to fetch. Example: 'https://mastra.ai/docs'"
      ),

    maxLength: z
      .number()
      .int()
      .min(500)
      .max(20000)
      .default(8000)
      .describe(
        "Maximum number of Markdown characters to return. Use a smaller value to save tokens."
      ),
  }),

  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    markdown: z.string(),
    truncated: z.boolean(),
  }),

  onInputAvailable: ({ input, toolCallId }) => {
    console.log(
      `[Firecrawl Fetch] Tool call ${toolCallId} received URL: ${input.url}`,
      `maxLength: ${input.maxLength}`
    );
  },

  execute: async ({ url, maxLength }, { abortSignal }) => {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlApiKey}`,
      },

      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),

      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Firecrawl page fetch failed with status ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as {
      data?: {
        markdown?: string;
        metadata?: {
          title?: string;
        };
      };
    };

    const page = data?.data;
    const markdown = page?.markdown ?? "";
    const truncated = markdown.length > maxLength;

    return {
      url,
      title: page?.metadata?.title ?? "Untitled page",
      markdown: truncated ? markdown.slice(0, maxLength) : markdown,
      truncated,
    };
  },

  onOutput: ({ output, toolName, toolCallId }) => {
    console.log(
      `[Firecrawl Fetch] Tool ${toolName} call ${toolCallId} returned ${output.markdown.length} characters, truncated: ${output.truncated}`
    );
  },
});