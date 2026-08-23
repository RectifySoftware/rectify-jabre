const fs = require('fs');
const path = require('path');

let logoDataUri = null;
function getLogoDataUri() {
  if (logoDataUri !== null) return logoDataUri;
  try {
    const buf = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'logo.png'));
    logoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    logoDataUri = ''; // no logo asset available - header just skips the image
  }
  return logoDataUri;
}

function buildItineraryHtml(pnr) {
  const segs = (pnr.segments || []).map((s) => {
    const segFare = s.fareOnSeg ? `${s.fareOnSeg.currency || ''} ${Number(s.fareOnSeg.price).toFixed(2)}` : '-';
    return `
    <tr>
      <td>${s.carrier}${s.flightNumber.replace(s.carrier, '')}</td>
      <td>${s.origin} - ${s.dest}</td>
      <td>${s.date}</td>
      <td>${s.dep}</td>
      <td>${s.arr}</td>
      <td>${s.bookingClass || ''}</td>
      <td>${s.aircraft || ''}</td>
      <td>${segFare}</td>
    </tr>`;
  }).join('');

  const names = (pnr.passengers || []).map((p) => `<li>${p.last}/${p.first} ${p.title || ''}</li>`).join('');
  const paxCount = Math.max(1, (pnr.passengers || []).length);

  const baseCode = (pnr.fare && pnr.fare.currency) || 'USD';
  const curCode = (pnr.fare && pnr.fare.displayCurrency) || baseCode;
  const perPax = pnr.fare ? (pnr.fare.displayPrice != null ? pnr.fare.displayPrice : pnr.fare.price) : 0;
  const total = perPax * paxCount;
  const fareLine = pnr.fare
    ? `<p>FARE: ${pnr.fare.code} - ${curCode} ${perPax.toFixed(2)} x ${paxCount} PAX = ${curCode} ${total.toFixed(2)}${curCode !== baseCode ? ` (BASE ${baseCode} ${pnr.fare.price.toFixed(2)} PER PAX)` : ''}</p>`
    : '';

  const logo = getLogoDataUri();
  const logoImg = logo ? `<img src="${logo}" class="logo-img" alt="">` : '';

  return `<!doctype html>
  <html><head><meta charset="utf-8">
  <style>
    body { font-family: 'Courier New', monospace; color: #111; padding: 32px; }
    .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #b01418; padding-bottom: 10px; }
    .logo-img { width: 52px; height: 52px; }
    .wordmark .top { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; color: #111; }
    .wordmark .bottom { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; color: #b01418; font-style: italic; margin-top: -6px; }
    h1 { font-size: 14px; margin: 14px 0 4px; letter-spacing: 0.5px; }
    .locator { font-size: 22px; letter-spacing: 3px; font-weight: bold; color: #b01418; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
    th { background: #eee; }
    ul { font-size: 13px; }
    .footer { margin-top: 40px; font-size: 10px; color: #555; border-top: 1px solid #ccc; padding-top: 10px; }
  </style></head>
  <body>
    <div class="header">
      ${logoImg}
      <div class="wordmark"><div class="top">Rectify&trade;</div><div class="bottom">jabre</div></div>
    </div>
    <h1>ITINERARY / REFERENCE QUOTE</h1>
    <p>RECORD LOCATOR: <span class="locator">${pnr.locator}</span></p>
    <p>AGENT: ${pnr.agentId || ''}   PCC: ${pnr.pcc || ''}   CREATED: ${pnr.createdAt ? new Date(pnr.createdAt).toLocaleString() : ''}</p>
    <h3>PASSENGERS</h3>
    <ul>${names}</ul>
    <h3>ITINERARY</h3>
    <table>
      <thead><tr><th>FLT</th><th>ROUTE</th><th>DATE</th><th>DEP</th><th>ARR</th><th>CLASS</th><th>EQP</th><th>FARE (PER PAX)</th></tr></thead>
      <tbody>${segs}</tbody>
    </table>
    ${fareLine}
    <div class="footer">THIS ITINERARY HAS NOT BEEN BOOKED AND IS NOT A TICKET OR CONFIRMED RESERVATION. IT IS PROVIDED AS A REFERENCE ONLY.<br>
    PRICING VARIES AND IS NOT GUARANTEED. RECTIFY JABRE AND THE ISSUING AGENT ACCEPT NO LIABILITY FOR THE ACCURACY OF FARES, SCHEDULES, OR AVAILABILITY SHOWN.</div>
  </body></html>`;
}

module.exports = { buildItineraryHtml };
