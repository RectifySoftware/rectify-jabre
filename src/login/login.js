const agentIdEl = document.getElementById('agentId');
const passwordEl = document.getElementById('password');
const dutyCodeEl = document.getElementById('dutyCode');
const errorEl = document.getElementById('error');
const connectBtn = document.getElementById('connectBtn');

agentIdEl.focus();

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}
function clearError() {
  errorEl.style.display = 'none';
}

async function attemptLogin() {
  clearError();
  const agentId = agentIdEl.value.trim().toUpperCase();
  const password = passwordEl.value;
  const dutyCode = dutyCodeEl.value;

  if (!agentId || !password) {
    showError('AGENT ID AND PASSWORD ARE REQUIRED');
    return;
  }

  connectBtn.disabled = true;
  connectBtn.textContent = 'CONNECTING...';
  try {
    const res = await window.rj.login({ agentId, password, dutyCode });
    if (!res.ok) {
      showError(res.error);
      connectBtn.disabled = false;
      connectBtn.textContent = 'CONNECT';
      passwordEl.value = '';
      passwordEl.focus();
    }
    // on success, main process swaps the window - nothing else to do here
  } catch (e) {
    showError('CONNECTION FAILED - ' + e.message);
    connectBtn.disabled = false;
    connectBtn.textContent = 'CONNECT';
  }
}

connectBtn.addEventListener('click', attemptLogin);
[agentIdEl, passwordEl].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });
});

document.getElementById('createAccountLink').addEventListener('click', () => {
  window.rj.goToSetup();
});
