import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright-core";

export const GASPEDAAL_SEARCH_URL = "https://www.gaspedaal.nl/zoeken?srt=df-a";

export interface GaspedaalSearchOptions {
  query?: string;
  make?: string;
  model?: string;
  yearMin?: string | number;
  yearMax?: string | number;
  fuelType?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  mileageMin?: string | number;
  mileageMax?: string | number;
  bodyType?: string;
  postcode?: string;
  radius?: string | number;
  powerMin?: string | number;
  powerMax?: string | number;
  slowMoMs?: number;
  actionDelayMs?: number;
  startUrl?: string;
  timeoutMs?: number;
}

export interface GaspedaalListing {
  listingId: string | null;
  title: string;
  priceDisplay: string | null;
  priceEur: number | null;
  year: number | null;
  mileage: number | null;
  mileageDisplay: string | null;
  mileageKm: number | null;
  fuelType: string | null;
  engineSize: string | null;
  power: string | null;
  transmission: string | null;
  bodyType: string | null;
  color: string | null;
  doors: string | null;
  seller: string | null;
  location: string | null;
  sources: string[];
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

interface ParsedListingFeatures {
  fuelType: string | null;
  engineSize: string | null;
  power: string | null;
  transmission: string | null;
  bodyType: string | null;
  color: string | null;
  doors: string | null;
}

interface ComboboxMatchOptions {
  aliases?: string[];
  numericTokenIndex?: number;
}

export async function searchGaspedaal(options: GaspedaalSearchOptions): Promise<GaspedaalSearchResult> {
  const query = normalizeInput(options.query);
  const make = normalizeInput(options.make);
  const model = normalizeInput(options.model);
  const yearMin = normalizeInput(options.yearMin);
  const yearMax = normalizeInput(options.yearMax);
  const fuelType = normalizeInput(options.fuelType);
  const priceMin = normalizeInput(options.priceMin);
  const priceMax = normalizeInput(options.priceMax);
  const mileageMin = normalizeInput(options.mileageMin);
  const mileageMax = normalizeInput(options.mileageMax);
  const bodyType = normalizeInput(options.bodyType);
  const postcode = normalizeInput(options.postcode);
  const radius = normalizeInput(options.radius);
  const powerMin = normalizeInput(options.powerMin);
  const powerMax = normalizeInput(options.powerMax);
  const slowMoMs = options.slowMoMs ?? getDefaultSlowMoMs();
  const actionDelayMs = options.actionDelayMs ?? getDefaultActionDelayMs();

  if (!query && !make && !model) {
    throw new Error("Geef minimaal een zoekterm, merk of model mee.");
  }

  if (model && !make) {
    throw new Error("Een modelfilter vereist ook een merkfilter.");
  }

  if (radius && !postcode) {
    throw new Error("Een straalfilter vereist ook een postcode.");
  }

  const startUrl = options.startUrl ?? GASPEDAAL_SEARCH_URL;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const userDataDir = path.resolve(process.cwd(), ".playwright", "gaspedaal-profile");
  const { browser, context } = await launchRealBrowser(userDataDir, slowMoMs);
  const page = context.pages()[0] ?? (await context.newPage());
  let appliedQuery: string | null = null;
  let appliedMake: string | null = null;
  let appliedModel: string | null = null;
  let advancedFiltersExpanded = false;

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
      await pauseBetweenActions(page, actionDelayMs);
      appliedQuery = normalizeInput(await searchInput.inputValue());
    }

