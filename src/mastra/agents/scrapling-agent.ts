// src/agents/scrapling-agent.ts
import { Agent } from "@mastra/core/agent";
import { nebiusModelInstance } from "../llm/nebius.ts";
import { scraplingMcpClient } from "../mcp/scrapling-client.ts";
import { capToolOutput } from "../tools/cap-tool-output.ts";

const scraplingTools = await scraplingMcpClient
  .listToolsWithErrors()
  .then((result) => {
    console.log("SCRAPLING TOOLS:", Object.keys(result.tools));
    console.log("SCRAPLING ERRORS:", result.errors);

    // Bound what each tool hands back to the model. One raw HTML page ran a
    // prompt to 1.1M tokens and aborted the run with
    // "The input (1109215 tokens) is longer than the model's context length".
    for (const tool of Object.values(result.tools)) {
      capToolOutput(tool);
    }

    return result.tools;
  });

export const scraplingAgent = new Agent({
  id: "scrapling-agent",
  name: "Scrapling Web Agent",

  description:
    "Fetches and crawls public web pages. Use this agent when the task needs page content, JavaScript-rendered pages, site crawling, or clean Markdown extraction from URLs.",

  instructions: `
You are a web fetching and crawling specialist.

Your job:
- Fetch one or more public web pages.
- Crawl a website when the user needs multiple pages.
- Handle JavaScript-rendered pages when needed.
- Return clean Markdown or structured page content.
- Preserve source URLs for every extracted page.

Rules:
- Only access public pages unless the user explicitly provides access details.
- Do not invent page content.
- If a page cannot be fetched, explain what failed.
- Prefer the smallest number of requests needed.
- Return the final content, not your internal tool process.
- Prefer extraction_type "markdown". Use "html" only when the raw markup is
  actually needed — a full HTML page is very large and gets truncated for you.
- Never ask for the same page twice.
`,

  model: nebiusModelInstance,
  tools: scraplingTools,
});
