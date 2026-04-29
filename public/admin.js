// ── admin.js — Admin panel logic (admin.html) ─────────────────────────────────
// Admins can: view/manage reservations, units, tickets, users, reviews,
// bar menu, and resort activities; see a revenue chart; mark invoices paid.

// Module-level state preserved across polling reloads
let _closedTicketsVisible = false;
let _unitTypes = [];
let _units     = [];

// Maps room type name → illustrated SVG (matches guest-facing home.js / app.js)
function unitImage(typeName) {
  const t = (typeName || '').toLowerCase();
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

// ── Theme init ────────────────────────────────────────────────────────────────
// Applied immediately (IIFE) to prevent a flash of the wrong colour scheme
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

// Shows a temporary success/error message bar at the top of the admin panel
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

// Renders a coloured pill badge — colour is controlled by CSS .badge-{cls} rules
function badge(text, cls) {
  return `<span class="badge badge-${escapeHTML(cls)}">${escapeHTML(text)}</span>`;
}

// ── Tab navigation ────────────────────────────────────────────────────────────
// Each button has data-tab="<name>"; clicking it activates #tab-<name>
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

// ── Profile ───────────────────────────────────────────────────────────────────
async function loadProfile() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    if (user) {
      document.getElementById('adminWelcome').textContent =
        `${user.first_name} ${user.last_name} · ${user.role_name}`;
    }
  } catch {}
}

