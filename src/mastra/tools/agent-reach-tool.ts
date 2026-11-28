// src/mastra/tools/agent-reach-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * The Agent-Reach CLI takes a top-level command first:
 *
 *   agent-reach <cmd> [target] [query]
 *
 * `cmd` is one of list | install | remove | doctor | get | skill | cache.
 * For `get`, `target` is a channel or `channel.command` (e.g. "youtube.info").
 *
 * The earlier version of this tool exposed `{ channel, action }` and built
 * `agent-reach <channel> <action>`, which never matched the CLI — every call
 * failed with "argument cmd: invalid choice: 'youtube'".
 */
export const AGENT_REACH_COMMANDS = [
  "get",
  "list",
  "install",
  "remove",
  "doctor",
  "skill",
  "cache",
] as const;

export type AgentReachCommand = (typeof AGENT_REACH_COMMANDS)[number];

export type AgentReachInput = {
  cmd: AgentReachCommand;
  target?: string;
  query?: string;
  channels?: string[];
  maxTokens?: number;
  limit?: number;
  json?: boolean;
  all?: boolean;
  dryRun?: boolean;
  channel?: string;
  write?: string;
};

/**
 * Build the argv for the Agent-Reach CLI.
 *
 * Arguments are returned as a list so that every value — including queries
 * with spaces or `&` — reaches the CLI as a single argument. Running the CLI
 * through a shell instead would let cmd.exe split on `&` and whitespace.
 */
export function buildAgentReachArgs(input: AgentReachInput): string[] {
  const args: string[] = [input.cmd];

  switch (input.cmd) {
    case "get": {
      if (!input.target?.trim()) {
        throw new Error(
          '`get` needs a `target` such as "youtube.info", "youtube.transcript" or "rss.feed". ' +
            'Run cmd "list" with all=true to see the available channels.',
        );
      }
      args.push(input.target.trim());
      if (input.query?.trim()) args.push(input.query);
      if (input.maxTokens !== undefined) {
        args.push("--max-tokens", String(input.maxTokens));
      }
      if (input.limit !== undefined) args.push("--limit", String(input.limit));
      if (input.json) args.push("--json");
      break;
    }

    case "list": {
      if (input.all) args.push("--all");
      break;
    }

    case "install": {
      if (!input.target?.trim()) {
        throw new Error(
          '`install` needs a `target` naming the channel to install, for example "youtube".',
        );
      }
      args.push(input.target.trim());
      if (input.dryRun) args.push("--dry-run");
      break;
    }

    case "remove": {
      if (!input.target?.trim()) {
        throw new Error(
          '`remove` needs a `target` naming the channel to remove, for example "rss".',
        );
      }
      args.push(input.target.trim());
      break;
    }

    case "doctor": {
      if (input.json) args.push("--json");
      if (input.channels?.length) args.push(...input.channels);
      break;
    }

    case "skill": {
      if (input.write) args.push("--write", input.write);
      break;
    }

    case "cache": {
      if (input.channel) args.push("--channel", input.channel);
      break;
    }
  }

  return args;
}

export const agentReachTool = createTool({
  id: "agent-reach",

  description: [
    "Read and search content through the Agent-Reach CLI, which exposes the content channels installed on this machine.",
    "",
    "Command shape: agent-reach <cmd> [target] [query]",
    "cmds: get, list, install, remove, doctor, skill, cache",
    "",
    "`get` takes a `target` of `channel` or `channel.command` — for example \"youtube.info\", \"youtube.transcript\", \"rss.feed\" — and an optional `query` (a URL, video id, or search phrase).",
    "Start with cmd \"list\" and all=true to discover the available channels, and cmd \"doctor\" to check whether they actually work.",
  ].join("\n"),

  inputSchema: z.object({
    cmd: z
      .enum(AGENT_REACH_COMMANDS)
      .describe(
        "Top-level CLI command. Use `get` to read content, `list` to discover channels, `doctor` to check channel health.",
      ),
    target: z
      .string()
      .optional()
      .describe(
        "For `get`: the channel or channel.command to read, e.g. \"youtube.info\", \"youtube.transcript\", \"rss.feed\". For `install`/`remove`: the channel name.",
      ),
    query: z
      .string()
      .optional()
      .describe(
        "For `get`: the URL, video id, or search phrase to read. Pass the whole thing as one string.",
      ),
    channels: z
      .array(z.string())
      .optional()
      .describe("For `doctor`: only check these channels."),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("For `get`: cap the number of output tokens. Use it for long sources."),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("For `get`: limit how many results to return."),
    json: z
      .boolean()
      .optional()
      .describe("For `get`/`doctor`: return raw JSON instead of formatted text."),
    all: z
      .boolean()
      .optional()
      .describe("For `list`: include every channel in the index, not just the installed ones."),
    dryRun: z
      .boolean()
      .optional()
      .describe("For `install`: print the install command without running it."),
    channel: z
      .string()
      .optional()
      .describe("For `cache`: only clear this channel's cache."),
    write: z
      .string()
      .optional()
      .describe("For `skill`: write the generated skill file to this path."),
  }),

  outputSchema: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number(),
    ok: z.boolean(),
  }),

  execute: async ({ cmd, ...rest }) => {
    const args = buildAgentReachArgs({ cmd, ...rest } as AgentReachInput);

    try {
      // No `shell: true` — the CLI must receive each argument verbatim.
      const { stdout, stderr } = await execFileAsync("agent-reach", args, {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        ok: true,
      };
    } catch (error) {
      const failure = error as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      const stdout = (failure.stdout ?? "").trim();
      const stderr = (failure.stderr ?? "").trim();
      const exitCode =
        typeof failure.code === "number" ? failure.code : 1;

      // `doctor` exits non-zero when a channel is unhealthy but still prints
      // its report on stdout. Returning it keeps the payload the caller needs.
      if (stdout) {
        return { stdout, stderr, exitCode, ok: false };
      }

      if (failure.code === "ENOENT") {
        throw new Error(
          "The agent-reach CLI is not installed or not on PATH. Install it with: pip install agent-reach",
        );
      }

      const detail = stderr || stdout || failure.message || "unknown error";
      throw new Error(
        `agent-reach ${args.join(" ")} failed (exit ${exitCode}): ${detail}`,
      );
    }
  },
});
