![image](https://raw.githubusercontent.com/RectifySoftware/rectify-jabre/refs/heads/main/assets/logo.png)
# Rectify™ Jabre

Rectify™ Jabre is a Windows desktop GDS style travel booking terminal, built with Electron. Basically I wanted my own version of the old airline reservation terminals like Sabre Red 360 or Amadeus Selling Platform, the ones travel agents actually use, so I built one.

## Running in development

```bash
npm install
npm start
```

On launch you'll get the splash screen, then either Initial Setup or Sign-On depending on whether an account already exists:

- **Initial Setup** (first run only, no agent accounts exist yet) — create your own
  agent account: Agent ID, full name, password, PCC, and duty code(s). There's no
  default/demo login baked in, you set your own the first time you open it.
- **Sign-On** (once at least one account exists) — sign in with whatever account
  you've created. There's also a "Create an Agent Account" link on this screen, so
  you can add more accounts later (say, for someone else using the same install)
  without needing to already be signed in.

Passwords never get stored in plain text, they're salted and hashed locally
(Node's `crypto.scrypt`) in the same local database as everything else (see
**Data persistence** below). None of it ever leaves your machine.

## Building the Windows installer

```bash
npm run dist
```

Output lands in `release/` as an NSIS `.exe` installer for Windows (unsigned, so Windows will moan at you, that's normal).
Swap out `/assets/icon.ico` and `/assets/logo.png` for your own artwork before you build. Right now both are just placeholder sphere graphics I generated with a script (`scripts/generate-assets.js`), not final art.

## Data persistence

PNRs, agent profiles, API settings and the 24h live fare cache all live locally in a JSON file (via `lowdb`) inside Electron's per-user `userData` folder, so your bookings are still there next time you open the app. One thing I'm strict about: flight availability is never made up. See **Live airline data** below, you need a live provider connected before `A` will give you anything back.

## Command set

Type commands into the entry field at the bottom of the terminal (or hit F3 to jump straight to it). Commands aren't case sensitive.

| Command | Description |
|---|---|
| `DA <city/country/name>` | Look up IATA airport codes, e.g. `DA LEEDS` or `DA PORTUGAL` |
| `A<ORIG><DEST><DDMMM>` | Search flight availability, e.g. `AORDJFK25AUG` |
| `S<line>[class]` | Sell a segment from the last availability display, e.g. `S2` or `S2M` |
| `NM1<LAST>/<FIRST> [TITLE]` | Add a passenger name, e.g. `NM1SMITH/JOHN MR` |
| `FXP` | Price the itinerary using the last sold fare class |
| `ER` | End & Retrieve, saves the PNR and gives you a record locator |
| `IG` | Ignore, ditches the current workspace transaction |
| `RT<LOCATOR>` | Retrieve a saved PNR by its record locator |
| `QR` | Queue Review, lists all saved PNRs |
| `QD<LOCATOR>` | Queue Delete, removes a PNR from the queue |
| `WP` | Write/Print itinerary to PDF (PNR needs to be saved with `ER` first) |
| `I` / `IR` | Display the active PNR in the current workspace tab |
| `SI` | Sign off and close the terminal |
| `CC<CODE>` | Set the display currency to a live exchange rate, e.g. `CCEUR` |
| `CC` | List all available currency codes |
| `HELP` | Show the full command reference in app |

Any syntactically valid 3 letter IATA code works as an origin or destination. I deliberately didn't put in a local "known airports" gate for it, because the live provider is the actual authority on whether an airport exists and has flights, not some hardcoded list I wrote. There's a small dataset of around 140 major airports with coordinates sitting in `src/lib/flights.js`, but that's only there to power the alternate airport suggestions I'll get into below.

### `DA`, IATA code lookup

Don't know an airport's 3 letter code off the top of your head? Fair, nobody does. `DA <text>` searches roughly 5,400 real airports with scheduled service by city, country or airport name and gives you the codes back, so you're not tabbing out to some other website mid search. It's fully offline (I bundled it from the [OurAirports](https://ourairports.com/data/) open dataset, see `scripts/build-airports-data.js`), so it's instant and doesn't eat into your API quota at all. A few examples:

```
DA LEEDS       any airport with "Leeds" in its city name (e.g. LBA)
DA PORTUGAL    every airport in Portugal (FAO, LIS, OPO, ...)
DA HEATHROW    matches by airport name too
```

Results get ranked (exact or whole word city/country matches first, then partial matches, then airport name matches) and capped at 30, with a note telling you how many more there were if you searched something broad like `DA UNITED STATES`, so you know to narrow it down a bit.

### Example booking flow

```
AORDJFK25AUG        search availability Chicago -> New York
S2                   sell line 2, cheapest available class
NM1SMITH/JOHN MR      add a passenger
FXP                   price the itinerary
ER                    end & retrieve - generates a record locator, saves to queue
WP                    print itinerary to PDF
```

### Function keys

| Key | Action |
|---|---|
| F1 | Help / command reference |
| F2 | New booking tab |
| F3 | Focus command line |
| F4 | Queue review (`QR`) |
| F5 | Repeat last availability search |
| F6 | Price itinerary (`FXP`) |
| F7 | End & retrieve (`ER`) |
| F8 | Print itinerary (`WP`) |
| F9 | Ignore transaction (`IG`) |
| F10 | Sign off (`SI`) |
| F11 | Change display currency (`CC`) |
| F12 | Collapse/expand the response log pane |

## Live airline data

**Every result `A` gives you is a genuine live search result, I never fake any of it.** There's no offline or simulated mode hiding in here, if there's no live provider connected, `A` just refuses the search and tells you to go connect one instead of pretending. Head to **Tools > Live Data Settings...** and hook up one or both of:

1. **[SearchAPI.io](https://www.searchapi.io/users/sign_up)** (tried first), mirrors live Google Flights results. Free tier gives you 100 requests total, no card needed. Good to get started with, but not something you can rely on long term since their cheapest paid tier is $40/month with no small pay-as-you-go option.
2. **[Apify](https://console.apify.com/sign-up)** (kicks in automatically once SearchAPI's free requests run dry, or if it's the only one you've set up), runs a multi-source fare-scraping Actor (Google Flights, Kiwi, Travelpayouts, budget carriers) at roughly **$0.0003 per search**, so about 30p per 1,000 searches, pay as you go, no subscription. New accounts get free monthly platform credit that covers thousands of casual searches on its own. Honestly this is the realistic "won't run dry on you" option if you're just messing about with it.

I'll be straight with you, there isn't a free forever and accurate option out there. Real fare data costs every provider money at the source, so eventually something metres it. Apify's pay-per-use pricing is about as close as you'll get on a hobby budget though, even a few thousand searches a year only costs you a few quid.

To make both providers' quota stretch further, **live results get cached locally for 24 hours** per route/date/currency combo, so searching the same trip again (say a mate asks twice, or you flick currency back and forth) doesn't burn another request until the cache runs out.

Results are always labelled clearly so you know exactly what you're looking at:

- **`[LIVE - REAL AIRLINE DATA]`**, a genuine flight result: real airline, real flight number, real fare, priced in whatever currency you've currently got selected (`CC`). You'll see `, CACHED` added on when it's served from the local cache instead of a fresh request.

### When there's no exact match

If your exact route and date search comes back empty, the terminal automatically runs a small, tightly bounded search for real alternatives before it gives up. It never invents a result just to fill the gap:

1. **Nearby dates**, tries plus or minus 1 and 2 days from what you asked for (stops at the first day with real results), in case the route just doesn't run that particular day.
2. **Nearby airports**, only kicks in if no nearby date worked, tries the single closest alternate airport (by real great-circle distance) to your origin, then your destination, on your original date. So searching `LBA-FAO` with nothing found might turn up a real result from `MAN-FAO` instead.
3. If genuinely nothing turns up anywhere, it just tells you straight: `NO FLIGHTS FOUND FOR THIS ROUTE, NEARBY DATES, OR NEARBY AIRPORTS`.

Any alternative you get shown is **clearly marked and highlighted**, a distinct amber row with an `ALT` column spelling out exactly what changed (e.g. `25AUG instead of 24AUG`, or `FROM MAN - MANCHESTER (62KM FROM LBA) INSTEAD OF LBA`), plus a banner above the table so there's no chance you mistake it for what you actually searched. You can still `S<line>` an alternative straight away, the segment just gets sold using its real (alternate) route and date, not your original request.

This genuinely mirrors real-world pricing well enough to hand someone an actual "here's what that flight costs" quote. It's not, however, hooked into a real GDS or airline inventory system. Nothing in this app ever actually books, holds or purchases a real flight, `ER` only ever writes to the local PNR store, and every itinerary you print carries a clear "not a valid ticket" disclaimer.

(Amadeus used to have a free self-service flight API I was going to use here, but they permanently decommissioned that program on July 17, 2026, the developer portal is enterprise customers only now, so that's off the table. Kiwi's Tequila API also closed off to new self-serve developers, for what it's worth.)

You can clear both keys any time from **Tools > Live Data Settings... > Clear Both / Use Simulated Data**, searches will just get refused until you reconnect a provider.

## Currency

Live fares get requested directly in whatever currency you've got selected, then everything converts on the fly (pivoting through USD) any time you switch. The `CUR:` indicator in the status bar shows your currently selected display currency, click it, use `Tools > Change Currency...`, hit **F11**, or just type `CC<CODE>` (e.g. `CCEUR`, `CCGBP`, `CCJPY`) to switch. Every switch pulls live mid-market rates from the free [Frankfurter](https://www.frankfurter.app/) API (European Central Bank reference rates, no API key needed) right at that moment, so the fares you see actually track real currency movement. Rates get cached locally after each successful fetch, so if you're offline it just falls back to the last known rates and marks the status bar `(CACHED)`. Worth saying, this only changes how fares are displayed and printed, no real payment or transaction ever happens.

## Project layout

```
main.js                 Electron main process (windows, IPC, PDF export)
preload.js               contextBridge API exposed to renderers as window.rj
src/lib/store.js         lowdb-backed local persistence (agents, PNRs, settings)
src/lib/auth.js          password hashing (crypto.scrypt, salted per agent)
src/lib/flights.js       airport reference data + distance/date helpers (no mock flights)
src/lib/airport-lookup.js   IATA code search (city/country/name -> airports)
src/lib/airports-data.json  ~5,400 real airports w/ scheduled service (OurAirports data)
src/lib/countries.json      ISO country code -> name map, for the lookup above
src/lib/searchapi.js     live Google Flights search integration (via SearchAPI.io)
src/lib/apify.js         live multi-source fare-scraper integration (via Apify)
src/lib/rates.js         live FX rate fetch (Frankfurter API)
src/lib/itinerary.js     itinerary HTML used for PDF export
src/splash/               splash screen
src/setup/                initial setup / create-agent-account screen
src/login/                sign-on screen
src/terminal/              main terminal UI (menu, toolbar, tabs, command line)
scripts/generate-assets.js  generates the placeholder icon.ico / logo.png
```
