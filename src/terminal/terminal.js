// ---------------------------------------------------------------------------
// Rectify Jabre - terminal renderer
// ---------------------------------------------------------------------------

let session = { agentId: '--', dutyCode: '--', pcc: '--', name: '' };
let tabs = [];
let activeTabId = null;
let tabSeq = 0;
let queueCache = [];

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------
let currency = 'USD';
let ratesBase = 'USD';
let rates = { USD: 1 };
let ratesUpdatedAt = null;
let ratesStale = false;

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
  CAD: 'C$', AUD: 'A$', CHF: 'CHF', MXN: 'MX$', INR: '₹',
  BRL: 'R$', NZD: 'NZ$', SGD: 'S$', HKD: 'HK$', SEK: 'kr', NOK: 'kr'
};

// General currency conversion pivoted through USD (rates table is base USD).
// fromCur may be any currency a fare is denominated in - live Google Flights fares
// are already priced in whatever currency was requested, mock fares are USD.
function convertAmount(amount, fromCur, toCur) {
  fromCur = fromCur || 'USD';
  toCur = toCur || 'USD';
  if (fromCur === toCur) return amount;
  const fromRate = fromCur === 'USD' ? 1 : rates[fromCur];
  const toRate = toCur === 'USD' ? 1 : rates[toCur];
  if (typeof fromRate !== 'number' || typeof toRate !== 'number') return amount;
  return (amount / fromRate) * toRate;
}

function formatMoney(amount, fromCur) {
  const converted = convertAmount(amount, fromCur || 'USD', currency);
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  return `${currency} ${symbol}${converted.toFixed(2)}`;
}

async function refreshRates(tab, opts) {
  opts = opts || {};
  try {
    const res = await window.rj.getRates();
    if (!res.ok) {
      ratesStale = true;
      if (tab && !opts.silent) logLine(tab, res.error, 'err');
      return false;
    }
    ratesBase = res.base;
    rates = res.rates;
    ratesUpdatedAt = res.fetchedAt;
    ratesStale = !!res.stale;
    if (tab && !opts.silent) {
      logLine(tab, `EXCHANGE RATES ${ratesStale ? 'LOADED FROM CACHE (OFFLINE)' : 'UPDATED LIVE'} - BASE ${ratesBase} - ${new Date(ratesUpdatedAt).toLocaleString()}`, ratesStale ? 'sys' : 'ok');
    }
    updateStatusBar();
    return true;
  } catch (e) {
    ratesStale = true;
    if (tab && !opts.silent) logLine(tab, 'FAILED TO REACH EXCHANGE RATE SERVICE - ' + e.message, 'err');
    return false;
  }
}

async function cmdCurrency(tab, code) {
  code = (code || '').trim().toUpperCase();
  await refreshRates(tab, { silent: true });
  if (!code) {
    const codes = Object.keys(rates).sort();
    logLine(tab, `AVAILABLE CURRENCIES (${codes.length}) - BASE ${ratesBase}${ratesStale ? ' (CACHED)' : ''}:`, 'sys');
    for (let i = 0; i < codes.length; i += 10) {
      logLine(tab, '  ' + codes.slice(i, i + 10).join(' '), 'sys');
    }
    logLine(tab, `CURRENT DISPLAY CURRENCY: ${currency}. FORMAT: CC<CODE> E.G. CCEUR`, 'sys');
    return;
  }
  if (!(code in rates)) {
    logLine(tab, `CURRENCY CODE "${code}" NOT RECOGNIZED. TYPE CC FOR THE FULL LIST.`, 'err');
    return;
  }
  currency = code;
  logLine(tab, `DISPLAY CURRENCY SET TO ${currency} - 1 USD = ${rates[currency]} ${currency}${ratesStale ? ' (RATES CACHED, OFFLINE)' : ' (LIVE RATE)'}`, 'ok');
  updateStatusBar();
  renderWorkspace();
}

function newTabState() {
  tabSeq += 1;
  return {
    id: 'tab-' + tabSeq,
    title: 'BOOKING ' + tabSeq,
    availability: null,
    lastSearch: null,
    pnr: { locator: null, passengers: [], segments: [], fare: null },
    log: []
  };
}

