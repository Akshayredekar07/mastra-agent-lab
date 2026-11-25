import { MCPClient } from "@mastra/mcp";

const projectRoot = process.cwd(); 

export const gitMcpClient = new MCPClient({
  id: "git-mcp-client",

  servers: {
    git: {
      command: "uvx",
      args: [
        "mcp-server-git",
        "--repository",
        projectRoot,
      ],

      requireToolApproval: ({ toolName }) => {
        const name = toolName.toLowerCase();
        return (
          name.includes("commit") ||
          name.includes("push") ||
          name.includes("checkout") ||
          name.includes("reset") ||
          name.includes("rm") ||
          name.includes("add") ||
          name.includes("write") ||
          name.includes("create") ||
          name.includes("delete")
        );
      },
    },
  },
});