    if (make) {
      appliedMake = await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="merk-dropdown"]').first(),
        make,
        "merk",
        actionDelayMs
      );
    }

    if (model) {
      const modelInput = searchForm.locator('[data-testid="model-dropdown"]').first();
      await waitForLocatorEnabled(modelInput, 5_000);
      appliedModel = await selectComboboxValue(page, modelInput, model, "model", actionDelayMs);
    }

    if (yearMin) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="bmin-dropdown"]').first(),
        yearMin,
        "bouwjaar min",
        actionDelayMs,
        { numericTokenIndex: 0 }
      );
    }

    if (yearMax) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="bmax-dropdown"]').first(),
        yearMax,
        "bouwjaar max",
        actionDelayMs,
        { numericTokenIndex: 0 }
      );
    }

    if (fuelType) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="brnst-dropdown"]').first(),
        fuelType,
        "brandstof",
        actionDelayMs,
        { aliases: getFuelTypeAliases(fuelType) }
      );
    }

    if (priceMin) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="pmin-dropdown"]').first(),
        priceMin,
        "prijs min",
        actionDelayMs,
        { numericTokenIndex: 0 }
      );
    }

    if (priceMax) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="pmax-dropdown"]').first(),
        priceMax,
        "prijs max",
        actionDelayMs,
        { numericTokenIndex: 0 }
      );
    }

    if (mileageMin) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="kmin-dropdown"]').first(),
        mileageMin,
        "kilometerstand min",
        actionDelayMs,
        { numericTokenIndex: 0 }
      );
    }

    if (mileageMax) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="kmax-dropdown"]').first(),
        mileageMax,
        "kilometerstand max",
        actionDelayMs,
        { numericTokenIndex: 0 }
      );
    }

    if (bodyType) {
      const bodyTypeInput = searchForm.locator('[data-testid="crs-dropdown"]').first();

      if (!(await bodyTypeInput.isVisible().catch(() => false))) {
        await ensureAdvancedFiltersExpanded(page, searchForm, actionDelayMs);
        advancedFiltersExpanded = true;
      }

      await selectComboboxValue(
        page,
        bodyTypeInput,
        bodyType,
        "carrosserie",
        actionDelayMs,
        {
          aliases: getBodyTypeAliases(bodyType)
        }
      );
    }

    if (postcode || radius || powerMin || powerMax) {
      await ensureAdvancedFiltersExpanded(page, searchForm, actionDelayMs);
      advancedFiltersExpanded = true;
    }

    if (postcode) {
      const postcodeInput = searchForm.locator('#pc-id, input[name="pc"]').first();
      await postcodeInput.scrollIntoViewIfNeeded();
      await postcodeInput.fill(postcode);
      await pauseBetweenActions(page, actionDelayMs);
    }

    if (radius) {
      const radiusInput = searchForm.locator('[data-testid="strl-dropdown"]').first();
      await waitForLocatorEnabled(radiusInput, 5_000);
      await selectComboboxValue(page, radiusInput, radius, "straal", actionDelayMs, {
        numericTokenIndex: 0
      });
    }

    if (powerMin) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="vmin-dropdown"]').first(),
        powerMin,
        "vermogen min",
        actionDelayMs,
        { numericTokenIndex: getPowerNumericTokenIndex(powerMin) }
      );
    }

    if (powerMax) {
      await selectComboboxValue(
        page,
        searchForm.locator('[data-testid="vmax-dropdown"]').first(),
        powerMax,
        "vermogen max",
        actionDelayMs,
        { numericTokenIndex: getPowerNumericTokenIndex(powerMax) }
      );
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
      if (advancedFiltersExpanded) {
        await pauseBetweenActions(page, actionDelayMs);
      }
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

async function launchRealBrowser(userDataDir: string, slowMoMs: number): Promise<BrowserLaunchResult> {
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
        slowMo: slowMoMs,
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
    if (await clickFirstVisible([page.getByRole("button", { name }), page.locator("button", { hasText: name })])) {
      return;
    }
  }
}

async function dismissLoginPopup(page: Page): Promise<void> {
  await clickFirstVisible(
    [
      page.locator('dialog[open] [data-testid="close-pop-up"]'),
      page.locator('[role="dialog"] [data-testid="close-pop-up"]'),
      page.locator('dialog [data-testid="close-pop-up"]')
    ]
  );
}

async function ensureAdvancedFiltersExpanded(page: Page, searchForm: Locator, actionDelayMs: number): Promise<void> {
  const advancedButton = searchForm.locator('[data-testid="advanced-filters-btn"]').first();

  if ((await advancedButton.count()) === 0) {
    throw new Error("Kon de knop voor meer filters niet vinden.");
  }

  const buttonText = normalizeWhitespaceOrNull(await getTextContent(advancedButton));

  if (!buttonText?.toLowerCase().includes("minder filters")) {
    await dismissBlockingUi(page);
    await advancedButton.scrollIntoViewIfNeeded();
    await advancedButton.click();
    await pauseBetweenActions(page, actionDelayMs);
  }

  await searchForm.locator('#pc-id, [data-testid="vmin-dropdown"]').first().waitFor({
    state: "visible",
    timeout: 5_000
  });
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

  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => undefined);
  await page.locator('[data-testid="occasion-item"]').first().waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
}

