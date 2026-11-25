import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'weather-tool',
  description: 'Fetches current weather for a city',

  inputSchema: z.object({
    location: z.string().describe('City name, for example Pune'),
  }),

  outputSchema: z.object({
    location: z.string(),
    temperatureCelsius: z.number(),
    conditions: z.string(),
  }),

  requireApproval: true, // correct

  // Optional tool-level lifecycle hooks
  onInputAvailable: ({ input }) => {
    console.log('Weather tool input:', input);
  },
  onOutput: ({ output }) => {
    console.log('Weather tool result:', output);
  },

  execute: async ({ location }, { abortSignal }) => {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      { signal: abortSignal },
    );

    if (!response.ok) {
      throw new Error(`Weather API failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      current_condition: Array<{
        temp_C: string;
        weatherDesc: Array<{ value: string }>;
      }>;
    };

    return {
      location,
      temperatureCelsius: Number(data.current_condition[0].temp_C),
      conditions: data.current_condition[0].weatherDesc[0].value,
    };
  },
});