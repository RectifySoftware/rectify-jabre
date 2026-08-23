// Live foreign-exchange rates, base USD. Uses the free/keyless Frankfurter API
// (European Central Bank reference rates). No financial transactions occur here -
// this only affects how mock fares are *displayed* in the terminal.
const RATES_URL = 'https://api.frankfurter.app/latest?from=USD';
const FETCH_TIMEOUT_MS = 6000;

async function fetchLiveRates() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(RATES_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.rates) throw new Error('MALFORMED RESPONSE');
    const rates = { USD: 1, ...data.rates };
    return { base: 'USD', rates, fetchedAt: new Date().toISOString(), sourceDate: data.date };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchLiveRates };
