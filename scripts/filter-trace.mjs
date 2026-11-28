#!/usr/bin/env node
/**
 * filter-trace.mjs — shrink Mastra trace files so they can actually be debugged.
 *
 * Mastra traces are dominated by duplicated LLM payload snapshots. In practice
 * ~95% of the bytes are content you never look at while debugging:
 *
 *   processor_run  (68%)  Mastra's internal request processors snapshot the
 *                         ENTIRE message history on every inference. Pure dupes.
 *   model_step     (9%)   Same message history again, per step.
 *   mapping        (4%)   toModelOutput remap of the tool result — duplicates
 *                         the tool_call / mcp_tool_call span that owns it.
 *   model_inference(11%)  attributes.tools carries the full JSON Schema of
 *                         every tool, re-sent on every single call.
 *
 * This script drops the duplicates, replaces tool schemas with tool names,
 * and truncates giant payloads (HTML dumps, RSS feeds) while keeping head and
 * tail so the shape of the payload stays visible.
 *
 * Usage:
 *   node scripts/filter-trace.mjs <input> [output] [options]
 *   node scripts/filter-trace.mjs traces/            # filters every .json in dir
 *
 * Options:
 *   --max-chars=N     truncate long strings to N chars (default 1200)
 *   --max-payload=N   collapse any single payload bigger than N chars (default 2000)
 *   --preview=N       message preview length in compacted histories (default 200)
 *   --keep-processors keep processor_run spans (still compacted, not dropped)
 *   --keep-mapping    keep mapping spans (still compacted, not dropped)
 *   --drop=type       extra spanType to drop, comma separated (repeatable)
 *   --report=FILE     also write a human-readable markdown report
 *   --pretty          pretty-print the JSON output (larger file)
 *   --stdout          write filtered JSON to stdout instead of a file
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------- CLI parsing

const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const [key, inlineValue] = a.slice(2).split("=");
    if (inlineValue !== undefined) {
      flags.set(key, inlineValue);
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      flags.set(key, argv[++i]);
    } else {
      flags.set(key, true);
    }
  } else {
    positional.push(a);
  }
}

const MAX_CHARS = Number(flags.get("max-chars") ?? 1200);
const MAX_PAYLOAD = Number(flags.get("max-payload") ?? 2000);
const PREVIEW_CHARS = Number(flags.get("preview") ?? 200);
const PRETTY = flags.has("pretty");
const KEEP_PROCESSORS = flags.has("keep-processors");
const KEEP_MAPPING = flags.has("keep-mapping");
const EXTRA_DROP = new Set(
  String(flags.get("drop") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

if (!positional.length) {
  console.error("Usage: node scripts/filter-trace.mjs <input> [output] [--max-chars=N] [--report=FILE]");
  process.exit(1);
}

const inputPath = positional[0];
const outputPath =
  flags.get("stdout") === true
    ? null
    : positional[1] ??
      (fs.statSync(inputPath).isDirectory()
        ? null
        : inputPath.replace(/\.json$/i, "") + ".filtered.json");

// ------------------------------------------------------------------ utilities

const bytes = (v) => Buffer.byteLength(JSON.stringify(v ?? null));

function truncateString(s, limit = MAX_CHARS) {
  if (typeof s !== "string" || s.length <= limit) return s;
  const head = Math.floor(limit * 0.65);
  const tail = limit - head;
  return (
    s.slice(0, head) +
    `\n…[TRUNCATED ${s.length - limit} chars by filter-trace]…\n` +
    s.slice(-tail)
  );
}

/** Recursively truncate every long string inside a value. */
function scrub(value, limit = MAX_CHARS) {
  if (typeof value === "string") return truncateString(value, limit);
  if (Array.isArray(value)) return value.map((v) => scrub(v, limit));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = scrub(v, limit);
    }
    return out;
  }
  return value;
}

/**
 * Cap a payload by TOTAL size, not just per-string.
 *
 * Per-string truncation alone is not enough: a tool result can be a nested
 * object holding hundreds of short strings, so the whole thing stays huge.
 * Once the scrubbed payload still exceeds the budget we collapse it into a
 * marker that keeps a readable preview.
 */
function capPayload(value, total = MAX_PAYLOAD) {
  if (value === null || value === undefined) return value;
  const scrubbed = scrub(value);
  const json = JSON.stringify(scrubbed);
  if (!json || json.length <= total) return scrubbed;
  return {
    _truncated: true,
    _originalChars: json.length,
    _preview: json.slice(0, total),
  };
}

