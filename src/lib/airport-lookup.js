// IATA code lookup: search ~5,400 real airports with scheduled service by
// city, country, airport name, or code. Fully offline - bundled from the
// OurAirports open dataset (see scripts/build-airports-data.js), so this
// works instantly with no network call and no API quota.
const AIRPORTS = require('./airports-data.json');
const COUNTRIES = require('./countries.json');

const SIZE_RANK = { large: 3, medium: 2, small: 1 };

function search(query, limit) {
  limit = limit || 30;
  const q = (query || '').trim().toUpperCase();
  if (!q) return { query, total: 0, results: [] };

  // exact IATA code hit - always surfaced first, on its own
  const exact = AIRPORTS.find((a) => a.iata === q);

  const scored = [];
  for (const a of AIRPORTS) {
    if (a.iata === q) continue; // already handled as `exact`
    const city = (a.city || '').toUpperCase();
    const name = (a.name || '').toUpperCase();
    const countryName = COUNTRIES[a.country] || a.country;
    let score = null;
    if (city === q || countryName === q) score = 100;
    else if (city.startsWith(q) || countryName.startsWith(q)) score = 80;
    else if (city.includes(q) || countryName.includes(q)) score = 60;
    else if (name.includes(q)) score = 40;
    if (score !== null) {
      scored.push({ ...a, countryName, score: score + (SIZE_RANK[a.size] || 0) });
    }
  }
  scored.sort((x, y) => y.score - x.score);

  const results = [];
  if (exact) results.push({ ...exact, countryName: COUNTRIES[exact.country] || exact.country });
  results.push(...scored);

  return {
    query,
    total: results.length,
    results: results.slice(0, limit)
  };
}

module.exports = { search };
