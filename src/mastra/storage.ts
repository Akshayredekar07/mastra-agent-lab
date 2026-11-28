import { LibSQLStore } from "@mastra/libsql";

export const memoryStorage = new LibSQLStore({
  id: "mastra-memory-storage",
  url: "file:./mastra.db",
});