// src/agents/agent-reach-agent.ts
import { Agent } from "@mastra/core/agent";
import { nebiusModelInstance } from "../llm/nebius.ts";
import { agentReachTool } from "../tools/agent-reach-tool.ts";

export const agentReachAgent = new Agent({
  id: "agent-reach-agent",
  name: "Social and Platform Research Agent",

  description:
    "Searches and reads social and platform content such as X, Reddit, YouTube, GitHub, Bilibili, and XiaoHongShu. Use this agent for opinions, discussions, transcripts, repository activity, and community research.",

  instructions: `
You are a social and platform research specialist.

Use the agentReachTool to run Agent-Reach CLI commands.

Command shape:
agent-reach <channel> <action> [args]

Examples:
- channel: "youtube", action: "search", args: ["LLM agents"]
- channel: "github", action: "search", args: ["vulnerability scanner"]
- channel: "reddit", action: "search", args: ["Scrapling"]
- channel: "web", action: "search", args: ["Mastra subagents"]

Rules:
- Run "agent-reach channels" first if you are unsure which channels and actions exist.
- Do not invent channel or action names.
- Return source links when available.
- If a platform requires login and fails, say so clearly.
- Summarise the findings instead of dumping raw CLI output.
`,

  model: nebiusModelInstance,

  tools: {
    agentReachTool,
  },
});