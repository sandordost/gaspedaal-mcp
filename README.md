# gaspedaal-mcp

MCP-server die met Playwright een echte browser opent en zoekopdrachten uitvoert op Gaspedaal.

Dit project is bewust niet headless-first opgebouwd. Gaspedaal probeert scraping actief te blokkeren, dus deze server werkt via een echte Edge- of Chrome-sessie in een zichtbaar browservenster.

## Wat dit project doet

- opent een echte browser via Playwright
- zoekt op Gaspedaal via de pagina `https://www.gaspedaal.nl/zoeken?srt=df-a`
- ondersteunt `query`, `make`, `model` en een set optionele filters
- parseert de resultatenpagina naar een gestructureerde dataset
- kan als MCP-tool door een AI-agent worden aangeroepen
- hergebruikt in MCP-modus standaard een bestaande browser-sessie tussen tool-calls

## Vereisten

Voor vrijwel alle installatiemethoden heb je dit nodig:

- Node.js 20 of hoger
- npm
- Git
- Microsoft Edge of Google Chrome
- een grafische desktop-sessie
- internettoegang

Let op:

- Chromium alleen is niet genoeg; deze code probeert standaard Edge of Chrome te starten
- op een headless server zonder desktopomgeving gaat deze setup meestal niet werken
- de eerste run is meestal het langzaamst; latere MCP-calls kunnen sneller zijn doordat de browser warm blijft

## Installatie Voor Een AI Agent

Dit project is bedoeld voor een MCP-capabele agent, bijvoorbeeld een desktop-agent of editor-integratie die stdio-MCP ondersteunt.

### Stappen

1. Clone de repository.
2. Installeer de npm-dependencies.
3. Build de server naar `dist/`.
4. Registreer `node dist/index.js` als MCP-server in je agent.
5. Herstart je agent.

### Repository lokaal ophalen

```bash
git clone <jouw-repo-url>
cd gaspedaal-mcp
```

### Dependencies installeren en builden

```bash
npm install
npm run build
```

### MCP-configuratie voor een agent

Gebruik als command de gebouwde entrypoint:

```json
{
  "mcpServers": {
    "gaspedaal": {
      "command": "node",
      "args": ["/absolute/path/to/gaspedaal-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/gaspedaal-mcp"
    }
  }
}
```

Voor Windows ziet dat er meestal zo uit:

```json
{
  "mcpServers": {
    "gaspedaal": {
      "command": "node",
      "args": ["A:\\Git\\gaspedaal-mcp\\dist\\index.js"],
      "cwd": "A:\\Git\\gaspedaal-mcp"
    }
  }
}
```

Belangrijk voor agents:

- de agent moet lokale processen mogen starten
- de agent moet toegang hebben tot een desktop/browser-sessie
- als je agent sandboxed draait zonder GUI, zal deze MCP-server waarschijnlijk niet werken

## Handmatige Installatie Per OS

Hieronder staan praktische startsuggesties. Controleer na installatie altijd of `node -v` minimaal `20` teruggeeft.

### Arch Linux

Basis:

```bash
sudo pacman -S --needed git nodejs npm
```

Browser:

- installeer Google Chrome via AUR, bijvoorbeeld met `yay -S google-chrome`
- of installeer Edge via AUR, bijvoorbeeld met `yay -S microsoft-edge-stable-bin`

Daarna:

```bash
git clone <jouw-repo-url>
cd gaspedaal-mcp
npm install
npm run build
```

### Debian

Basis:

```bash
sudo apt update
sudo apt install -y git nodejs npm
```

Controleer daarna:

```bash
node -v
npm -v
```

Als Debian een te oude Node-versie levert, installeer dan Node.js 20 LTS handmatig via de officiele Node.js installer.

Browser:

- installeer Google Chrome via het officiele `.deb` pakket
- of installeer Microsoft Edge via het officiele `.deb` pakket

Project:

```bash
git clone <jouw-repo-url>
cd gaspedaal-mcp
npm install
npm run build
```

### Ubuntu

Basis:

```bash
sudo apt update
sudo apt install -y git nodejs npm
```

Controleer daarna:

```bash
node -v
npm -v
```

Als Ubuntu nog geen Node 20 of hoger levert in jouw omgeving, gebruik dan de officiele Node.js LTS installer.

Browser:

- installeer Google Chrome
- of installeer Microsoft Edge

Project:

```bash
git clone <jouw-repo-url>
cd gaspedaal-mcp
npm install
npm run build
```

### Windows

