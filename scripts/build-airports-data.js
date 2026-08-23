// One-off processing script: takes the raw OurAirports airports.csv (public
// domain, https://ourairports.com/data/) and produces a compact bundled JSON
// file of every airport that has a real IATA code and real (or plausible)
// scheduled service, for the in-app IATA code lookup feature. Not run at
// app runtime - this is a build-time data prep step, output is committed.
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || path.join(require('os').tmpdir(), 'airports_full.csv');
const OUT = path.join(__dirname, '..', 'src', 'lib', 'airports-data.json');

// Minimal CSV parser that handles quoted fields containing commas.
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split('\n');
const header = parseCsvLine(lines[0]);
const idx = (name) => header.indexOf(name);
const iType = idx('type'), iName = idx('name'), iCountry = idx('iso_country'),
  iMunicipality = idx('municipality'), iIata = idx('iata_code'),
  iScheduled = idx('scheduled_service'), iLat = idx('latitude_deg'), iLon = idx('longitude_deg');

const out = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  const f = parseCsvLine(line);
  const iata = (f[iIata] || '').trim();
  if (!iata || !/^[A-Za-z]{3}$/.test(iata)) continue;
  const type = f[iType] || '';
  const scheduled = (f[iScheduled] || '').toLowerCase() === 'yes';
  const isRelevantSize = type === 'large_airport' || type === 'medium_airport';
  if (!isRelevantSize && !scheduled) continue; // skip tiny fields with no scheduled service

  out.push({
    iata: iata.toUpperCase(),
    name: f[iName] || '',
    city: f[iMunicipality] || '',
    country: (f[iCountry] || '').toUpperCase(),
    lat: parseFloat(f[iLat]) || null,
    lon: parseFloat(f[iLon]) || null,
    size: type.replace('_airport', '')
  });
}

// de-dupe by IATA code, preferring large > medium > small/other
const sizeRank = { large: 3, medium: 2, small: 1 };
const byIata = new Map();
for (const a of out) {
  const existing = byIata.get(a.iata);
  if (!existing || (sizeRank[a.size] || 0) > (sizeRank[existing.size] || 0)) {
    byIata.set(a.iata, a);
  }
}
const deduped = [...byIata.values()].sort((a, b) => a.iata.localeCompare(b.iata));

fs.writeFileSync(OUT, JSON.stringify(deduped), 'utf8');
console.log(`Wrote ${deduped.length} airports to ${OUT}`);
