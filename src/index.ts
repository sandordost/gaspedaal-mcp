import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPersistentGaspedaalSearchExecutor } from "./gaspedaal";

const filterValueSchema = z.union([z.string().min(1), z.number()]);
const searchExecutor = createPersistentGaspedaalSearchExecutor();

const server = new McpServer({
  name: "gaspedaal-playwright-mcp",
  version: "0.1.0"
});

server.registerTool(
  "search_gaspedaal",
  {
    description:
      "Open een echte browser met Playwright en zoek op Gaspedaal met zoekterm, merk, model en optionele filters.",
    inputSchema: {
      query: z.string().min(1).optional().describe('Vrije zoekterm, bijvoorbeeld "Cupra".'),
      make: z.string().min(1).optional().describe('Merkfilter, bijvoorbeeld "Cupra".'),
      model: z.string().min(1).optional().describe('Modelfilter, bijvoorbeeld "Formentor".'),
      yearMin: filterValueSchema.optional().describe('Bouwjaar vanaf, bijvoorbeeld 2022.'),
      yearMax: filterValueSchema.optional().describe('Bouwjaar tot en met, bijvoorbeeld 2025.'),
      fuelType: z.string().min(1).optional().describe('Brandstof, bijvoorbeeld "Benzine" of "Hybride".'),
      priceMin: filterValueSchema.optional().describe('Minimum prijs in euro, bijvoorbeeld 20000.'),
      priceMax: filterValueSchema.optional().describe('Maximum prijs in euro, bijvoorbeeld 35000.'),
      mileageMin: filterValueSchema.optional().describe('Minimum kilometerstand, bijvoorbeeld 10000.'),
      mileageMax: filterValueSchema.optional().describe('Maximum kilometerstand, bijvoorbeeld 80000.'),
      bodyType: z.string().min(1).optional().describe('Carrosserie, bijvoorbeeld "SUV" of "Stationwagon".'),
      postcode: z.string().min(1).optional().describe('Nederlandse postcode voor afstandsfilter, bijvoorbeeld "3511AB".'),
      radius: filterValueSchema.optional().describe('Straal rond postcode, bijvoorbeeld 25 of "25 km".'),
      powerMin: filterValueSchema.optional().describe('Minimum vermogen in kW of pk, bijvoorbeeld 110 of "150 kW".'),
      powerMax: filterValueSchema.optional().describe('Maximum vermogen in kW of pk, bijvoorbeeld 200 of "272 pk".')
    }
  },
  async ({
    query,
    make,
    model,
    yearMin,
    yearMax,
    fuelType,
    priceMin,
    priceMax,
    mileageMin,
    mileageMax,
    bodyType,
    postcode,
    radius,
    powerMin,
    powerMax
  }) => {
    const result = await searchExecutor.search({
      query: query ?? undefined,
      make: make ?? (!query && !model ? "Cupra" : undefined),
      model: model ?? undefined,
      yearMin: yearMin ?? undefined,
      yearMax: yearMax ?? undefined,
      fuelType: fuelType ?? undefined,
      priceMin: priceMin ?? undefined,
      priceMax: priceMax ?? undefined,
      mileageMin: mileageMin ?? undefined,
      mileageMax: mileageMax ?? undefined,
      bodyType: bodyType ?? undefined,
      postcode: postcode ?? undefined,
      radius: radius ?? undefined,
      powerMin: powerMin ?? undefined,
      powerMax: powerMax ?? undefined
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

for (const eventName of ["SIGINT", "SIGTERM", "beforeExit"] as const) {
  process.once(eventName, () => {
    void searchExecutor.close().catch(() => undefined);
  });
}
