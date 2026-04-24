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
- Microsoft Edge, Google Chrome of Chromium
- een grafische desktop-sessie
- internettoegang

Let op:

- op Linux probeert de server ook veelvoorkomende browserbinaries zoals `chromium`, `google-chrome-stable` en `microsoft-edge-stable`
- als autodetectie niet lukt, kun je `GASPEDAAL_BROWSER_EXECUTABLE_PATH` zetten naar een expliciet browserpad
- op een headless server zonder desktopomgeving gaat deze setup meestal niet werken
- de eerste run is meestal het langzaamst; latere MCP-calls kunnen sneller zijn doordat de browser warm blijft

## Installatie Voor Een AI Agent

Dit project is bedoeld voor een MCP-capabele agent die remote MCP via `HTTP`, `SSE` of `streamable-http` ondersteunt.

Belangrijk:

- deze repository exposeert een HTTP MCP-endpoint op `/mcp`
- standaard bindt de server op `127.0.0.1` en poort `3100`
- voor remote gebruik over Tailscale publiceer je dit endpoint het liefst alleen binnen je tailnet

### Stappen

1. Clone de repository.
2. Installeer de npm-dependencies.
3. Build de server naar `dist/`.
4. Start de server.
5. Registreer de MCP-URL in je agent.
6. Herstart je agent.

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

Start eerst de server:

```bash
npm run build
PORT=3100 npm run start
```

Daarna registreer je in je agent een remote MCP-server die naar jouw endpoint wijst:

```json
{
  "mcpServers": {
    "gaspedaal": {
      "url": "http://127.0.0.1:3100/mcp"
    }
  }
}
```

Belangrijk voor agents:

- de host waarop deze server draait moet toegang hebben tot een desktop/browser-sessie
- als je agent of server sandboxed draait zonder GUI, zal de zoektool waarschijnlijk niet werken
- als agent en MCP-server op verschillende machines staan, gebruik dan een private netwerkroute zoals Tailscale

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
- of installeer Chromium via `sudo pacman -S chromium`

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

Als je browser op een ongebruikelijk pad staat, kun je expliciet een binary forceren:

```bash
GASPEDAAL_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run demo:cupra
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

Let op:

- dit proces start een HTTP MCP-server op `http://127.0.0.1:3100/mcp`
- gebruik `PORT` als je een andere poort wilt
- voor productie is een systemd-service logisch zodra de host-setup stabiel is

## Veilig Verbinden Via Tailscale En OpenClaw

De huidige setup is HTTP-gebaseerd. Dat betekent dat OpenClaw deze MCP-server als remote MCP-endpoint kan benaderen via een private URL binnen je tailnet.

Aanbevolen route:

```text
OpenClaw host (100.80.102.47)
  -> HTTP over Tailscale
MCP host (100.86.139.102)
  -> gaspedaal-mcp op /mcp
```

Voordelen van deze aanpak:

- alle MCP-communicatie blijft binnen je tailnet
- je kunt Tailscale ACLs en eventueel `tailscale serve` gebruiken
- dit sluit goed aan op hoe deze server nu gebouwd is

### Voorwaarden

Op de MCP-host:

- `npm ci` of `npm install` is al uitgevoerd
- `npm run build` is uitgevoerd
- Edge of Chrome is geinstalleerd
- de machine heeft een desktop/browser-sessie als je echte zoekopdrachten wilt uitvoeren

Tussen beide machines:

- beide machines zitten in dezelfde tailnet
- `tailscale ping 100.86.139.102` werkt vanaf de OpenClaw-host
- de MCP-host draait de HTTP-server en luistert op de verwachte poort

### Stap 1: test de lokale HTTP-server op de MCP-host

Test op de MCP-host:

```bash
curl -i http://127.0.0.1:3100/mcp
```

Let op:

- `GET /mcp` zonder sessie geeft meestal een foutmelding terug; dat is normaal
- belangrijker is dat je een HTTP-response krijgt en dat de service draait

### Stap 2: maak de server bereikbaar binnen Tailscale

De eenvoudigste varianten zijn:

- bind de service direct op een Tailscale-bereikbaar adres
- of gebruik `tailscale serve` om een lokale poort veilig binnen je tailnet te publiceren

Voorbeeld met Tailscale Serve op de MCP-host:

```bash
sudo tailscale serve --bg 3100
```

Controleer daarna vanaf de OpenClaw-host via de private Tailscale Serve-URL van die machine.

### Voorbeeldconfiguratie

```json
{
  "mcp": {
    "servers": {
      "gaspedaal": {
        "url": "https://<mcp-host>.<tailnet>.ts.net/mcp"
      }
    }
  }
}
```

### Veiligheidsadvies

- beperk toegang met Tailscale ACLs zodat alleen je OpenClaw-machine de MCP-host mag bereiken
- gebruik bij voorkeur Tailscale tags voor servermachines, niet voor laptops of user-devices
- expose deze MCP-server niet publiek naar internet
- gebruik bij voorkeur Tailscale Serve in plaats van een publieke Funnel

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

Na `npm run build` en `npm run start` laat je de agent verbinden met:

```text
http://127.0.0.1:3100/mcp
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
- `queryLooksRelevant`
- `queryRelevanceNotes`
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