// ── Reservations tab ──────────────────────────────────────────────────────────
// Splits reservations into Active (checked-in now), Future (upcoming), Past (done/cancelled).
function toDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function reservationTable(rows) {
  if (!rows.length) return '<p style="color:var(--muted);padding:8px 0;font-size:13px">None.</p>';
  const COLS = `<th>#</th><th>Guest</th><th>Unit</th><th>Check-in</th><th>Check-out</th>
    <th>Status</th><th>Invoice</th><th>Amount</th><th>Action</th>`;
  let html = `<table><thead><tr>${COLS}</tr></thead><tbody>`;
  rows.forEach(r => {
    const payBtn = r.invoice_id && r.invoice_status === 'unpaid' && r.status === 'confirmed'
      ? `<button class="btn-primary" style="font-size:12px;padding:4px 10px;margin-bottom:4px"
           onclick="markPaid(${r.invoice_id},this)">Mark Paid</button>`
      : '';
    const cancelBtn = r.status === 'confirmed'
      ? `<button class="btn-ghost" style="font-size:12px;padding:4px 10px;color:#dc2626;border-color:#fca5a5"
           onclick="cancelReservation(${r.reservation_id},this)">Cancel</button>`
      : '';
    const actions = payBtn || cancelBtn
      ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">${payBtn}${cancelBtn}</div>`
      : '<span class="sub-muted">–</span>';
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
      <td>${actions}</td>
    </tr>`;
  });
  return html + '</tbody></table>';
}

function sectionHeader(title, count, color) {
  return `<div style="display:flex;align-items:center;gap:10px;margin:20px 0 10px">
    <h3 style="margin:0;font-size:1rem;color:${color}">${title}</h3>
    <span style="background:${color}22;color:${color};font-size:12px;font-weight:700;padding:2px 10px;border-radius:12px">${count}</span>
  </div>`;
}

async function loadReservations() {
  try {
    const rows = await apiFetch('/api/reservations');
    document.getElementById('statReservations').textContent = rows.length;
    document.getElementById('statUnpaid').textContent =
      rows.filter(r => r.invoice_status === 'unpaid' && r.status === 'confirmed').length;

    const today = new Date().toISOString().slice(0, 10);

    const active = rows.filter(r =>
      r.status === 'confirmed' &&
      toDateStr(r.check_in) <= today &&
      toDateStr(r.check_out) >= today
    );
    const future = rows.filter(r =>
      r.status === 'confirmed' && toDateStr(r.check_in) > today
    );
    const past = rows.filter(r =>
      r.status === 'cancelled' || toDateStr(r.check_out) < today
    );

    document.getElementById('reservationsTable').innerHTML =
      sectionHeader('🏖️ Active — Checked In Now', active.length, '#0ea5a4') +
      '<div class="table-wrap">' + reservationTable(active) + '</div>' +
      sectionHeader('📅 Future — Upcoming', future.length, '#3b82f6') +
      '<div class="table-wrap">' + reservationTable(future) + '</div>' +
      sectionHeader('📁 Past — Completed & Cancelled', past.length, '#6b7280') +
      '<div class="table-wrap">' + reservationTable(past) + '</div>';

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

window.cancelReservation = async (reservation_id, btn) => {
  if (!confirm(`Cancel reservation #${reservation_id}? This cannot be undone.`)) return;
  btn.disabled = true;
  try {
    await apiFetch(`/api/reservations/${reservation_id}/cancel`, { method: 'POST' });
    showMessage(`Reservation #${reservation_id} cancelled.`);
    await loadReservations();
  } catch (err) {
    showMessage(err.message, 'error');
    btn.disabled = false;
  }
};

// ── Units tab ─────────────────────────────────────────────────────────────────
// Builds _unitTypes from the units JOIN response so the dropdown and room-types
// section always work even if GET /api/unit-types is unavailable.
function rebuildTypeCacheFromUnits(units) {
  const seen = {};
  units.forEach(u => {
    if (!seen[u.unit_type_id]) {
      seen[u.unit_type_id] = {
        unit_type_id: u.unit_type_id,
        type_name:    u.type_name,
        capacity:     u.capacity,
        nightly_rate: u.type_nightly_rate ?? u.nightly_rate,
        description:  u.type_description  ?? null,
        amenities:    u.type_amenities    ?? null,
        photo_url:    u.type_photo_url    ?? null
      };
    }
  });
  _unitTypes = Object.values(seen).sort((a, b) => a.type_name.localeCompare(b.type_name));

  // Populate the Add Unit dropdown from this cache
  const el = document.getElementById('newUnitType');
  if (el) {
    el.innerHTML = '<option value="">Select type…</option>' +
      _unitTypes.map(t =>
        `<option value="${t.unit_type_id}">${escapeHTML(t.type_name)} ($${Number(t.nightly_rate).toFixed(0)}/night)</option>`
      ).join('');
  }
}

async function loadUnits() {
  try {
    const units = await apiFetch('/api/units');
    _units = units;
    rebuildTypeCacheFromUnits(units);   // always populate type cache from unit data

    let html = `<table>
      <thead><tr>
        <th>Photo</th><th>Code</th><th>Type</th><th>Rate/Night</th><th>Status</th><th>Edit</th><th>Delete</th>
      </tr></thead><tbody>`;

    units.forEach(u => {
      const photoSrc = u.unit_photo_url || u.type_photo_url || unitImage(u.type_name);
      const thumb = `<img src="${escapeHTML(photoSrc)}" alt="${escapeHTML(u.type_name)}"
          style="width:56px;height:40px;object-fit:cover;border-radius:5px;display:block"
          onerror="this.src='${unitImage(u.type_name)}'">`;
      const rateLabel = u.unit_nightly_rate
        ? `$${Number(u.unit_nightly_rate).toFixed(2)} <span style="font-size:11px;color:var(--muted)">(custom)</span>`
        : `$${Number(u.nightly_rate).toFixed(2)}`;
      html += `<tr>
        <td>${thumb}</td>
        <td><strong>${escapeHTML(u.unit_code)}</strong>${u.unit_description
          ? `<br><span class="sub-muted" style="font-size:11px;max-width:130px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(u.unit_description)}</span>`
          : ''}</td>
        <td>${escapeHTML(u.type_name)}</td>
        <td>${rateLabel}</td>
        <td>${badge(u.status, u.status)}</td>
        <td><button class="btn-secondary" style="font-size:12px;padding:5px 12px;white-space:nowrap"
              onclick="openUnitModal(${u.unit_id})">Edit</button></td>
        <td><button class="btn-ghost" style="font-size:12px;padding:5px 10px;color:#dc2626;border-color:#fca5a5;white-space:nowrap"
              onclick="deleteUnit(${u.unit_id},'${escapeHTML(u.unit_code)}')">Delete</button></td>
      </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('unitsTable').innerHTML = html;
  } catch (err) {
    document.getElementById('unitsTable').textContent = 'Failed to load units.';
  }
}

window.openUnitModal = function(unitId) {
  const unit = _units.find(u => u.unit_id === unitId);
  if (!unit) return;

  document.getElementById('unitModalTitle').textContent = `Edit Unit: ${unit.unit_code}`;
  document.getElementById('unitModalMsg').className     = 'admin-message';
  document.getElementById('unitModalMsg').textContent   = '';

  // Structural fields
  document.getElementById('unitModalCode').value   = unit.unit_code;
  document.getElementById('unitModalStatus').value = unit.status;

  // Type dropdown — built from cached _unitTypes
  const typeSelect = document.getElementById('unitModalType');
  typeSelect.innerHTML = _unitTypes.map(t =>
    `<option value="${t.unit_type_id}" ${t.unit_type_id === unit.unit_type_id ? 'selected' : ''}>
      ${escapeHTML(t.type_name)} ($${Number(t.nightly_rate).toFixed(0)}/night)
    </option>`
  ).join('');

  // Update rate hint whenever type changes
  function updateRateHint() {
    const selected = _unitTypes.find(t => t.unit_type_id === parseInt(typeSelect.value, 10));
    document.getElementById('unitModalRateHint').textContent =
      selected ? `Room type default: $${Number(selected.nightly_rate).toFixed(2)}/night` : '';
  }
  typeSelect.onchange = updateRateHint;
  updateRateHint();

  // Display / pricing fields
  document.getElementById('unitModalDesc').value  = unit.unit_description || '';
  document.getElementById('unitModalRate').value  = Number(unit.nightly_rate).toFixed(2);

  // Photo preview
  const fileInput   = document.getElementById('unitModalPhotoInput');
  const preview     = document.getElementById('unitModalPhotoPreview');
  const placeholder = document.getElementById('unitModalPhotoPh');
  fileInput.value = '';
  const currentPhoto = unit.unit_photo_url || unit.type_photo_url || unitImage(unit.type_name);
  preview.src = currentPhoto;
  preview.style.display = '';
  placeholder.style.display = 'none';
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { preview.src = ev.target.result; preview.style.display = ''; placeholder.style.display = 'none'; };
    reader.readAsDataURL(file);
  };

  // Delete button inside modal
  const delBtn = document.getElementById('unitModalDeleteBtn');
  delBtn.onclick = () => { closeUnitModal(); deleteUnit(unitId, unit.unit_code); };

  const modal = document.getElementById('unitModal');
  modal.style.display = 'flex';
  modal._editingUnitId = unitId;
};

window.closeUnitModal = function() {
  document.getElementById('unitModal').style.display = 'none';
};

window.deleteUnit = async (unitId, code) => {
  if (!confirm(`Delete unit ${code}? This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/units/${unitId}`, { method: 'DELETE' });
    showMessage(`Unit ${code} deleted.`);
    loadUnits();
  } catch (err) {
    showMessage(err.message, 'error');
  }
};

document.getElementById('unitModalSaveBtn')?.addEventListener('click', async () => {
  const modal  = document.getElementById('unitModal');
  const unitId = modal._editingUnitId;
  if (!unitId) return;

  const saveBtn   = document.getElementById('unitModalSaveBtn');
  const msgEl     = document.getElementById('unitModalMsg');
  const fileInput = document.getElementById('unitModalPhotoInput');
  saveBtn.disabled = true;

  try {
    // Save all text/structural fields as JSON
    await apiFetch(`/api/units/${unitId}/details`, {
      method: 'PATCH',
      body: JSON.stringify({
        unit_code:    document.getElementById('unitModalCode').value.trim().toUpperCase(),
        unit_type_id: parseInt(document.getElementById('unitModalType').value, 10),
        status:       document.getElementById('unitModalStatus').value,
        description:  document.getElementById('unitModalDesc').value.trim(),
        nightly_rate: document.getElementById('unitModalRate').value.trim()
      })
    });

    // Upload photo separately if one was chosen
    if (fileInput.files[0]) {
      const fd = new FormData();
      fd.append('photo', fileInput.files[0]);
      await apiFetch(`/api/units/${unitId}/photo`, { method: 'PATCH', body: fd, headers: {} });
    }

    msgEl.textContent = 'Unit saved!';
    msgEl.className   = 'admin-message success';
    setTimeout(() => { closeUnitModal(); loadUnits(); }, 900);
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className   = 'admin-message error';
  } finally {
    saveBtn.disabled = false;
  }
});

// Add New Unit form
document.getElementById('addUnitBtn')?.addEventListener('click', async () => {
  const btn    = document.getElementById('addUnitBtn');
  const msgEl  = document.getElementById('addUnitMsg');
  const code   = document.getElementById('newUnitCode').value.trim().toUpperCase();
  const typeId = parseInt(document.getElementById('newUnitType').value, 10);
  const status = document.getElementById('newUnitStatus').value;

  if (!code)        { msgEl.textContent = 'Unit code is required.';  msgEl.className = 'admin-message error'; return; }
  if (isNaN(typeId)){ msgEl.textContent = 'Please select a room type.'; msgEl.className = 'admin-message error'; return; }

  // Client-side duplicate check against cached units
  if (_units.some(u => u.unit_code === code)) {
    msgEl.textContent = `Unit code "${code}" already exists. Choose a different code.`;
    msgEl.className = 'admin-message error';
    return;
  }

  btn.disabled = true;
  try {
    await apiFetch('/api/units', {
      method: 'POST',
      body: JSON.stringify({ unit_code: code, unit_type_id: typeId, status })
    });
    msgEl.textContent = `Unit ${code} created.`;
    msgEl.className   = 'admin-message success';
    document.getElementById('newUnitCode').value  = '';
    document.getElementById('newUnitType').value  = '';
    loadUnits();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className   = 'admin-message error';
  } finally {
    btn.disabled = false;
  }
});

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

// ── Unit Types tab section ────────────────────────────────────────────────────
// Renders the room types management table.
// Tries GET /api/unit-types first (gives description/amenities from DB).
// If that fails, renders from the _unitTypes cache already built by loadUnits().
function renderUnitTypesTable(types, container) {
  if (!types.length) {
    container.innerHTML = '<p class="muted">No room types found.</p>';
    return;
  }
  let html = `<table>
    <thead><tr>
      <th>Photo</th><th>Type</th><th>Rate</th><th>Cap.</th><th>Description</th><th>Amenities</th><th>Edit</th>
    </tr></thead><tbody>`;
  types.forEach(t => {
    const typeSrc = t.photo_url || unitImage(t.type_name);
    const thumb = `<img src="${escapeHTML(typeSrc)}" alt="${escapeHTML(t.type_name)}"
        style="width:64px;height:46px;object-fit:cover;border-radius:6px;display:block"
        onerror="this.src='${unitImage(t.type_name)}'">`;
    const desc = t.description
      ? `<span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:200px">${escapeHTML(t.description)}</span>`
      : '<span class="sub-muted">–</span>';
    const amen = t.amenities
      ? `<span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:150px">${escapeHTML(t.amenities)}</span>`
      : '<span class="sub-muted">–</span>';
    html += `<tr>
      <td>${thumb}</td>
      <td><strong>${escapeHTML(t.type_name)}</strong></td>
      <td>$${Number(t.nightly_rate).toFixed(0)}/night</td>
      <td>👥 ${t.capacity}</td>
      <td>${desc}</td>
      <td>${amen}</td>
      <td><button class="btn-secondary" style="font-size:12px;padding:5px 12px;white-space:nowrap"
            onclick="openUnitTypeModal(${t.unit_type_id})">Edit</button></td>
    </tr>`;
  });
  container.innerHTML = html + '</tbody></table>';
}

async function loadUnitTypes() {
  const container = document.getElementById('unitTypesContainer');
  if (!container) return;
  try {
    const types = await apiFetch('/api/unit-types');
    // Enrich the existing cache with richer data (description, amenities, photo_url)
    // WITHOUT replacing or removing types — _unitTypes was fully built by loadUnits().
    const apiMap = {};
    types.forEach(t => { apiMap[t.unit_type_id] = t; });
    _unitTypes = _unitTypes.map(cached =>
      apiMap[cached.unit_type_id] ? { ...cached, ...apiMap[cached.unit_type_id] } : cached
    );
    // Add any types the API knows about that aren't in the cache yet
    types.forEach(t => {
      if (!_unitTypes.find(c => c.unit_type_id === t.unit_type_id)) _unitTypes.push(t);
    });
    _unitTypes.sort((a, b) => a.type_name.localeCompare(b.type_name));
  } catch (err) {
    console.error('GET /api/unit-types failed:', err);
    // Cache already populated by loadUnits() — just render from it
  }
  // Always render from the (possibly enriched) cache
  if (_unitTypes.length) {
    renderUnitTypesTable(_unitTypes, container);
  } else {
    container.innerHTML = '<p style="color:#dc2626;font-size:13px">No room types found.</p>';
  }
}

window.openUnitTypeModal = function(typeId) {
  const type = _unitTypes.find(t => t.unit_type_id === typeId);
  if (!type) return;

  document.getElementById('unitTypeModalTitle').textContent = `Edit: ${type.type_name}`;
  document.getElementById('unitTypeDesc').value       = type.description || '';
  document.getElementById('unitTypeAmenities').value  = type.amenities   || '';
  document.getElementById('unitTypeRate').value       = type.nightly_rate != null ? Number(type.nightly_rate).toFixed(2) : '';
  document.getElementById('unitTypeModalMsg').className = 'admin-message';
  document.getElementById('unitTypeModalMsg').textContent = '';

  const fileInput   = document.getElementById('unitTypePhotoInput');
  const preview     = document.getElementById('unitTypePhotoPreview');
  const placeholder = document.getElementById('unitTypePhotoPh');
  fileInput.value = '';
  preview.src = type.photo_url || unitImage(type.type_name);
  preview.style.display = '';
  placeholder.style.display = 'none';

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      preview.style.display = '';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  const modal = document.getElementById('unitTypeModal');
  modal.style.display = 'flex';
  modal._editingTypeId = typeId;
};

window.closeUnitTypeModal = function() {
  document.getElementById('unitTypeModal').style.display = 'none';
};

document.getElementById('unitTypeModalSaveBtn')?.addEventListener('click', async () => {
  const modal   = document.getElementById('unitTypeModal');
  const typeId  = modal._editingTypeId;
  if (!typeId) return;

  const saveBtn = document.getElementById('unitTypeModalSaveBtn');
  const msgEl   = document.getElementById('unitTypeModalMsg');
  saveBtn.disabled = true;

  const formData = new FormData();
  formData.append('description',  document.getElementById('unitTypeDesc').value.trim());
  formData.append('amenities',    document.getElementById('unitTypeAmenities').value.trim());
  const rateVal = document.getElementById('unitTypeRate').value.trim();
  if (rateVal !== '') formData.append('nightly_rate', rateVal);
  const fileInput = document.getElementById('unitTypePhotoInput');
  if (fileInput.files[0]) formData.append('photo', fileInput.files[0]);

  try {
    await apiFetch(`/api/unit-types/${typeId}`, {
      method: 'PATCH',
      body: formData,
      headers: {}  // clear Content-Type so browser sets multipart boundary
    });
    msgEl.textContent = 'Room type updated!';
    msgEl.className = 'admin-message success';
    setTimeout(() => {
      closeUnitTypeModal();
      loadUnitTypes();
    }, 1200);
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'admin-message error';
  } finally {
    saveBtn.disabled = false;
  }
});

// ── Tickets tab ───────────────────────────────────────────────────────────────
// Active tickets (open/in_progress) get an inline status updater.
// Closed tickets appear in a separate read-only table showing who closed them and when.
function formatDateTime(val) {
  if (!val) return '–';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

async function loadTickets() {
  try {
    const tickets = await apiFetch('/api/tickets');
    document.getElementById('statTickets').textContent =
      tickets.filter(t => t.status === 'open').length;

    const active = tickets.filter(t => t.status !== 'closed');
    const closed = tickets.filter(t => t.status === 'closed');

    // ── Active tickets table ──────────────────────────────────────────────
    if (!active.length) {
      document.getElementById('ticketsTableActive').innerHTML =
        '<p style="color:var(--muted);padding:12px 0">No open tickets.</p>';
    } else {
      let html = `<table>
        <thead><tr>
          <th>#</th><th>Unit</th><th>Type</th><th>Title</th>
          <th>Reporter</th><th>Status</th><th>Update</th><th>Submitted</th>
        </tr></thead><tbody>`;

      active.forEach(t => {
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
              <option value="open"        ${t.status === 'open'        ? 'selected' : ''}>Open</option>
              <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="closed"                                                     >Close</option>
            </select>
          </td>
          <td>${formatDate(t.created_at)}</td>
        </tr>`;
      });

      html += '</tbody></table>';
      document.getElementById('ticketsTableActive').innerHTML = html;
    }

    // ── Closed tickets table ──────────────────────────────────────────────
    const closedSection  = document.getElementById('closedTicketsSection');
    const toggleWrap     = document.getElementById('closedTicketsToggleWrap');
    const toggleBtn      = document.getElementById('closedTicketsToggleBtn');

    if (!closed.length) {
      if (toggleWrap) toggleWrap.style.display = 'none';
      closedSection.style.display = 'none';
    } else {
      if (toggleWrap) toggleWrap.style.display = '';
      closedSection.style.display = _closedTicketsVisible ? 'block' : 'none';

      if (toggleBtn && !toggleBtn._wired) {
        toggleBtn._wired = true;
        toggleBtn.addEventListener('click', () => {
          _closedTicketsVisible = !_closedTicketsVisible;
          closedSection.style.display = _closedTicketsVisible ? 'block' : 'none';
          toggleBtn.textContent = _closedTicketsVisible ? 'Hide Closed Tickets ▲' : 'Show Closed Tickets ▼';
        });
      }
      if (toggleBtn) {
        toggleBtn.textContent = _closedTicketsVisible ? 'Hide Closed Tickets ▲' : 'Show Closed Tickets ▼';
      }

      let html = `<table>
        <thead><tr>
          <th>#</th><th>Unit</th><th>Type</th><th>Title</th>
          <th>Reporter</th><th>Closed By</th><th>Closed At</th>
        </tr></thead><tbody>`;

      closed.forEach(t => {
        const closerName = t.closed_by_first
          ? `${escapeHTML(t.closed_by_first)} ${escapeHTML(t.closed_by_last)}`
          : '<span class="sub-muted">–</span>';
        html += `<tr>
          <td>#${t.ticket_id}</td>
          <td>${escapeHTML(t.unit_code)}</td>
          <td>${escapeHTML(t.ticket_type)}</td>
          <td>${escapeHTML(t.title)}${t.description
            ? `<br><span class="sub-muted">${escapeHTML(t.description)}</span>` : ''}</td>
          <td>${escapeHTML(t.first_name)} ${escapeHTML(t.last_name)}</td>
          <td>${closerName}</td>
          <td style="white-space:nowrap">${formatDateTime(t.closed_at)}</td>
        </tr>`;
      });

      html += '</tbody></table>';
      document.getElementById('ticketsTableClosed').innerHTML = html;
    }
  } catch (err) {
    document.getElementById('ticketsTableActive').textContent = 'Failed to load tickets.';
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

// ── Users tab ─────────────────────────────────────────────────────────────────
// All users with a role dropdown (admin accounts show "Protected" — cannot be changed)
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

// ── Search / filter helpers ───────────────────────────────────────────────────
// wireSearch() attaches a live text filter to a table: typing hides rows that
// don't contain the search string anywhere in their visible text content.
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
  // loadUnits must finish first so _unitTypes cache is ready for loadUnitTypes fallback
  await loadUnits();
  await Promise.all([loadReservations(), loadUnitTypes(), loadTickets(), loadUsers(), loadRevenue(), loadReviews()]);

  wireSearch('searchReservations', 'reservationsTable');
  wireSearch('searchTickets', 'ticketsTableActive');
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
