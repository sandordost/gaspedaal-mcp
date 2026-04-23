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

## MCP-server starten

```bash
npm run build
npm run start
```

De server exposeert een tool `search_gaspedaal` met optionele argumenten `query`, `make` en `model`.

Voorbeelden:

- alleen vrije zoekterm: `query = "Cupra"`
- merkfilter: `make = "Cupra"`
- merk + model: `make = "Cupra", model = "Formentor"`

## Belangrijke beperking

Omdat Gaspedaal scraping actief probeert te blokkeren, is dit expres opgezet rond een echte browser in headed mode. De volgende stap is meestal:

- selectors hardenen
- cookie- en consentflows uitbreiden
- resultaatkaarten gericht parsen
