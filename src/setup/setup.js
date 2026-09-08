const agentIdEl = document.getElementById('agentId');
const fullNameEl = document.getElementById('fullName');
const passwordEl = document.getElementById('password');
const confirmPasswordEl = document.getElementById('confirmPassword');
const pccEl = document.getElementById('pcc');
const dutyAAEl = document.getElementById('dutyAA');
const dutySUPEl = document.getElementById('dutySUP');
const errorEl = document.getElementById('error');
const okMsgEl = document.getElementById('okMsg');
const createBtn = document.getElementById('createBtn');
const backHint = document.getElementById('backHint');
const backLink = document.getElementById('backLink');
const introEl = document.getElementById('intro');
const subtitleEl = document.getElementById('subtitle');

agentIdEl.focus();

function showError(msg) {
  okMsgEl.style.display = 'none';
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}
function clearMessages() {
  errorEl.style.display = 'none';
  okMsgEl.style.display = 'none';
}

async function init() {
  const hasAgents = await window.rj.hasAgents();
  if (hasAgents) {
    subtitleEl.textContent = 'Create Agent Account';
    introEl.textContent = 'Create a new agent account for this terminal. Passwords are stored locally, salted and hashed - never in plain text.';
    backHint.style.display = 'block';
  }
}
init();

backLink.addEventListener('click', () => window.rj.goToLogin());

async function attemptCreate() {
  clearMessages();
  const agentId = agentIdEl.value.trim().toUpperCase();
  const name = fullNameEl.value.trim();
  const password = passwordEl.value;
  const confirmPassword = confirmPasswordEl.value;
  const pcc = pccEl.value.trim().toUpperCase();
  const dutyCodes = [];
  if (dutyAAEl.checked) dutyCodes.push('AA');
  if (dutySUPEl.checked) dutyCodes.push('SUP');

  if (!agentId || !name || !password || !confirmPassword || !pcc) {
    showError('ALL FIELDS ARE REQUIRED');
    return;
  }

  createBtn.disabled = true;
  createBtn.textContent = 'CREATING...';
  try {
    const res = await window.rj.createAgent({ agentId, name, password, confirmPassword, pcc, dutyCodes });
    if (!res.ok) {
      showError(res.error);
      createBtn.disabled = false;
      createBtn.textContent = 'CREATE ACCOUNT';
      return;
    }
    // on success, main process swaps the window to the Sign On screen -
    // nothing else to do here.
  } catch (e) {
    showError('SETUP FAILED - ' + e.message);
    createBtn.disabled = false;
    createBtn.textContent = 'CREATE ACCOUNT';
  }
}

createBtn.addEventListener('click', attemptCreate);
[agentIdEl, fullNameEl, passwordEl, confirmPasswordEl, pccEl].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptCreate();
  });
});
