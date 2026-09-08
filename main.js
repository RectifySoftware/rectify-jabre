const { app, BrowserWindow, ipcMain, dialog, screen, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const db = require('./src/lib/store');
const { hashPassword, verifyPassword } = require('./src/lib/auth');
const { AIRPORTS, parseDDMMM, formatDateLabel, validateAirports, haversineKm, nearestAirports } = require('./src/lib/flights');
const { search: searchAirportsByText } = require('./src/lib/airport-lookup');
const { buildItineraryHtml } = require('./src/lib/itinerary');
const { fetchLiveRates } = require('./src/lib/rates');
const { testConnection: testSearchApiConnection, searchLiveFlights: searchApiSearchLiveFlights } = require('./src/lib/searchapi');
const { testConnection: testApifyConnection, searchLiveFlights: apifySearchLiveFlights } = require('./src/lib/apify');
const { autoUpdater } = require('electron-updater');

let splashWin = null;
let loginWin = null;
let mainWin = null;

const APP_VERSION = app.getVersion();

function createSplash() {
  splashWin = new BrowserWindow({
    width: 520,
    height: 360,
    frame: false,
    resizable: false,
    movable: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  splashWin.loadFile(path.join(__dirname, 'src', 'splash', 'splash.html'), {
    query: { v: APP_VERSION }
  });
  splashWin.once('ready-to-show', () => splashWin.show());
}

function hasAnyAgents() {
  return db.get('agents').value().length > 0;
}

function loadSetupScreen() {
  loginWin.setTitle('Rectify Jabre - Initial Setup');
  loginWin.loadFile(path.join(__dirname, 'src', 'setup', 'setup.html'));
}
function loadSignOnScreen() {
  loginWin.setTitle('Rectify Jabre - Sign On');
  loginWin.loadFile(path.join(__dirname, 'src', 'login', 'login.html'));
}

function createLogin() {
  loginWin = new BrowserWindow({
    width: 460,
    height: 620,
    frame: true,
    resizable: false,
    backgroundColor: '#1b1b1b',
    title: 'Rectify Jabre - Sign On',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  loginWin.setMenuBarVisibility(false);
  if (hasAnyAgents()) {
    loadSignOnScreen();
  } else {
    loadSetupScreen();
  }
  loginWin.once('ready-to-show', () => {
    if (splashWin) {
      splashWin.close();
      splashWin = null;
    }
    loginWin.show();
  });
}

function createMainWindow(session) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWin = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#141414',
    title: 'Rectify Jabre',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  mainWin.loadFile(path.join(__dirname, 'src', 'terminal', 'terminal.html'));
  mainWin.once('ready-to-show', () => {
    if (loginWin) {
      loginWin.close();
      loginWin = null;
    }
    mainWin.maximize();
    mainWin.show();
    mainWin.webContents.send('session:init', session);
    checkForUpdatesSilently();
  });
}

// ---------- Auto-update (GitHub Releases, public repo) ----------
autoUpdater.autoDownload = true;

let manualCheckInFlight = false;

function setupAutoUpdater() {
  autoUpdater.on('update-downloaded', (info) => {
    const win = mainWin || BrowserWindow.getFocusedWindow();
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready - Rectify Jabre',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart now to install it, or keep working and it will install next time you quit.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
  // Background checks fail silently (e.g. offline, or dev/unpackaged run) -
  // only the manual "Check for Updates" path surfaces errors to the user.
  autoUpdater.on('error', (err) => {
    console.error('auto-updater error:', err.message);
  });
}

function checkForUpdatesSilently() {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch((e) => console.error('update check failed:', e.message));
}

ipcMain.handle('update:checkNow', async () => {
  if (!app.isPackaged) {
    return { ok: false, error: 'UPDATE CHECKS ARE DISABLED IN A DEV (UNPACKAGED) RUN' };
  }
  if (manualCheckInFlight) {
    return { ok: false, error: 'A CHECK IS ALREADY IN PROGRESS' };
  }
  manualCheckInFlight = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    const current = APP_VERSION;
    const latest = result && result.updateInfo && result.updateInfo.version;
    if (latest && latest !== current) {
      return { ok: true, updateAvailable: true, version: latest };
    }
    return { ok: true, updateAvailable: false, version: current };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    manualCheckInFlight = false;
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // the app has its own File/Edit/View/... menubar in HTML
  setupAutoUpdater();
  createSplash();
  setTimeout(() => {
    createLogin();
  }, 2200);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: auth ----------
ipcMain.handle('auth:login', (evt, { agentId, password, dutyCode }) => {
  agentId = (agentId || '').trim().toUpperCase();
  const agent = db.get('agents').find({ agentId }).value();
  if (!agent || !verifyPassword(password || '', agent.passwordSalt, agent.passwordHash)) {
    return { ok: false, error: 'INVALID SIGN-ON - AGENT ID OR PASSWORD NOT RECOGNIZED' };
  }
  if (!agent.dutyCodes.includes(dutyCode)) {
    return { ok: false, error: 'DUTY CODE NOT AUTHORIZED FOR THIS AGENT' };
  }
  const session = {
    agentId: agent.agentId,
    name: agent.name,
    dutyCode,
    pcc: agent.pcc,
    signedOnAt: new Date().toISOString()
  };
  createMainWindow(session);
  return { ok: true, session };
});

const AGENT_ID_RE = /^[A-Z0-9]{3,10}$/;
const PCC_RE = /^[A-Z0-9]{2,6}$/;
const VALID_DUTY_CODES = ['AA', 'SUP'];

ipcMain.handle('auth:hasAgents', () => hasAnyAgents());

ipcMain.handle('auth:createAgent', (evt, { agentId, name, password, confirmPassword, pcc, dutyCodes }) => {
  agentId = (agentId || '').trim().toUpperCase();
  name = (name || '').trim().toUpperCase();
  pcc = (pcc || '').trim().toUpperCase();
  const codes = Array.isArray(dutyCodes) ? dutyCodes.filter((c) => VALID_DUTY_CODES.includes(c)) : [];

  if (!AGENT_ID_RE.test(agentId)) {
    return { ok: false, error: 'AGENT ID MUST BE 3-10 LETTERS/NUMBERS' };
  }
  if (db.get('agents').find({ agentId }).value()) {
    return { ok: false, error: 'AGENT ID ALREADY EXISTS - CHOOSE ANOTHER' };
  }
  if (!name) {
    return { ok: false, error: 'FULL NAME IS REQUIRED' };
  }
  if (!PCC_RE.test(pcc)) {
    return { ok: false, error: 'PCC MUST BE 2-6 LETTERS/NUMBERS' };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'PASSWORD MUST BE AT LEAST 8 CHARACTERS' };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'PASSWORDS DO NOT MATCH' };
  }
  if (codes.length === 0) {
    return { ok: false, error: 'SELECT AT LEAST ONE DUTY CODE' };
  }

  const { salt, hash } = hashPassword(password);
  db.get('agents').push({
    agentId, name, pcc, dutyCodes: codes,
    passwordSalt: salt, passwordHash: hash,
    createdAt: new Date().toISOString()
  }).write();

  if (loginWin) loadSignOnScreen();
  return { ok: true, agentId };
});

ipcMain.handle('nav:toSetup', () => { if (loginWin) loadSetupScreen(); return { ok: true }; });
ipcMain.handle('nav:toLogin', () => { if (loginWin) loadSignOnScreen(); return { ok: true }; });

// ---------- Live search result cache ----------
// Keeps every recognized live fare provider's success from having to be
// re-fetched (and re-billed/re-metered) for the same route+date+currency
// within the freshness window - stretches free/cheap quota a long way for
// casual personal use. Entries older than PRUNE_MS are dropped on write to
// keep the local store from growing unbounded.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // reuse a result for 24h
const CACHE_PRUNE_MS = 7 * 24 * 60 * 60 * 1000; // stop keeping it around after 7 days

function liveCacheKey(origin, dest, date, currency) {
  return `${origin}|${dest}|${date}|${currency}`.toUpperCase();
}

function getLiveCache(key) {
  const entry = db.get('liveCache').find({ key }).value();
  if (!entry) return null;
  if (Date.now() - new Date(entry.fetchedAt).getTime() > CACHE_TTL_MS) return null;
  return entry;
}

function setLiveCache(key, data) {
  const table = db.get('liveCache');
  const record = { key, data, fetchedAt: new Date().toISOString() };
  if (table.find({ key }).value()) {
    table.find({ key }).assign(record).write();
  } else {
    table.push(record).write();
  }
  const cutoff = Date.now() - CACHE_PRUNE_MS;
  const pruned = db.get('liveCache').value().filter((e) => new Date(e.fetchedAt).getTime() > cutoff);
  db.set('liveCache', pruned).write();
}

// ---------- IPC: flights ----------
// Every result shown to the user must come from a real live provider search -
// nothing here ever invents a flight. If the exact request comes back empty,
// we try a small, tightly-bounded set of nearby dates and nearby airports
// (using real great-circle distance) and, if any of those genuinely exist,
// return them clearly tagged as alternatives rather than exact matches.
async function tryLiveSearch({ origin, dest, dateLabel, currency, searchApiKey, apifyToken }) {
  const key = liveCacheKey(origin, dest, dateLabel, currency);
  const cached = getLiveCache(key);
  if (cached) return { ...cached.data, cached: true };

  let lastError = null;

  if (searchApiKey) {
    try {
      const live = await searchApiSearchLiveFlights({ apiKey: searchApiKey, origin, dest, dateLabel, currency });
      if (live.lines.length > 0) {
        setLiveCache(key, live);
        return { ...live, cached: false };
      }
    } catch (e) {
      lastError = `SEARCHAPI: ${e.message}`;
    }
  }

  if (apifyToken) {
    try {
      const live = await apifySearchLiveFlights({ token: apifyToken, origin, dest, dateLabel, currency });
      if (live.lines.length > 0) {
        setLiveCache(key, live);
        return { ...live, cached: false };
      }
    } catch (e) {
      lastError = lastError ? `${lastError} | APIFY: ${e.message}` : `APIFY: ${e.message}`;
    }
  }

  return { ok: true, origin, dest, date: dateLabel, lines: [], liveError: lastError };
}

ipcMain.handle('flights:search', async (evt, { origin, dest, date, currency }) => {
  origin = (origin || '').toUpperCase();
  dest = (dest || '').toUpperCase();
  const cur = currency || 'USD';

  const settings = db.get('settings').value() || {};
  const { searchApiKey, apifyToken } = settings;
  if (!searchApiKey && !apifyToken) {
    return { ok: false, error: 'NO LIVE DATA SOURCE CONFIGURED - CONNECT SEARCHAPI OR APIFY IN TOOLS > LIVE DATA SETTINGS TO SEARCH REAL FLIGHTS' };
  }

  const airportCheck = validateAirports(origin, dest);
  if (!airportCheck.ok) return airportCheck;

  const parsedDate = parseDDMMM(date);
  if (!parsedDate) {
    return { ok: false, error: `INVALID DATE FORMAT "${date}" - USE DDMMM (E.G. 25AUG)` };
  }
  const dateLabel = formatDateLabel(parsedDate);

  const providers = { searchApiKey, apifyToken };
  const primary = await tryLiveSearch({ origin, dest, dateLabel, currency: cur, ...providers });
  if (primary.lines.length > 0) return primary;

  // ---- nearby dates: cheap first check, +/-1 then +/-2 days, stop at first hit ----
  const altDateLines = [];
  for (const offset of [-1, 1, -2, 2]) {
    if (altDateLines.length > 0) break;
    const candidate = new Date(parsedDate);
    candidate.setDate(candidate.getDate() + offset);
    const label = formatDateLabel(candidate);
    const res = await tryLiveSearch({ origin, dest, dateLabel: label, currency: cur, ...providers });
    if (res.lines.length > 0) {
      res.lines.forEach((l) => { l.alt = 'DATE'; l.altNote = `${label} instead of ${dateLabel}`; });
      altDateLines.push(...res.lines);
    }
  }

  // ---- nearby airports: only bother if date-shifting found nothing ----
  const altAirportLines = [];
  if (altDateLines.length === 0) {
    const originAlts = nearestAirports(origin, 1, [dest]);
    const destAlts = nearestAirports(dest, 1, [origin]);
    for (const o of originAlts) {
      const res = await tryLiveSearch({ origin: o, dest, dateLabel, currency: cur, ...providers });
      if (res.lines.length > 0) {
        const distKm = Math.round(haversineKm(origin, o));
        const name = AIRPORTS[o] ? AIRPORTS[o][0] : o;
        res.lines.forEach((l) => { l.alt = 'ORIGIN'; l.altNote = `FROM ${o} - ${name} (${distKm}KM FROM ${origin}) INSTEAD OF ${origin}`; });
        altAirportLines.push(...res.lines);
      }
    }
    for (const d of destAlts) {
      const res = await tryLiveSearch({ origin, dest: d, dateLabel, currency: cur, ...providers });
      if (res.lines.length > 0) {
        const distKm = Math.round(haversineKm(dest, d));
        const name = AIRPORTS[d] ? AIRPORTS[d][0] : d;
        res.lines.forEach((l) => { l.alt = 'DEST'; l.altNote = `TO ${d} - ${name} (${distKm}KM FROM ${dest}) INSTEAD OF ${dest}`; });
        altAirportLines.push(...res.lines);
      }
    }
  }

  const altLines = [...altDateLines, ...altAirportLines];
  const finalResult = {
    ok: true,
    origin, dest, date: dateLabel,
    lines: altLines.map((l, idx) => ({ ...l, line: idx + 1 })),
    source: 'LIVE',
    liveError: primary.liveError,
    msg: altLines.length === 0
      ? 'NO FLIGHTS FOUND FOR THIS ROUTE, NEARBY DATES, OR NEARBY AIRPORTS'
      : undefined
  };
  const finalKey = liveCacheKey(origin, dest, dateLabel, cur);
  setLiveCache(finalKey, finalResult);
  return finalResult;
});

// ---------- IPC: settings / live data connection ----------
ipcMain.handle('settings:get', () => {
  const s = db.get('settings').value() || {};
  return { searchApiKey: s.searchApiKey || '', apifyToken: s.apifyToken || '' };
});

ipcMain.handle('settings:save', (evt, { searchApiKey, apifyToken }) => {
  db.set('settings', {
    searchApiKey: (searchApiKey || '').trim() || null,
    apifyToken: (apifyToken || '').trim() || null
  }).write();
  return { ok: true };
});

ipcMain.handle('settings:clear', () => {
  db.set('settings', { searchApiKey: null, apifyToken: null }).write();
  return { ok: true };
});

ipcMain.handle('settings:testConnection', async (evt, { provider, searchApiKey, apifyToken }) => {
  try {
    const settings = db.get('settings').value() || {};
    if (provider === 'apify') {
      const token = apifyToken || settings.apifyToken;
      if (!token) return { ok: false, error: 'API TOKEN IS REQUIRED' };
      await testApifyConnection(token);
    } else {
      const key = searchApiKey || settings.searchApiKey;
      if (!key) return { ok: false, error: 'API KEY IS REQUIRED' };
      await testSearchApiConnection(key);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------- IPC: PNR / queue ----------
ipcMain.handle('pnr:save', (evt, pnr) => {
  const pnrs = db.get('pnrs');
  const existing = pnrs.find({ locator: pnr.locator }).value();
  if (existing) {
    pnrs.find({ locator: pnr.locator }).assign(pnr).write();
  } else {
    pnrs.push(pnr).write();
  }
  return { ok: true };
});

ipcMain.handle('pnr:get', (evt, locator) => {
  const pnr = db.get('pnrs').find({ locator }).value();
  return pnr || null;
});

ipcMain.handle('pnr:list', () => {
  return db.get('pnrs').value();
});

ipcMain.handle('pnr:delete', (evt, locator) => {
  db.get('pnrs').remove({ locator }).write();
  return { ok: true };
});

// ---------- IPC: open external (allowlisted) ----------
const EXTERNAL_ALLOWLIST = ['https://www.searchapi.io/', 'https://console.apify.com/'];
ipcMain.handle('shell:openExternal', (evt, url) => {
  if (typeof url === 'string' && EXTERNAL_ALLOWLIST.some((prefix) => url.startsWith(prefix))) {
    shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false, error: 'URL NOT ALLOWED' };
});

// ---------- IPC: airport/IATA code lookup ----------
ipcMain.handle('airports:search', (evt, query) => {
  return searchAirportsByText(query, 30);
});

// ---------- IPC: currency ----------
ipcMain.handle('currency:getRates', async () => {
  try {
    const live = await fetchLiveRates();
    db.set('rates', live).write();
    return { ok: true, ...live, stale: false };
  } catch (e) {
    const cached = db.get('rates').value();
    if (cached) {
      return { ok: true, ...cached, stale: true, error: e.message };
    }
    return { ok: false, error: `EXCHANGE RATE SERVICE UNAVAILABLE - ${e.message}` };
  }
});

// ---------- IPC: print itinerary ----------
ipcMain.handle('pnr:print', async (evt, pnr) => {
  const win = BrowserWindow.getFocusedWindow() || mainWin;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Print Itinerary',
    defaultPath: `Itinerary_${pnr.locator}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  const printWin = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  const html = buildItineraryHtml(pnr);
  const tmpPath = path.join(app.getPath('temp'), `rj_itin_${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');
  await printWin.loadFile(tmpPath);
  try {
    const data = await printWin.webContents.printToPDF({ printBackground: true, pageSize: 'Letter' });
    fs.writeFileSync(filePath, data);
    return { ok: true, filePath };
  } finally {
    printWin.close();
    fs.unlink(tmpPath, () => {});
  }
});
