async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  let data = {};
  try { data = await response.json(); } catch { throw new Error('Server returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showMessage(text, type = 'success') {
  const el = document.getElementById('adminMessage');
  el.textContent = text;
  el.className = `admin-message ${type}`;
  setTimeout(() => { el.className = 'admin-message'; }, 4000);
}

function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString();
}

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  window.location.href = '/';
});

document.getElementById('guestViewBtn').addEventListener('click', () => {
  window.location.href = '/dashboard';
});

async function loadProfile() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    if (user) {
      document.getElementById('adminWelcome').textContent =
        `${user.first_name} ${user.last_name} · ${user.role_name}`;
    }
  } catch {}
}

async function loadReservations() {
  try {
    const rows = await apiFetch('/api/reservations');
    document.getElementById('statReservations').textContent = rows.length;
    document.getElementById('statUnpaid').textContent =
      rows.filter(r => r.invoice_status === 'unpaid' && r.status === 'confirmed').length;

    if (!rows.length) {
      document.getElementById('reservationsTable').textContent = 'No reservations yet.';
      return;
    }

    let html = `<table>
      <thead><tr>
        <th>#</th><th>Guest</th><th>Unit</th><th>Check-in</th><th>Check-out</th>
        <th>Status</th><th>Invoice</th><th>Amount</th><th>Action</th>
      </tr></thead><tbody>`;

    rows.forEach(r => {
      const payBtn = r.invoice_id && r.invoice_status === 'unpaid' && r.status === 'confirmed'
        ? `<button class="btn-primary" style="font-size:12px;padding:4px 10px"
             onclick="markPaid(${r.invoice_id},this)">Mark Paid</button>`
        : '';
      html += `<tr>
        <td>#${r.reservation_id}</td>
        <td>${r.first_name} ${r.last_name}<br>
            <span class="sub-muted">${r.email}</span></td>
        <td>${r.unit_code}<br>
            <span class="sub-muted">${r.type_name}</span></td>
        <td>${formatDate(r.check_in)}</td>
        <td>${formatDate(r.check_out)}</td>
        <td>${badge(r.status, r.status)}</td>
        <td>${r.invoice_status ? badge(r.invoice_status, r.invoice_status) : '-'}</td>
        <td>${r.total_amount ? '$' + Number(r.total_amount).toFixed(2) : '-'}</td>
        <td>${payBtn}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('reservationsTable').innerHTML = html;
  } catch (err) {
    document.getElementById('reservationsTable').textContent = 'Failed to load reservations.';
  }
}

window.markPaid = async (invoice_id, btn) => {
  btn.disabled = true;
  try {
    await apiFetch(`/api/invoices/${invoice_id}/pay`, { method: 'POST' });
    showMessage('Invoice marked as paid.');
    await loadReservations();
  } catch (err) {
    showMessage(err.message, 'error');
    btn.disabled = false;
  }
};

async function loadUnits() {
  try {
    const units = await apiFetch('/api/units');

    let html = `<table>
      <thead><tr><th>Code</th><th>Type</th><th>Capacity</th><th>Rate/Night</th><th>Status</th><th>Change Status</th></tr></thead>
      <tbody>`;

    units.forEach(u => {
      html += `<tr>
        <td>${u.unit_code}</td>
        <td>${u.type_name}</td>
        <td>${u.capacity}</td>
        <td>$${Number(u.nightly_rate).toFixed(2)}</td>
        <td>${badge(u.status, u.status)}</td>
        <td>
          <select class="inline" onchange="updateUnitStatus(${u.unit_id},this.value,this)">
            <option value="available" ${u.status === 'available' ? 'selected' : ''}>Available</option>
            <option value="maintenance" ${u.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            <option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('unitsTable').innerHTML = html;
  } catch (err) {
    document.getElementById('unitsTable').textContent = 'Failed to load units.';
  }
}

window.updateUnitStatus = async (unit_id, status, select) => {
  select.disabled = true;
  try {
    await apiFetch(`/api/units/${unit_id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showMessage(`Unit status updated to ${status}.`);
    await loadUnits();
  } catch (err) {
    showMessage(err.message, 'error');
    select.disabled = false;
  }
};

async function loadTickets() {
  try {
    const tickets = await apiFetch('/api/tickets');
    document.getElementById('statTickets').textContent =
      tickets.filter(t => t.status === 'open').length;

    if (!tickets.length) {
      document.getElementById('ticketsTable').textContent = 'No tickets yet.';
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
        <td>${t.title}${t.description
          ? `<br><span class="sub-muted">${t.description}</span>` : ''}</td>
        <td>${t.first_name} ${t.last_name}</td>
        <td>${badge(t.status, t.status)}</td>
        <td>
          <select class="inline" onchange="updateTicketStatus(${t.ticket_id},this.value,this)">
            <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td>${formatDate(t.created_at)}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('ticketsTable').innerHTML = html;
  } catch (err) {
    document.getElementById('ticketsTable').textContent = 'Failed to load tickets.';
  }
}

window.updateTicketStatus = async (ticket_id, status, select) => {
  select.disabled = true;
  try {
    await apiFetch(`/api/tickets/${ticket_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showMessage(`Ticket updated to ${status}.`);
    await loadTickets();
  } catch (err) {
    showMessage(err.message, 'error');
    select.disabled = false;
  }
};

async function loadUsers() {
  try {
    const users = await apiFetch('/api/admin/users');
    document.getElementById('statUsers').textContent = users.length;

    let html = `<table>
      <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Change Role</th><th>Joined</th></tr></thead>
      <tbody>`;

    users.forEach(u => {
      const isAdmin = u.role_name === 'admin';
      const roleSelect = isAdmin
        ? `<span class="sub-muted" style="font-size:12px">Protected</span>`
        : `<select class="inline" onchange="updateUserRole(${u.user_id},this.value,this)">
             <option value="guest"  ${u.role_name === 'guest'  ? 'selected' : ''}>Guest</option>
             <option value="staff"  ${u.role_name === 'staff'  ? 'selected' : ''}>Staff</option>
           </select>`;

      html += `<tr>
        <td>#${u.user_id}</td>
        <td>${u.first_name} ${u.last_name}</td>
        <td>${u.email}</td>
        <td>${badge(u.role_name, u.role_name)}</td>
        <td>${roleSelect}</td>
        <td>${formatDate(u.created_at)}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('usersTable').innerHTML = html;
  } catch (err) {
    document.getElementById('usersTable').textContent = 'Failed to load users.';
  }
}

window.updateUserRole = async (user_id, role_name, select) => {
  select.disabled = true;
  try {
    await apiFetch(`/api/admin/users/${user_id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role_name })
    });
    showMessage(`User #${user_id} role updated to ${role_name}.`);
    await loadUsers();
  } catch (err) {
    showMessage(err.message, 'error');
    select.disabled = false;
  }
};

// ── Search / filter helpers ──────────────────────────────────────────────
function wireSearch(inputId, tableWrapId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    const wrap = document.getElementById(tableWrapId);
    if (!wrap) return;
    wrap.querySelectorAll('tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ── Revenue chart ────────────────────────────────────────────────────────
let revenueChartInstance = null;

async function loadRevenue() {
  try {
    const { revenue, monthly, avgRating } = await apiFetch('/api/admin/stats');
    document.getElementById('statTotalRevenue').textContent =
      '$' + Number(revenue.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('statAvgRating').textContent =
      avgRating.avg_rating ? `${avgRating.avg_rating} ★ (${avgRating.total_reviews})` : '–';

    const labels  = monthly.map(m => m.month);
    const data    = monthly.map(m => Number(m.revenue));

    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue ($)',
          data,
          backgroundColor: 'rgba(14,165,164,0.7)',
          borderColor: '#0ea5a4',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '$' + v } }
        }
      }
    });
  } catch (err) {
    console.error('Revenue load error:', err);
  }
}

// ── Reviews tab ──────────────────────────────────────────────────────────
function stars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

async function loadReviews() {
  try {
    const reviews = await apiFetch('/api/admin/reviews');
    if (!reviews.length) {
      document.getElementById('reviewsTable').innerHTML = '<p class="muted" style="padding:20px">No reviews yet.</p>';
      return;
    }
    let html = `<table>
      <thead><tr><th>Rating</th><th>Guest</th><th>Unit</th><th>Comment</th><th>Date</th></tr></thead>
      <tbody>`;
    reviews.forEach(r => {
      html += `<tr>
        <td style="color:#f59e0b;font-size:15px;letter-spacing:1px">${stars(r.rating)}</td>
        <td>${r.first_name} ${r.last_name}</td>
        <td>${r.unit_code}<br><span class="sub-muted">${r.type_name}</span></td>
        <td>${r.comment ? r.comment : '<span class="sub-muted">–</span>'}</td>
        <td>${formatDate(r.created_at)}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('reviewsTable').innerHTML = html;
  } catch (err) {
    document.getElementById('reviewsTable').textContent = 'Failed to load reviews.';
  }
}

async function init() {
  await loadProfile();
  await Promise.all([loadReservations(), loadUnits(), loadTickets(), loadUsers(), loadRevenue(), loadReviews()]);

  wireSearch('searchReservations', 'reservationsTable');
  wireSearch('searchTickets', 'ticketsTable');
  wireSearch('searchUsers', 'usersTable');

  // Poll every 10 seconds — tickets and reservations update live
  setInterval(async () => {
    await loadTickets();
    await loadReservations();
  }, 10000);
}

init();
