/**
 * Cap the payload a tool hands back to the model.
 *
 * Scrapling can return a full page of HTML — a single `scrapling_make_request`
 * against a search results page produced ~35 MB, which pushed the prompt to
 * 1.1M tokens and killed the run with:
 *
 *   AI_APICallError: The input (1109215 tokens) is longer than the model's
 *   context length (1048576 tokens).
 *
 * Capping at the `toModelOutput` boundary keeps the tool's real result intact
 * while bounding what the model has to read.
 */

/** Maximum characters for a single string inside a tool result. */
export const MAX_TOOL_OUTPUT_CHARS = 60_000;

/** Maximum characters for a whole tool result, after per-string truncation. */
export const MAX_TOOL_OUTPUT_TOTAL_CHARS = 240_000;

function truncateString(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const dropped = value.length - limit;
  return `${value.slice(0, limit)}\n…[truncated ${dropped} chars]…`;
}

/** Truncate every string inside a value, keeping the structure intact. */
function capStrings(value: unknown, limit: number): unknown {
  if (typeof value === "string") return truncateString(value, limit);
  if (Array.isArray(value)) return value.map((item) => capStrings(item, limit));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = capStrings(item, limit);
    }
    return out;
  }
  return value;
}

/**
 * Bound a tool result so it can never blow the model's context window.
 *
 * Strings are truncated individually, and if the payload is still too large
 * it collapses into a single preview.
 */
export function capModelOutput(
  value: unknown,
  limit = MAX_TOOL_OUTPUT_CHARS,
  totalLimit?: number,
): unknown {
  const capped = capStrings(value, limit);

  // The total budget scales with the per-string limit so a caller that
  // lowers `limit` gets a proportionally smaller overall payload.
  const total = totalLimit ?? limit * 4;

  const json = JSON.stringify(capped);
  if (!json || json.length <= total) return capped;

  return {
    type: "text",
    value: `[output truncated: ${json.length} chars total]\n${json.slice(0, limit)}`,
  };
}

/**
 * Wrap a tool so the payload it sends to the model is capped.
 *
 * The tool's own execute result is untouched — only the model-facing
 * representation is bounded.
 */
export function capToolOutput<T extends object>(
  tool: T,
  limit = MAX_TOOL_OUTPUT_CHARS,
): T {
  const holder = tool as { toModelOutput?: (output: unknown) => unknown };
  const original = holder.toModelOutput?.bind(holder);

  holder.toModelOutput = (output: unknown) =>
    capModelOutput(original ? original(output) : output, limit);

  return tool;
}
