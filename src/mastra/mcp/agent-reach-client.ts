// src/mcp/agent-reach-client.ts
import { MCPClient } from "@mastra/mcp";

export const agentReachMcpClient = new MCPClient({
  servers: {
    "agent-reach": {
      command: "py",
      args: ["-3", "-m", "agent_reach.integrations.mcp_server"],
    },
  },
});