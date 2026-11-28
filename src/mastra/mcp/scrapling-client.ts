// src/mcp/scrapling-client.ts
import { MCPClient } from "@mastra/mcp";

export const scraplingMcpClient = new MCPClient({
  servers: {
    scrapling: {
      command: "scrapling-mcp",
      args: [],
    },
  },
});