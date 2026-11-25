import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";

import { exaSearchTool } from "../tools/exa-search-tool.ts";
import { tinyFishSearchTool } from "../tools/tinyfish-search-tool.ts";
import {
  firecrawlSearchTool,
  firecrawlFetchPageTool,
} from "../tools/firecrawl-search-tool.ts";
import { mcpClient } from "../mcp/clients.ts";
import { filesystemMcpClient } from "../mcp/filesystem-client.ts";
import { memoryMcpClient } from "../mcp/memory-client.ts"
import { fetchMcpClient } from "../mcp/fetch-client.ts";
import { gitMcpClient } from "../mcp/git-client.ts"
import { timeMcpClient } from "../mcp/time-client.ts";
import { sequentialThinkingMcpClient } from "../mcp/sequential-thinking-client.ts"


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

export const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Agent",

  instructions: `
You are a concise research and problem-solving assistant.

Available tools:
- exaSearchTool, tinyFishSearchTool, and firecrawlSearchTool: Search the web.
- firecrawlFetchPageTool: Fetch one public web page as Markdown.
- Filesystem MCP tools: List, read, and search files inside the allowed notes folder.
- Sequential Thinking MCP tool: Break down complex tasks and revise plans.

Tool rules:
- Use web tools for current events, products, documentation, and research.
- Use filesystem tools only inside the allowed notes folder.
- Use filesystem_list_directory before assuming a file exists.
- Use filesystem_read_file to read a specific file.
- Use filesystem_search_files to find files by name or content.
- Do not write, create, modify, or delete files unless the user explicitly asks you to save notes.
- Use Sequential Thinking only for complex planning, debugging, architecture, trade-off analysis, or multi-step research.
- Do not use Sequential Thinking for simple questions, definitions, greetings, or basic calculations.
- Select the most appropriate tools. Use multiple tools when necessary.
- Include source URLs when available.
- Never invent facts, sources, numbers, or citations.
- If evidence is insufficient, clearly say what is missing.
- Do not claim to have used a tool if it was not actually invoked.

Response rules:
- Give a direct answer first.
- Use concise, beginner-friendly explanations.
- Use bullet points or short sections when helpful.
- Cite source URLs immediately after relevant claims.
- Do not expose private reasoning or tool-call details.
`,

  model: nebiusModelInstance,

  tools: {
    exaSearchTool,
    tinyFishSearchTool,
    firecrawlSearchTool,
    firecrawlFetchPageTool,

    ...(await mcpClient.listToolsWithErrors().then((result) => {
      // console.log("WIKIPEDIA MCP TOOLS:", Object.keys(result.tools));
      // console.log("WIKIPEDIA MCP ERRORS:", result.errors);
      // console.log("WIKIPEDIA MCP ERROR DETAILS:", result.errorDetails);

      return result.tools;
    })),

    ...(await filesystemMcpClient.listToolsWithErrors().then((result) => {
      console.log("FILESYSTEM MCP TOOLS:", Object.keys(result.tools));
      console.log("FILESYSTEM MCP ERRORS:", result.errors);
      console.log("FILESYSTEM MCP ERROR DETAILS:", result.errorDetails);

      return result.tools;
    })),

    ...(await memoryMcpClient.listToolsWithErrors().then((result) => {
      console.log("MEMORY_MCP_TOOLS:", Object.keys(result.tools));
      console.log("MEMORY MCP ERRORS:", result.errors);

      return result.tools;
    })),

    ...(await fetchMcpClient.listToolsWithErrors().then((result) => {
      console.log("FETCH MCP TOOLS:", Object.keys(result.tools));
      console.log("FETCH MCP ERRORS:", result.errors);

      return result.tools;
    })),

    ...(await gitMcpClient.listToolsWithErrors().then((result) => {
      console.log("GIT MCP TOOLS:", Object.keys(result.tools));
      console.log("GIT MCP ERRORS:", result.errors);

      return result.tools;
    })),

    ...(await timeMcpClient.listToolsWithErrors().then((result) => {
      console.log("TIME MCP TOOLS:", Object.keys(result.tools));
      console.log("TIME MCP ERRORS:", result.errors);

      return result.tools;
    })),

    // ...(await sequentialThinkingMcpClient.listToolsWithErrors().then((result) => {
    //   console.log("SEQUENTIAL THINKING TOOLS:", Object.keys(result.tools));
    //   console.log("SEQUENTIAL THINKING ERRORS:", result.errors);

    //   return result.tools;
    // })),

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