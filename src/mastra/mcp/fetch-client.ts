import { MCPClient } from "@mastra/mcp";

export const fetchMcpClient = new MCPClient({
    id: "fetch-mcp-client",

    servers: {
        fetch: {
            command: 'uvx',
            args: ['mcp-server-fetch'],
        },
    },
});