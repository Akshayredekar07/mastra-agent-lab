
import { Mastra } from "@mastra/core";
import { researchAgent } from "./agents/research-agent";

export const mastra = new Mastra({
    agents: {
        researchAgent,
    },
});