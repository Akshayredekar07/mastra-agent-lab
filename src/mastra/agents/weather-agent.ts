import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { memoryStorage } from "../storage";
import { weatherTool } from "../tools/weather-tool";

const weatherMemory = new Memory({
  storage: memoryStorage,
  options: {
    lastMessages: 20,
  },
});

export const weatherAgent = new Agent({
  id: "weather-agent",
  name: "Weather Agent",

  instructions: `
You are a helpful weather assistant.
Use the weatherTool to fetch current weather data.
`,

  model: "google/gemini-3.5-flash-lite",

  memory: weatherMemory,

  tools: {
    weatherTool,
  },

  // hooks: {
  //   beforeToolCall: ({ toolName, input }) => {
  //     console.log("Running tool:", toolName, input);
  //   },

  //   afterToolCall: async ({ toolName, error }) => {
  //     console.log("Finished tool:", toolName, error ? "failed" : "ok");
  //   },
  // },
});