function activeTab() {
  return tabs.find((t) => t.id === activeTabId);
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function logLine(tab, text, cls) {
  tab.log.push({ text, cls: cls || '' });
  if (tab.id === activeTabId) renderResponseLog();
}
function logBlock(tab, lines, cls) {
  lines.forEach((l) => logLine(tab, l, cls));
}

function renderResponseLog() {
  const el = document.getElementById('responseLog');
  const tab = activeTab();
  if (!tab) { el.innerHTML = ''; return; }
  el.innerHTML = tab.log
    .map((l) => `<div class="${l.cls}">${escapeHtml(l.text)}</div>`)
    .join('');
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function addTab() {
  const t = newTabState();
  tabs.push(t);
  activeTabId = t.id;
  logBlock(t, [
    'RECTIFY JABRE - NEW WORKSPACE OPENED',
    'TYPE HELP FOR COMMAND REFERENCE.'
  ], 'sys');
  renderTabs();
  renderWorkspace();
  focusCmd();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  tabs.splice(idx, 1);
  if (tabs.length === 0) {
    addTab();
    return;
  }
  if (activeTabId === id) {
    activeTabId = tabs[Math.max(0, idx - 1)].id;
  }
  renderTabs();
  renderWorkspace();
  renderResponseLog();
}

function switchTab(id) {
  activeTabId = id;
  renderTabs();
  renderWorkspace();
  renderResponseLog();
  updateStatusBar();
}

function renderTabs() {
  const el = document.getElementById('tabs');
  el.innerHTML = '';
  tabs.forEach((t) => {
    const d = document.createElement('div');
    d.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    d.innerHTML = `<span>${escapeHtml(t.title)}${t.pnr.locator ? ' - ' + t.pnr.locator : ''}</span><span class="tab-close" data-close="${t.id}">x</span>`;
    d.addEventListener('click', (e) => {
      if (e.target.dataset.close) {
        closeTab(e.target.dataset.close);
      } else {
        switchTab(t.id);
      }
    });
    el.appendChild(d);
  });
  const addBtn = document.createElement('div');
  addBtn.className = 'tab-add';
  addBtn.textContent = '+';
  addBtn.title = 'New Booking Tab (F2)';
  addBtn.addEventListener('click', addTab);
  el.appendChild(addBtn);
}

// ---------------------------------------------------------------------------
// Workspace rendering
// ---------------------------------------------------------------------------
function renderWorkspace() {
  const el = document.getElementById('workspace');
  const tab = activeTab();
  if (!tab) { el.innerHTML = ''; return; }

  let html = '';

  if (tab.airportLookup) {
    html += renderAirportLookupBlock(tab.airportLookup);
  }

  if (tab.availability && tab.availability.lines) {
    html += renderAvailabilityBlock(tab.availability);
  }

  if (tab.pnr.passengers.length || tab.pnr.segments.length || tab.pnr.locator) {
    html += renderPnrBlock(tab.pnr);
  }

  if (!html) {
    html = `<div class="welcome">
RECTIFY JABRE TERMINAL - WORKSPACE ${escapeHtml(tab.title)}<br><br>
No active display. Enter a command below, e.g.:<br>
&nbsp;&nbsp;<b>AORDJFK25AUG</b>  - search availability CHI to NYC<br>
&nbsp;&nbsp;<b>DA LEEDS</b>      - look up IATA codes for "Leeds"<br>
&nbsp;&nbsp;<b>HELP</b>          - full command reference<br>
</div>`;
  }

  el.innerHTML = html;
}

function fareCellClass(seats) {
  if (seats === 0) return 'no-seats';
  if (seats <= 2) return 'low-seats';
  return 'has-seats';
}

function sourceLabel(cached) {
  return cached ? '[LIVE - REAL AIRLINE DATA, CACHED]' : '[LIVE - REAL AIRLINE DATA]';
}
function sourceBadge(cached) {
  return `<span style="color:#1c5c22;font-weight:bold;">${sourceLabel(cached)}</span>`;
}

function renderAirportLookupBlock(data) {
  if (!data.results || data.results.length === 0) {
    return `<div class="panel-block">
      <div class="panel-block-head">IATA CODE LOOKUP - "${escapeHtml(data.query)}"</div>
      <div style="padding:10px;font-family:var(--font-mono);font-size:12px;">NO AIRPORTS MATCHED "${escapeHtml(data.query)}" - TRY A CITY, COUNTRY, OR PARTIAL AIRPORT NAME</div>
    </div>`;
  }
  const rows = data.results.map((a) => `<tr>
    <td><b>${a.iata}</b></td>
    <td>${escapeHtml(a.name)}</td>
    <td>${escapeHtml(a.city || '')}</td>
    <td>${escapeHtml(a.countryName || a.country || '')}</td>
  </tr>`).join('');
  const moreNote = data.total > data.results.length
    ? `<div style="padding:4px 8px;font-family:var(--font-mono);font-size:11px;color:#777;">SHOWING ${data.results.length} OF ${data.total} MATCHES - NARROW YOUR SEARCH FOR MORE PRECISE RESULTS</div>`
    : '';
  return `<div class="panel-block">
    <div class="panel-block-head">IATA CODE LOOKUP - "${escapeHtml(data.query)}" (${data.total} MATCH${data.total === 1 ? '' : 'ES'})</div>
    <table class="data-table">
      <thead><tr><th>CODE</th><th>AIRPORT</th><th>CITY</th><th>COUNTRY</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${moreNote}
  </div>`;
}

function renderAvailabilityBlock(av) {
  const head = `AVAILABILITY ${av.origin}-${av.dest} ${av.date} ${sourceBadge(av.cached)}`;
  if (!av.lines || av.lines.length === 0) {
    const liveErrLine = av.liveError ? `<div style="padding:0 10px 8px;font-family:var(--font-mono);font-size:11px;color:#999;">LIVE LOOKUP FAILED: ${escapeHtml(av.liveError)}</div>` : '';
    return `<div class="panel-block">
      <div class="panel-block-head">${head}</div>
      <div style="padding:10px;font-family:var(--font-mono);font-size:12px;">${escapeHtml(av.msg || 'NO FLIGHTS FOUND')}</div>
      ${liveErrLine}
    </div>`;
  }
  const hasAlts = av.lines.some((l) => l.alt);
  const rows = av.lines.map((l) => {
    const fareCells = l.fares.map((f) => `<td class="fare-cell has-seats" title="CLASS ${f.code} - ${f.label}">${formatMoney(f.price, f.currency)}</td>`).join('');
    const carrierTitle = l.carrierName ? ` title="${escapeHtml(l.carrierName)}${l.aircraftName ? ' - ' + escapeHtml(l.aircraftName) : ''}"` : '';
    const stopsLabel = l.stops ? `${l.stops} STOP${l.stops > 1 ? 'S' : ''}` : 'NONSTOP';
    const rowClass = l.alt ? ' class="alt-row"' : '';
    const altCell = hasAlts ? `<td class="alt-cell">${l.alt ? `&#9888; ${escapeHtml(l.altNote || 'ALTERNATIVE')}` : ''}</td>` : '';
    return `<tr${rowClass}>
      <td>${l.line}</td>
      <td${carrierTitle}>${l.carrier} ${l.flightNumber.replace(l.carrier, '')}</td>
      <td>${l.origin}</td><td>${l.dest}</td>
      <td>${l.dep}</td><td>${l.arr}</td><td>${l.dur}</td><td>${stopsLabel}</td><td>${l.aircraft}</td>
      ${fareCells}
      ${altCell}
    </tr>`;
  }).join('');
  const altBanner = hasAlts
    ? `<div class="alt-banner">&#9888; NO EXACT MATCH FOR ${av.origin}-${av.dest} ${av.date} - SHOWING NEAREST ALTERNATIVES BELOW (HIGHLIGHTED)</div>`
    : '';
  return `<div class="panel-block">
    <div class="panel-block-head">${head}</div>
    ${altBanner}
    <table class="data-table">
      <thead><tr>
        <th>LN</th><th>FLT</th><th>ORG</th><th>DST</th><th>DEP</th><th>ARR</th><th>ELPD</th><th>STOPS</th><th>EQP</th>
        <th>FARE</th>
        ${hasAlts ? '<th>ALT</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderPnrBlock(pnr) {
  const names = pnr.passengers.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${escapeHtml(p.last)}/${escapeHtml(p.first)} ${escapeHtml(p.title || '')}</td></tr>`
  ).join('') || `<tr><td colspan="2" style="color:#999;">NO NAMES ADDED - USE NM1LAST/FIRST</td></tr>`;

  const segs = pnr.segments.map((s, i) => {
    const segFare = s.fareOnSeg ? formatMoney(s.fareOnSeg.price, s.fareOnSeg.currency) : '-';
    return `<tr><td>${i + 1}</td><td>${s.carrier}${s.flightNumber.replace(s.carrier, '')}</td><td>${s.origin}-${s.dest}</td><td>${s.date}</td><td>${s.dep}</td><td>${s.arr}</td><td>${s.bookingClass}</td><td>${segFare}</td></tr>`;
  }).join('') || `<tr><td colspan="8" style="color:#999;">NO SEGMENTS SOLD - USE S&lt;LINE&gt;&lt;CLASS&gt;</td></tr>`;

  const paxCount = Math.max(1, pnr.passengers.length);
  const fareRow = pnr.fare
    ? `FARE: ${pnr.fare.code} - ${formatMoney(pnr.fare.price, pnr.fare.currency)} PER PAX (SUM OF ${pnr.segments.length} SEGMENT${pnr.segments.length === 1 ? '' : 'S'} ABOVE) x ${paxCount} PAX = ${formatMoney(pnr.fare.price * paxCount, pnr.fare.currency)}`
    : 'FARE: NOT PRICED - USE FXP';

  return `<div class="panel-block">
    <div class="panel-block-head">PNR IN PROGRESS ${pnr.locator ? '- LOCATOR ' + pnr.locator : '(UNSAVED)'}</div>
    <table class="data-table">
      <thead><tr><th style="width:30px;">#</th><th>PASSENGER NAME</th></tr></thead>
      <tbody>${names}</tbody>
    </table>
    <table class="data-table">
      <thead><tr><th style="width:30px;">#</th><th>FLT</th><th>ROUTE</th><th>DATE</th><th>DEP</th><th>ARR</th><th>CLS</th><th>FARE (PER PAX)</th></tr></thead>
      <tbody>${segs}</tbody>
    </table>
    <div style="padding:6px 8px;font-family:var(--font-mono);font-size:12px;border-top:1px solid #ddd9cc;">${fareRow}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Queue sidebar
// ---------------------------------------------------------------------------
async function refreshQueue() {
  queueCache = await window.rj.listPnrs();
  renderQueue();
}

function renderQueue() {
  document.getElementById('queueCount').textContent = String(queueCache.length);
  const el = document.getElementById('queueList');
  if (queueCache.length === 0) {
    el.innerHTML = '<div class="queue-empty">QUEUE EMPTY</div>';
    return;
  }
  el.innerHTML = '';
  queueCache.slice().reverse().forEach((pnr) => {
    const row = document.createElement('div');
    row.className = 'queue-row';
    const firstName = pnr.passengers[0] ? `${pnr.passengers[0].last}/${pnr.passengers[0].first}` : 'NO NAME';
    row.innerHTML = `<span class="loc">${pnr.locator}</span><span class="nm">${escapeHtml(firstName)}${pnr.passengers.length > 1 ? ' +' + (pnr.passengers.length - 1) : ''}</span>`;
    row.title = 'Click to retrieve';
    row.addEventListener('click', () => {
      runCommand('RT' + pnr.locator);
    });
    el.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Command parsing / execution
// ---------------------------------------------------------------------------
function genLocator() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function runCommand(raw) {
  const tab = activeTab();
  if (!tab) return;
  const cmd = raw.trim();
  if (!cmd) return;
  logLine(tab, '> ' + cmd, 'cmd-echo');

  const upper = cmd.toUpperCase();

  try {
    if (upper === 'HELP' || upper === 'H') {
      showHelp();
      return;
    }
    if (upper === 'QR') return cmdQueueReview(tab);
    if (/^QD/.test(upper)) return cmdQueueDelete(tab, upper.slice(2));
    if (/^RT/.test(upper)) return cmdRetrieve(tab, upper.slice(2));
    if (upper === 'IG') return cmdIgnore(tab);
    if (upper === 'ER') return cmdEndRetrieve(tab);
    if (upper === 'FXP' || upper === 'FQ') return cmdPrice(tab);
    if (upper === 'WP') return cmdPrint(tab);
    if (upper === 'I' || upper === 'IR') return cmdDisplay(tab);
    if (upper === 'SI') return cmdSignOut(tab);
    if (/^CC/.test(upper)) return cmdCurrency(tab, upper.slice(2));
    if (/^DA\s+/.test(upper)) return cmdAirportLookup(tab, cmd.trim().slice(2).trim());
    if (/^NM\d*/.test(upper)) return cmdName(tab, cmd);
    if (/^S\d+/.test(upper)) return cmdSell(tab, upper);
    if (/^A[A-Z]{6}\d{1,2}[A-Z]{3}$/.test(upper)) return cmdAvailability(tab, upper);

    logLine(tab, `INVALID FORMAT - "${cmd}" NOT RECOGNIZED. TYPE HELP FOR COMMAND LIST.`, 'err');
  } catch (e) {
    logLine(tab, 'SYSTEM ERROR - ' + e.message, 'err');
  }
}

async function cmdAirportLookup(tab, query) {
  if (!query) { logLine(tab, 'FORMAT: DA <CITY, COUNTRY, OR AIRPORT NAME> E.G. DA LEEDS OR DA PORTUGAL', 'err'); return; }
  const data = await window.rj.searchAirports(query);
  tab.airportLookup = data;
  if (data.total === 0) {
    logLine(tab, `NO AIRPORTS MATCHED "${query}"`, 'err');
  } else {
    logLine(tab, `IATA LOOKUP - ${data.total} MATCH${data.total === 1 ? '' : 'ES'} FOR "${query}"${data.total > data.results.length ? ` (SHOWING ${data.results.length})` : ''}`, 'ok');
  }
  renderWorkspace();
}

async function cmdAvailability(tab, upper) {
  const m = /^A([A-Z]{3})([A-Z]{3})(\d{1,2}[A-Z]{3})$/.exec(upper);
  if (!m) { logLine(tab, 'FORMAT: A<ORIG><DEST><DDMMM> E.G. AORDJFK25AUG', 'err'); return; }
  const [, origin, dest, date] = m;
  logLine(tab, 'SEARCHING...', 'sys');
  const res = await window.rj.searchFlights(origin, dest, date, currency);
  if (!res.ok) { logLine(tab, res.error, 'err'); return; }
  tab.availability = res;
  tab.lastSearch = { origin, dest, date };
  if (res.lines.length === 0) {
    logLine(tab, res.msg || 'NO AVAILABILITY', 'err');
    if (res.liveError) logLine(tab, 'LIVE LOOKUP FAILED: ' + res.liveError, 'sys');
  } else {
    const altCount = res.lines.filter((l) => l.alt).length;
    if (altCount > 0) {
      logLine(tab, `NO EXACT MATCH - SHOWING ${altCount} ALTERNATIVE(S) INSTEAD (SEE HIGHLIGHTED ROWS)`, 'err');
    } else {
      logLine(tab, `${sourceLabel(res.cached)} ${res.lines.length} OPTION(S) - ${origin}-${dest} ${res.date}`, 'ok');
    }
  }
  renderWorkspace();
}

function cmdSell(tab, upper) {
  const m = /^S(\d+)([A-Z]?)$/.exec(upper);
  if (!m) { logLine(tab, 'FORMAT: S<LINE NUMBER>[CLASS] E.G. S2 OR S2M', 'err'); return; }
  if (!tab.availability || !tab.availability.lines || tab.availability.lines.length === 0) {
    logLine(tab, 'NO AVAILABILITY DISPLAYED - RUN AN "A" SEARCH FIRST', 'err');
    return;
  }
  const lineNum = parseInt(m[1], 10);
  const line = tab.availability.lines.find((l) => l.line === lineNum);
  if (!line) { logLine(tab, `LINE ${lineNum} NOT FOUND IN LAST AVAILABILITY DISPLAY`, 'err'); return; }

  let fare;
  if (m[2]) {
    fare = line.fares.find((f) => f.code === m[2]);
    if (!fare) { logLine(tab, `CLASS ${m[2]} NOT OFFERED ON THIS FLIGHT`, 'err'); return; }
  } else {
    fare = line.fares.find((f) => f.seats === null || f.seats > 0) || line.fares[0];
  }
  // seats === null means the data source (e.g. live Google Flights results)
  // doesn't expose a bookable-seat count - treat as available.
  if (fare.seats !== null && fare.seats <= 0) { logLine(tab, `CLASS ${fare.code} IS SOLD OUT (0 SEATS) ON LINE ${lineNum}`, 'err'); return; }

  tab.pnr.segments.push({
    carrier: line.carrier, flightNumber: line.flightNumber,
    origin: line.origin, dest: line.dest, date: line.date,
    dep: line.dep, arr: line.arr, aircraft: line.aircraft,
    bookingClass: fare.code, fareOnSeg: fare
  });
  logLine(tab, `SEGMENT SOLD - ${line.flightNumber} ${line.origin}${line.dest} ${line.date} CLASS ${fare.code} (${formatMoney(fare.price, fare.currency)})`, 'ok');
  renderWorkspace();
}

function cmdName(tab, cmd) {
  const m = /^NM\d*([A-Z' -]+)\/([A-Z' -]+?)(?:\s+([A-Z]{2,4}))?$/i.exec(cmd.trim());
  if (!m) { logLine(tab, 'FORMAT: NM1LASTNAME/FIRSTNAME [TITLE] E.G. NM1SMITH/JOHN MR', 'err'); return; }
  const [, last, first, title] = m;
  tab.pnr.passengers.push({ last: last.toUpperCase(), first: first.toUpperCase(), title: (title || '').toUpperCase() });
  logLine(tab, `NAME ADDED - ${last.toUpperCase()}/${first.toUpperCase()} ${(title || '').toUpperCase()}`, 'ok');
  renderWorkspace();
}

function cmdPrice(tab) {
  if (tab.pnr.segments.length === 0) { logLine(tab, 'CANNOT PRICE - NO SEGMENTS SOLD', 'err'); return; }
  // Sum every sold segment's fare (not just the last one sold) - a round trip
  // or multi-leg itinerary has to add up its outbound AND return/connecting fares.
  const segments = tab.pnr.segments;
  const commonCurrency = segments[0].fareOnSeg.currency || 'USD';
  let perPaxTotal = 0;
  segments.forEach((s) => {
    perPaxTotal += convertAmount(s.fareOnSeg.price, s.fareOnSeg.currency || 'USD', commonCurrency);
  });
  const classes = [...new Set(segments.map((s) => s.bookingClass))].join('/');

  tab.pnr.fare = { code: classes, price: perPaxTotal, currency: commonCurrency };
  const paxCount = Math.max(1, tab.pnr.passengers.length);
  logLine(tab, `FARE QUOTE - CLASS ${classes} - ${segments.length} SEGMENT${segments.length > 1 ? 'S' : ''}:`, 'ok');
  segments.forEach((s) => {
    logLine(tab, `  ${s.flightNumber} ${s.origin}-${s.dest} ${s.date} = ${formatMoney(s.fareOnSeg.price, s.fareOnSeg.currency)}`, 'sys');
  });
  logLine(tab, `SUM PER PAX = ${formatMoney(perPaxTotal, commonCurrency)}  x ${paxCount} PAX  TOTAL = ${formatMoney(perPaxTotal * paxCount, commonCurrency)}`, 'ok');
  renderWorkspace();
}

async function cmdEndRetrieve(tab) {
  if (tab.pnr.passengers.length === 0) { logLine(tab, 'CANNOT END/RETRIEVE - NO PASSENGER NAME (NM)', 'err'); return; }
  if (tab.pnr.segments.length === 0) { logLine(tab, 'CANNOT END/RETRIEVE - NO SEGMENTS SOLD (S)', 'err'); return; }
  if (!tab.pnr.fare) { logLine(tab, 'CANNOT END/RETRIEVE - ITINERARY NOT PRICED (FXP)', 'err'); return; }

  if (!tab.pnr.locator) tab.pnr.locator = genLocator();
  const record = {
    locator: tab.pnr.locator,
    passengers: tab.pnr.passengers,
    segments: tab.pnr.segments,
    fare: tab.pnr.fare,
    agentId: session.agentId,
    pcc: session.pcc,
    createdAt: new Date().toISOString()
  };
  await window.rj.savePnr(record);
  logLine(tab, `END OF TRANSACTION COMPLETE - RECORD LOCATOR: ${tab.pnr.locator}`, 'ok');
  tab.title = tab.pnr.locator;
  await refreshQueue();
  updateStatusBar();
  renderTabs();
  renderWorkspace();
}

function cmdIgnore(tab) {
  tab.pnr = { locator: null, passengers: [], segments: [], fare: null };
  tab.availability = null;
  logLine(tab, 'TRANSACTION IGNORED - WORKSPACE CLEARED', 'sys');
  updateStatusBar();
  renderTabs();
  renderWorkspace();
}

async function cmdRetrieve(tab, locator) {
  locator = locator.trim().toUpperCase();
  if (!locator) { logLine(tab, 'FORMAT: RT<RECORD LOCATOR>', 'err'); return; }
  const pnr = await window.rj.getPnr(locator);
  if (!pnr) { logLine(tab, `RECORD LOCATOR ${locator} NOT FOUND`, 'err'); return; }
  tab.pnr = { locator: pnr.locator, passengers: pnr.passengers, segments: pnr.segments, fare: pnr.fare };
  tab.title = pnr.locator;
  tab.availability = null;
  logLine(tab, `PNR RETRIEVED - ${locator}`, 'ok');
  updateStatusBar();
  renderTabs();
  renderWorkspace();
}

async function cmdQueueReview(tab) {
  await refreshQueue();
  if (queueCache.length === 0) { logLine(tab, 'QUEUE EMPTY', 'sys'); return; }
  logLine(tab, `QUEUE REVIEW - ${queueCache.length} RECORD(S)`, 'ok');
  queueCache.forEach((p) => {
    const nm = p.passengers[0] ? `${p.passengers[0].last}/${p.passengers[0].first}` : 'NO NAME';
    logLine(tab, `  ${p.locator}  ${nm}  ${p.segments.length} SEG  ${p.fare ? p.fare.code : '--'}`, 'sys');
  });
}

async function cmdQueueDelete(tab, locator) {
  locator = locator.trim().toUpperCase();
  if (!locator) { logLine(tab, 'FORMAT: QD<RECORD LOCATOR>', 'err'); return; }
  const existing = await window.rj.getPnr(locator);
  if (!existing) { logLine(tab, `RECORD LOCATOR ${locator} NOT FOUND`, 'err'); return; }
  await window.rj.deletePnr(locator);
  logLine(tab, `RECORD ${locator} REMOVED FROM QUEUE`, 'ok');
  await refreshQueue();
  if (tab.pnr.locator === locator) {
    tab.pnr = { locator: null, passengers: [], segments: [], fare: null };
    renderWorkspace();
    updateStatusBar();
    renderTabs();
  }
}

async function cmdPrint(tab) {
  if (!tab.pnr.locator) { logLine(tab, 'PNR MUST BE SAVED (ER) BEFORE PRINTING', 'err'); return; }
  const pnr = await window.rj.getPnr(tab.pnr.locator);
  if (pnr.fare) {
    pnr.fare = { ...pnr.fare, displayCurrency: currency, displayPrice: convertAmount(pnr.fare.price, pnr.fare.currency || 'USD', currency) };
  }
  logLine(tab, 'GENERATING ITINERARY PDF...', 'sys');
  const res = await window.rj.printPnr(pnr);
  if (res.canceled) { logLine(tab, 'PRINT CANCELED', 'sys'); return; }
  if (!res.ok) { logLine(tab, 'PRINT FAILED', 'err'); return; }
  logLine(tab, `ITINERARY SAVED TO ${res.filePath}`, 'ok');
}

function cmdDisplay(tab) {
  if (!tab.pnr.passengers.length && !tab.pnr.segments.length) {
    logLine(tab, 'NO ACTIVE PNR IN THIS WORKSPACE', 'sys');
    return;
  }
  logLine(tab, `PNR DISPLAY ${tab.pnr.locator ? '- ' + tab.pnr.locator : '(NOT SAVED)'}`, 'ok');
  tab.pnr.passengers.forEach((p, i) => logLine(tab, `  ${i + 1}.${p.last}/${p.first} ${p.title || ''}`, 'sys'));
  tab.pnr.segments.forEach((s, i) => logLine(tab, `  ${i + 1} ${s.flightNumber} ${s.origin}${s.dest} ${s.date} ${s.dep} CLASS ${s.bookingClass}`, 'sys'));
  if (tab.pnr.fare) logLine(tab, `  FARE ${tab.pnr.fare.code} ${formatMoney(tab.pnr.fare.price, tab.pnr.fare.currency)}`, 'sys');
}

function cmdSignOut(tab) {
  logLine(tab, 'SIGNING OFF...', 'sys');
  setTimeout(() => window.close(), 400);
}

// ---------------------------------------------------------------------------
// Help modal
// ---------------------------------------------------------------------------
const HELP_ROWS = [
  ['DA <CITY/COUNTRY/NAME>', 'Look up IATA airport codes. e.g. DA LEEDS or DA PORTUGAL'],
  ['A<ORIG><DEST><DDMMM>', 'Search flight availability. e.g. AORDJFK25AUG'],
  ['S<line>[class]', 'Sell a segment from displayed availability. e.g. S2 or S2M'],
  ['NM1<LAST>/<FIRST> [TITLE]', 'Add a passenger name. e.g. NM1SMITH/JOHN MR'],
  ['FXP', 'Price the itinerary using the last sold fare class'],
  ['ER', 'End & Retrieve - save the PNR and generate a record locator'],
  ['IG', 'Ignore - discard the current workspace transaction'],
  ['RT<LOCATOR>', 'Retrieve a saved PNR by record locator'],
  ['QR', 'Queue Review - list all saved PNRs'],
  ['QD<LOCATOR>', 'Queue Delete - remove a PNR from the queue'],
  ['WP', 'Write/Print itinerary to PDF (PNR must be saved first)'],
  ['I / IR', 'Display the active PNR in this workspace'],
  ['SI', 'Sign off and close the terminal'],
  ['CC<CODE>', 'Set display currency to live exchange rate, e.g. CCEUR'],
  ['CC', 'List available currency codes'],
  ['HELP', 'Show this reference']
];
const FKEY_ROWS = [
  ['F1', 'Help'], ['F2', 'New booking tab'], ['F3', 'Focus command line'],
  ['F4', 'Queue review (QR)'], ['F5', 'Repeat last availability search'],
  ['F6', 'Price itinerary (FXP)'], ['F7', 'End & retrieve (ER)'],
  ['F8', 'Print itinerary (WP)'], ['F9', 'Ignore transaction (IG)'],
  ['F10', 'Sign off (SI)'], ['F11', 'Change display currency (CC)'],
  ['F12', 'Collapse/expand response log']
];
function showHelp() {
  const body = document.getElementById('helpBody');
  const rows = HELP_ROWS.map(([c, d]) => `<tr><td class="cmd">${c}</td><td>${d}</td></tr>`).join('');
  const fkeys = FKEY_ROWS.map(([c, d]) => `<tr><td class="cmd">${c}</td><td>${d}</td></tr>`).join('');
  body.innerHTML = `<table>${rows}</table><div style="margin:10px 0 4px;color:#888;">FUNCTION KEYS</div><table>${fkeys}</table>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #333;color:#888;">
      <b style="color:var(--red-bright);">A</b> only ever shows real flights - nothing is
      ever invented. Go to <b>Tools &gt; Live Data Settings...</b> and connect a free
      SearchAPI.io key and/or a pay-per-use Apify token first, or searches will be
      refused with an error telling you to connect one. If your exact search comes up
      empty, the terminal automatically tries nearby dates and nearby airports and
      shows any real results it finds, clearly highlighted as alternatives.
    </div>`;
  document.getElementById('helpBackdrop').classList.add('show');
}
function hideHelp() { document.getElementById('helpBackdrop').classList.remove('show'); }

// ---------------------------------------------------------------------------
// Settings modal (live data / SearchAPI.io Google Flights)
// ---------------------------------------------------------------------------
async function showSettings() {
  const status = document.getElementById('settingsStatus');
  status.textContent = '';
  status.className = '';
  try {
    const s = await window.rj.getSettings();
    document.getElementById('setSearchApiKey').value = s.searchApiKey || '';
    document.getElementById('setApifyToken').value = s.apifyToken || '';
  } catch (e) {
    status.textContent = 'FAILED TO LOAD SETTINGS - ' + e.message;
    status.className = 'err';
  }
  document.getElementById('settingsBackdrop').classList.add('show');
}
function hideSettings() { document.getElementById('settingsBackdrop').classList.remove('show'); }

function setSettingsStatus(text, cls) {
  const status = document.getElementById('settingsStatus');
  status.textContent = text;
  status.className = cls || '';
}

function bindSettingsModal() {
  document.getElementById('settingsClose').addEventListener('click', hideSettings);
  document.getElementById('settingsBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'settingsBackdrop') hideSettings();
  });
  document.getElementById('signupSearchApiBtn').addEventListener('click', () => {
    window.rj.openExternal('https://www.searchapi.io/users/sign_up');
  });
  document.getElementById('signupApifyBtn').addEventListener('click', () => {
    window.rj.openExternal('https://console.apify.com/sign-up');
  });

  document.getElementById('settingsSaveBtn').addEventListener('click', async () => {
    const searchApiKey = document.getElementById('setSearchApiKey').value.trim();
    const apifyToken = document.getElementById('setApifyToken').value.trim();
    const res = await window.rj.saveSettings({ searchApiKey, apifyToken });
    setSettingsStatus(res.ok ? 'SAVED.' : 'SAVE FAILED', res.ok ? 'ok' : 'err');
    const t = activeTab();
    if (t) logLine(t, (searchApiKey || apifyToken) ? 'LIVE DATA SETTINGS SAVED - "A" SEARCHES WILL TRY LIVE AIRLINE DATA FIRST' : 'LIVE DATA SETTINGS CLEARED', 'sys');
  });
  document.getElementById('settingsClearBtn').addEventListener('click', async () => {
    await window.rj.clearSettings();
    document.getElementById('setSearchApiKey').value = '';
    document.getElementById('setApifyToken').value = '';
    setSettingsStatus('CLEARED - "A" SEARCHES WILL BE REFUSED UNTIL A PROVIDER IS RECONNECTED.', 'ok');
    const t = activeTab();
    if (t) logLine(t, 'LIVE DATA SETTINGS CLEARED - NO LIVE PROVIDER CONFIGURED', 'sys');
  });
  document.getElementById('testSearchApiBtn').addEventListener('click', async () => {
    setSettingsStatus('TESTING SEARCHAPI.IO (USES 1 FREE REQUEST)...', '');
    const searchApiKey = document.getElementById('setSearchApiKey').value.trim();
    const res = await window.rj.testApiConnection({ provider: 'searchapi', searchApiKey });
    setSettingsStatus(res.ok ? 'SEARCHAPI.IO CONNECTION OK.' : ('SEARCHAPI.IO FAILED - ' + res.error), res.ok ? 'ok' : 'err');
  });
  document.getElementById('testApifyBtn').addEventListener('click', async () => {
    setSettingsStatus('TESTING APIFY (RUNS ONE SEARCH, SMALL COST)...', '');
    const apifyToken = document.getElementById('setApifyToken').value.trim();
    const res = await window.rj.testApiConnection({ provider: 'apify', apifyToken });
    setSettingsStatus(res.ok ? 'APIFY CONNECTION OK.' : ('APIFY FAILED - ' + res.error), res.ok ? 'ok' : 'err');
  });
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------
const MENUS = {
  file: [
    { label: 'New Booking Tab', kbd: 'F2', action: () => addTab() },
    { label: 'Close Tab', kbd: 'Ctrl+W', action: () => closeTab(activeTabId) },
    { sep: true },
    { label: 'Print Itinerary', kbd: 'F8', action: () => runCommand('WP') },
    { sep: true },
    { label: 'Exit', kbd: '', action: () => window.close() }
  ],
  edit: [
    { label: 'Ignore Transaction', kbd: 'F9', action: () => runCommand('IG') },
    { label: 'Clear Response Log', kbd: '', action: () => { const t = activeTab(); if (t) { t.log = []; renderResponseLog(); } } }
  ],
  view: [
    { label: 'Toggle Response Log', kbd: 'F12', action: () => toggleBottomPane() },
    { label: 'Refresh Queue', kbd: '', action: () => refreshQueue() }
  ],
  booking: [
    { label: 'IATA Code Lookup...', kbd: '', action: () => promptFor('Enter: DA <city, country, or airport name> e.g. DA LEEDS:') },
    { label: 'Availability Search...', kbd: '', action: () => promptFor('Enter availability command, e.g. AORDJFK25AUG:') },
    { label: 'Add Passenger Name...', kbd: '', action: () => promptFor('Enter name command, e.g. NM1SMITH/JOHN:') },
    { label: 'Price Itinerary', kbd: 'F6', action: () => runCommand('FXP') },
    { label: 'End & Retrieve', kbd: 'F7', action: () => runCommand('ER') },
    { label: 'Retrieve PNR...', kbd: '', action: () => promptFor('Enter record locator command, e.g. RTAB12CD:') }
  ],
  tools: [
    { label: 'Queue Review', kbd: 'F4', action: () => runCommand('QR') },
    { label: 'Change Currency...', kbd: 'F11', action: () => promptCurrency() },
    { label: 'Live Data Settings...', kbd: '', action: () => showSettings() }
  ],
  help: [
    { label: 'Command Reference', kbd: 'F1', action: () => showHelp() },
    { label: 'Check for Updates...', kbd: '', action: () => checkForUpdates() },
    { label: 'About Rectify Jabre', kbd: '', action: () => aboutDialog() }
  ]
};

async function checkForUpdates() {
  const t = activeTab();
  if (t) logLine(t, 'CHECKING FOR UPDATES...', 'sys');
  const res = await window.rj.checkForUpdates();
  if (!t) return;
  if (!res.ok) {
    logLine(t, 'UPDATE CHECK FAILED - ' + res.error, 'err');
  } else if (res.updateAvailable) {
    logLine(t, `UPDATE AVAILABLE - v${res.version} - DOWNLOADING IN THE BACKGROUND, YOU WILL BE PROMPTED TO RESTART WHEN READY`, 'ok');
  } else {
    logLine(t, `UP TO DATE - RUNNING THE LATEST VERSION (v${res.version})`, 'ok');
  }
}

function promptFor(msg) {
  const val = window.prompt(msg);
  if (val) runCommand(val);
}
function promptCurrency() {
  const val = window.prompt(`Enter a 3-letter currency code (e.g. EUR, GBP, JPY).\nLeave blank to see the full list.\nCurrent: ${currency}`);
  if (val === null) return;
  runCommand('CC' + val.trim());
}
function aboutDialog() {
  const t = activeTab();
  if (t) logBlock(t, ['RECTIFY JABRE TERMINAL', 'A GDS-STYLE BOOKING TERMINAL', '(C) RECTIFY JABRE TERMINAL SYSTEMS'], 'sys');
}

function buildMenus() {
  const bar = document.getElementById('menubar');
  Object.keys(MENUS).forEach((key) => {
    const item = bar.querySelector(`[data-menu="${key}"]`);
    const dd = document.createElement('div');
    dd.className = 'menu-dropdown';
    MENUS[key].forEach((mi) => {
      if (mi.sep) { const s = document.createElement('div'); s.className = 'menu-sep'; dd.appendChild(s); return; }
      const row = document.createElement('div');
      row.className = 'mi' + (mi.disabled ? ' disabled' : '');
      row.innerHTML = `<span>${mi.label}</span><span class="kbd">${mi.kbd || ''}</span>`;
      if (!mi.disabled) {
        row.addEventListener('click', () => { closeAllMenus(); mi.action(); });
      }
      dd.appendChild(row);
    });
    item.appendChild(dd);
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dd.classList.contains('show');
      closeAllMenus();
      if (!isOpen) { dd.classList.add('show'); item.classList.add('open'); }
    });
  });
  document.addEventListener('click', closeAllMenus);
}
function closeAllMenus() {
  document.querySelectorAll('.menu-dropdown').forEach((d) => d.classList.remove('show'));
  document.querySelectorAll('.menu-item').forEach((d) => d.classList.remove('open'));
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------
function bindToolbar() {
  document.getElementById('toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tbtn');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'newtab') addTab();
    else if (action === 'closetab') closeTab(activeTabId);
    else if (action === 'focuscmd') focusCmd();
    else if (action === 'queue') runCommand('QR');
    else if (action === 'price') runCommand('FXP');
    else if (action === 'endretrieve') runCommand('ER');
    else if (action === 'print') runCommand('WP');
    else if (action === 'currency') promptCurrency();
    else if (action === 'help') showHelp();
  });
}

// ---------------------------------------------------------------------------
// Bottom pane toggle
// ---------------------------------------------------------------------------
function toggleBottomPane() {
  const el = document.getElementById('bottomPane');
  const collapsed = el.classList.toggle('collapsed');
  document.getElementById('bottomToggle').textContent = collapsed ? '[F12] EXPAND' : '[F12] COLLAPSE';
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------
function updateStatusBar() {
  document.getElementById('sbAgent').textContent = session.agentId;
  document.getElementById('sbDuty').textContent = session.dutyCode;
  document.getElementById('sbPcc').textContent = session.pcc;
  const t = activeTab();
  document.getElementById('sbLocator').textContent = (t && t.pnr.locator) ? t.pnr.locator : '---';

  const curEl = document.getElementById('sbCurrency');
  curEl.textContent = currency + (ratesStale ? ' (CACHED)' : '');
  curEl.className = ratesStale ? 'stale' : '';
  const seg = document.getElementById('sbCurrencySeg');
  seg.title = ratesUpdatedAt
    ? `1 USD = ${rates[currency]} ${currency} - updated ${new Date(ratesUpdatedAt).toLocaleString()}${ratesStale ? ' (offline, last known)' : ' (live)'}`
    : 'Rates not yet loaded';
}
function tickClock() {
  const now = new Date();
  document.getElementById('sbClock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

// ---------------------------------------------------------------------------
// Command line input
// ---------------------------------------------------------------------------
function focusCmd() {
  document.getElementById('cmdInput').focus();
}
function bindCmdLine() {
  const input = document.getElementById('cmdInput');
  const history = [];
  let hIdx = -1;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      if (val.trim()) { history.push(val); hIdx = history.length; }
      input.value = '';
      runCommand(val);
    } else if (e.key === 'ArrowUp') {
      if (hIdx > 0) { hIdx -= 1; input.value = history[hIdx]; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (hIdx < history.length - 1) { hIdx += 1; input.value = history[hIdx]; }
      else { hIdx = history.length; input.value = ''; }
      e.preventDefault();
    }
  });
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
function bindShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') { e.preventDefault(); showHelp(); }
    else if (e.key === 'F2') { e.preventDefault(); addTab(); }
    else if (e.key === 'F3') { e.preventDefault(); focusCmd(); }
    else if (e.key === 'F4') { e.preventDefault(); runCommand('QR'); }
    else if (e.key === 'F5') { e.preventDefault(); repeatLastSearch(); }
    else if (e.key === 'F6') { e.preventDefault(); runCommand('FXP'); }
    else if (e.key === 'F7') { e.preventDefault(); runCommand('ER'); }
    else if (e.key === 'F8') { e.preventDefault(); runCommand('WP'); }
    else if (e.key === 'F9') { e.preventDefault(); runCommand('IG'); }
    else if (e.key === 'F10') { e.preventDefault(); runCommand('SI'); }
    else if (e.key === 'F11') { e.preventDefault(); promptCurrency(); }
    else if (e.key === 'F12') { e.preventDefault(); toggleBottomPane(); }
    else if (e.key === 'Escape') { hideHelp(); hideSettings(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'w') { e.preventDefault(); closeTab(activeTabId); }
    else if (e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); addTab(); }
  });
}
function repeatLastSearch() {
  const t = activeTab();
  if (!t || !t.lastSearch) { const tt = activeTab(); if (tt) logLine(tt, 'NO PRIOR AVAILABILITY SEARCH TO REPEAT', 'err'); return; }
  runCommand(`A${t.lastSearch.origin}${t.lastSearch.dest}${t.lastSearch.date}`);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  buildMenus();
  bindToolbar();
  bindCmdLine();
  bindShortcuts();
  document.getElementById('helpClose').addEventListener('click', hideHelp);
  document.getElementById('helpBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'helpBackdrop') hideHelp();
  });
  bindSettingsModal();
  document.getElementById('bottomToggle').addEventListener('click', toggleBottomPane);
  document.getElementById('sbCurrencySeg').addEventListener('click', promptCurrency);

  addTab();
  refreshQueue();
  updateStatusBar();
  tickClock();
  setInterval(tickClock, 1000);
  refreshRates(activeTab());
  setInterval(() => refreshRates(null, { silent: true }), 15 * 60 * 1000);
  focusCmd();
}

window.rj.onSessionInit((s) => {
  session = s;
  updateStatusBar();
});

init();
