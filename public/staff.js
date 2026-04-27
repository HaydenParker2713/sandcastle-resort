// ── staff.js — Staff panel logic (staff.html) ─────────────────────────────────
// Staff can: view all reservations, update ticket statuses, post/delete events.

// ── Shared helpers ────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return '';
  // ISO date strings like "2026-06-15" are parsed without timezone conversion
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  return new Date(val).toLocaleDateString();
}

// Wraps a string in a coloured badge <span> — CSS handles the colours
function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}

// Shows a temporary notification bar at the top of the page
function notify(text, type = 'success') {
  const el = document.getElementById('staffNotify');
  el.textContent = text;
  el.className = `notify-bar ${type}`;
  setTimeout(() => { el.className = 'notify-bar'; }, 3500);
}

// ── Theme init ────────────────────────────────────────────────────────────────
// Runs immediately (IIFE) so the correct theme is applied before the page renders,
// preventing a flash of the wrong colours.
(function initStaffTheme() {
  const theme = localStorage.getItem('sc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
})();

// Toggle between light and dark mode, persisting the choice in localStorage
document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sc_theme', next);
  document.getElementById('themeToggleBtn').textContent = next === 'dark' ? '☀️' : '🌙';
});

// ── Navigation ────────────────────────────────────────────────────────────────
document.getElementById('guestViewBtn').addEventListener('click', () => {
  window.location.href = '/dashboard';
});

document.getElementById('staffLogoutBtn').addEventListener('click', async () => {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  window.location.href = '/';
});

// ── Profile ───────────────────────────────────────────────────────────────────
// Fetch the current user's name to display in the welcome header.
// If the API call fails (session expired), redirect to home.
async function loadProfile() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    if (!user) { window.location.href = '/'; return; }
    document.getElementById('staffWelcome').textContent = `${user.first_name} ${user.last_name}`;
  } catch { window.location.href = '/'; }
}

// ── Reservations tab ──────────────────────────────────────────────────────────
// Staff see ALL reservations (no user filter), rendered as a table.
async function loadReservations() {
  try {
    const rows = await apiFetch('/api/reservations');
    if (!rows.length) {
      document.getElementById('staffReservations').textContent = 'No reservations yet.';
      return;
    }
    let html = `<table>
      <thead><tr>
        <th>#</th><th>Guest</th><th>Unit</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Amount</th>
      </tr></thead><tbody>`;
    rows.forEach(r => {
      html += `<tr>
        <td>#${r.reservation_id}</td>
        <td>${r.first_name} ${r.last_name}<br><span class="sub-muted">${r.email}</span></td>
        <td>${r.unit_code}<br><span class="sub-muted">${r.type_name}</span></td>
        <td>${formatDate(r.check_in)}</td>
        <td>${formatDate(r.check_out)}</td>
        <td>${badge(r.status, r.status)}</td>
        <td>${r.total_amount ? '$' + Number(r.total_amount).toFixed(2) : '–'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('staffReservations').innerHTML = html;
  } catch (err) {
    document.getElementById('staffReservations').textContent = 'Failed to load reservations.';
  }
}

// ── Tickets tab ───────────────────────────────────────────────────────────────
// Staff see all tickets and can change status via an inline dropdown.
// The dropdown's onchange calls updateTicket() which is exposed on window so
// it can be called from the inline HTML attribute.
async function loadTickets() {
  try {
    const tickets = await apiFetch('/api/tickets');
    if (!tickets.length) {
      document.getElementById('staffTickets').innerHTML = '<div class="empty-state"><div class="empty-icon">🎫</div><p>No tickets yet.</p></div>';
      return;
    }
    let html = `<table>
      <thead><tr><th>#</th><th>Unit</th><th>Type</th><th>Title</th><th>Reporter</th><th>Status</th><th>Update</th><th>Date</th></tr></thead>
      <tbody>`;
    tickets.forEach(t => {
      html += `<tr>
        <td>#${t.ticket_id}</td>
        <td>${t.unit_code}</td>
        <td>${t.ticket_type}</td>
        <td>${t.title}${t.description ? `<br><span class="sub-muted">${t.description}</span>` : ''}</td>
        <td>${t.first_name} ${t.last_name}</td>
        <td>${badge(t.status, t.status)}</td>
        <td>
          <select class="inline" onchange="updateTicket(${t.ticket_id}, this.value, this)">
            <option value="open"        ${t.status === 'open'        ? 'selected' : ''}>Open</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="closed"      ${t.status === 'closed'      ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td>${formatDate(t.created_at)}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('staffTickets').innerHTML = html;
  } catch (err) {
    document.getElementById('staffTickets').textContent = 'Failed to load tickets.';
  }
}

// Called by inline onchange — updates ticket status via PATCH then reloads the list
window.updateTicket = async (ticket_id, status, select) => {
  select.disabled = true; // prevent double-submit
  try {
    await apiFetch(`/api/tickets/${ticket_id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    notify(`Ticket #${ticket_id} updated to ${status}.`);
    await loadTickets();
  } catch (err) {
    notify(err.message, 'error');
    select.disabled = false;
  }
};

// ── Startup ───────────────────────────────────────────────────────────────────
// Load profile and both tables in parallel, then poll every 10 s so updates
// from other staff members appear without a manual page refresh.
async function init() {
  await loadProfile();
  await Promise.all([loadReservations(), loadTickets()]);
  setInterval(async () => {
    await loadReservations();
    await loadTickets();
  }, 10000);
}

init();

// ── Event management tab ──────────────────────────────────────────────────────
// The events tab is loaded lazily — initEventTab() only runs the first time
// the tab is clicked (see the listener at the bottom of this file).
const EVENT_EMOJIS = ['🎉','🎶','🏐','🍽️','🤿','🧘','🎨','🌅','🎤','🎊','🏄','🐚'];

function initEventTab() {
  // ── Emoji picker ──────────────────────────────────────────────────────────
  // Renders clickable emoji buttons; clicking one sets the hidden emojiInput value
  const picker = document.getElementById('emojiPicker');
  const emojiInput = document.getElementById('evEmoji');
  if (picker) {
    EVENT_EMOJIS.forEach(em => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = em;
      btn.className = 'emoji-opt' + (em === '🎉' ? ' selected' : '');
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.emoji-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        emojiInput.value = em;
      });
      picker.appendChild(btn);
    });
  }

  // ── Image preview ─────────────────────────────────────────────────────────
  // When a file is selected, show a preview so staff can confirm the right image
  const imageInput = document.getElementById('evImage');
  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];
      const preview = document.getElementById('evImagePreview');
      const img = document.getElementById('evPreviewImg');
      if (file) {
        img.src = URL.createObjectURL(file); // local blob URL, no upload yet
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    });
  }

  // ── Event form submit ─────────────────────────────────────────────────────
  // Uses FormData (not JSON) because multipart is needed for the image file.
  // The raw fetch() is used here instead of apiFetch() so we can omit the
  // Content-Type header and let the browser set it with the correct boundary.
  const form = document.getElementById('eventForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('evSubmitBtn');
      btn.disabled = true;
      btn.textContent = 'Posting…';

      const fd = new FormData();
      fd.append('title',        document.getElementById('evTitle').value.trim());
      fd.append('description',  document.getElementById('evDesc').value.trim());
      fd.append('event_date',   document.getElementById('evDate').value);
      fd.append('event_time',   document.getElementById('evTime').value.trim());
      fd.append('location',     document.getElementById('evLocation').value.trim());
      fd.append('ticket_info',  document.getElementById('evTicket').value.trim());
      fd.append('banner_emoji', document.getElementById('evEmoji').value);
      const imageFile = document.getElementById('evImage').files[0];
      if (imageFile) fd.append('image', imageFile); // optional

      try {
        const res = await fetch('/api/events', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to post event.');
        showEventMsg('Event posted successfully!', 'success');
        form.reset();
        // Reset emoji picker back to the default selection
        document.getElementById('evEmoji').value = '🎉';
        document.querySelectorAll('.emoji-opt').forEach((b, i) => b.classList.toggle('selected', i === 0));
        document.getElementById('evImagePreview').style.display = 'none';
        loadStaffEvents(); // refresh the event list below the form
      } catch (err) {
        showEventMsg(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Post Event';
      }
    });
  }

  loadStaffEvents();
}

