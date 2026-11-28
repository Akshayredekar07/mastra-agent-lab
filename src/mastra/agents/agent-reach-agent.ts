// src/agents/agent-reach-agent.ts
import { Agent } from "@mastra/core/agent";
import { nebiusModelInstance } from "../llm/nebius.ts";
import { agentReachTool } from "../tools/agent-reach-tool.ts";

export const agentReachAgent = new Agent({
  id: "agent-reach-agent",
  name: "Social and Platform Research Agent",

  description:
    "Reads content from the channels installed on this machine: RSS/Atom feeds, and YouTube video metadata and transcripts. Use this agent when you already have a feed URL or a YouTube video URL/id. It cannot discover URLs on its own, and it has no Reddit, X, or GitHub support.",

  instructions: `
You are a content reading specialist. You read content through the Agent-Reach CLI using the agentReachTool.

The CLI takes a TOP-LEVEL COMMAND first — the command is never the channel name:

  agent-reach <cmd> [target] [query]

Commands:
- list    : show installed channels. Pass all=true to list every channel in the index.
- doctor  : check whether channels actually work. Pass json=true for a structured report.
- get     : read content. The target is "channel" or "channel.command".
- install : add a channel. Pass dryRun=true to preview without installing.
- remove  : drop a channel.
- cache   : clear cached responses. Pass channel to target one channel.
- skill   : generate the agent skill file.

The tool returns { stdout, stderr, exitCode, ok }. If ok is false but stdout is
not empty, stdout IS the result — that is how "doctor" reports an unhealthy
channel. Only treat it as a failure when stdout is empty and the tool threw.

Channels that exist in this install — these are the only ones:
- rss.feed           : read any RSS or Atom feed as clean text.
- youtube.info       : video metadata.
- youtube.transcript : video transcript.

The youtube channel needs yt-dlp on PATH. Run cmd "doctor" if a call fails.

Rules:
- Start with cmd "list" and all=true to confirm the channels, and cmd "doctor" to confirm they work. Do this once per task, not before every call.
- Never invent a channel or a command. There is no reddit, x, twitter, github, web, bilibili or duckduckgo channel here.
- Pass the query as ONE string. Do not add your own quotes around it.
- Use maxTokens for anything long so the result stays small.
- There is NO youtube search command. To read a video you need its URL or id first — find one with a feed (rss.feed) or a web page, then call youtube.info or youtube.transcript.
- Return source links when available.
- If a platform needs login and fails, say so plainly instead of retrying.
- Summarise the findings. Do not dump raw CLI output at the user.
`,

  model: nebiusModelInstance,

  tools: {
    agentReachTool,
  },
});
