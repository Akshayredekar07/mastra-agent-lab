// src/tools/agent-reach-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const agentReachTool = createTool({
  id: "agent-reach",

  description:
    "Run Agent-Reach to search and read social platforms such as X, Reddit, YouTube, GitHub, Bilibili, and XiaoHongShu. Use the channel and action names from the Agent-Reach CLI.",

  inputSchema: z.object({
    channel: z
      .string()
      .describe(
        "Platform channel, for example: youtube, github, reddit, twitter, bilibili, web.",
      ),
    action: z
      .string()
      .describe(
        "Action to perform, for example: search, read, browse, user, or comments.",
      ),
    args: z
      .array(z.string())
      .default([])
      .describe(
        "Additional CLI arguments, for example: ['LLM agents', '--limit', '5'].",
      ),
  }),

  outputSchema: z.object({
    stdout: z.string(),
    stderr: z.string(),
  }),

  execute: async ({ channel, action, args }) => {

    try {
      const { stdout, stderr } = await execFileAsync(
        "agent-reach",
        [channel, action, ...args],
        {
          shell: true,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      throw new Error(`Agent-Reach command failed: ${message}`);
    }
  },
});