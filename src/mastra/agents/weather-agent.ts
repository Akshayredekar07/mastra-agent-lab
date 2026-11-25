// ── 5. Weather agent ──
//    File: src/mastra/agents/weather-agent.ts

import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
    id: 'weather-agent',
    name: 'Weather Agent',
    instructions: `
    You are helpful weather assistant.
    Use the weatherTool to fetch current weather data.`,
    model: 'google/gemini-3.5-flash-lite',
    tools: { weatherTool },
    hooks: {
    beforeToolCall: ({ toolName, input }) => {
      console.log('Running tool:', toolName, input);
    },
    afterToolCall: async ({ toolName, error }) => {
      console.log('Finished tool:', toolName, error ? 'failed' : 'ok');
    }
    },
});