async function selectComboboxValue(
  page: Page,
  input: Locator,
  value: string,
  label: string,
  actionDelayMs: number,
  matchOptions: ComboboxMatchOptions = {}
): Promise<string> {
  await dismissBlockingUi(page);
  await input.scrollIntoViewIfNeeded();
  await input.click({ force: true }).catch(async () => {
    await input.focus();
  });
  await input.fill(value);
  const optionScope = await getComboboxOptionScope(page, input);
  const optionLocator = optionScope.getByRole("option");
  await waitForComboboxOptions(optionLocator);
  const matchingOptionIndex = await findMatchingOptionIndex(optionLocator, value, matchOptions);

  if (matchingOptionIndex !== null) {
    await optionLocator.nth(matchingOptionIndex).click();
  } else {
    const visibleOptions = await getTextList(optionLocator);

    if (visibleOptions.length === 0) {
      throw new Error(`Kon geen opties vinden voor ${label} "${value}".`);
    }

    throw new Error(
      `Kon geen passende ${label}-optie vinden voor "${value}". Beschikbare opties: ${visibleOptions.slice(0, 8).join(", ")}`
    );
  }

  await pauseBetweenActions(input.page(), actionDelayMs);
  const appliedValue = normalizeInput(await input.inputValue());

  if (!appliedValue) {
    throw new Error(`De gekozen ${label}-waarde "${value}" is niet toegepast.`);
  }

  return appliedValue;
}

async function getComboboxOptionScope(page: Page, input: Locator): Promise<Locator> {
  const inputId = await input.getAttribute("id");

  for (let attempt = 0; attempt < 8; attempt += 1) {
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

    await page.waitForTimeout(50);
  }

  return page.locator("body");
}

async function waitForLocatorEnabled(locator: Locator, timeoutMs: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (!(await locator.isDisabled())) {
      return;
    }

    await locator.page().waitForTimeout(100);
  }

  throw new Error("Het modelveld werd niet actief na het kiezen van een merk.");
}

async function findMatchingOptionIndex(
  optionLocator: Locator,
  rawValue: string,
  matchOptions: ComboboxMatchOptions
): Promise<number | null> {
  const options = await getTextList(optionLocator);
  const normalizedCandidates = dedupeStrings([rawValue, ...(matchOptions.aliases ?? [])]).map((value) =>
    normalizeOptionMatchText(value)
  );

  for (const candidate of normalizedCandidates) {
    const exactIndex = options.findIndex((option) => normalizeOptionMatchText(option) === candidate);

    if (exactIndex !== -1) {
      return exactIndex;
    }
  }

  for (const candidate of normalizedCandidates) {
    const prefixIndex = options.findIndex((option) => normalizeOptionMatchText(option).startsWith(candidate));

    if (prefixIndex !== -1) {
      return prefixIndex;
    }
  }

  const targetNumber = parseFlexibleInteger(rawValue);

  if (targetNumber !== null) {
    const numericIndex = options.findIndex((option) => {
      const numericTokens = extractNumericTokens(option);
      const tokenIndex = matchOptions.numericTokenIndex ?? 0;
      return numericTokens[tokenIndex] === targetNumber;
    });

    if (numericIndex !== -1) {
      return numericIndex;
    }
  }

  return null;
}

