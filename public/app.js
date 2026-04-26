async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    ...options
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function setMessage(message, type = "info") {
  const box = document.getElementById("messageBox");
  if (!box) return;

  box.className = `message-box ${type}`;
  box.textContent = message;
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

document.addEventListener("DOMContentLoaded", async () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const first_name = document.getElementById("regFirstName").value.trim();
      const last_name = document.getElementById("regLastName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;

      if (!first_name || !last_name || !email || !password) {
        setMessage("Please fill in all registration fields.", "error");
        return;
      }

      setMessage("Creating account...", "info");

      try {
        const result = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            first_name,
            last_name,
            email,
            password
          })
        });

        setMessage(result.message || "Account created successfully.", "success");
        registerForm.reset();
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        setMessage("Please enter both email and password.", "error");
        return;
      }

      setMessage("Logging in...", "info");

      try {
        const result = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password
          })
        });

        setMessage(result.message || "Login successful.", "success");
        loginForm.reset();
        window.location.href = '/dashboard';
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  // Dashboard-specific behavior: load profile and wire logout
  const welcomeEl = document.getElementById('welcomeText');
  const dashboardMessageEl = document.getElementById('reservationMessage');

  function setDashboardMessage(text, type = 'info') {
    if (!dashboardMessageEl) return;
    dashboardMessageEl.style.display = 'block';
    dashboardMessageEl.className = `message-box ${type}`;
    dashboardMessageEl.textContent = text;
  }

  const calendarSelection = {
    unit_id: null,
    start: null,
    end: null
  };

  let currentUnitRate = null;

  const selectionInfoEl = document.getElementById('calendarSelectionInfo');
  const selectedRangeTextEl = document.getElementById('selectedRangeText');
  const confirmReservationBtn = document.getElementById('confirmReservationBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const calendarMonthLabel = document.getElementById('calendarMonthLabel');
  const yearFilterSelect = document.getElementById('yearFilterSelect');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');

  const calendarMonthState = {
    year: null,
    month: null
  };

  const calendarYearFilter = {
    active: false,
    year: null
  };

  function resetCalendarSelectionDisplay() {
    if (selectionInfoEl) {
      selectionInfoEl.style.display = 'none';
    }
    if (selectedRangeTextEl) {
      selectedRangeTextEl.textContent = 'None';
    }
    if (confirmReservationBtn) {
      confirmReservationBtn.disabled = true;
    }
  }

  function resetCalendarMonth() {
    const now = new Date();
    calendarMonthState.year = now.getFullYear();
    calendarMonthState.month = now.getMonth();
  }

  function updateCalendarLabel() {
    if (!calendarMonthLabel || calendarMonthState.year === null || calendarMonthState.month === null) return;
    const labelDate = new Date(calendarMonthState.year, calendarMonthState.month, 1);
    calendarMonthLabel.textContent = labelDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function populateYearFilterOptions() {
    if (!yearFilterSelect) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = currentYear - 2;
    const endYear = currentYear + 3;
    yearFilterSelect.innerHTML = '<option value="">All years</option>';
    for (let year = startYear; year <= endYear; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilterSelect.appendChild(option);
    }
  }

  function updateNavButtons() {
    if (!prevMonthBtn || !nextMonthBtn) return;
    if (calendarYearFilter.active) {
      prevMonthBtn.disabled = calendarMonthState.month <= 0;
      nextMonthBtn.disabled = calendarMonthState.month >= 11;
    } else {
      prevMonthBtn.disabled = false;
      nextMonthBtn.disabled = false;
    }
  }

  function applyYearFilter(yearValue) {
    if (!yearFilterSelect) return;
    if (!yearValue) {
      calendarYearFilter.active = false;
      calendarYearFilter.year = null;
      resetCalendarMonth();
    } else {
      calendarYearFilter.active = true;
      calendarYearFilter.year = Number(yearValue);
      if (calendarMonthState.month === null) {
        resetCalendarMonth();
      }
      calendarMonthState.year = calendarYearFilter.year;
    }
    updateCalendarLabel();
    updateNavButtons();
  }

  function resetFilters() {
    if (yearFilterSelect) {
      yearFilterSelect.value = '';
    }
    calendarYearFilter.active = false;
    calendarYearFilter.year = null;
    resetCalendarMonth();
    updateCalendarLabel();
    updateNavButtons();
    clearCalendarSelection();
  }

  function clearCalendarSelection() {
    calendarSelection.start = null;
    calendarSelection.end = null;
    resetCalendarSelectionDisplay();
    const calendarEl = document.getElementById('unitCalendar');
    if (!calendarEl) return;
    calendarEl.querySelectorAll('td').forEach((cell) => {
      cell.classList.remove('calendar-selected');
      cell.classList.remove('calendar-start');
      cell.classList.remove('calendar-end');
    });
  }

  if (confirmReservationBtn) {
    confirmReservationBtn.addEventListener('click', confirmCalendarReservation);
  }
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      clearCalendarSelection();
      setDashboardMessage('Selection cleared.', 'info');
    });
  }
  if (yearFilterSelect) {
    populateYearFilterOptions();
    yearFilterSelect.addEventListener('change', (event) => {
      const selectedYear = event.target.value;
      applyYearFilter(selectedYear);
      if (calendarSelection.unit_id) {
        loadCalendar(calendarSelection.unit_id);
      }
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      resetFilters();
      setDashboardMessage('Filters removed.', 'info');
      if (calendarSelection.unit_id) {
        loadCalendar(calendarSelection.unit_id);
      }
    });
  }
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      if (!calendarSelection.unit_id) return;
      if (calendarMonthState.month === null || calendarMonthState.year === null) {
        resetCalendarMonth();
      }
      if (calendarYearFilter.active && calendarMonthState.month <= 0) {
        return;
      }
      calendarMonthState.month -= 1;
      if (calendarMonthState.month < 0) {
        calendarMonthState.month = 11;
        calendarMonthState.year -= 1;
      }
      loadCalendar(calendarSelection.unit_id);
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      if (!calendarSelection.unit_id) return;
      if (calendarMonthState.month === null || calendarMonthState.year === null) {
        resetCalendarMonth();
      }
      if (calendarYearFilter.active && calendarMonthState.month >= 11) {
        return;
      }
      calendarMonthState.month += 1;
      if (calendarMonthState.month > 11) {
        calendarMonthState.month = 0;
        calendarMonthState.year += 1;
      }
      loadCalendar(calendarSelection.unit_id);
    });
  }

  function unitGradient(typeName) {
    const t = typeName.toLowerCase();
    if (t.includes('oceanfront'))  return 'linear-gradient(135deg,#0c4a6e,#0ea5e9)';
    if (t.includes('poolside'))    return 'linear-gradient(135deg,#065f46,#10b981)';
    if (t.includes('queen'))       return 'linear-gradient(135deg,#4c1d95,#8b5cf6)';
    if (t.includes('two bedroom')) return 'linear-gradient(135deg,#7c2d12,#f97316)';
    if (t.includes('one bedroom')) return 'linear-gradient(135deg,#1e3a5f,#3b82f6)';
    if (t.includes('studio'))      return 'linear-gradient(135deg,#713f12,#eab308)';
    return                                'linear-gradient(135deg,#374151,#6b7280)';
  }

  function unitEmoji(typeName) {
    const t = typeName.toLowerCase();
    if (t.includes('oceanfront')) return '🌊';
    if (t.includes('poolside'))   return '🏊';
    if (t.includes('two bedroom'))return '🏠';
    if (t.includes('queen'))      return '👑';
    if (t.includes('studio'))     return '🏖️';
    return '🛏️';
  }

  async function loadUnits() {
    try {
      const units = await apiFetch('/api/units');

      // Populate hidden select (used by calendar selection logic)
      const unitSelect = document.getElementById('unitId');
      if (unitSelect) {
        unitSelect.innerHTML = '<option value="" disabled selected>Select a unit</option>';
        units.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.unit_id;
          opt.textContent = `${u.unit_code} (${u.type_name})`;
          unitSelect.appendChild(opt);
        });
      }

      // Populate quick-book select
      const quickSelect = document.getElementById('quickUnitId');
      if (quickSelect) {
        quickSelect.innerHTML = '<option value="" disabled selected>Select a unit</option>';
        units.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.unit_id;
          opt.textContent = `${u.unit_code} – ${u.type_name} ($${Number(u.nightly_rate).toFixed(0)}/night)`;
          if (u.status !== 'available') opt.disabled = true;
          quickSelect.appendChild(opt);
        });
      }

      // Render gradient gallery cards
      const gallery = document.getElementById('roomGallery');
      if (gallery) {
        gallery.innerHTML = '';
        units.forEach(unit => {
          const dotClass = unit.status === 'available' ? 'dot-available'
                         : unit.status === 'maintenance' ? 'dot-maintenance' : 'dot-inactive';
          const card = document.createElement('div');
          card.className = 'unit-card';
          card.dataset.unitId = unit.unit_id;
          card.innerHTML = `
            <div class="unit-card-img" style="background:${unitGradient(unit.type_name)}">
              <div>
                <div style="font-size:1.4rem">${unitEmoji(unit.type_name)}</div>
                <div>${unit.unit_code}</div>
              </div>
            </div>
            <div class="unit-card-body">
              <div class="unit-card-code">${unit.unit_code}</div>
              <div class="unit-card-type">${unit.type_name}</div>
              <div class="unit-card-rate">$${Number(unit.nightly_rate).toFixed(0)}<span style="font-size:11px;font-weight:400;color:var(--muted)">/night</span></div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px">
                <span class="unit-status-dot ${dotClass}"></span>
                ${unit.status === 'available' ? 'Available' : unit.status}
                &nbsp;·&nbsp; 👥 ${unit.capacity}
              </div>
            </div>
          `;
          if (unit.status === 'available') {
            card.addEventListener('click', () => selectUnit(unit, card));
          } else {
            card.style.opacity = '.55';
            card.style.cursor = 'not-allowed';
          }
          gallery.appendChild(card);
        });
      }

      return units;
    } catch (error) {
      setDashboardMessage('Unable to load units.', 'error');
      console.error('Load units error:', error);
      return [];
    }
  }

  function selectUnit(unit, cardEl) {
    // Highlight selected card
    document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');

    // Sync hidden select
    const unitSelect = document.getElementById('unitId');
    if (unitSelect) unitSelect.value = unit.unit_id;

    currentUnitRate = Number(unit.nightly_rate);

    // Render detail banner
    const detailsEl = document.getElementById('unitDetails');
    detailsEl.style.display = 'block';
    detailsEl.innerHTML = `
      <div class="unit-detail-panel" style="background:${unitGradient(unit.type_name)}">
        <div class="detail-emoji">${unitEmoji(unit.type_name)}</div>
        <div style="flex:1">
          <h3>${unit.unit_code} – ${unit.type_name}</h3>
          <p>👥 Up to ${unit.capacity} guests &nbsp;·&nbsp; ${unit.status}</p>
        </div>
        <div style="text-align:right">
          <div class="detail-rate">$${Number(unit.nightly_rate).toFixed(2)}</div>
          <div style="font-size:12px;opacity:.8">per night</div>
        </div>
      </div>
    `;

    // Scroll to calendar
    detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    calendarSelection.unit_id = unit.unit_id;
    calendarSelection.start = null;
    calendarSelection.end = null;
    resetCalendarSelectionDisplay();
    resetCalendarMonth();
    loadCalendar(unit.unit_id);
  }

  async function loadCalendar(unit_id) {
    try {
      calendarSelection.unit_id = unit_id;
      calendarSelection.start = null;
      calendarSelection.end = null;
      resetCalendarSelectionDisplay();

      if (calendarMonthState.year === null || calendarMonthState.month === null) {
        resetCalendarMonth();
      }
      if (calendarYearFilter.active && calendarYearFilter.year !== null) {
        calendarMonthState.year = calendarYearFilter.year;
      }
      updateCalendarLabel();
      updateNavButtons();

      const bookings = await apiFetch(`/api/units/${unit_id}/availability`);
      const calendarEl = document.getElementById('unitCalendar');
      const calendarSection = document.getElementById('calendarSection');
      calendarSection.style.display = 'block';

      const year = calendarMonthState.year;
      const month = calendarMonthState.month;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();

      let html = `<h3>Availability for Unit ${unit_id} - ${new Date(year, month, 1).toLocaleString('default', { month: 'long' })} ${year}</h3>`;
      html += '<table style="border-collapse: collapse; width: 100%;">';
      html += '<tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr><tr>';

      // Empty cells for days before first day
      for (let i = 0; i < firstDay; i++) {
        html += '<td></td>';
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let isBooked = false;
        bookings.forEach(booking => {
          const checkIn = new Date(booking.check_in);
          const checkOut = new Date(booking.check_out);
          if (date >= checkIn && date < checkOut) {
            isBooked = true;
          }
        });
        let className;
        if (date < today) {
          className = 'past';
        } else if (isBooked) {
          className = 'booked';
        } else {
          className = 'available';
        }
        html += `<td class="${className}" data-date="${dateStr}" style="padding: 10px; text-align: center; border: 1px solid #ddd;">${day}</td>`;
        if ((firstDay + day) % 7 === 0) {
          html += '</tr><tr>';
        }
      }

      html += '</tr></table>';
      calendarEl.innerHTML = html;
      attachCalendarHandlers();
    } catch (error) {
      setDashboardMessage('Unable to load calendar.', 'error');
      console.error('Load calendar error:', error);
    }
  }

  function attachCalendarHandlers() {
    const calendarEl = document.getElementById('unitCalendar');
    if (!calendarEl) return;

    const cells = calendarEl.querySelectorAll('td.available');
    cells.forEach((cell) => {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', async () => {
        const date = cell.dataset.date;
        if (!date) return;

        const isSelected = cell.classList.contains('calendar-selected') || cell.classList.contains('calendar-start') || cell.classList.contains('calendar-end');
        if (isSelected && calendarSelection.start) {
          clearCalendarSelection();
          setDashboardMessage('Selection cleared.', 'info');
          return;
        }

        if (!calendarSelection.start) {
          calendarSelection.start = date;
          calendarSelection.end = null;
          highlightCalendarRange(date, date);
          updateSelectionInfo();
          setDashboardMessage('Selected check-in date. Please select the last consecutive green day.', 'info');
          return;
        }

        const startDate = new Date(calendarSelection.start);
        const endDate = new Date(date);
        if (endDate <= startDate) {
          calendarSelection.start = date;
          calendarSelection.end = null;
          highlightCalendarRange(date, date);
          updateSelectionInfo();
          setDashboardMessage('Start date updated. Now select a later end date.', 'info');
          return;
        }

        let current = new Date(startDate);
        const rangeDates = [];
        while (current <= endDate) {
          rangeDates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }

        const allAvailable = rangeDates.every((rangeDate) => {
          const rangeCell = calendarEl.querySelector(`td.available[data-date="${rangeDate}"]`);
          return Boolean(rangeCell);
        });

        if (!allAvailable) {
          setDashboardMessage('Please select a fully consecutive green range with no booked days.', 'error');
          return;
        }

        calendarSelection.end = date;
        highlightCalendarRange(calendarSelection.start, calendarSelection.end);
        updateSelectionInfo();
        setDashboardMessage('Date range selected. Click Confirm Reservation to finalize.', 'info');
      });
    });
  }

  function updateSelectionInfo() {
    if (!selectedRangeTextEl || !selectionInfoEl) return;
    if (calendarSelection.start && calendarSelection.end) {
      const nights = calculateNights(calendarSelection.start, calendarSelection.end);
      const total = (nights * currentUnitRate).toFixed(2);
      selectedRangeTextEl.textContent = `${calendarSelection.start} → ${calendarSelection.end} (${nights} nights, $${total})`;
      selectionInfoEl.style.display = 'block';
      if (confirmReservationBtn) confirmReservationBtn.disabled = false;
    } else if (calendarSelection.start) {
      selectedRangeTextEl.textContent = `${calendarSelection.start} → ...`;
      selectionInfoEl.style.display = 'block';
      if (confirmReservationBtn) confirmReservationBtn.disabled = true;
    } else {
      resetCalendarSelectionDisplay();
    }
  }

  function highlightCalendarRange(start, end) {
    const calendarEl = document.getElementById('unitCalendar');
    if (!calendarEl) return;
    calendarEl.querySelectorAll('td').forEach((cell) => {
      cell.classList.remove('calendar-selected');
      cell.classList.remove('calendar-start');
      cell.classList.remove('calendar-end');
    });

    let current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const cell = calendarEl.querySelector(`td[data-date="${dateStr}"]`);
      if (cell && cell.classList.contains('available')) {
        cell.classList.add('calendar-selected');
      }
      current.setDate(current.getDate() + 1);
    }

    const startCell = calendarEl.querySelector(`td[data-date="${start}"]`);
    const endCell = calendarEl.querySelector(`td[data-date="${end}"]`);
    if (startCell) startCell.classList.add('calendar-start');
    if (endCell) endCell.classList.add('calendar-end');
  }

  function calculateNights(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) return 0;
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((endDate - startDate) / msPerDay);
  }

  async function confirmCalendarReservation() {
    if (!calendarSelection.unit_id || !calendarSelection.start || !calendarSelection.end) {
      setDashboardMessage('Please select a start and end date before confirming.', 'error');
      return;
    }

    const endDate = new Date(calendarSelection.end);
    endDate.setDate(endDate.getDate() + 1);
    const checkOut = endDate.toISOString().split('T')[0];

    setDashboardMessage('Confirming reservation...', 'info');
    try {
      await apiFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          unit_id: Number(calendarSelection.unit_id),
          check_in: calendarSelection.start,
          check_out: checkOut,
          adults: 1,
          children: 0
        })
      });
      setDashboardMessage(`Reservation confirmed for ${calendarSelection.start} to ${checkOut}.`, 'success');
      await loadReservations();
      await loadInvoices();
      await loadCalendar(calendarSelection.unit_id);
      setTimeout(() => { if (window.switchDashTab) window.switchDashTab('panel-bookings'); }, 1200);
    } catch (err) {
      setDashboardMessage(err.message || 'Reservation confirmation failed.', 'error');
      console.error('Confirm reservation error:', err);
    }
  }

  async function loadReservations() {
    try {
      const rows = await apiFetch('/api/reservations/mine');
      const container = document.getElementById('myReservations');
      if (!container) return;

      // Update stats
      const resCountEl = document.getElementById('statResCount');
      if (resCountEl) resCountEl.textContent = rows.length;
      const nextEl = document.getElementById('statNextCheckIn');
      if (nextEl) {
        const upcoming = rows.filter(r => new Date(r.check_in) >= new Date()).sort((a,b) => new Date(a.check_in) - new Date(b.check_in));
        nextEl.textContent = upcoming.length ? formatDate(upcoming[0].check_in) : '–';
      }
      const badge = document.getElementById('bookingsBadge');
      if (badge && rows.length) badge.textContent = ` (${rows.length})`;

      if (!rows.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No active reservations yet.<br>Head to Browse &amp; Book to get started.</p></div>';
        return;
      }

      container.innerHTML = '';
      rows.forEach((r) => {
        const nights = calculateNights(r.check_in, r.check_out);
        const total  = (r.nightly_rate * nights).toFixed(2);

        const n = document.createElement('div');
        n.className = 'res-card';
        n.innerHTML = `
          <div class="res-card-left">
            <h4>${unitEmoji(r.type_name)} ${r.unit_code} – ${r.type_name}</h4>
            <p>📅 ${formatDate(r.check_in)} → ${formatDate(r.check_out)} &nbsp;·&nbsp; ${nights} night${nights !== 1 ? 's' : ''}</p>
            <p>👥 ${r.adults} adult${r.adults !== 1 ? 's' : ''} &nbsp;·&nbsp; $${Number(r.nightly_rate).toFixed(2)}/night</p>
          </div>
          <div style="text-align:right">
            <div class="res-card-price">$${total}</div>
            <div class="res-card-sub">total</div>
            <button class="btn-ghost" style="margin-top:10px;font-size:12px;color:#dc2626;border-color:#fca5a5">Cancel</button>
          </div>
        `;
        const btn = n.querySelector('button');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await apiFetch(`/api/reservations/${r.reservation_id}/cancel`, { method: 'POST' });
            n.remove();
            await loadReservations();
            await loadInvoices();
          } catch (err) {
            setDashboardMessage(err.message || 'Cancel failed.', 'error');
            btn.disabled = false;
          }
        });
        container.appendChild(n);
      });
    } catch (err) {
      console.error('Load reservations error:', err);
      setDashboardMessage('Unable to load your reservations.', 'error');
    }
  }

  async function loadInvoices() {
    const container = document.getElementById('myInvoices');
    if (!container) return;
    try {
      const rows = await apiFetch('/api/invoices/mine');

      // Update unpaid stat
      const unpaidEl = document.getElementById('statUnpaidCount');
      if (unpaidEl) unpaidEl.textContent = rows.filter(r => r.invoice_status === 'unpaid').length;

      if (!rows.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No invoices yet.</p></div>';
        return;
      }
      container.innerHTML = '';
      rows.forEach((inv) => {
        const el = document.createElement('div');
        el.className = `invoice-card ${inv.invoice_status}`;
        el.innerHTML = `
          <div>
            <div style="font-weight:700;color:var(--accent-deep);font-size:15px">${inv.unit_code} – ${inv.type_name}</div>
            <div style="font-size:13px;color:var(--muted);margin-top:3px">${formatDate(inv.check_in)} → ${formatDate(inv.check_out)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.2rem;font-weight:800;color:var(--accent-deep)">$${Number(inv.total_amount).toFixed(2)}</div>
            <span class="invoice-badge ${inv.invoice_status}">${inv.invoice_status}</span>
          </div>
        `;
        container.appendChild(el);
      });
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><p>Unable to load invoices.</p></div>';
    }
  }

  function wireTicketForm(units) {
    const ticketUnitSelect = document.getElementById('ticketUnit');
    if (!ticketUnitSelect) return;

    ticketUnitSelect.innerHTML = '<option value="" disabled selected>Select a unit</option>';
    units.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.unit_id;
      opt.textContent = `${u.unit_code} – ${u.type_name}`;
      ticketUnitSelect.appendChild(opt);
    });

    const ticketForm = document.getElementById('ticketForm');
    const ticketMessageEl = document.getElementById('ticketMessage');

    function setTicketMessage(text, type = 'info') {
      if (!ticketMessageEl) return;
      ticketMessageEl.style.display = 'block';
      ticketMessageEl.className = `message-box ${type}`;
      ticketMessageEl.textContent = text;
    }

    if (ticketForm) {
      ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const unit_id = ticketUnitSelect.value;
        const ticket_type = document.getElementById('ticketType').value;
        const title = document.getElementById('ticketTitle').value.trim();
        const description = document.getElementById('ticketDesc').value.trim();

        if (!unit_id || !title) {
          setTicketMessage('Unit and title are required.', 'error');
          return;
        }

        try {
          await apiFetch('/api/tickets', {
            method: 'POST',
            body: JSON.stringify({ unit_id: Number(unit_id), ticket_type, title, description })
          });
          setTicketMessage('Ticket submitted successfully.', 'success');
          ticketForm.reset();
        } catch (err) {
          setTicketMessage(err.message, 'error');
        }
      });
    }
  }

  if (welcomeEl) {
    (async () => {
      try {
        const me = await apiFetch('/api/auth/me');
        const user = me.user;
        if (user) {
          welcomeEl.textContent = `Welcome, ${user.first_name} ${user.last_name}`;
          if (user.role_name === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'inline-block';
          }
        } else {
          welcomeEl.textContent = 'Welcome, Guest';
        }
      } catch (err) {
        welcomeEl.textContent = 'Welcome';
      }
    })();

    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
      profileAvatar.src = '/avatar.svg';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
          // ignore
        }
        window.location.href = '/';
      });
    }

    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) {
      reservationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const msgEl = document.getElementById('reservationMessage');
        const unit_id = Number(document.getElementById('quickUnitId').value);
        const check_in  = document.getElementById('checkIn').value;
        const check_out = document.getElementById('checkOut').value;
        const adults    = Number(document.getElementById('adults').value) || 1;

        function setFormMsg(text, type) {
          if (!msgEl) return;
          msgEl.style.display = 'block';
          msgEl.className = `message-box ${type}`;
          msgEl.textContent = text;
        }

        if (!unit_id || !check_in || !check_out) {
          setFormMsg('Unit, check-in and check-out are required.', 'error');
          return;
        }
        if (new Date(check_in) >= new Date(check_out)) {
          setFormMsg('Check-out must be after check-in.', 'error');
          return;
        }

        try {
          await apiFetch('/api/reservations', {
            method: 'POST',
            body: JSON.stringify({ unit_id, check_in, check_out, adults, children: 0 })
          });
          setFormMsg('Reservation created! Switching to My Bookings…', 'success');
          reservationForm.reset();
          await loadReservations();
          await loadInvoices();
          setTimeout(() => { if (window.switchDashTab) window.switchDashTab('panel-bookings'); }, 900);
        } catch (error) {
          setFormMsg(error.message, 'error');
        }
      });
    }

    const units = await loadUnits();
    wireTicketForm(units || []);
    await loadReservations();
    await loadInvoices();
  }
});