Met `winget`:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Google.Chrome -e
```

Of gebruik Edge als die al aanwezig is:

```powershell
winget install --id Microsoft.Edge -e
```

Project:

```powershell
git clone <jouw-repo-url>
cd gaspedaal-mcp
npm install
npm run build
```

### macOS

Als Homebrew al geinstalleerd is:

```bash
brew install git node
brew install --cask google-chrome
```

Of met Edge:

```bash
brew install --cask microsoft-edge
```

Project:

```bash
git clone <jouw-repo-url>
cd gaspedaal-mcp
npm install
npm run build
```

## Project Installeren

Als je Node, npm en een ondersteunde browser al hebt:

```bash
npm install
npm run build
```

## Demo Lokaal Draaien

```bash
npm run demo:cupra
```

Dat opent een echte browser en voert een minimale test uit met:

- merk `Cupra`
- model `Formentor`

De output bevat onder andere:

- de gebruikte browser
- de uiteindelijke URL
- het totale aantal matches
- het aantal listings op de huidige pagina
- een lijst met dataset-records

## MCP-server Starten

```bash
npm run build
npm run start
```

De server exposeert een tool `search_gaspedaal`.

## Ondersteunde Input Velden

De tool ondersteunt op dit moment:

- `query`
- `make`
- `model`
- `yearMin`
- `yearMax`
- `fuelType`
- `priceMin`
- `priceMax`
- `mileageMin`
- `mileageMax`
- `bodyType`
- `postcode`
- `radius`
- `powerMin`
- `powerMax`

Extra regels:

- `model` vereist `make`
- `radius` vereist `postcode`
- `bodyType` komt overeen met Carrosserie
- `powerMin` en `powerMax` kun je als kW of als pk meegeven, bijvoorbeeld `150` of `"204 pk"`

## Kleine Gebruikshandleiding

### 1. Eerste lokale check

Run eerst de demo:

```bash
npm run demo:cupra
```

Als dit werkt, weet je dat:

- Node goed staat
- dependencies geinstalleerd zijn
- Playwright een echte browser kan openen
- Gaspedaal bereikbaar is

### 2. MCP in een agent gebruiken

Na `npm run build` laat je de agent deze entrypoint starten:

```text
node /absolute/path/to/gaspedaal-mcp/dist/index.js
```

Daarna kan de agent de tool `search_gaspedaal` aanroepen.

### 3. Voorbeeld: simpele zoekopdracht

```json
{
  "make": "Cupra",
  "model": "Formentor"
}
```

### 4. Voorbeeld: uitgebreide zoekopdracht

```json
{
  "make": "Cupra",
  "model": "Formentor",
  "yearMin": 2022,
  "fuelType": "Hybride",
  "priceMax": 35000,
  "mileageMax": 60000,
  "bodyType": "SUV",
  "postcode": "3511AB",
  "radius": 200,
  "powerMin": 150
}
```

### 5. Wat je terugkrijgt

Per run krijg je:

- metadata over de zoekopdracht
- de uiteindelijke Gaspedaal-URL
- de paginatitel
- `totalMatches`
- `pageListingCount`
- `listings`

Per listing zitten onder andere deze velden in de dataset:

- `title`
- `priceEur`
- `year`
- `mileage`
- `fuelType`
- `engineSize`
- `power`
- `transmission`
- `bodyType`
- `color`
- `doors`
- `location`
- `imageUrl`
- `sources`

### 6. Snelheid en vertraging

De server gebruikt standaard een kleine menselijke vertraging tussen acties:

- standaard `500ms` tussen echte interacties

Als je dat wilt aanpassen:

```bash
GASPEDAAL_ACTION_DELAY_MS=300 npm run demo:cupra
```

Voor extra langzame debug-weergave kun je ook Playwright slow motion gebruiken:

```bash
PLAYWRIGHT_SLOWMO_MS=75 npm run demo:cupra
```

### 7. Browser-hergebruik in MCP-modus

De MCP-server hergebruikt standaard een bestaande browser-sessie tussen tool-calls.

Dat betekent:

- eerste call is meestal het langzaamst
- opvolgende calls zijn vaak sneller
- de browser wordt na een idle-periode automatisch gesloten

## Beperkingen

- Gaspedaal kan selectors of flows wijzigen
- cookie- of login-popups kunnen veranderen
- scraping via een echte browser blijft kwetsbaar voor UI-wijzigingen
- zonder desktopomgeving werkt deze aanpak meestal niet

## Troubleshooting

### Browser start niet

Controleer of Edge of Chrome echt lokaal geinstalleerd is.

### Agent ziet de tool niet

Controleer:

- of `npm run build` succesvol was
- of je agent naar `dist/index.js` wijst
- of je agent na config-wijziging opnieuw is gestart

### Resultaten blijven leeg

Controleer:

- of Gaspedaal bereikbaar is
- of een popup de pagina blokkeert
- of de gekozen filters samen niet te streng zijn
