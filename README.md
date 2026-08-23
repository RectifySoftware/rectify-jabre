![image](https://raw.githubusercontent.com/govll/rectify-jabre/refs/heads/main/assets/logo.png)
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
schedule/fare data is a static mock dataset in `src/lib/flights.js` by
default — see **Live airline data** below for real fares.

## Command set

Type commands into the entry field at the bottom of the terminal (or press F3
to focus it). All commands are case-insensitive.

| Command | Description |
|---|---|
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

Airport coverage is global — around 140 IATA codes across North & South
America, Europe, the Middle East, Africa, Asia and Oceania are recognized (see
`AIRPORTS` in `src/lib/flights.js`). A handful of major city pairs (e.g.
`ORD-JFK`, `JFK-ORD`, `ORD-LAX`, `ORD-LHR`, `JFK-CDG`...) have curated,
flavorful timetables; every other valid pair falls back to a deterministic
synthetic schedule computed from great-circle distance (flight time, aircraft
type, and fare all scale with distance), so any recognized origin/destination
combination — e.g. `ALGWLBA27AUG` — returns a plausible result instead of
"no service found". Only unrecognized IATA codes return an error.

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

By default `A` searches use the built-in synthetic schedule. To pull **real
airline data** — real carriers, real flight numbers, real fares — open
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
- **`[SIMULATED - NO LIVE FARE FOUND]`** — every configured live provider
  either had nothing for that route/date or the request failed (e.g. quota
  exhausted), so the synthetic generator filled in instead. Check the log
  line under it for the specific error.
- **`[MOCK DATA]`** — no API key/token configured at all; always synthetic.

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
Use Simulated Data** to go back to fully offline mock data.

## Currency

Mock/simulated fares are priced in USD internally; live Google Flights fares are
requested directly in whatever currency is currently selected, then
everything is converted on the fly (pivoting through USD) whenever you switch.
The
`CUR:` indicator in the status bar shows the currently selected display
currency — click it, use `Tools > Change Currency...`, press **F11**, or type
`CC<CODE>` (e.g. `CCEUR`, `CCGBP`, `CCJPY`) to switch. Every switch pulls live
mid-market rates from the free [Frankfurter](https://www.frankfurter.app/) API
(European Central Bank reference rates, no API key required) at that exact
moment, so displayed fares track actual currency strength in real time. Rates
are cached locally after each successful fetch — if the app is offline, it
falls back to the last known rates and marks the status bar `(CACHED)`. This
only changes how mock fares are *displayed and printed*; no real payment or
transaction ever occurs.

## Project layout

```
main.js                 Electron main process (windows, IPC, PDF export)
preload.js               contextBridge API exposed to renderers as window.rj
src/lib/store.js         lowdb-backed local persistence (agents, PNRs, settings)
src/lib/flights.js       mock/synthetic flight schedule/fare dataset + search
src/lib/searchapi.js     live Google Flights search integration (via SearchAPI.io)
src/lib/apify.js         live multi-source fare-scraper integration (via Apify)
src/lib/rates.js         live FX rate fetch (Frankfurter API)
src/lib/itinerary.js     itinerary HTML used for PDF export
src/splash/               splash screen
src/login/                sign-on screen
src/terminal/              main terminal UI (menu, toolbar, tabs, command line)
scripts/generate-assets.js  generates the placeholder icon.ico / logo.png
```
