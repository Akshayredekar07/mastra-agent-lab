import { Mastra } from "@mastra/core";

// observability
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from "@mastra/core/storage";
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from "@mastra/observability";

// agents
import { researchAgent } from "./agents/research-agent";
import { weatherAgent } from "./agents/weather-agent";
import { newResearchAgent } from "./agents/new-research-agent";
import { supervisorAgent } from "./agents/supervisor-agent";
import { agentReachAgent } from "./agents/agent-reach-agent";
import { scraplingAgent } from "./agents/scrapling-agent"
import { webIntelligenceAgent } from "./agents/web-intelligence-agent";

export const mastra = new Mastra({
  storage: new MastraCompositeStore({
    id: "composite-storage",
    domains: {
      observability: await new DuckDBStore().getStore("observability"),
    },
  }),

  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new MastraStorageExporter(),
          new MastraPlatformExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),

  agents: {
    // researchAgent,
    // newResearchAgent,
    // supervisorAgent,
    weatherAgent,
    agentReachAgent,
    scraplingAgent,
    webIntelligenceAgent,
  },
});