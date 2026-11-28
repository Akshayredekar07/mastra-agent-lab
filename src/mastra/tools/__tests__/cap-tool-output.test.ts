import { describe, expect, test } from "vitest";
import { capModelOutput, capToolOutput } from "../cap-tool-output.ts";

const LIMIT = 100;

describe("capModelOutput", () => {
  test("leaves short output untouched", () => {
    const output = { type: "text", value: "short" };
    expect(capModelOutput(output, LIMIT)).toEqual(output);
  });

  test("truncates a long text value and says how much was dropped", () => {
    const value = "a".repeat(500);
    const capped = capModelOutput({ type: "text", value }, LIMIT) as {
      type: string;
      value: string;
    };

    expect(capped.value.length).toBeLessThan(value.length);
    expect(capped.value).toContain("truncated");
    expect(capped.value).toContain("400");
  });

  test("keeps the head of the content and drops the tail", () => {
    const value = `${"head".repeat(30)}TAIL_MARKER`;
    const capped = capModelOutput({ type: "text", value }, LIMIT) as {
      value: string;
    };

    expect(capped.value).toContain("head");
    expect(capped.value).not.toContain("TAIL_MARKER");
  });

  test("caps every string inside a content array", () => {
    const output = { content: ["x".repeat(300), "y".repeat(300)] };
    const capped = capModelOutput(output, LIMIT) as { content: string[] };

    expect(capped.content).toHaveLength(2);
    for (const part of capped.content) {
      expect(part.length).toBeLessThan(300);
      expect(part).toContain("truncated");
    }
  });

  test("collapses a payload that is still huge after per-string truncation", () => {
    const output = { content: Array.from({ length: 50 }, () => "z".repeat(90)) };
    const capped = capModelOutput(output, LIMIT) as Record<string, unknown>;

    expect(JSON.stringify(capped).length).toBeLessThan(
      JSON.stringify(output).length,
    );
  });

  test("passes primitives through", () => {
    expect(capModelOutput(42, LIMIT)).toBe(42);
    expect(capModelOutput(null, LIMIT)).toBe(null);
    expect(capModelOutput(undefined, LIMIT)).toBe(undefined);
  });
});

describe("capToolOutput", () => {
  test("wraps a tool so its model output is capped", () => {
    const tool = {
      toModelOutput: (output: unknown) => ({
        type: "text",
        value: JSON.stringify(output),
      }),
    };

    capToolOutput(tool, LIMIT);

    const result = tool.toModelOutput({ body: "q".repeat(5000) }) as {
      value: string;
    };
    expect(result.value.length).toBeLessThan(5000);
    expect(result.value).toContain("truncated");
  });

  test("copes with a tool that has no toModelOutput", () => {
    const tool = {} as { toModelOutput?: (output: unknown) => unknown };

    capToolOutput(tool, LIMIT);

    expect(typeof tool.toModelOutput).toBe("function");
    const result = tool.toModelOutput!({ body: "q".repeat(5000) });
    expect(JSON.stringify(result)).toContain("truncated");
  });
});
