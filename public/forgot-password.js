const form      = document.getElementById('forgotForm');
const emailEl   = document.getElementById('email');
const submitBtn = document.getElementById('submitBtn');
const msgEl     = document.getElementById('msg');

function showMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className   = `msg ${type}`;
  msgEl.style.display = 'block';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailEl.value.trim();

  if (!email) {
    showMsg('Please enter your email address.', 'error');
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Sending...';
  msgEl.style.display   = 'none';

  try {
    const data = await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    form.style.display = 'none';
    showMsg(data.message, 'success');
  } catch (err) {
    showMsg(err.message || 'Something went wrong. Please try again.', 'error');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Send reset link';
  }
});
