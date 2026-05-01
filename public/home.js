// ── home.js — landing page logic (index.html) ─────────────────────────────────
// Handles: room card gallery, login/register modal, "Book Now" flow,
// and auto-redirecting already-logged-in users to their correct dashboard.

// ── Room card helpers ──────────────────────────────────────────────────────────
// Fallback gradient used while the SVG loads or if it fails
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

// Map room type name to an illustrated SVG scene
function unitImage(typeName) {
  const t = typeName.toLowerCase();
  if (t.includes('oceanfront') && !t.includes('studio')) return '/room1.svg';
  if (t.includes('oceanfront'))                           return '/room2.svg';
  if (t.includes('poolside') && !t.includes('studio'))   return '/room3.svg';
  if (t.includes('poolside'))                             return '/room4.svg';
  if (t.includes('standard suite') && t.includes('main'))return '/room5.svg';
  if (t.includes('standard studio') && !t.includes('balcony') && t.includes('main')) return '/room6.svg';
  if (t.includes('queen'))                                return '/room7.svg';
  if (t.includes('standard studio') && t.includes('balcony') && t.includes('main'))  return '/room8.svg';
  if (t.includes('small suite'))                          return '/room9.svg';
  if (t.includes('pool building'))                        return '/room10.svg';
  if (t === 'studio')                                     return '/room11.svg';
  if (t.includes('one bedroom'))                          return '/room12.svg';
  if (t.includes('two bedroom'))                          return '/room13.svg';
  return '/room5.svg';
}

// ── Render rooms grid ──────────────────────────────────────────────────────────
// Groups individual units by type so we show one card per type with an availability count.
// Clicking "Book Now" either sends the user to their dashboard or opens the login modal.
function renderRooms(units) {
  const grid = document.getElementById('homeRoomsGrid');
  if (!units.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#6b7280;padding:40px">No rooms found.</div>';
    return;
  }

  // Aggregate units into a map keyed by type_name
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
      <div class="room-img" style="position:relative;overflow:hidden;background:${roomGradient(t.type_name)}">
        <img src="${t.type_photo_url || unitImage(t.type_name)}" alt="${t.type_name}"
             style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"
             onerror="this.remove()">
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

// ── Auth modal ─────────────────────────────────────────────────────────────────
// A single modal contains both the Login and Register tabs.
// Showing/hiding is done purely with CSS classes (no page reload).
const modal     = document.getElementById('authModal');
const modalClose = document.getElementById('modalClose');

function openModal(tab = 'loginPanel') {
  modal.classList.add('open');
  switchTab(tab);
}
function closeModal() { modal.classList.remove('open'); }

modalClose.addEventListener('click', closeModal);
// Clicking the backdrop (not the dialog itself) also closes the modal
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

document.querySelectorAll('.modal-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.panel));
});

// Activate the chosen tab panel and deactivate all others
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

// ── Login submit ───────────────────────────────────────────────────────────────
// On success, redirect based on role: admin → /admin, staff → /staff, else → /dashboard
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

// Allow Enter key in login fields to trigger the submit button
['loginEmail','loginPassword'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginSubmitBtn').click();
  });
});

// ── Register submit ────────────────────────────────────────────────────────────
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

// ── Book button logic ──────────────────────────────────────────────────────────
// If the user is already logged in, send them straight to their dashboard.
// Otherwise open the login modal so they can sign in first.
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

// ── Nav buttons ────────────────────────────────────────────────────────────────
document.getElementById('navLoginBtn').addEventListener('click', () => openModal('loginPanel'));
document.getElementById('navBookBtn').addEventListener('click', requireAuthThenBook);
// Hero "Browse Rooms" scrolls to the room cards section smoothly
document.getElementById('heroBookBtn').addEventListener('click', () => {
  document.getElementById('roomsSection').scrollIntoView({ behavior: 'smooth' });
});

// ── Init ───────────────────────────────────────────────────────────────────────
// On load, check if the user is already logged in.
// If they are, skip the home page and send them to their dashboard immediately.
// Otherwise fetch and render the available room types.
(async () => {
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
