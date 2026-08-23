// Global IATA airport reference data (name + approx coordinates) used for:
//   - validating origin/destination codes typed into the terminal
//   - great-circle distance, to suggest nearby alternate airports when a
//     search comes back empty
// This file does NOT generate or invent flights - every result the app shows
// must come from a live provider (src/lib/searchapi.js / src/lib/apify.js).
const AIRPORTS = {
  // North America
  ATL: ['ATLANTA', 33.6407, -84.4277], ORD: ['CHICAGO OHARE', 41.9742, -87.9073],
  LAX: ['LOS ANGELES', 33.9416, -118.4085], DFW: ['DALLAS FT WORTH', 32.8998, -97.0403],
  DEN: ['DENVER', 39.8561, -104.6737], JFK: ['NEW YORK JFK', 40.6413, -73.7781],
  SFO: ['SAN FRANCISCO', 37.6213, -122.3790], SEA: ['SEATTLE', 47.4502, -122.3088],
  LAS: ['LAS VEGAS', 36.0840, -115.1537], MCO: ['ORLANDO', 28.4312, -81.3081],
  MIA: ['MIAMI', 25.7959, -80.2870], PHX: ['PHOENIX', 33.4342, -112.0116],
  IAH: ['HOUSTON INTERCONTINENTAL', 29.9902, -95.3368], BOS: ['BOSTON LOGAN', 42.3656, -71.0096],
  MSP: ['MINNEAPOLIS', 44.8848, -93.2223], DTW: ['DETROIT', 42.2124, -83.3534],
  FLL: ['FORT LAUDERDALE', 26.0726, -80.1527], PHL: ['PHILADELPHIA', 39.8744, -75.2424],
  LGA: ['NEW YORK LAGUARDIA', 40.7769, -73.8740], BWI: ['BALTIMORE', 39.1774, -76.6684],
  SLC: ['SALT LAKE CITY', 40.7899, -111.9791], SAN: ['SAN DIEGO', 32.7338, -117.1933],
  TPA: ['TAMPA', 27.9755, -82.5332], PDX: ['PORTLAND', 45.5898, -122.5951],
  STL: ['ST LOUIS', 38.7487, -90.3700], YYZ: ['TORONTO PEARSON', 43.6777, -79.6248],
  YVR: ['VANCOUVER', 49.1947, -123.1792], YUL: ['MONTREAL', 45.4706, -73.7408],
  MEX: ['MEXICO CITY', 19.4363, -99.0721], CUN: ['CANCUN', 21.0365, -86.8771],
  GDL: ['GUADALAJARA', 20.5218, -103.3112], HAV: ['HAVANA', 22.9892, -82.4091],
  SJU: ['SAN JUAN', 18.4394, -66.0018], PTY: ['PANAMA CITY', 9.0714, -79.3835],
  BOG: ['BOGOTA', 4.7016, -74.1469], LIM: ['LIMA', 12.0219, -77.1143],
  SCL: ['SANTIAGO', 33.3930, -70.7858], EZE: ['BUENOS AIRES EZEIZA', 34.8222, -58.5358],
  GRU: ['SAO PAULO GUARULHOS', 23.4356, -46.4731], GIG: ['RIO DE JANEIRO GALEAO', 22.8100, -43.2506],
  BSB: ['BRASILIA', 15.8711, -47.9172], CCS: ['CARACAS', 10.6031, -66.9906],
  UIO: ['QUITO', 0.1292, -78.3575],
  MDW: ['CHICAGO MIDWAY', 41.7868, -87.7522], OAK: ['OAKLAND', 37.7126, -122.2197],
  SJC: ['SAN JOSE', 37.3639, -121.9289], YOW: ['OTTAWA', 45.3225, -75.6692],
  // Europe
  LHR: ['LONDON HEATHROW', 51.4700, -0.4543], LGW: ['LONDON GATWICK', 51.1537, -0.1821],
  STN: ['LONDON STANSTED', 51.8860, 0.2389], LTN: ['LONDON LUTON', 51.8747, -0.3683],
  CDG: ['PARIS CDG', 49.0097, 2.5479], ORY: ['PARIS ORLY', 48.7233, 2.3794],
  AMS: ['AMSTERDAM SCHIPHOL', 52.3105, 4.7683], FRA: ['FRANKFURT', 50.0379, 8.5622],
  MUC: ['MUNICH', 48.3538, 11.7861], MAD: ['MADRID BARAJAS', 40.4983, -3.5676],
  BCN: ['BARCELONA', 41.2974, 2.0833], FCO: ['ROME FIUMICINO', 41.8003, 12.2389],
  MXP: ['MILAN MALPENSA', 45.6306, 8.7281], ZRH: ['ZURICH', 47.4647, 8.5492],
  VIE: ['VIENNA', 48.1103, 16.5697], CPH: ['COPENHAGEN', 55.6180, 12.6560],
  ARN: ['STOCKHOLM ARLANDA', 59.6519, 17.9186], OSL: ['OSLO', 60.1976, 11.1004],
  HEL: ['HELSINKI', 60.3172, 24.9633], DUB: ['DUBLIN', 53.4213, -6.2701],
  LIS: ['LISBON', 38.7756, -9.1354], ATH: ['ATHENS', 37.9364, 23.9445],
  IST: ['ISTANBUL', 41.2753, 28.7519], SVO: ['MOSCOW SHEREMETYEVO', 55.9736, 37.4125],
  DME: ['MOSCOW DOMODEDOVO', 55.4088, 37.9063], WAW: ['WARSAW', 52.1657, 20.9671],
  PRG: ['PRAGUE', 50.1008, 14.2632], BUD: ['BUDAPEST', 47.4298, 19.2611],
  BRU: ['BRUSSELS', 50.9014, 4.4844], GVA: ['GENEVA', 46.2381, 6.1090],
  MAN: ['MANCHESTER', 53.3537, -2.2750], EDI: ['EDINBURGH', 55.9500, -3.3725],
  NCE: ['NICE', 43.6584, 7.2159], BER: ['BERLIN BRANDENBURG', 52.3667, 13.5033],
  KEF: ['REYKJAVIK KEFLAVIK', 63.9850, -22.6056],
  LBA: ['LEEDS BRADFORD', 53.8659, -1.6606], BHX: ['BIRMINGHAM', 52.4539, -1.7480],
  GLA: ['GLASGOW', 55.8642, -4.4330], BFS: ['BELFAST', 54.6575, -6.2158],
  NCL: ['NEWCASTLE', 55.0375, -1.6917], BRS: ['BRISTOL', 51.3827, -2.7191],
  LPL: ['LIVERPOOL', 53.3336, -2.8497], EMA: ['EAST MIDLANDS', 52.8311, -1.3281],
  LYS: ['LYON', 45.7256, 5.0811], TLS: ['TOULOUSE', 43.6293, 1.3638],
  HAM: ['HAMBURG', 53.6304, 9.9882], STR: ['STUTTGART', 48.6899, 9.2220],
  NAP: ['NAPLES', 40.8860, 14.2908], VCE: ['VENICE', 45.5053, 12.3519],
  PMI: ['PALMA DE MALLORCA', 39.5517, 2.7388], OPO: ['PORTO', 41.2481, -8.6814],
  BEG: ['BELGRADE', 44.8184, 20.3091], SOF: ['SOFIA', 42.6952, 23.4062],
  OTP: ['BUCHAREST', 44.5711, 26.0850],
  // Middle East / Africa
  DXB: ['DUBAI', 25.2532, 55.3657], AUH: ['ABU DHABI', 24.4330, 54.6511],
  DOH: ['DOHA', 25.2731, 51.6080], JED: ['JEDDAH', 21.6796, 39.1565],
  RUH: ['RIYADH', 24.9576, 46.6988], CAI: ['CAIRO', 30.1219, 31.4056],
  CMN: ['CASABLANCA', 33.3675, -7.5900], JNB: ['JOHANNESBURG', 26.1392, 28.2460],
  CPT: ['CAPE TOWN', 33.9648, 18.6017], NBO: ['NAIROBI', 1.3192, 36.9278],
  LOS: ['LAGOS', 6.5774, 3.3212], ADD: ['ADDIS ABABA', 8.9779, 38.7993],
  TLV: ['TEL AVIV', 32.0114, 34.8867], AMM: ['AMMAN', 31.7226, 35.9932],
  // Asia / Oceania
  HND: ['TOKYO HANEDA', 35.5494, 139.7798], NRT: ['TOKYO NARITA', 35.7647, 140.3864],
  KIX: ['OSAKA KANSAI', 34.4347, 135.2441], ICN: ['SEOUL INCHEON', 37.4602, 126.4407],
  PVG: ['SHANGHAI PUDONG', 31.1443, 121.8083], PEK: ['BEIJING CAPITAL', 40.0799, 116.6031],
  PKX: ['BEIJING DAXING', 39.5098, 116.4105], HKG: ['HONG KONG', 22.3080, 113.9185],
  TPE: ['TAIPEI TAOYUAN', 25.0797, 121.2342], SIN: ['SINGAPORE CHANGI', 1.3644, 103.9915],
  KUL: ['KUALA LUMPUR', 2.7456, 101.7099], BKK: ['BANGKOK SUVARNABHUMI', 13.6900, 100.7501],
  DPS: ['DENPASAR BALI', 8.7482, 115.1672], CGK: ['JAKARTA', 6.1256, 106.6559],
  MNL: ['MANILA', 14.5086, 121.0198], DEL: ['DELHI', 28.5562, 77.1000],
  BOM: ['MUMBAI', 19.0896, 72.8656], BLR: ['BANGALORE', 13.1986, 77.7066],
  MAA: ['CHENNAI', 12.9941, 80.1709], CCU: ['KOLKATA', 22.6547, 88.4467],
  KTM: ['KATHMANDU', 27.6966, 85.3591], DAC: ['DHAKA', 23.8433, 90.3978],
  CMB: ['COLOMBO', 7.1808, 79.8841], SYD: ['SYDNEY', 33.9399, 151.1753],
  MEL: ['MELBOURNE', 37.6690, 144.8410], BNE: ['BRISBANE', 27.3842, 153.1175],
  PER: ['PERTH', 31.9403, 115.9669], AKL: ['AUCKLAND', 37.0082, 174.7850],
  NAN: ['NADI FIJI', 17.7554, 177.4434], HNL: ['HONOLULU', 21.3187, -157.9224],
  GUM: ['GUAM', 13.4834, 144.7960]
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parseDDMMM(str, now = new Date()) {
  const m = /^(\d{1,2})([A-Z]{3})$/.exec((str || '').toUpperCase());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monIdx = MONTHS.indexOf(m[2]);
  if (monIdx < 0 || day < 1 || day > 31) return null;
  let year = now.getFullYear();
  let candidate = new Date(year, monIdx, day);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate = new Date(year + 1, monIdx, day);
  }
  return candidate;
}

function formatDateLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')}${MONTHS[date.getMonth()]}`;
}

// This only checks the codes *look* like IATA airport codes (3 letters).
// It deliberately does NOT require membership in the local AIRPORTS dataset
// below - that list is a few hundred major airports used for computing
// alternate-airport suggestions, not an exhaustive directory. The live
// provider (SearchAPI/Apify) is the real authority on whether an airport
// actually exists and has flights; rejecting real airports just because
// they're missing from this local list would be wrong.
function validateAirports(origin, dest) {
  origin = (origin || '').toUpperCase();
  dest = (dest || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(dest)) {
    return { ok: false, error: `INVALID AIRPORT CODE - MUST BE 3 LETTERS - ${!/^[A-Z]{3}$/.test(origin) ? origin : dest}` };
  }
  if (origin === dest) {
    return { ok: false, error: 'ORIGIN AND DESTINATION MUST BE DIFFERENT' };
  }
  return { ok: true };
}

function haversineKm(codeA, codeB) {
  const a = AIRPORTS[codeA], b = AIRPORTS[codeB];
  if (!a || !b) return Infinity;
  const [, lat1, lon1] = a, [, lat2, lon2] = b;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Nearest other airports to `code` by great-circle distance, excluding itself
// and (optionally) a code that wouldn't make a sensible suggestion (e.g. the
// other side of the route being searched). Used to suggest "try this instead"
// when a route genuinely has no live results.
function nearestAirports(code, count, exclude) {
  code = (code || '').toUpperCase();
  if (!AIRPORTS[code]) return [];
  const excludeSet = new Set([code, ...(exclude || [])].map((c) => (c || '').toUpperCase()));
  return Object.keys(AIRPORTS)
    .filter((c) => !excludeSet.has(c))
    .map((c) => ({ code: c, distKm: haversineKm(code, c) }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, count)
    .map((x) => x.code);
}

module.exports = { AIRPORTS, parseDDMMM, formatDateLabel, validateAirports, haversineKm, nearestAirports };
