# Mastra Agent Lab

A hands-on lab for building production-ready AI agents with **[Mastra](https://mastra.ai/ai-agent-framework)** — a TypeScript-first framework for agents, tools, workflows, memory, RAG, evaluation, observability, and deployment.

This repository contains progressive labs that move from a basic agent to production-ready agent systems. Each lab focuses on one practical engineering concern: tools, structured output, memory, streaming, workflows, multi-agent systems, RAG, evaluation, and deployment.

---

## What this lab covers

| Lab | Focus | Deliverable |
|---|---|---|
| 01 | Agent fundamentals | CLI research assistant |
| 02 | Tools and safety | Operations assistant |
| 03 | Structured output | Resume/job-fit analyzer |
| 04 | Memory and context | Persistent support assistant |
| 05 | Streaming and APIs | Real-time agent service |
| 06 | Workflows and approvals | Invoice-processing workflow |
| 07 | Multi-agent systems | Software delivery assistant |
| 08 | RAG and MCP | Enterprise knowledge-base agent |
| 09 | Evaluation and safety | Production-readiness package |
| 10 | Deployment and operations | Team agent platform |

---

## Tech stack

- **Language:** TypeScript
- **Agent framework:** [Mastra](https://mastra.ai/ai-agent-framework)
- **Runtime:** Node.js 22+
- **Validation:** Zod
- **Testing:** Vitest
- **Package manager:** npm or pnpm

---

## Repository structure

```text
mastra-agent-lab/
├── docs/
│   ├── 00-roadmap.md
│   ├── 01-architecture-decisions.md
│   ├── 02-evaluation-checklist.md
│   └── 03-production-checklist.md
├── projects/
│   ├── lab-01-first-mastra-agent/
│   ├── lab-02-safe-tool-using-agent/
│   ├── lab-03-structured-output-agent/
│   ├── lab-04-memory-aware-assistant/
│   ├── lab-05-streaming-agent-api/
│   ├── lab-06-human-in-the-loop-workflow/
│   ├── lab-07-multi-agent-system/
│   ├── lab-08-rag-knowledge-agent/
│   ├── lab-09-evaluated-guarded-agent/
│   └── lab-10-deployable-agent-platform/
├── src/
├── tests/
├── .env.example
├── package.json
└── README.md
```

---

## Quick start

### Prerequisites

- Node.js 22+
- npm or pnpm
- An LLM provider API key

### Install

```bash
git clone [https://github.com/Akshayredekar07/mastra-agent-lab.git](https://github.com/Akshayredekar07/mastra-agent-lab.git)
cd mastra-agent-lab

npm install
```

### Configure environment

```bash
cp .env.example .env
```

Add your provider API key:

```env
OPENAI_API_KEY=your_openai_api_key
```

Never commit API keys or real user data.

### Run

```bash
npm run dev
```

### Run tests

```bash
npm run test
```

---

## Example

```ts
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core";

const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Agent",
  instructions: `
You are a concise research assistant.

Rules:
- Answer only from information provided by tools or the user.
- If evidence is insufficient, say what is missing.
- Never fabricate sources, figures, or citations.
`,
  model: "openai/gpt-6.1-sol",
});

export const mastra = new Mastra({
  agents: {
    researchAgent,
  },
});
```

---

## Documentation

- [Roadmap](./docs/00-roadmap.md)
- [Architecture decisions](./docs/01-architecture-decisions.md)
- [Evaluation checklist](./docs/02-evaluation-checklist.md)


---

## Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra Agents](https://mastra.ai/docs/agents/overview)
- [Mastra Tools](https://mastra.ai/docs/agents/tools)
- [Mastra Workflows](https://mastra.ai/docs/workflows/overview.md)
- [Mastra Studio](https://mastra.ai/docs/studio/overview)
- [Zod Documentation](https://zod.dev/)

---

## License

This project is licensed under the [MIT License](./LICENSE).