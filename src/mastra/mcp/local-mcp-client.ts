import path from "node:path";
import { MCPClient } from "@mastra/mcp";

const projectRoot = "D:\\mastra-agent-lab";

const notesDirectory = path.join(projectRoot, "notes");

const memoryFilePath = path.join(notesDirectory, "agent-memory.jsonl");

export const localMcpClient = new MCPClient({
  id: "local-mcp-client",

  servers: {
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        notesDirectory,
      ],

      requireToolApproval: ({ toolName }) => {
        return (
          toolName.includes("write") ||
          toolName.includes("create") ||
          toolName.includes("delete") ||
          toolName.includes("move")
        );
      },
    },

    memory: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],

      env: {
        MEMORY_FILE_PATH: memoryFilePath,
      },
    },

    sequentialThinking: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking",
      ],
    },
  },
});