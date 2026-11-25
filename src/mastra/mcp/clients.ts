
import { computeMean } from "@mastra/core/datasets";
import { withoutLiveRequestKeys } from "@mastra/core/request-context";
import { MCPClient } from "@mastra/mcp";

export const mcpClient = new MCPClient({
    id: "research-mcp-client",
    servers: {
        wikipedia: {
            command: "npx",
            args: ["-y", "wikipedia-mcp"]
        },
    }
})