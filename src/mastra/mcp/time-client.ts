import { MCPClient } from "@mastra/mcp";

export const timeMcpClient = new MCPClient({
  id: "time-mcp-client",

  servers: {
    time: {
    "command": "uvx",
    "args": ["mcp-server-time"]
    },
  },
});