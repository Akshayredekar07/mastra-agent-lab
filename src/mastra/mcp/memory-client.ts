import path from "node:path";
import { MCPClient } from "@mastra/mcp";

const projectRoot = "D:\\mastra-agent-lab";

const notesDirectory = path.join(projectRoot, "notes");

const memoryFilePath = path.join(notesDirectory, "agent-memory.jsonl");

console.log("Memory file path:", memoryFilePath);

export const memoryMcpClient = new MCPClient({
  id: "memory-mcp-client",

  servers: {
    memory: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],

      env: {
        MEMORY_FILE_PATH: memoryFilePath,
      },
    },
  },
});