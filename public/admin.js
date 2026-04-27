(function initAdminTheme() {
  const theme = localStorage.getItem('sc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
})();

document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sc_theme', next);
  document.getElementById('themeToggleBtn').textContent = next === 'dark' ? '☀️' : '🌙';
});

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
  return `<span class="badge badge-${escapeHTML(cls)}">${escapeHTML(text)}</span>`;
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
        <td>${escapeHTML(r.first_name)} ${escapeHTML(r.last_name)}<br>
            <span class="sub-muted">${escapeHTML(r.email)}</span></td>
        <td>${escapeHTML(r.unit_code)}<br>
            <span class="sub-muted">${escapeHTML(r.type_name)}</span></td>
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
        <td>${escapeHTML(u.unit_code)}</td>
        <td>${escapeHTML(u.type_name)}</td>
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
        <td>${escapeHTML(t.unit_code)}</td>
        <td>${escapeHTML(t.ticket_type)}</td>
        <td>${escapeHTML(t.title)}${t.description
          ? `<br><span class="sub-muted">${escapeHTML(t.description)}</span>` : ''}</td>
        <td>${escapeHTML(t.first_name)} ${escapeHTML(t.last_name)}</td>
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
        <td>${escapeHTML(u.first_name)} ${escapeHTML(u.last_name)}</td>
        <td>${escapeHTML(u.email)}</td>
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
        <td>${escapeHTML(r.first_name)} ${escapeHTML(r.last_name)}</td>
        <td>${escapeHTML(r.unit_code)}<br><span class="sub-muted">${escapeHTML(r.type_name)}</span></td>
        <td>${r.comment ? escapeHTML(r.comment) : '<span class="sub-muted">–</span>'}</td>
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

/* ── Bar & Dining management ─────────────────────────────────────────────── */
async function loadBarItems() {
  const el = document.getElementById('barList');
  if (!el) return;
  try {
    const items = await apiFetch('/api/bar');
    if (!items.length) { el.innerHTML = '<p class="muted" style="font-size:14px">No items yet.</p>'; return; }

    const byCategory = {};
    items.forEach(item => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    });

    el.innerHTML = Object.entries(byCategory).map(([cat, catItems]) => `
      <div style="margin-bottom:22px">
        <div class="list-category-header">${escapeHTML(cat)}</div>
        ${catItems.map(item => `
          <div class="admin-list-row">
            <div style="flex:1;min-width:0">
              <span class="list-item-name">${escapeHTML(item.name)}</span>
              ${item.description ? `<span class="list-item-desc">${escapeHTML(item.description)}</span>` : ''}
            </div>
            <span class="list-item-price">${item.price != null ? '$' + Number(item.price).toFixed(2) : '—'}</span>
            <button class="btn-ghost" style="font-size:12px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;flex-shrink:0" onclick="deleteBarItem(${item.item_id})">Delete</button>
          </div>`).join('')}
      </div>`).join('');
  } catch { el.innerHTML = '<p class="muted">Could not load menu.</p>'; }
}

window.deleteBarItem = async (id) => {
  if (!confirm('Delete this menu item?')) return;
  try {
    await apiFetch(`/api/bar/${id}`, { method: 'DELETE' });
    showMessage('Item deleted.');
    loadBarItems();
  } catch (err) { showMessage(err.message, 'error'); }
};

document.getElementById('barForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await apiFetch('/api/bar', {
      method: 'POST',
      body: JSON.stringify({
        category:    document.getElementById('barCategory').value.trim(),
        name:        document.getElementById('barName').value.trim(),
        description: document.getElementById('barDesc').value.trim(),
        price:       document.getElementById('barPrice').value || null
      })
    });
    showMessage('Menu item added.');
    e.target.reset();
    loadBarItems();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally { btn.disabled = false; }
});

/* ── Activities management ───────────────────────────────────────────────── */
async function loadActivityItems() {
  const el = document.getElementById('actList');
  if (!el) return;
  try {
    const items = await apiFetch('/api/activity-items');
    if (!items.length) { el.innerHTML = '<p class="muted" style="font-size:14px">No activities yet.</p>'; return; }
    el.innerHTML = items.map(item => {
      const tags = (item.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const tagHtml = tags.map(t => {
        const cls = /free|included/i.test(t) ? 'list-tag-free' : /\$|per /i.test(t) ? 'list-tag-paid' : 'list-tag-default';
        return `<span class="list-tag ${cls}">${escapeHTML(t)}</span>`;
      }).join('');
      return `
        <div class="admin-list-row" style="align-items:flex-start">
          <div class="list-item-icon">${escapeHTML(item.icon || '🏄')}</div>
          <div style="flex:1;min-width:0">
            <span class="list-item-name">${escapeHTML(item.name)}</span>
            ${item.description ? `<span class="list-item-desc">${escapeHTML(item.description)}</span>` : ''}
            ${tagHtml ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">${tagHtml}</div>` : ''}
          </div>
          <button class="btn-ghost" style="font-size:12px;padding:4px 10px;color:#dc2626;border-color:#fca5a5;flex-shrink:0" onclick="deleteActivityItem(${item.activity_id})">Delete</button>
        </div>`;
    }).join('');
  } catch { el.innerHTML = '<p class="muted">Could not load activities.</p>'; }
}

window.deleteActivityItem = async (id) => {
  if (!confirm('Delete this activity?')) return;
  try {
    await apiFetch(`/api/activity-items/${id}`, { method: 'DELETE' });
    showMessage('Activity deleted.');
    loadActivityItems();
  } catch (err) { showMessage(err.message, 'error'); }
};

document.getElementById('actForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await apiFetch('/api/activity-items', {
      method: 'POST',
      body: JSON.stringify({
        icon:        document.getElementById('actIcon').value.trim() || '🏄',
        name:        document.getElementById('actName').value.trim(),
        description: document.getElementById('actDesc').value.trim(),
        tags:        document.getElementById('actTags').value.trim()
      })
    });
    showMessage('Activity added.');
    e.target.reset();
    loadActivityItems();
  } catch (err) {
    showMessage(err.message, 'error');
  } finally { btn.disabled = false; }
});

// Load bar/activity data when their tabs are first opened
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'bar' && !btn._loaded)        { loadBarItems();      btn._loaded = true; }
    if (tab === 'activitylist' && !btn._loaded) { loadActivityItems(); btn._loaded = true; }
  });
});
