// Mock schedule data. Carriers are fictional (no real airline codes used).
// AIRPORTS is a broad global IATA code set (name + approx coordinates) so any
// city pair can be searched. A handful of major routes have curated, flavorful
// schedules in ROUTES; every other pair falls back to a deterministic synthetic
// schedule generated from great-circle distance, so results are stable for a
// given origin/destination/date but still feel like a real timetable.
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

const CARRIERS = ['ZR', 'QX', 'VT', 'NB'];

const ROUTES = [
  { o: 'ORD', d: 'JFK', flights: [
    { fn: 'ZR104', dep: '0710', arr: '1002', dur: '2H52M', ac: '738', days: [0,1,2,3,4,5,6] },
    { fn: 'QX882', dep: '1245', arr: '1538', dur: '2H53M', ac: '32N', days: [1,2,3,4,5] },
    { fn: 'VT219', dep: '1830', arr: '2121', dur: '2H51M', ac: '73H', days: [0,1,2,3,4,5,6] }
  ]},
  { o: 'JFK', d: 'ORD', flights: [
    { fn: 'ZR105', dep: '0800', arr: '0942', dur: '2H42M', ac: '738', days: [0,1,2,3,4,5,6] },
    { fn: 'NB471', dep: '1620', arr: '1801', dur: '2H41M', ac: 'E75', days: [1,2,3,4,5,6] }
  ]},
  { o: 'ORD', d: 'LAX', flights: [
    { fn: 'QX310', dep: '0900', arr: '1128', dur: '4H28M', ac: '32N', days: [0,1,2,3,4,5,6] },
    { fn: 'ZR552', dep: '1710', arr: '1938', dur: '4H28M', ac: '789', days: [0,2,4,6] }
  ]},
  { o: 'LAX', d: 'ORD', flights: [
    { fn: 'QX311', dep: '1305', arr: '1912', dur: '4H07M', ac: '32N', days: [0,1,2,3,4,5,6] }
  ]},
  { o: 'DFW', d: 'ATL', flights: [
    { fn: 'VT640', dep: '0640', arr: '0925', dur: '1H45M', ac: '73H', days: [1,2,3,4,5] },
    { fn: 'NB118', dep: '1415', arr: '1700', dur: '1H45M', ac: 'E75', days: [0,1,2,3,4,5,6] }
  ]},
  { o: 'ATL', d: 'DFW', flights: [
    { fn: 'VT641', dep: '1010', arr: '1112', dur: '2H02M', ac: '73H', days: [1,2,3,4,5] }
  ]},
  { o: 'MIA', d: 'JFK', flights: [
    { fn: 'ZR822', dep: '0730', arr: '1025', dur: '2H55M', ac: '320', days: [0,1,2,3,4,5,6] },
    { fn: 'QX905', dep: '1940', arr: '2233', dur: '2H53M', ac: '32N', days: [0,3,5] }
  ]},
  { o: 'SEA', d: 'DEN', flights: [
    { fn: 'NB233', dep: '0855', arr: '1225', dur: '2H30M', ac: 'E75', days: [0,1,2,3,4,5,6] }
  ]},
  { o: 'ORD', d: 'LHR', flights: [
    { fn: 'VT002', dep: '1855', arr: '0840', dur: '7H45M', ac: '772', days: [0,1,2,3,4,5,6] }
  ]},
  { o: 'JFK', d: 'CDG', flights: [
    { fn: 'ZR010', dep: '2010', arr: '0925', dur: '7H15M', ac: '789', days: [0,1,2,3,4,5,6] }
  ]},
  { o: 'SFO', d: 'BOS', flights: [
    { fn: 'QX477', dep: '0810', arr: '1635', dur: '5H25M', ac: '32N', days: [1,2,3,4,5] }
  ]}
];

const FARE_TEMPLATE = [
  { code: 'Y', label: 'FULL Y', base: 620 },
  { code: 'B', label: 'FLEX B', base: 410 },
  { code: 'M', label: 'SAVER M', base: 268 },
  { code: 'Q', label: 'DEEP Q', base: 179 }
];

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function seededSeats(seed) {
  return Math.max(0, Math.min(9, Math.floor(seededRand(seed) * 10)));
}
function strSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
}

