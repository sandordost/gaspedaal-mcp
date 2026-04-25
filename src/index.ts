import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createPersistentGaspedaalSearchExecutor } from "./gaspedaal";

const filterValueSchema = z.union([z.string().min(1), z.number()]);
const searchExecutor = createPersistentGaspedaalSearchExecutor();

function buildServer(): McpServer {
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
        yearMin: filterValueSchema.optional().describe("Bouwjaar vanaf, bijvoorbeeld 2022."),
        yearMax: filterValueSchema.optional().describe("Bouwjaar tot en met, bijvoorbeeld 2025."),
        fuelType: z.string().min(1).optional().describe('Brandstof, bijvoorbeeld "Benzine" of "Hybride".'),
        priceMin: filterValueSchema.optional().describe("Minimum prijs in euro, bijvoorbeeld 20000."),
        priceMax: filterValueSchema.optional().describe("Maximum prijs in euro, bijvoorbeeld 35000."),
        mileageMin: filterValueSchema.optional().describe("Minimum kilometerstand, bijvoorbeeld 10000."),
        mileageMax: filterValueSchema.optional().describe("Maximum kilometerstand, bijvoorbeeld 80000."),
        bodyType: z.string().min(1).optional().describe('Carrosserie, bijvoorbeeld "SUV" of "Stationwagon".'),
        postcode: z.string().min(1).optional().describe('Nederlandse postcode voor afstandsfilter, bijvoorbeeld "3511AB".'),
        radius: filterValueSchema.optional().describe('Straal rond postcode, bijvoorbeeld 25 of "25 km".'),
        powerMin: filterValueSchema.optional().describe('Minimum vermogen in kW of pk, bijvoorbeeld 110 of "150 kW".'),
        powerMax: filterValueSchema.optional().describe('Maximum vermogen in kW of pk, bijvoorbeeld 200 of "272 pk".'),
        includeSourceUrls: z
          .boolean()
          .optional()
          .describe("Voer extra UI-stappen uit om per listing de echte bron-URL's uit het Gaspedaal dialoog te verzamelen.")
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
      powerMax,
      includeSourceUrls
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
        powerMax: powerMax ?? undefined,
        includeSourceUrls: includeSourceUrls ?? undefined
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

  return server;
}

const app = express();
app.use(express.json());

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (req: any, res: any) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid: string) => {
        transports[sid] = transport;
      },
      enableDnsRebindingProtection: true,
      allowedHosts: [
        "127.0.0.1:3100",
        "127.0.0.1:3101",
        "localhost:3100",
        "localhost:3101",
        "100.76.72.108:3101",
        "openclaw:3101"
      ]
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        delete transports[sid];
      }
    };

    const server = buildServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP POST error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.get("/mcp", async (req: any, res: any) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session ID required or unknown session" },
        id: null
      });
      return;
    }

    await transports[sessionId].handleRequest(req, res);
  } catch (error) {
    console.error("MCP GET error:", error);

    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

const port = Number(process.env.PORT ?? 3100);
app.listen(port, "127.0.0.1", () => {
  console.log(`Gaspedaal MCP listening on http://127.0.0.1:${port}/mcp`);
});

for (const eventName of ["SIGINT", "SIGTERM", "beforeExit"] as const) {
  process.once(eventName, () => {
    void searchExecutor.close().catch(() => undefined);
  });
}
