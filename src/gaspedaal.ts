import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright-core";

export const GASPEDAAL_SEARCH_URL = "https://www.gaspedaal.nl/zoeken?srt=df-a";

export interface GaspedaalSearchOptions {
  query?: string;
  make?: string;
  model?: string;
  startUrl?: string;
  timeoutMs?: number;
}

export interface GaspedaalListing {
  listingId: string | null;
  title: string;
  priceDisplay: string | null;
  priceEur: number | null;
  year: number | null;
  mileageDisplay: string | null;
  mileageKm: number | null;
  seller: string | null;
  location: string | null;
  sourceSites: string[];
  features: string[];
  imageUrl: string | null;
  href: string | null;
}

export interface GaspedaalSearchResult {
  requestedQuery: string | null;
  requestedMake: string | null;
  requestedModel: string | null;
  appliedQuery: string | null;
  appliedMake: string | null;
  appliedModel: string | null;
  browser: string;
  startUrl: string;
  finalUrl: string;
  pageTitle: string;
  searchTriggered: boolean;
  resultCountText: string | null;
  totalMatches: number | null;
  pageListingCount: number;
  listings: GaspedaalListing[];
}

interface BrowserLaunchResult {
  browser: string;
  context: BrowserContext;
}

export async function searchGaspedaal(options: GaspedaalSearchOptions): Promise<GaspedaalSearchResult> {
  const query = normalizeInput(options.query);
  const make = normalizeInput(options.make);
  const model = normalizeInput(options.model);

  if (!query && !make && !model) {
    throw new Error("Geef minimaal een zoekterm, merk of model mee.");
  }

  if (model && !make) {
    throw new Error("Een modelfilter vereist ook een merkfilter.");
  }

  const startUrl = options.startUrl ?? GASPEDAAL_SEARCH_URL;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const userDataDir = path.resolve(process.cwd(), ".playwright", "gaspedaal-profile");
  const { browser, context } = await launchRealBrowser(userDataDir);
  const page = context.pages()[0] ?? (await context.newPage());
  let appliedQuery: string | null = null;
  let appliedMake: string | null = null;
  let appliedModel: string | null = null;

  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await dismissBlockingUi(page);
    const searchForm = await findVisibleLocator(
      [page.locator("#searchForm"), page.locator('[data-testid="searchbox"] form')],
      4_000
    );

    if (!searchForm) {
      throw new Error("Kon het Gaspedaal zoekformulier niet vinden.");
    }

    const beforeUrl = page.url();

    if (query) {
      const searchInput = await findVisibleLocator(
        [
          searchForm.getByPlaceholder(/Zoek op trefwoord/i),
          searchForm.getByRole("textbox", { name: /zoek/i }),
          searchForm.locator('input[placeholder*="Zoek"]'),
          searchForm.locator('input[type="search"]'),
          searchForm.locator("#trefw"),
          searchForm.locator("input")
        ],
        4_000
      );

      if (!searchInput) {
        throw new Error("Kon het Gaspedaal zoekveld niet vinden.");
      }

      await searchInput.click();
      await searchInput.fill(query);
      appliedQuery = normalizeInput(await searchInput.inputValue());
    }

    if (make) {
      appliedMake = await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="merk-dropdown"]').first(),
        make,
        "merk"
      );
    }

    if (model) {
      const modelInput = searchForm.locator('[data-testid="model-dropdown"]').first();
      await waitForLocatorEnabled(modelInput, 5_000);
      appliedModel = await selectComboboxValue(page, modelInput, model, "model");
    }

    const searchButton = await findVisibleLocator(
      [
        searchForm.getByRole("button", { name: /vinden|zoek/i }),
        searchForm.locator('button[type="submit"]'),
        searchForm.locator('input[type="submit"]')
      ],
      2_500
    );

    if (searchButton) {
      await dismissBlockingUi(page);
      await searchButton.scrollIntoViewIfNeeded();
      await searchButton.click();
    } else {
      if (!query) {
        throw new Error("Kon de knop om de zoekopdracht uit te voeren niet vinden.");
      }

      const searchInput = searchForm.locator('#trefw, input[name="trefw"]').first();
      await searchInput.press("Enter");
    }

    await waitForSearchResults(page, beforeUrl, [query, make, model].filter((value): value is string => Boolean(value)));
    const bodyText = normalizeWhitespace(await page.locator("body").innerText());
    const listings = await extractListings(page);
    const resultCountText = extractResultCountText(bodyText);
    const totalMatches = parseDutchInteger(resultCountText);

    return {
      requestedQuery: query,
      requestedMake: make,
      requestedModel: model,
      appliedQuery,
      appliedMake,
      appliedModel,
      browser,
      startUrl,
      finalUrl: page.url(),
      pageTitle: await page.title(),
      searchTriggered:
        page.url() !== beforeUrl || (query ? bodyText.toLowerCase().includes(query.toLowerCase()) : listings.length > 0),
      resultCountText,
      totalMatches,
      pageListingCount: listings.length,
      listings
    };
  } finally {
    await context.close();
  }
}

