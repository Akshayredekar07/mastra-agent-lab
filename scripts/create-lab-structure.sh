#!/usr/bin/env bash
set -euo pipefail

# Run from the root of mastra-agent-lab.
# Creates a learning-repository structure without creating a complete application.

mkdir -p \
  labs \
  notes \
  resources \
  assets/diagrams \
  assets/screenshots

for lab in \
  lab-01-first-mastra-agent \
  lab-02-safe-tool-using-agent \
  lab-03-structured-output-agent \
  lab-04-memory-aware-assistant \
  lab-05-streaming-agent-api \
  lab-06-human-in-the-loop-workflow \
  lab-07-multi-agent-system \
  lab-08-rag-knowledge-agent \
  lab-09-evaluated-guarded-agent \
  lab-10-deployable-agent-platform
do
  mkdir -p "labs/$lab/notes" "labs/$lab/examples" "labs/$lab/screenshots"
done

# Create lab README files
create_lab_readme() {
  local slug="$1"
  local title="$2"
  local deliverable="$3"
  local concepts="$4"

  cat > "labs/$slug/README.md" <<EOF
# $title

## Objective

Demonstrate $concepts using Mastra.

## Deliverable

$deliverable

## Status

Planned.

## Notes

Add implementation notes, architecture decisions, screenshots, and lessons learned here.
EOF
}

create_lab_readme \
  "lab-01-first-mastra-agent" \
  "First Mastra Agent" \
  "CLI research assistant" \
  "agent fundamentals, model routing, streaming, Studio"

create_lab_readme \
  "lab-02-safe-tool-using-agent" \
  "Safe Tool-Using Agent" \
  "Operations assistant" \
  "createTool, Zod, authorization, MCP"

create_lab_readme \
  "lab-03-structured-output-agent" \
  "Structured Output Agent" \
  "Resume/job-fit analyzer" \
  "Zod validation, structured output, retries"

create_lab_readme \
  "lab-04-memory-aware-assistant" \
  "Memory-Aware Assistant" \
  "Persistent support assistant" \
  "conversation history, working memory, semantic recall"

create_lab_readme \
  "lab-05-streaming-agent-api" \
  "Streaming Agent API" \
  "Real-time agent service" \
  "SSE, APIs, cancellation, frontend integration"

create_lab_readme \
  "lab-06-human-in-the-loop-workflow" \
  "Human-in-the-Loop Workflow" \
  "Invoice-processing workflow" \
  "workflow steps, branches, suspension, approvals"

create_lab_readme \
  "lab-07-multi-agent-system" \
  "Multi-Agent System" \
  "Software delivery assistant" \
  "delegation, supervisor pattern, typed handoffs"

create_lab_readme \
  "lab-08-rag-knowledge-agent" \
  "RAG Knowledge Agent" \
  "Enterprise knowledge-base agent" \
  "RAG, embeddings, retrieval, citations, MCP"

create_lab_readme \
  "lab-09-evaluated-guarded-agent" \
  "Evaluated and Guarded Agent" \
  "Production-readiness package" \
  "evals, scorers, guardrails, tracing"

create_lab_readme \
  "lab-10-deployable-agent-platform" \
  "Deployable Agent Platform" \
  "Team agent platform" \
  "Studio, CI/CD, secrets, observability"

# Create folder READMEs
cat > labs/README.md <<'EOF'
# Labs

This folder contains progressive Mastra learning labs.

Each lab has:

- `README.md` — objective, deliverable, status, and notes
- `notes/` — learning notes and research
- `examples/` — small code snippets or reference implementations
- `screenshots/` — Studio, terminal, or UI evidence

The labs are organized from basic agent fundamentals to production-ready agent systems.
EOF

cat > notes/README.md <<'EOF'
# Notes

Use this folder for framework research, learning notes, comparisons, and reference material.

Suggested files:

- `mastra-core.md`
- `tools-and-mcp.md`
- `workflows.md`
- `memory-and-rag.md`
- `evaluation-and-observability.md`
- `deployment.md`
EOF

cat > resources/README.md <<'EOF'
# Resources

Use this folder for curated links, official documentation summaries, templates, and reference material.

Suggested files:

- `official-docs.md`
- `articles.md`
- `examples.md`
- `templates.md`
EOF

cat > assets/README.md <<'EOF'
# Assets

Use this folder for diagrams, architecture sketches, screenshots, and other non-code assets.

Suggested folders:

- `diagrams/`
- `screenshots/`
EOF

# Keep empty folders in Git
touch \
  assets/diagrams/.gitkeep \
  assets/screenshots/.gitkeep

for lab in \
  lab-01-first-mastra-agent \
  lab-02-safe-tool-using-agent \
  lab-03-structured-output-agent \
  lab-04-memory-aware-assistant \
  lab-05-streaming-agent-api \
  lab-06-human-in-the-loop-workflow \
  lab-07-multi-agent-system \
  lab-08-rag-knowledge-agent \
  lab-09-evaluated-guarded-agent \
  lab-10-deployable-agent-platform
do
  touch \
    "labs/$lab/notes/.gitkeep" \
    "labs/$lab/examples/.gitkeep" \
    "labs/$lab/screenshots/.gitkeep"
done

echo "Repository learning structure created successfully."