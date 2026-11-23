import "dotenv/config";
import { mastra } from "./mastra/index.ts";

const agent = mastra.getAgentById("research-agent");

if (!agent) {
  throw new Error("Agent not found: research-agent");
}

const response = await agent.generateLegacy(
  "Explain the difference between an AI agent and a workflow in two sentences."
);

console.log("Response:");
console.log(response.text);

console.log("\nUsage:");
console.log(response.usage);