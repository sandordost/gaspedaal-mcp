import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchGaspedaal } from "./gaspedaal";

const server = new McpServer({
  name: "gaspedaal-playwright-mcp",
  version: "0.1.0"
});

server.registerTool(
  "search_gaspedaal",
  {
    description: "Open een echte browser met Playwright en zoek op Gaspedaal met zoekterm, merk en model.",
    inputSchema: {
      query: z.string().min(1).optional().describe('Vrije zoekterm, bijvoorbeeld "Cupra".'),
      make: z.string().min(1).optional().describe('Merkfilter, bijvoorbeeld "Cupra".'),
      model: z.string().min(1).optional().describe('Modelfilter, bijvoorbeeld "Formentor".')
    }
  },
  async ({ query, make, model }) => {
    const result = await searchGaspedaal({
      query: query ?? undefined,
      make: make ?? (!query && !model ? "Cupra" : undefined),
      model: model ?? undefined
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      structuredContent: result as unknown as Record<string, unknown>
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});