async function waitForComboboxOptions(optionLocator: Locator): Promise<void> {
  await optionLocator.first().waitFor({ state: "visible", timeout: 1_200 }).catch(() => undefined);
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
    const features = dedupeStrings(await getTextList(metaParagraphs.nth(1).locator("span")));
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
    const sources = dedupeStrings(splitCommaList(sourceSitesText));
    const mileageDisplay = extractMileageDisplay(yearMileageText);
    const mileage = parseDutchInteger(mileageDisplay);
    const parsedFeatures = parseListingFeatures(features);

    listings.push({
      listingId: await card.getAttribute("id"),
      title,
      priceDisplay,
      priceEur: parseDutchInteger(priceDisplay),
      year: parseYear(yearMileageText),
      mileage,
      mileageDisplay,
      mileageKm: mileage,
      fuelType: parsedFeatures.fuelType,
      engineSize: parsedFeatures.engineSize,
      power: parsedFeatures.power,
      transmission: parsedFeatures.transmission,
      bodyType: parsedFeatures.bodyType,
      color: parsedFeatures.color,
      doors: parsedFeatures.doors,
      seller,
      location,
      sources,
      sourceSites: sources,
      features,
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

function getDefaultSlowMoMs(): number {
  const envValue = process.env.PLAYWRIGHT_SLOWMO_MS;

  if (!envValue) {
    return 0;
  }

  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getDefaultActionDelayMs(): number {
  const envValue = process.env.GASPEDAAL_ACTION_DELAY_MS;

  if (!envValue) {
    return 500;
  }

  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
}

function normalizeInput(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeWhitespace(String(value));
  return normalized || null;
}

function normalizeWhitespaceOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeOptionMatchText(value: string): string {
  return stripOptionCount(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripOptionCount(value: string): string {
  return value.replace(/\s*\([\d.]+\)\s*$/, "");
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

function parseFlexibleInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d[\d.]*/);

  if (!match) {
    return null;
  }

  return Number(match[0].replace(/\./g, ""));
}

function extractNumericTokens(value: string): number[] {
  return Array.from(value.matchAll(/\d[\d.]*/g), (match) => Number(match[0].replace(/\./g, "")));
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

function getFuelTypeAliases(value: string): string[] {
  const normalized = normalizeOptionMatchText(value);

  switch (normalized) {
    case "hybrid":
    case "hybride":
      return ["Hybride"];
    case "electric":
    case "elektrisch":
      return ["Elektrisch"];
    case "petrol":
    case "gasoline":
    case "benzine":
      return ["Benzine"];
    case "diesel":
      return ["Diesel"];
    case "plug in hybrid":
    case "plug-in hybrid":
    case "plug-in hybride":
      return ["Plug-in hybride", "Hybride"];
    default:
      return [];
  }
}

function getBodyTypeAliases(value: string): string[] {
  const normalized = normalizeOptionMatchText(value);

  switch (normalized) {
    case "stationwagen":
    case "stationwagon":
      return ["Stationwagon"];
    case "coupe":
    case "coupé":
      return ["Coupé"];
    case "suv":
    case "terreinwagen":
      return ["SUV / Terreinwagen"];
    case "bedrijfswagen":
    case "bedrijfswagens":
    case "bestelwagen":
      return ["Bedrijfswagens"];
    default:
      return [];
  }
}

function getPowerNumericTokenIndex(value: string): number {
  return /\bpk\b/i.test(value) ? 1 : 0;
}

function parseListingFeatures(features: string[]): ParsedListingFeatures {
  const remaining = [...features];
  const fuelType = takeFirstMatching(remaining, isFuelTypeFeature);
  const engineSize = takeFirstMatching(remaining, isEngineSizeFeature);
  const power = takeFirstMatching(remaining, isPowerFeature);
  const transmission = takeFirstMatching(remaining, isTransmissionFeature);
  const doors = takeFirstMatching(remaining, isDoorsFeature);
  const bodyType = takeFirstMatching(remaining, isBodyTypeFeature) ?? remaining.shift() ?? null;
  const color = takeFirstMatching(remaining, isColorFeature) ?? remaining.shift() ?? null;

  return {
    fuelType,
    engineSize,
    power,
    transmission,
    bodyType,
    color,
    doors
  };
}

function takeFirstMatching(values: string[], predicate: (value: string) => boolean): string | null {
  const index = values.findIndex(predicate);

  if (index === -1) {
    return null;
  }

  return values.splice(index, 1)[0] ?? null;
}

function isFuelTypeFeature(value: string): boolean {
  return /^(benzine|diesel|elektrisch|hybride|lpg|aardgas|cng|waterstof|ethanol|plug-in hybride)$/i.test(value);
}

function isEngineSizeFeature(value: string): boolean {
  return /^\d[\d.]*\s*cc$/i.test(value);
}

function isPowerFeature(value: string): boolean {
  return /^\d[\d.,]*\s*kW$/i.test(value);
}

function isTransmissionFeature(value: string): boolean {
  return /^(automaat|handgeschakeld|semi-automaat|cvt|automatisch)$/i.test(value);
}

function isDoorsFeature(value: string): boolean {
  return /^\d+\s*-?\s*deurs$/i.test(value);
}

function isBodyTypeFeature(value: string): boolean {
  return /^(suv\s*\/\s*terreinwagen|hatchback|sedan|stationwagon|stationwagen|cabriolet|coupe|mpv|bedrijfswagens|bestelauto|bestelbus|personenbus|pick-?up|camper|limousine|chassis cabine|bus|overig)$/i.test(
    value
  );
}

function isColorFeature(value: string): boolean {
  return /^(zwart|wit|grijs|blauw|rood|groen|geel|oranje|bruin|beige|paars|roze|zilver|goud|creme|antraciet|turquoise|overig)$/i.test(
    value
  );
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

async function clickFirstVisible(candidates: Locator[]): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = candidate.first();

    if (!(await isLocatorVisible(locator))) {
      continue;
    }

    try {
      await locator.click({ timeout: 400 });
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function isLocatorVisible(locator: Locator): Promise<boolean> {
  if ((await locator.count()) === 0) {
    return false;
  }

  return locator.isVisible().catch(() => false);
}

async function pauseBetweenActions(page: Page, actionDelayMs: number): Promise<void> {
  if (actionDelayMs <= 0) {
    return;
  }

  await page.waitForTimeout(actionDelayMs);
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
