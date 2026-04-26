async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  let data = {};
  try { data = await res.json(); } catch { throw new Error('Invalid server response.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  return new Date(val).toLocaleDateString();
}

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}

function notify(text, type = 'success') {
  const el = document.getElementById('staffNotify');
  el.textContent = text;
  el.className = `notify-bar ${type}`;
  setTimeout(() => { el.className = 'notify-bar'; }, 3500);
}

document.getElementById('staffLogoutBtn').addEventListener('click', async () => {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  window.location.href = '/';
});

async function loadProfile() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    if (!user) { window.location.href = '/'; return; }
    document.getElementById('staffWelcome').textContent = `${user.first_name} ${user.last_name}`;
  } catch { window.location.href = '/'; }
}

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

window.updateTicket = async (ticket_id, status, select) => {
  select.disabled = true;
  try {
    await apiFetch(`/api/tickets/${ticket_id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    notify(`Ticket #${ticket_id} updated to ${status}.`);
    await loadTickets();
  } catch (err) {
    notify(err.message, 'error');
    select.disabled = false;
  }
};

async function init() {
  await loadProfile();
  await Promise.all([loadReservations(), loadTickets()]);
  setInterval(async () => {
    await loadReservations();
    await loadTickets();
  }, 10000);
}

init();
