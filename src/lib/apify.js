// Live flight offer search via an Apify Actor that aggregates real fares from
// several sources (Google Flights, Kiwi, Travelpayouts, budget carriers, etc).
// Pay-per-event pricing (~$0.0003/search) with a free monthly platform credit
// on new accounts - no subscription, no fixed monthly minimum, which makes it
// a realistic long-term backstop once a free API tier (e.g. SearchAPI's 100
// requests) runs out. Self-serve sign-up: https://console.apify.com/sign-up.
// Read-only fare shopping only; nothing here ever books a real flight.

// Apify's REST API requires the "username/actor-name" ID to be written with
// a ~ instead of / when used in a URL path.
const ACTOR_ID = 'makework36~flight-price-scraper';
const RUN_URL = `https://api.apify.com/v2/actors/${ACTOR_ID}/run-sync-get-dataset-items`;
const FETCH_TIMEOUT_MS = 45000; // actor runs can take a few seconds to complete

const CABIN_CODE = { ECONOMY: 'Y', PREMIUM_ECONOMY: 'W', BUSINESS: 'C', FIRST: 'F' };

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ddmmmToIsoDate(dateLabel, now = new Date()) {
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const m = /^(\d{1,2})([A-Z]{3})$/.exec((dateLabel || '').toUpperCase());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monIdx = MONTHS.indexOf(m[2]);
  if (monIdx < 0) return null;
  let year = now.getFullYear();
  let candidate = new Date(year, monIdx, day);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate = new Date(year + 1, monIdx, day);
  }
  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
}

function clockFromIso(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? `${m[1]}${m[2]}` : '';
}

function durationToHM(str) {
  const m = /(\d+)h\s*(\d+)?m?/i.exec(str || '');
  if (!m) return str || '';
  return `${m[1]}H${String(m[2] || '0').padStart(2, '0')}M`;
}

async function runActor(token, input) {
  const res = await fetchWithTimeout(`${RUN_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
    if (res.status === 402) throw new Error(`APIFY USAGE LIMIT REACHED - ${msg}`);
    if (res.status === 401) throw new Error('APIFY TOKEN INVALID');
    throw new Error(`APIFY REQUEST FAILED - ${msg}`);
  }
  return res.json();
}

async function testConnection(token) {
  if (!token) throw new Error('API TOKEN IS REQUIRED');
  const tomorrow = new Date(Date.now() + 86400000);
  const iso = tomorrow.toISOString().slice(0, 10);
  await runActor(token, {
    origin: 'JFK', destination: 'LAX', departDate: iso, maxFlights: 1
  });
  return true;
}

async function searchLiveFlights({ token, origin, dest, dateLabel, currency }) {
  const departDate = ddmmmToIsoDate(dateLabel);
  if (!departDate) throw new Error(`INVALID DATE FORMAT "${dateLabel}"`);

  const items = await runActor(token, {
    origin, destination: dest, departDate,
    adults: 1, cabinClass: 'ECONOMY',
    currency: currency || 'USD',
    maxFlights: 20
  });

  const raw = Array.isArray(items) ? items : [];

  // "Self-transfer" results stitch together separate one-way tickets from
  // different sources as if they were one itinerary - they routinely show
  // up with inflated total prices and nonsensical multi-stop routings for
  // what should be a simple regional hop. Prefer genuine single-ticket
  // results; only fall back to self-transfer ones if that's all there is.
  const genuine = raw.filter((it) => !it.isSelfTransfer);
  const pool = genuine.length > 0 ? genuine : raw;

  // The scraper aggregates several source sites, so the same nominal flight
  // can appear more than once with different prices/durations reported by
  // each source - keep only the cheapest instance of each distinct
  // flight+departure+arrival combination, then rank cheapest first.
  const best = new Map();
  pool.forEach((it) => {
    const firstSeg = (it.segments && it.segments[0]) || {};
    const dedupeKey = `${firstSeg.flightCode || ''}|${it.departTime || ''}|${it.arriveTime || ''}`;
    const price = typeof it.bestPrice === 'number' ? it.bestPrice : parseFloat(it.bestPrice);
    const existing = best.get(dedupeKey);
    if (!existing || price < existing._price) {
      best.set(dedupeKey, { ...it, _price: price });
    }
  });
  const deduped = [...best.values()].sort((a, b) => a._price - b._price);

  const lines = deduped.slice(0, 8).map((it, idx) => {
    const firstSeg = (it.segments && it.segments[0]) || {};
    const lastSeg = (it.segments && it.segments[it.segments.length - 1]) || firstSeg;
    const cabin = (firstSeg.cabinClass || 'ECONOMY').toUpperCase();
    return {
      line: idx + 1,
      carrier: (firstSeg.flightCode || '').replace(/[0-9].*$/, '') || '',
      carrierName: firstSeg.airline || it.airline || '',
      flightNumber: (firstSeg.flightCode || '').replace(/\s+/g, ''),
      origin: (it.from && it.from.iata) || origin,
      dest: (it.to && it.to.iata) || dest,
      dep: clockFromIso(it.departTime),
      arr: clockFromIso(it.arriveTime),
      dur: durationToHM(it.duration),
      aircraft: '',
      date: dateLabel.toUpperCase(),
      stops: typeof it.stops === 'number' ? it.stops : (it.segments ? it.segments.length - 1 : 0),
      fares: [{
        code: CABIN_CODE[cabin] || 'Y',
        label: cabin + (it.cheapestSource ? ` VIA ${String(it.cheapestSource).toUpperCase()}` : ''),
        price: typeof it.bestPrice === 'number' ? it.bestPrice : parseFloat(it.bestPrice),
        currency: it.currency || currency || 'USD',
        seats: null
      }]
    };
  }).filter((l) => l.origin && l.dest && !Number.isNaN(l.fares[0].price));

  return { ok: true, origin, dest, date: dateLabel.toUpperCase(), lines, source: 'LIVE' };
}

module.exports = { testConnection, searchLiveFlights };