function haversineKm(a, b) {
  const [, lat1, lon1] = a, [, lat2, lon2] = b;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function minutesToHM(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}H${String(m).padStart(2, '0')}M`;
}
function addMinutesToClock(startMins, durMins) {
  const total = (startMins + durMins) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}
function fmtClock(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

function aircraftForDistance(km, seed) {
  if (km < 1200) return seededRand(seed) > 0.5 ? 'E75' : 'CRJ9';
  if (km < 4200) return ['738', '32N', '73H', '320'][Math.floor(seededRand(seed) * 4)];
  return ['789', '772', '359', '388'][Math.floor(seededRand(seed) * 4)];
}

function generateFlights(origin, dest, dayCode, dateLabel) {
  const oInfo = AIRPORTS[origin], dInfo = AIRPORTS[dest];
  const distKm = haversineKm(oInfo, dInfo);
  const baseSeed = strSeed(`${origin}${dest}${dayCode}`);
  const numFlights = distKm > 6000 ? 1 : (seededRand(baseSeed) > 0.45 ? 2 : 1);

  const flights = [];
  for (let i = 0; i < numFlights; i++) {
    const seed = baseSeed + i * 17.3;
    const durMins = Math.max(40, Math.round((distKm / 830) * 60) + 28 + Math.round(seededRand(seed + 1) * 12));
    const depMins = 300 + Math.floor(seededRand(seed + 2) * 1050); // 05:00 - 22:30
    const carrier = CARRIERS[Math.floor(seededRand(seed + 3) * CARRIERS.length)];
    const fn = carrier + (100 + Math.floor(seededRand(seed + 4) * 899));
    const aircraft = aircraftForDistance(distKm, seed + 5);
    flights.push({
      fn,
      dep: fmtClock(depMins),
      arr: addMinutesToClock(depMins, durMins),
      dur: minutesToHM(durMins),
      ac: aircraft,
      distKm
    });
  }
  return flights;
}

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

function farePriceForDistance(base, distKm) {
  // curated routes just use the flat FARE_TEMPLATE base; generated ones scale with distance
  return distKm ? Math.round(base * 0.35 + distKm * 0.085 * (base / 268)) : base;
}

function searchAvailability(origin, dest, dateStr) {
  origin = (origin || '').toUpperCase();
  dest = (dest || '').toUpperCase();
  const date = parseDDMMM(dateStr);
  if (!date) {
    return { ok: false, error: `INVALID DATE FORMAT "${dateStr}" - USE DDMMM (E.G. 25AUG)` };
  }
  if (!AIRPORTS[origin] || !AIRPORTS[dest]) {
    return { ok: false, error: `UNKNOWN CITY/AIRPORT CODE - ${!AIRPORTS[origin] ? origin : dest}` };
  }
  if (origin === dest) {
    return { ok: false, error: 'ORIGIN AND DESTINATION MUST BE DIFFERENT' };
  }
  const dow = date.getDay();
  const dateLabel = `${String(date.getDate()).padStart(2, '0')}${MONTHS[date.getMonth()]}`;

  const curated = ROUTES.find((r) => r.o === origin && r.d === dest);
  let rawFlights;
  if (curated) {
    rawFlights = curated.flights.filter((f) => f.days.includes(dow));
    if (rawFlights.length === 0) {
      return { ok: true, origin, dest, date: dateLabel, lines: [], msg: 'NO FLIGHTS OPERATE ON REQUESTED DAY' };
    }
  } else {
    rawFlights = generateFlights(origin, dest, `${dow}`, dateLabel);
  }

  const lines = rawFlights.map((f, idx) => {
    const seed = date.getTime() / 86400000 + strSeed(f.fn) + idx;
    const fares = FARE_TEMPLATE.map((ft, fi) => ({
      code: ft.code,
      label: ft.label,
      price: farePriceForDistance(ft.base, f.distKm),
      currency: 'USD',
      seats: seededSeats(seed + fi * 3.7)
    }));
    return {
      line: idx + 1,
      carrier: f.fn.slice(0, 2),
      flightNumber: f.fn,
      origin, dest,
      dep: f.dep, arr: f.arr, dur: f.dur, aircraft: f.ac,
      date: dateLabel,
      fares
    };
  });

  return { ok: true, origin, dest, date: dateLabel, lines };
}

module.exports = { searchAvailability, AIRPORTS };
