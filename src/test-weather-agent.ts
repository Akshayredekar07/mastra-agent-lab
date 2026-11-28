import "dotenv/config";
import { mastra } from "./mastra/index.ts";

const agent = mastra.getAgentById("weather-agent");

if (!agent) {
  throw new Error("Agent not found: weather-agent");
}

const first = await agent.generate(
  "What is the weather in Mumbai?",
  {
    memory: {
      resource: "user-123",
      thread: "weather-conversation-123",
    },
  }
);

console.log("First response:");
// console.log(JSON.stringify(first, null, 2));
console.log(first.text)

const second = await agent.generate(
  "What about tomorrow?",
  {
    memory: {
      resource: "user-123",
      thread: "weather-conversation-123",
    },
  }
);

console.log("\nSecond response:");
// console.log(JSON.stringify(second, null, 2));
console.log(second.text)