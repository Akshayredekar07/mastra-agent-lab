// src/agents/scrapling-agent.ts
import { Agent } from "@mastra/core/agent";
import { nebiusModelInstance } from "../llm/nebius.ts";
import { scraplingMcpClient } from "../mcp/scrapling-client.ts";

const scraplingTools = await scraplingMcpClient
  .listToolsWithErrors()
  .then((result) => {
    console.log("SCRAPLING TOOLS:", Object.keys(result.tools));
    console.log("SCRAPLING ERRORS:", result.errors);
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
`,

  model: nebiusModelInstance,
  tools: scraplingTools,
});