// Displays a temporary message below the event form
function showEventMsg(text, type) {
  const el = document.getElementById('eventMsg');
  el.textContent = text;
  el.className = `notify-bar ${type}`;
  setTimeout(() => { el.className = 'notify-bar'; el.textContent = ''; }, 4000);
}

// ── Event list ────────────────────────────────────────────────────────────────
// Fetches all events and renders them as a list with a Delete button on each.
async function loadStaffEvents() {
  const list = document.getElementById('staffEventList');
  if (!list) return;
  try {
    const res    = await fetch('/api/events');
    const events = await res.json();
    if (!events.length) {
      list.innerHTML = '<p class="muted" style="font-size:14px">No events posted yet.</p>';
      return;
    }
    list.innerHTML = '';
    events.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'event-list-item';

      // Show image thumbnail if the event has one, otherwise show the banner emoji
      const thumb = ev.image_path
        ? `<img class="event-list-thumb" src="${ev.image_path}" alt="${ev.title}">`
        : `<div class="event-list-emoji">${ev.banner_emoji || '🎉'}</div>`;

      const dateLabel = ev.event_date
        ? new Date(ev.event_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
        : '';

      item.innerHTML = `
        ${thumb}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;color:var(--accent-deep)">${ev.title}</div>
          <div style="font-size:12px;color:#6b7280;margin:2px 0">${[dateLabel, ev.event_time, ev.location].filter(Boolean).join(' · ')}</div>
          <div style="font-size:13px;color:#374151;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px">${ev.description || ''}</div>
        </div>
        <button class="btn-ghost" style="font-size:12px;padding:5px 12px;color:#dc2626;border-color:#fca5a5;white-space:nowrap" data-id="${ev.event_id}">Delete</button>`;

      // Confirm before deleting to prevent accidental removals
      item.querySelector('button').addEventListener('click', async () => {
        if (!confirm(`Delete "${ev.title}"?`)) return;
        try {
          const r = await apiFetch(`/api/events/${ev.event_id}`, { method: 'DELETE' });
          showEventMsg('Event deleted.', 'success');
          loadStaffEvents();
        } catch (err) {
          showEventMsg(err.message, 'error');
        }
      });

      list.appendChild(item);
    });
  } catch {
    list.innerHTML = '<p class="muted">Could not load events.</p>';
  }
}

// ── Lazy tab initialisation ───────────────────────────────────────────────────
// initEventTab() is expensive (DOM manipulation + API call) so we run it only
// once, the first time the Events tab is clicked. btn._eventsInited is used as
// a flag so subsequent clicks just show the already-initialised content.
document.querySelectorAll('.dash-tab-btn').forEach(btn => {
  if (btn.dataset.tab === 'tab-events') {
    btn.addEventListener('click', () => {
      if (!btn._eventsInited) { initEventTab(); btn._eventsInited = true; }
    });
  }
});
