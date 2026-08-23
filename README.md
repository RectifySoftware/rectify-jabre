![image](https://raw.githubusercontent.com/RectifySoftware/rectify-jabre/refs/heads/main/assets/logo.png)
# Rectify™ Jabre

Rectify™ Jabre is a Windows desktop GDS-style travel booking terminal, built with Electron. It is based off other 
airline reservation terminals like Sabre Red 360 or Amadeus Selling Platform.

## Running in development

```bash
npm install
npm start
```

On launch you'll see the splash screen, then the Sign-On screen, then the terminal.

### Demo agent profiles

| Agent ID | Password | Duty Code | PCC  |
|----------|----------|-----------|------|
| 1A2B3C   | jabre1   | AA or SUP | 7X4Y |
| DEMO01   | demo     | AA        | 9Q1Z |

## Building the Windows installer

```bash
npm run dist
```

Output lands in `release/` as an NSIS `.exe` installer for Windows (unsigned).
Swap `/assets/icon.ico` and `/assets/logo.png` with your final artwork before
building — both are placeholder-generated sphere graphics right now
(see `scripts/generate-assets.js`).

## Data persistence

PNRs, agent profiles, API settings, and the 24h live-fare cache are all stored
locally in a JSON file (via `lowdb`) inside Electron's per-user `userData`
directory, so bookings survive closing and reopening the app. Flight
availability is never fabricated — see **Live airline data** below; a live
provider must be connected before `A` will return anything.

## Command set

Type commands into the entry field at the bottom of the terminal (or press F3
to focus it). All commands are case-insensitive.

| Command | Description |
|---|---|
| `DA <city/country/name>` | Look up IATA airport codes, e.g. `DA LEEDS` or `DA PORTUGAL` |
| `A<ORIG><DEST><DDMMM>` | Search flight availability, e.g. `AORDJFK25AUG` |
| `S<line>[class]` | Sell a segment from the last availability display, e.g. `S2` or `S2M` |
| `NM1<LAST>/<FIRST> [TITLE]` | Add a passenger name, e.g. `NM1SMITH/JOHN MR` |
| `FXP` | Price the itinerary using the last sold fare class |
| `ER` | End & Retrieve — saves the PNR and generates a record locator |
| `IG` | Ignore — discards the current workspace transaction |
| `RT<LOCATOR>` | Retrieve a saved PNR by its record locator |
| `QR` | Queue Review — lists all saved PNRs |
| `QD<LOCATOR>` | Queue Delete — removes a PNR from the queue |
| `WP` | Write/Print itinerary to PDF (PNR must be saved with `ER` first) |
| `I` / `IR` | Display the active PNR in the current workspace tab |
| `SI` | Sign off and close the terminal |
| `CC<CODE>` | Set the display currency to a live exchange rate, e.g. `CCEUR` |
| `CC` | List all available currency codes |
| `HELP` | Show the full command reference in-app |

Any syntactically valid 3-letter IATA code is accepted as origin/destination —
there's no local "known airports" gate, since the live provider is the real
authority on whether an airport exists and has flights, not a hand-maintained
list here. A small dataset of ~140 major airports (with coordinates) is kept
in `src/lib/flights.js` purely to power the alternate-airport suggestions
described below.

### `DA` — IATA code lookup

Don't know an airport's 3-letter code? `DA <text>` searches ~5,400 real
airports with scheduled service by city, country, or airport name and shows
their codes — no more digging through other websites to find one before
typing an `A` search. It's fully offline (bundled from the
[OurAirports](https://ourairports.com/data/) open dataset, see
`scripts/build-airports-data.js`), so it's instant and doesn't touch your API
quota. Examples:

```
DA LEEDS       any airport with "Leeds" in its city name (e.g. LBA)
DA PORTUGAL    every airport in Portugal (FAO, LIS, OPO, ...)
DA HEATHROW    matches by airport name too
```

Results are ranked (exact/whole-word city or country matches first, then
partial matches, then airport-name matches) and capped at 30 with a note if
there were more — a broad query like `DA UNITED STATES` will tell you how
many total matches there were so you know to narrow it down.

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

**Every result `A` shows is a genuine live search result — nothing is ever
invented.** There is no offline/mock/simulated mode: if no live provider is
connected, `A` refuses the search outright with an error telling you to
connect one, rather than making something up. Open
**Tools > Live Data Settings...** and connect one or both of:

1. **[SearchAPI.io](https://www.searchapi.io/users/sign_up)** (tried first) —
   mirrors live Google Flights results. Free tier: 100 requests total, no
   card required. Fine to start with, but not a long-term supply on its own —
   their cheapest paid tier is $40/month, no small pay-as-you-go option.
2. **[Apify](https://console.apify.com/sign-up)** (used automatically once
   SearchAPI's free requests run out, or if it's the only one configured) —
   runs a multi-source fare-scraping Actor (Google Flights, Kiwi,
   Travelpayouts, budget carriers) at roughly **$0.0003 per search**
   (~30¢ per 1,000 searches), pay-per-use, no subscription. New accounts get
   free monthly platform credit that alone covers thousands of casual
   searches. This is the realistic "won't run out" option for occasional
   personal use.

There genuinely isn't a free-forever *and* accurate option — real fare data
costs every provider money at the source, so something eventually meters it.
Apify's pay-per-use pricing is about as close as it gets on a hobby budget:
even a few thousand searches a year comes out to a few dollars.

To keep both providers' quota going further, **live results are cached
locally for 24 hours** per route/date/currency combination — searching the
same trip again (e.g. a mate asks twice, or you switch currency back and
forth) doesn't re-spend a request until the cache expires.

Results are always labeled so you know what you're looking at:

- **`[LIVE - REAL AIRLINE DATA]`** — a genuine flight result: real airline,
  real flight number, real fare, priced in whatever currency you currently
  have selected (`CC`). Add `, CACHED` when served from the local cache
  instead of a fresh request.

### When there's no exact match

If your exact route/date search comes back empty, the terminal automatically
does a small, tightly-bounded search for real alternatives before giving up —
it never fabricates a result to fill the gap:

1. **Nearby dates** — tries ±1 and ±2 days from your requested date (stopping
   at the first day that has real results), in case the route exists but just
   doesn't operate that day.
2. **Nearby airports** — only if no nearby date worked, tries the single
   closest alternate airport (by real great-circle distance) to your origin,
   then to your destination, at your original date — e.g. searching `LBA-FAO`
   with nothing found might turn up a real result from `MAN-FAO` instead.
3. If genuinely nothing turns up anywhere, it says so plainly:
   `NO FLIGHTS FOUND FOR THIS ROUTE, NEARBY DATES, OR NEARBY AIRPORTS`.

Any alternative shown is **clearly marked and highlighted** — a distinct
amber-highlighted row with an `ALT` column explaining exactly what changed
(e.g. `25AUG instead of 24AUG`, or `FROM MAN - MANCHESTER (62KM FROM LBA)
INSTEAD OF LBA`) — plus a banner above the table so it's impossible to
mistake an alternative for what you actually asked for. You can still `S<line>`
an alternative directly; the segment gets sold using its real (alternate)
route/date, not your original request.

This genuinely mirrors real-world pricing, good enough to hand someone an
actual "here's what that flight costs" quote — it is not, however, a
connection into a real GDS or airline inventory system. Nothing in this app
ever actually books, holds, or purchases a real flight — `ER` only ever
writes to the local PNR store, and every printed itinerary carries a clear
"not a valid ticket" disclaimer.

(Amadeus previously had a free self-service flight API here, but Amadeus
permanently decommissioned that program on July 17, 2026 — the developer
portal now serves enterprise customers only, so it's no longer an option.
Kiwi's Tequila API also closed to new self-serve developers.)

Clear both keys any time with **Tools > Live Data Settings... > Clear Both /
Use Simulated Data** — searches will then be refused until a provider is
reconnected.

## Currency

Live fares are requested directly in whatever currency is currently selected,
then everything is converted on the fly (pivoting through USD) whenever you
switch. The
`CUR:` indicator in the status bar shows the currently selected display
currency — click it, use `Tools > Change Currency...`, press **F11**, or type
`CC<CODE>` (e.g. `CCEUR`, `CCGBP`, `CCJPY`) to switch. Every switch pulls live
mid-market rates from the free [Frankfurter](https://www.frankfurter.app/) API
(European Central Bank reference rates, no API key required) at that exact
moment, so displayed fares track actual currency strength in real time. Rates
are cached locally after each successful fetch — if the app is offline, it
falls back to the last known rates and marks the status bar `(CACHED)`. This
only changes how fares are *displayed and printed*; no real payment or
transaction ever occurs.

## Project layout

```
main.js                 Electron main process (windows, IPC, PDF export)
preload.js               contextBridge API exposed to renderers as window.rj
src/lib/store.js         lowdb-backed local persistence (agents, PNRs, settings)
src/lib/flights.js       airport reference data + distance/date helpers (no mock flights)
src/lib/airport-lookup.js   IATA code search (city/country/name -> airports)
src/lib/airports-data.json  ~5,400 real airports w/ scheduled service (OurAirports data)
src/lib/countries.json      ISO country code -> name map, for the lookup above
src/lib/searchapi.js     live Google Flights search integration (via SearchAPI.io)
src/lib/apify.js         live multi-source fare-scraper integration (via Apify)
src/lib/rates.js         live FX rate fetch (Frankfurter API)
src/lib/itinerary.js     itinerary HTML used for PDF export
src/splash/               splash screen
src/login/                sign-on screen
src/terminal/              main terminal UI (menu, toolbar, tabs, command line)
scripts/generate-assets.js  generates the placeholder icon.ico / logo.png
```
