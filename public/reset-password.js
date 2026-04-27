const token = new URLSearchParams(window.location.search).get('token');

const resetFormEl  = document.getElementById('resetForm');
const invalidEl    = document.getElementById('invalidState');
const form         = document.getElementById('form');
const newPassEl    = document.getElementById('newPassword');
const confirmEl    = document.getElementById('confirmPassword');
const submitBtn    = document.getElementById('submitBtn');
const msgEl        = document.getElementById('msg');

// If there's no token in the URL at all, show the invalid state immediately
if (!token) {
  resetFormEl.style.display = 'none';
  invalidEl.style.display   = 'block';
}

function showMsg(text, type) {
  msgEl.textContent   = text;
  msgEl.className     = `msg ${type}`;
  msgEl.style.display = 'block';
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const new_password     = newPassEl.value;
    const confirm_password = confirmEl.value;

    msgEl.style.display = 'none';

    if (!new_password || !confirm_password) {
      showMsg('Both fields are required.', 'error');
      return;
    }
    if (new_password.length < 8) {
      showMsg('Password must be at least 8 characters.', 'error');
      return;
    }
    if (new_password !== confirm_password) {
      showMsg('Passwords do not match.', 'error');
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Saving...';

    try {
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password })
      });

      form.style.display = 'none';
      showMsg(data.message + ' Redirecting to login…', 'success');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('invalid')) {
        // Token is bad or expired — swap to the invalid state
        resetFormEl.style.display = 'none';
        invalidEl.style.display   = 'block';
      } else {
        showMsg(err.message || 'Something went wrong. Please try again.', 'error');
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Set new password';
      }
    }
  });
}