async function launchRealBrowser(userDataDir: string): Promise<BrowserLaunchResult> {
  await mkdir(userDataDir, { recursive: true });

  const browserCandidates = [
    { browser: "Microsoft Edge", channel: "msedge" as const },
    { browser: "Google Chrome", channel: "chrome" as const }
  ];
  const launchErrors: string[] = [];

  for (const candidate of browserCandidates) {
    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        channel: candidate.channel,
        headless: false,
        locale: "nl-NL",
        viewport: { width: 1440, height: 960 },
        slowMo: 75,
        args: ["--disable-blink-features=AutomationControlled"]
      });

      return {
        browser: candidate.browser,
        context
      };
    } catch (error) {
      launchErrors.push(`${candidate.browser}: ${toErrorMessage(error)}`);
    }
  }

  throw new Error(
    `Kon geen echte browser starten via Playwright. Zorg dat Edge of Chrome is geinstalleerd.\n${launchErrors.join("\n")}`
  );
}

async function dismissBlockingUi(page: Page): Promise<void> {
  await dismissCookieBanner(page);
  await dismissLoginPopup(page);
}

async function dismissCookieBanner(page: Page): Promise<void> {
  const candidateNames = [/alles accepteren/i, /accepteren/i, /akkoord/i, /toestaan/i];

  for (const name of candidateNames) {
    const button = await findVisibleLocator(
      [page.getByRole("button", { name }), page.locator("button", { hasText: name })],
      1_200
    );

    if (!button) {
      continue;
    }

    await button.click();
    await page.waitForTimeout(500);
    return;
  }
}

async function dismissLoginPopup(page: Page): Promise<void> {
  const closeButton = await findVisibleLocator(
    [
      page.locator('dialog[open] [data-testid="close-pop-up"]'),
      page.locator('[role="dialog"] [data-testid="close-pop-up"]'),
      page.locator('dialog [data-testid="close-pop-up"]')
    ],
    1_000
  );

  if (!closeButton) {
    return;
  }

  await closeButton.click();
  await page.waitForTimeout(400);
}

async function waitForSearchResults(page: Page, beforeUrl: string, searchHints: string[]): Promise<void> {
  const waiters: Promise<unknown>[] = [
    page.waitForURL((url) => url.toString() !== beforeUrl, { timeout: 15_000 }),
    page.getByText(/Alle occasions|Resultaten|We hebben .* occasions gevonden/i).first().waitFor({
      state: "visible",
      timeout: 15_000
    })
  ];

  for (const hint of searchHints) {
    waiters.push(
      page.getByText(new RegExp(escapeRegExp(hint), "i")).first().waitFor({ state: "visible", timeout: 15_000 })
    );
  }

  await Promise.race(waiters).catch(() => undefined);

  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);
}

async function selectComboboxValue(
  page: Page,
  input: Locator,
  value: string,
  label: "merk" | "model"
): Promise<string> {
  await dismissBlockingUi(page);
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(600);
  const optionScope = await getComboboxOptionScope(page, input);
  const matchingOption = optionScope.getByRole("option", {
    name: new RegExp(`^${escapeRegExp(value)}(?:\\s*\\(|$)`, "i")
  });

  if ((await matchingOption.count()) > 0) {
    await matchingOption.first().click();
  } else {
    const visibleOptions = await getTextList(optionScope.getByRole("option"));

    if (visibleOptions.length === 0) {
      throw new Error(`Kon geen opties vinden voor ${label} "${value}".`);
    }

    throw new Error(
      `Kon geen passende ${label}-optie vinden voor "${value}". Beschikbare opties: ${visibleOptions.slice(0, 8).join(", ")}`
    );
  }

  await page.waitForTimeout(400);
  const appliedValue = normalizeInput(await input.inputValue());

  if (!appliedValue) {
    throw new Error(`De gekozen ${label}-waarde "${value}" is niet toegepast.`);
  }

  return appliedValue;
}

async function getComboboxOptionScope(page: Page, input: Locator): Promise<Locator> {
  const inputId = await input.getAttribute("id");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const activeControls = await input.getAttribute("aria-controls");

    if (activeControls) {
      return page.locator(`[id="${escapeAttributeValue(activeControls)}"]`);
    }

    if (inputId) {
      const controlledList = page.locator(`[role="listbox"][aria-labelledby="${escapeAttributeValue(inputId)}"]`);

      if ((await controlledList.count()) > 0) {
        return controlledList;
      }
    }

    await page.waitForTimeout(100);
  }

  return page.locator("body");
}

