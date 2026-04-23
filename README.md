# gaspedaal-mcp

Minimale MCP-server die een echte browser opent met Playwright en een zoekpoging op Gaspedaal uitvoert.

## Wat staat er nu

- Een MCP-tool `search_gaspedaal`
- Een losse demo-runner die merk `Cupra` en model `Formentor` kiest
- Playwright gebruikt een echte browser via het geinstalleerde Edge- of Chrome-kanaal
- Na een run krijg je een gestructureerde lijst met listings van de huidige resultatenpagina

## Installatie

```bash
npm install
```

## Demo lokaal draaien

```bash
npm run demo:cupra
```

Dat opent een echte browser, gaat naar [Gaspedaal zoeken](https://www.gaspedaal.nl/zoeken?srt=df-a), kiest merk `Cupra` en model `Formentor`, en print daarna een JSON-resultaat met:

- de gebruikte browser
- de uiteindelijke URL
- de paginatitel
- de gevraagde en toegepaste filters
- het totale aantal matches
- het aantal listings op de huidige pagina
- een lijst met dataset-records zoals prijs, bouwjaar, kilometerstand, verkoper, locatie, kenmerken en bron-sites
- per listing ook expliciete velden zoals `year`, `mileage`, `fuelType`, `engineSize`, `power`, `transmission`, `bodyType`, `color`, `doors`, `location`, `imageUrl` en `sources`

## MCP-server starten

```bash
npm run build
npm run start
```

De server exposeert een tool `search_gaspedaal` met optionele argumenten voor:

- `query`, `make`, `model`
- `yearMin`, `yearMax`
- `fuelType`
- `priceMin`, `priceMax`
- `mileageMin`, `mileageMax`
- `bodyType`
- `postcode`, `radius`
- `powerMin`, `powerMax`

Voorbeelden:

- alleen vrije zoekterm: `query = "Cupra"`
- merkfilter: `make = "Cupra"`
- merk + model: `make = "Cupra", model = "Formentor"`
- merk + model + basisfilters: `make = "Cupra", model = "Formentor", fuelType = "Hybride", yearMin = 2022, priceMax = 35000`
- merk + model + uitgebreide filters: `make = "Cupra", model = "Formentor", postcode = "3511AB", radius = 25, powerMin = 150`

## Belangrijke beperking

Omdat Gaspedaal scraping actief probeert te blokkeren, is dit expres opgezet rond een echte browser in headed mode. De volgende stap is meestal:

- selectors hardenen
- cookie- en consentflows uitbreiden
- resultaatkaarten gericht parsen

## Snelheid

De standaardinstelling draait nu zonder Playwright slow-motion. Als je expres langzamer wilt debuggen, kun je optioneel een environment variable zetten:

```bash
PLAYWRIGHT_SLOWMO_MS=75 npm run demo:cupra
```
