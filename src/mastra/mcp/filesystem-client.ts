
import path from "node:path"
import { MCPClient } from "@mastra/mcp"


const projectroot = process.cwd()

// D:\mastra-agent-lab\notee
const allowedDirectory = path.join(projectroot, "notes")
console.log("Filesystem allowed directory:", allowedDirectory);

// ── filesystem mcp client ──

export const filesystemMcpClient = new MCPClient({
  id: "filesystem-mcp-client",

  servers: {
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        allowedDirectory,
      ],

      requireToolApproval: ({ toolName }) => {
        const name = toolName.toLowerCase();
        return (
          name.includes("write") ||
          name.includes("create") ||
          name.includes("delete") ||
          name.includes("move")
        );
      },
    },
  },
});