
import { Mastra } from "@mastra/core";

// observability
import { LibSQLStore } from "@mastra/libsql";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from "@mastra/core/storage";
import {
    Observability,
    MastraStorageExporter,
    MastraPlatformExporter,
    SensitiveDataFilter
} from "@mastra/observability";


// import agents
import { researchAgent } from "./agents/research-agent";
import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
    storage: new MastraCompositeStore({
        id: 'composite-storage',
        default: new LibSQLStore({
            id: 'mastra-storage',
            url: 'file:./mastra.db'
        }),
        // domains
        domains: {
            observability: await new DuckDBStore().getStore('observability'),
        },
    }),

    //observability
    observability: new Observability({
        configs: {
            default: {
                serviceName: 'mastra',
                exporters: [
                    new MastraStorageExporter(), // Persists observability events to Mastra Storage
                    new MastraPlatformExporter(), // Sends observability events to Mastra platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
                ],
                spanOutputProcessors: [
                    new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
                ],
            },
        },
    }),

    // agents
    agents: {
        researchAgent,
        weatherAgent,
    },
});