/** True when an array looks like a chat message list. */
function isMessageList(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.some((m) => m && typeof m === "object" && "role" in m)
  );
}

/** Replace a message array with a compact per-message summary. */
function compactMessages(messages) {
  if (!Array.isArray(messages)) return scrub(messages);
  return messages.map((m) => {
    if (!m || typeof m !== "object") return scrub(m);
    const content = m.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((p) =>
                typeof p === "string"
                  ? p
                  : p?.text ?? p?.content ?? JSON.stringify(p),
              )
              .join("\n")
          : JSON.stringify(content ?? "");
    const preview = truncateString(text, PREVIEW_CHARS);
    const role = m.role ?? m.type ?? "?";
    const entry = { role, chars: text.length };
    // Tool messages duplicate the tool_call span that owns them — keep the
    // shape, drop the payload.
    if (role !== "tool" && role !== "tool-result") entry.preview = preview;
    if (m.toolCallId) entry.toolCallId = m.toolCallId;
    if (m.name) entry.name = m.name;
    if (m.toolCalls) entry.toolCalls = scrub(m.toolCalls);
    return entry;
  });
}

/** Full JSON Schema for every tool, re-sent on every call. Names are enough. */
function compactToolSchemas(tools) {
  if (!Array.isArray(tools)) return tools;
  return tools.map((t) => {
    if (t && typeof t === "object" && t.name) {
      return {
        type: t.type ?? "function",
        name: t.name,
        description: t.description ? truncateString(t.description, 200) : "",
        parameterKeys: Object.keys(t.parameters?.properties ?? {}),
        required: t.parameters?.required ?? [],
      };
    }
    return scrub(t);
  });
}

// -------------------------------------------------------------- span filters

const DROP_BY_DEFAULT = new Set(["processor_run", "mapping"]);

function filterSpan(span) {
  const s = { ...span };

  // The message history is snapshotted on model_step, model_inference and
  // model_generation alike. Compact all of them to role + preview.
  if (isMessageList(s.input)) {
    s.input = compactMessages(s.input);
  } else if (s.input !== null && s.input !== undefined) {
    s.input = capPayload(s.input);
  }

  // model_inference / model_generation: strip the giant tool JSON Schemas.
  if (s.attributes?.tools) {
    s.attributes = {
      ...s.attributes,
      tools: compactToolSchemas(s.attributes.tools),
    };
  }

  // providerMetadata echoes the full tool payload back into span metadata.
  if (s.metadata?.providerMetadata) {
    s.metadata = {
      ...s.metadata,
      providerMetadata: capPayload(s.metadata.providerMetadata, 600),
    };
  }

  // Scrub remaining payloads with a total-size cap.
  if (s.output !== null && s.output !== undefined) {
    s.output = capPayload(s.output);
  }

  // Errors are the most valuable payload — the message is what identifies the
  // failure; the stack is the same boilerplate on every call, so cap it hard.
  if (s.error) {
    s.error = {
      ...s.error,
      message: truncateString(s.error.message ?? "", 2000),
    };
    if (s.error.stack) s.error.stack = truncateString(s.error.stack, 400);
  }

  return s;
}

// ------------------------------------------------------------------ reporting

