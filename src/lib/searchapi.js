// Live flight offer search via SearchAPI.io's Google Flights API
// (https://www.searchapi.io/docs/google-flights-api). This mirrors real
// Google Flights results, i.e. actual live airline pricing as aggregated by
// Google - not a fabricated dataset. Free tier: 100 requests, no card
// required, self-serve sign-up at https://www.searchapi.io/users/sign_up.
// Read-only fare shopping only; nothing here ever books a real flight.

const BASE_URL = 'https://www.searchapi.io/api/v1/search';
const FETCH_TIMEOUT_MS = 15000;

const TRAVEL_CLASS_CODE = {
  Economy: 'Y', 'Premium Economy': 'W', Business: 'C', 'First Class': 'F'
};

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clockFromHHMM(str) {
  return (str || '').replace(':', '');
}

function minutesToHM(mins) {
  if (typeof mins !== 'number') return '';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}H${String(m).padStart(2, '0')}M`;
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
  const iso = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
  return { iso, label: `${String(candidate.getDate()).padStart(2, '0')}${MONTHS[candidate.getMonth()]}` };
}

async function runSearch(apiKey, params) {
  const qs = new URLSearchParams({ engine: 'google_flights', api_key: apiKey, ...params });
  const res = await fetchWithTimeout(`${BASE_URL}?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function testConnection(apiKey) {
  if (!apiKey) throw new Error('API KEY IS REQUIRED');
  // A cheap, always-valid probe search. This consumes 1 of the free quota.
  const tomorrow = new Date(Date.now() + 86400000);
  const iso = tomorrow.toISOString().slice(0, 10);
  await runSearch(apiKey, {
    departure_id: 'JFK', arrival_id: 'LAX',
    outbound_date: iso, flight_type: 'one_way'
  });
  return true;
}

function normalizeResult(result, idx, currency, dateLabel) {
  const legs = result.flights || [];
  if (legs.length === 0) return null;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const stops = legs.length - 1;
  const travelClass = first.travel_class || 'Economy';

  return {
    line: idx + 1,
    carrier: (first.flight_number || '').split(' ')[0] || '',
    carrierName: first.airline || '',
    flightNumber: (first.flight_number || '').replace(/\s+/g, ''),
    origin: first.departure_airport && first.departure_airport.id,
    dest: last.arrival_airport && last.arrival_airport.id,
    dep: clockFromHHMM(first.departure_airport && first.departure_airport.time),
    arr: clockFromHHMM(last.arrival_airport && last.arrival_airport.time),
    dur: minutesToHM(result.total_duration),
    aircraft: first.airplane || '',
    date: dateLabel.toUpperCase(),
    stops,
    fares: [{
      code: TRAVEL_CLASS_CODE[travelClass] || 'Y',
      label: travelClass.toUpperCase(),
      price: typeof result.price === 'number' ? result.price : parseFloat(result.price),
      currency: currency || 'USD',
      seats: null // Google Flights doesn't expose bookable seat counts
    }]
  };
}

async function searchLiveFlights({ apiKey, origin, dest, dateLabel, currency }) {
  const parsed = ddmmmToIsoDate(dateLabel);
  if (!parsed) throw new Error(`INVALID DATE FORMAT "${dateLabel}"`);

  const data = await runSearch(apiKey, {
    departure_id: origin,
    arrival_id: dest,
    outbound_date: parsed.iso,
    flight_type: 'one_way',
    currency: currency || 'USD'
  });

  const raw = [...(data.best_flights || []), ...(data.other_flights || [])].slice(0, 8);
  const lines = raw
    .map((r, idx) => normalizeResult(r, idx, currency, dateLabel))
    .filter(Boolean);

  return { ok: true, origin, dest, date: dateLabel.toUpperCase(), lines, source: 'LIVE' };
}

module.exports = { testConnection, searchLiveFlights };
