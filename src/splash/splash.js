const msgs = [
  'INITIALIZING SESSION...',
  'LOADING LOCAL PROFILE STORE...',
  'CONNECTING TO PSEUDO CITY...',
  'READY.'
];
let i = 0;
const el = document.getElementById('status');
setInterval(() => {
  i = (i + 1) % msgs.length;
  el.textContent = msgs[i];
}, 550);

try {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('v');
  if (v) document.getElementById('version').textContent = 'v' + v;
} catch (e) {}