async function waitForLocatorEnabled(locator: Locator, timeoutMs: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (!(await locator.isDisabled())) {
      return;
    }

    await locator.page().waitForTimeout(150);
  }

  throw new Error("Het modelveld werd niet actief na het kiezen van een merk.");
}

async function extractListings(page: Page): Promise<GaspedaalListing[]> {
  const cards = page.locator('[data-testid="occasion-item"]');
  const cardCount = await cards.count();
  const listings: GaspedaalListing[] = [];

  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    const href = await card.getAttribute("href");

    if (href?.startsWith("/importautos")) {
      continue;
    }

    const title = normalizeWhitespaceOrNull(await getTextContent(card.locator("h2").first()));

    if (!title) {
      continue;
    }

    const priceDisplay = normalizeWhitespaceOrNull(await getTextContent(card.locator('[data-testid="price"]').first()));
    const imageUrl = await getAttribute(card.locator("img").first(), "src");
    const contentColumn = card.locator("div.pl-m").first();
    const contentSections = contentColumn.locator(":scope > div");
    const metaSection = contentSections.nth(0);
    const sellerSection = contentSections.nth(1);
    const metaParagraphs = metaSection.locator(":scope > p");
    const yearMileageText = normalizeWhitespaceOrNull(await getTextContent(metaParagraphs.nth(0)));
    const features = await getTextList(metaParagraphs.nth(1).locator("span"));
    const sellerBlocks = sellerSection.locator(":scope > div");
    const sellerInfoBlock = sellerBlocks.nth(0);
    const sourceSitesBlock = sellerBlocks.nth(1);
    const seller = normalizeWhitespaceOrNull(await getTextContent(sellerInfoBlock.locator("span").first()));
    const sellerInfoText = normalizeWhitespaceOrNull(await getTextContent(sellerInfoBlock));
    const location = seller
      ? normalizeWhitespaceOrNull(sellerInfoText?.replace(seller, "") ?? null)
      : sellerInfoText;
    const sourceSitesText = (normalizeWhitespaceOrNull(await getTextContent(sourceSitesBlock)) ?? "").replace(
      /^Bekijk deze auto op:\s*/i,
      ""
    );

    listings.push({
      listingId: await card.getAttribute("id"),
      title,
      priceDisplay,
      priceEur: parseDutchInteger(priceDisplay),
      year: parseYear(yearMileageText),
      mileageDisplay: extractMileageDisplay(yearMileageText),
      mileageKm: parseDutchInteger(extractMileageDisplay(yearMileageText)),
      seller,
      location,
      sourceSites: dedupeStrings(splitCommaList(sourceSitesText)),
      features: dedupeStrings(features),
      imageUrl: imageUrl ? toAbsoluteUrl(imageUrl) : null,
      href: href ? toAbsoluteUrl(href) : null
    });
  }

  return listings;
}

async function findVisibleLocator(candidates: Locator[], timeoutMs: number): Promise<Locator | null> {
  for (const candidate of candidates) {
    const locator = candidate.first();

    try {
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      return locator;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeInput(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeWhitespaceOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function extractResultCountText(bodyText: string): string | null {
  const summaryMatch = bodyText.match(/We hebben\s+([\d.]+)\s+occasions gevonden/i);

  if (summaryMatch) {
    return `${summaryMatch[1]} occasions gevonden`;
  }

  const searchButtonMatch = bodyText.match(/Vinden\s+\(([\d.]+)\)/i);

  if (searchButtonMatch) {
    return `${searchButtonMatch[1]} occasions gevonden`;
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseDutchInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^\d]/g, "");

  if (!digits) {
    return null;
  }

  return Number(digits);
}

function parseYear(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function extractMileageDisplay(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const matches = Array.from(value.matchAll(/(\d[\d.]*)\s*km(?!\.)/gi));
  const match = matches.at(-1);
  return match ? `${match[1]} km` : null;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function toAbsoluteUrl(value: string): string {
  return new URL(value, "https://www.gaspedaal.nl").toString();
}

async function getTextContent(locator: Locator): Promise<string | null> {
  if ((await locator.count()) === 0) {
    return null;
  }

  return locator.textContent();
}

async function getAttribute(locator: Locator, name: string): Promise<string | null> {
  if ((await locator.count()) === 0) {
    return null;
  }

  return locator.getAttribute(name);
}

async function getTextList(locator: Locator): Promise<string[]> {
  const count = await locator.count();
  const values: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const text = normalizeWhitespaceOrNull(await locator.nth(index).textContent());

    if (text) {
      values.push(text);
    }
  }

  return values;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
