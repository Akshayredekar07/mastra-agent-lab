import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import {
  agentReachTool,
  buildAgentReachArgs,
  type AgentReachInput,
} from "../agent-reach-tool.ts";

const execFileAsync = promisify(execFile);

type ToolResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  ok: boolean;
};

async function runTool(input: AgentReachInput): Promise<ToolResult> {
  const result = await agentReachTool.execute!(input);
  return result as ToolResult;
}

async function agentReachInstalled(): Promise<boolean> {
  try {
    await execFileAsync("agent-reach", ["--help"], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

const HAS_CLI = await agentReachInstalled();

describe("buildAgentReachArgs", () => {
  test("get passes target and query positionally", () => {
    expect(
      buildAgentReachArgs({ cmd: "get", target: "youtube.info", query: "abc" }),
    ).toEqual(["get", "youtube.info", "abc"]);
  });

  test("get appends max-tokens, limit and json flags", () => {
    expect(
      buildAgentReachArgs({
        cmd: "get",
        target: "rss.feed",
        query: "https://example.com/feed.xml",
        maxTokens: 500,
        limit: 10,
        json: true,
      }),
    ).toEqual([
      "get",
      "rss.feed",
      "https://example.com/feed.xml",
      "--max-tokens",
      "500",
      "--limit",
      "10",
      "--json",
    ]);
  });

  test("a query with spaces stays one argument", () => {
    const args = buildAgentReachArgs({
      cmd: "get",
      target: "youtube.info",
      query: "Mastra AI agents",
    });
    expect(args).toEqual(["get", "youtube.info", "Mastra AI agents"]);
    expect(args.filter((a) => a === "Mastra AI agents")).toHaveLength(1);
  });

  test("a query containing & stays one argument", () => {
    const url = "https://example.com/feed.xml?a=1&b=2";
    expect(buildAgentReachArgs({ cmd: "get", target: "rss.feed", query: url })).toEqual([
      "get",
      "rss.feed",
      url,
    ]);
  });

  test("list emits --all only when asked", () => {
    expect(buildAgentReachArgs({ cmd: "list" })).toEqual(["list"]);
    expect(buildAgentReachArgs({ cmd: "list", all: true })).toEqual(["list", "--all"]);
  });

  test("install supports --dry-run", () => {
    expect(buildAgentReachArgs({ cmd: "install", target: "youtube", dryRun: true })).toEqual([
      "install",
      "youtube",
      "--dry-run",
    ]);
  });

  test("remove takes the channel name", () => {
    expect(buildAgentReachArgs({ cmd: "remove", target: "rss" })).toEqual(["remove", "rss"]);
  });

  test("doctor can target specific channels and request json", () => {
    expect(
      buildAgentReachArgs({ cmd: "doctor", channels: ["rss", "youtube"], json: true }),
    ).toEqual(["doctor", "--json", "rss", "youtube"]);
  });

  test("cache targets a single channel", () => {
    expect(buildAgentReachArgs({ cmd: "cache", channel: "rss" })).toEqual([
      "cache",
      "--channel",
      "rss",
    ]);
  });

  test("skill can write the skill file to a path", () => {
    expect(buildAgentReachArgs({ cmd: "skill", write: "out.md" })).toEqual([
      "skill",
      "--write",
      "out.md",
    ]);
  });

  test("get without a target is rejected", () => {
    expect(() => buildAgentReachArgs({ cmd: "get" })).toThrow(/target/i);
  });

  test("install without a channel is rejected", () => {
    expect(() => buildAgentReachArgs({ cmd: "install" })).toThrow(/target/i);
  });

  test("remove without a channel is rejected", () => {
    expect(() => buildAgentReachArgs({ cmd: "remove" })).toThrow(/target/i);
  });
});

describe.runIf(HAS_CLI)("agentReachTool.execute", () => {
  test("runs a real command and returns stdout", async () => {
    const result = await runTool({ cmd: "list", all: true });

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/rss|youtube/);
  });

  test("keeps & and spaces inside the query intact", async () => {
    const dir = path.join(os.tmpdir(), "agent-reach-test");
    fs.mkdirSync(dir, { recursive: true });
    // The name deliberately contains "&" and a space: under a shell, cmd.exe
    // splits on "&" and the whole call breaks.
    const file = path.join(dir, "feed&b test.xml");
    fs.writeFileSync(
      file,
      `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>` +
        `<item><title>Hello World</title><link>https://x.test/1</link></item></channel></rss>`,
    );
    const url = "file:///" + file.split(path.sep).join("/");

    const result = await runTool({ cmd: "get", target: "rss", query: url });

    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("Hello World");
    expect(result.stdout).toContain("feed&b test.xml");
  });

  test("returns doctor output even though the CLI exits non-zero", async () => {
    const result = await runTool({ cmd: "doctor", json: true });

    expect(result.ok).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain("channel");
  });

  test("surfaces the CLI error message for an unknown channel", async () => {
    await expect(
      agentReachTool.execute!({ cmd: "get", target: "not-a-channel", query: "x" }),
    ).rejects.toThrow(/not-a-channel/);
  });
});
