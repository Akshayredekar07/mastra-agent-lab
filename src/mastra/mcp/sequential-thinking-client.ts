import { MCPClient } from "@mastra/mcp";

export const sequentialThinkingMcpClient = new MCPClient({
  id: "sequential-thinking-mcp-client",

  servers: {
    sequentialThinking: {
      command: "cmd",
      args: [
        "/c",
        "npx",
        "-y",
        "@modelcontextprotocol/server-sequential-thinking",
      ],
    },
  },
});