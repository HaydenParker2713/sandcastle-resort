// ── Room card gradients by keyword ────────────────────────────────────────
function roomGradient(typeName) {
  const t = typeName.toLowerCase();
  if (t.includes('oceanfront'))  return 'linear-gradient(135deg,#0c4a6e,#0ea5e9)';
  if (t.includes('poolside'))    return 'linear-gradient(135deg,#065f46,#10b981)';
  if (t.includes('queen'))       return 'linear-gradient(135deg,#4c1d95,#8b5cf6)';
  if (t.includes('two bedroom')) return 'linear-gradient(135deg,#7c2d12,#f97316)';
  if (t.includes('one bedroom')) return 'linear-gradient(135deg,#1e3a5f,#3b82f6)';
  if (t.includes('studio'))      return 'linear-gradient(135deg,#713f12,#eab308)';
  return                                'linear-gradient(135deg,#374151,#6b7280)';
}

function roomEmoji(typeName) {
  const t = typeName.toLowerCase();
  if (t.includes('oceanfront')) return '🌊';
  if (t.includes('poolside'))   return '🏊';
  if (t.includes('two bedroom'))return '🏠';
  if (t.includes('queen'))      return '👑';
  if (t.includes('studio'))     return '🏖️';
  return '🛏️';
}

// ── Render rooms grid ──────────────────────────────────────────────────────
function renderRooms(units) {
  const grid = document.getElementById('homeRoomsGrid');
  if (!units.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#6b7280;padding:40px">No rooms found.</div>';
    return;
  }

  // Group by type so we show one card per type with count
  const byType = {};
  units.forEach(u => {
    const key = u.type_name;
    if (!byType[key]) byType[key] = { ...u, count: 0, available: 0 };
    byType[key].count++;
    if (u.status === 'available') byType[key].available++;
  });

  grid.innerHTML = '';
  Object.values(byType).forEach(t => {
    const dot = t.available > 0 ? 'dot-available' : 'dot-maintenance';
    const statusText = t.available > 0 ? `${t.available} available` : 'Unavailable';
    const canBook = t.available > 0;

    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <div class="room-img" style="background:${roomGradient(t.type_name)}">
        <div>
          <div style="font-size:1.8rem;margin-bottom:4px">${roomEmoji(t.type_name)}</div>
          <div>${t.type_name}</div>
        </div>
      </div>
      <div class="room-body">
        <h3>${t.type_name}</h3>
        <div class="room-meta">
          <span>👥 Up to ${t.capacity}</span>
          <span>${t.count} unit${t.count > 1 ? 's' : ''}</span>
        </div>
        <div class="room-rate">$${Number(t.nightly_rate).toFixed(0)}<span> / night</span></div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;color:#6b7280">
            <span class="status-dot ${dot}"></span>${statusText}
          </span>
          <button class="btn-primary" style="padding:8px 18px;font-size:13px"
            ${canBook ? '' : 'disabled style="opacity:.5;cursor:not-allowed;padding:8px 18px;font-size:13px"'}
            data-book>Book Now</button>
        </div>
      </div>
    `;

    if (canBook) {
      card.querySelector('[data-book]').addEventListener('click', () => requireAuthThenBook());
    }
    grid.appendChild(card);
  });
}

// ── Auth modal ─────────────────────────────────────────────────────────────
const modal     = document.getElementById('authModal');
const modalClose = document.getElementById('modalClose');

function openModal(tab = 'loginPanel') {
  modal.classList.add('open');
  switchTab(tab);
}
function closeModal() { modal.classList.remove('open'); }

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

document.querySelectorAll('.modal-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.panel));
});

function switchTab(panelId) {
  document.querySelectorAll('.modal-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.panel === panelId));
  document.querySelectorAll('.modal-panel').forEach(p =>
    p.classList.toggle('active', p.id === panelId));
}

function showModalError(panelId, msg) {
  const el = document.getElementById(panelId === 'loginPanel' ? 'loginError' : 'registerError');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearModalMessages() {
  ['loginError','loginSuccess','registerError','registerSuccess'].forEach(id => {
    const el = document.getElementById(id);
    el.style.display = 'none';
    el.textContent = '';
  });
}

// ── Login submit ───────────────────────────────────────────────────────────
document.getElementById('loginSubmitBtn').addEventListener('click', async () => {
  clearModalMessages();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showModalError('loginPanel', 'Email and password required.'); return; }

  const btn = document.getElementById('loginSubmitBtn');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const { user } = await apiFetch('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    });
    window.location.href = user.role_name === 'admin' ? '/admin' : user.role_name === 'staff' ? '/staff' : '/dashboard';
  } catch (err) {
    showModalError('loginPanel', err.message);
    btn.disabled = false; btn.textContent = 'Sign In';
  }
});

// Allow Enter key in login fields
['loginEmail','loginPassword'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginSubmitBtn').click();
  });
});

// ── Register submit ────────────────────────────────────────────────────────
document.getElementById('registerSubmitBtn').addEventListener('click', async () => {
  clearModalMessages();
  const first_name = document.getElementById('regFirstName').value.trim();
  const last_name  = document.getElementById('regLastName').value.trim();
  const email      = document.getElementById('regEmail').value.trim();
  const password   = document.getElementById('regPassword').value;
  if (!first_name || !last_name || !email || !password) {
    showModalError('registerPanel', 'All fields are required.'); return;
  }
  if (password.length < 8) {
    showModalError('registerPanel', 'Password must be at least 8 characters.'); return;
  }

  const btn = document.getElementById('registerSubmitBtn');
  btn.disabled = true; btn.textContent = 'Creating account...';
  try {
    await apiFetch('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ first_name, last_name, email, password })
    });
    const success = document.getElementById('registerSuccess');
    success.textContent = 'Account created! Redirecting...';
    success.style.display = 'block';
    setTimeout(() => { window.location.href = '/dashboard'; }, 900);
  } catch (err) {
    showModalError('registerPanel', err.message);
    btn.disabled = false; btn.textContent = 'Create Account';
  }
});

// ── Book button logic ──────────────────────────────────────────────────────
async function requireAuthThenBook() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    if (user) {
      window.location.href = user.role_name === 'admin' ? '/admin' : user.role_name === 'staff' ? '/staff' : '/dashboard';
    } else {
      openModal('loginPanel');
    }
  } catch {
    openModal('loginPanel');
  }
}

// ── Nav buttons ────────────────────────────────────────────────────────────
document.getElementById('navLoginBtn').addEventListener('click', () => openModal('loginPanel'));
document.getElementById('navBookBtn').addEventListener('click', requireAuthThenBook);
document.getElementById('heroBookBtn').addEventListener('click', () => {
  document.getElementById('roomsSection').scrollIntoView({ behavior: 'smooth' });
});

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  // If already logged in, redirect away from home
  try {
    const { user } = await apiFetch('/api/auth/me');
    if (user) {
      window.location.href = user.role_name === 'admin' ? '/admin' : user.role_name === 'staff' ? '/staff' : '/dashboard';
      return;
    }
  } catch {}

  try {
    const units = await apiFetch('/api/units');
    renderRooms(units);
  } catch {
    document.getElementById('homeRoomsGrid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:#dc2626;padding:40px">Unable to load rooms.</div>';
  }
})();