function buildReport(traceId, spans, originalBytes) {
  const L = [];
  const byType = {};
  for (const s of spans) byType[s.spanType] = (byType[s.spanType] || 0) + 1;

  const runs = spans
    .filter((s) => s.spanType === "agent_run")
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  const calls = spans
    .filter((s) => s.spanType === "tool_call" || s.spanType === "mcp_tool_call")
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  L.push(`# Trace ${traceId}`);
  L.push("");
  L.push(
    `Filtered from ${(originalBytes / 1024 / 1024).toFixed(1)} MB to ${(bytes(spans) / 1024 / 1024).toFixed(1)} MB`,
  );
  L.push("");
  L.push(`**Spans kept:** ${spans.length} (${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(", ")})`);
  L.push("");

  L.push("## Agent runs");
  L.push("");
  L.push("| started | entity | outcome | error |");
  L.push("|---|---|---|---|");
  for (const r of runs) {
    const err = r.error?.message ? r.error.message.replace(/\s+/g, " ").slice(0, 120) : "";
    L.push(
      `| ${r.startedAt} | ${r.entityId} | ${r.outcome ?? "-"} | ${err} |`,
    );
  }
  L.push("");

  L.push("## Tool calls");
  L.push("");
  L.push("| # | started | tool | ok | input | error |");
  L.push("|---|---|---|---|---|---|");
  calls.forEach((c, i) => {
    const ok = c.attributes?.success;
    const inp = JSON.stringify(c.input ?? "").replace(/\s+/g, " ").slice(0, 110);
    const err = c.error?.message
      ? c.error.message.replace(/\s+/g, " ").slice(0, 110)
      : "";
    L.push(`| ${i + 1} | ${c.startedAt} | ${c.entityId} | ${ok} | ${inp} | ${err} |`);
  });
  L.push("");

  const failed = calls.filter((c) => c.error || c.attributes?.success === false);
  L.push(`## Failures (${failed.length} of ${calls.length} calls)`);
  L.push("");
  if (failed.length) {
    const grouped = new Map();
    for (const f of failed) {
      const key = (f.error?.message ?? "")
        .split("\n")
        .find((l) => l.trim())
        ?.slice(0, 160);
      if (!key) continue;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    L.push("| count | first error line |");
    L.push("|---|---|");
    for (const [k, v] of [...grouped].sort((a, b) => b[1] - a[1])) {
      L.push(`| ${v} | ${k.replace(/\|/g, "\\|")} |`);
    }
  } else {
    L.push("None.");
  }
  L.push("");

  return L.join("\n");
}

// ------------------------------------------------------------------ main loop

function filterTrace(raw) {
  const data = JSON.parse(raw);
  const spans = data.spans ?? [];
  const originalBytes = Buffer.byteLength(raw);

  const kept = [];
  const droppedCounts = {};

  for (const span of spans) {
    const drop =
      EXTRA_DROP.has(span.spanType) ||
      (!KEEP_PROCESSORS && span.spanType === "processor_run") ||
      (!KEEP_MAPPING && span.spanType === "mapping");

    if (drop) {
      droppedCounts[span.spanType] = (droppedCounts[span.spanType] ?? 0) + 1;
      continue;
    }
    kept.push(filterSpan(span));
  }

  return { data, kept, droppedCounts, originalBytes };
}

function processFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  const { data, kept, droppedCounts, originalBytes } = filterTrace(raw);

  const out = {
    traceId: data.traceId,
    spans: kept,
    _filter: {
      source: path.resolve(file),
      originalBytes,
      filteredBytes: bytes(kept),
      droppedSpans: droppedCounts,
      maxChars: MAX_CHARS,
    },
  };

  const target =
    outputPath ??
    path.join(
      path.dirname(file),
      path.basename(file).replace(/\.json$/i, "") + ".filtered.json",
    );

  const json = PRETTY ? JSON.stringify(out, null, 2) : JSON.stringify(out);
  if (target === "-") {
    process.stdout.write(json);
  } else {
    fs.writeFileSync(target, json);
  }

  console.log(
    `${path.basename(file)}: ${(originalBytes / 1024 / 1024).toFixed(1)} MB -> ` +
      `${(Buffer.byteLength(json) / 1024 / 1024).toFixed(1)} MB  ` +
      `(${kept.length} spans kept, ` +
      Object.entries(droppedCounts)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ") +
      " dropped)",
  );
  if (target !== "-") console.log(`  -> ${target}`);

  const reportPath = flags.get("report");
  if (reportPath) {
    const report = buildReport(data.traceId, kept, originalBytes);
    const finalReport =
      reportPath === true
        ? target.replace(/\.json$/i, "") + ".report.md"
        : reportPath;
    fs.writeFileSync(finalReport, report);
    console.log(`  -> ${finalReport}`);
  }
}

// ----------------------------------------------------------------------- main

const stat = fs.statSync(inputPath);
if (stat.isDirectory()) {
  const files = fs
    .readdirSync(inputPath)
    .filter(
      (f) =>
        f.toLowerCase().endsWith(".json") &&
        !f.includes(".filtered.") &&
        !f.includes(".report."),
    )
    .map((f) => path.join(inputPath, f));
  if (!files.length) {
    console.error(`No .json files in ${inputPath}`);
    process.exit(1);
  }
  for (const f of files) processFile(f);
} else {
  processFile(inputPath);
}
