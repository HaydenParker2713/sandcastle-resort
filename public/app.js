// ── app.js — Guest dashboard logic (dashboard.html) ───────────────────────────
// This file is loaded on both the login/register page AND the dashboard page.
// It detects which elements exist and only wires up what's present.

// ── Theme & Avatar ────────────────────────────────────────────────────────────
// Emoji avatars — stored in localStorage, no backend needed
const AVATARS = ['🏄','🌊','🏖️','🐚','⛵','🌴','🦀','🐬','🌺','🤿','🏝️','🦈'];
const DEFAULT_AVATAR = '🏄';

// Apply a theme (light/dark) to the document and persist the choice
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sc_theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  // Sync the explicit Light/Dark choice buttons in the Account panel
  const lightBtn = document.getElementById('themeLightBtn');
  const darkBtn  = document.getElementById('themeDarkBtn');
  if (lightBtn) lightBtn.classList.toggle('active', theme === 'light');
  if (darkBtn)  darkBtn.classList.toggle('active',  theme === 'dark');
}

// Save chosen avatar emoji to localStorage and update the header avatar display
function applyAvatar(emoji) {
  localStorage.setItem('sc_avatar', emoji);
  const el = document.getElementById('profileAvatar');
  if (el) el.textContent = emoji;
}

// Run immediately so theme and avatar are applied before the page renders
// (prevents a flash of wrong colours / missing avatar)
(function initPrefs() {
  const theme  = localStorage.getItem('sc_theme')  || 'light';
  const avatar = localStorage.getItem('sc_avatar') || DEFAULT_AVATAR;
  applyTheme(theme);
  const el = document.getElementById('profileAvatar');
  if (el) el.textContent = avatar;
})();

// ── Avatar picker ─────────────────────────────────────────────────────────────
// Builds a row of clickable emoji buttons in the #avatarPicker container.
// Clicking one saves to localStorage and updates the header avatar immediately.
function initAvatarPicker() {
  const picker = document.getElementById('avatarPicker');
  if (!picker) return;
  const current = localStorage.getItem('sc_avatar') || DEFAULT_AVATAR;
  AVATARS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.className = 'avatar-option' + (emoji === current ? ' selected' : '');
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      applyAvatar(emoji);
    });
    picker.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAvatarPicker();

  // Toggle button in the nav bar
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Explicit Light / Dark buttons inside the Account panel
  const themeLightBtn = document.getElementById('themeLightBtn');
  const themeDarkBtn  = document.getElementById('themeDarkBtn');
  if (themeLightBtn) themeLightBtn.addEventListener('click', () => applyTheme('light'));
  if (themeDarkBtn)  themeDarkBtn.addEventListener('click',  () => applyTheme('dark'));
});

// ── Shared utilities ──────────────────────────────────────────────────────────
// Shows a coloured status message in #messageBox
function setMessage(message, type = "info") {
  const box = document.getElementById("messageBox");
  if (!box) return;
  box.className = `message-box ${type}`;
  box.textContent = message;
}

// Converts ISO date strings and Date objects to a localised readable date.
// Handles plain "YYYY-MM-DD" without converting to UTC (avoids off-by-one day).
function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString();
}

// ── Main DOMContentLoaded ─────────────────────────────────────────────────────
// Everything below is dashboard-specific and runs only after the DOM is ready.
document.addEventListener("DOMContentLoaded", async () => {
  // ── Login / register forms (index.html) ────────────────────────────────────
  // These forms only exist on index.html; on dashboard.html they are not present.
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
          body: JSON.stringify({ first_name, last_name, email, password })
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
          body: JSON.stringify({ email, password })
        });
        setMessage(result.message || "Login successful.", "success");
        loginForm.reset();
        window.location.href = '/dashboard';
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  // ── Dashboard section — only runs when #welcomeText exists (dashboard.html) ─
  const welcomeEl = document.getElementById('welcomeText');
  const dashboardMessageEl = document.getElementById('reservationMessage');

  function setDashboardMessage(text, type = 'info') {
    if (!dashboardMessageEl) return;
    dashboardMessageEl.style.display = 'block';
    dashboardMessageEl.className = `message-box ${type}`;
    dashboardMessageEl.textContent = text;
  }

  // ── Calendar state ────────────────────────────────────────────────────────
  // Tracks which unit the user has selected and which date range they are picking.
  const calendarSelection = {
    unit_id: null,
    start: null,
    end: null
  };

  let currentUnitRate = null; // used to calculate cost estimate as dates are selected

  const selectionInfoEl       = document.getElementById('calendarSelectionInfo');
  const selectedRangeTextEl   = document.getElementById('selectedRangeText');
  const confirmReservationBtn = document.getElementById('confirmReservationBtn');
  const clearSelectionBtn     = document.getElementById('clearSelectionBtn');
  const prevMonthBtn          = document.getElementById('prevMonthBtn');
  const nextMonthBtn          = document.getElementById('nextMonthBtn');
  const calendarMonthLabel    = document.getElementById('calendarMonthLabel');
  const yearFilterSelect      = document.getElementById('yearFilterSelect');
  const clearFiltersBtn       = document.getElementById('clearFiltersBtn');

  // Tracks which month/year the calendar is showing
  const calendarMonthState = { year: null, month: null };
  // Optional year filter that locks navigation to a single year
  const calendarYearFilter = { active: false, year: null };

  function resetCalendarSelectionDisplay() {
    if (selectionInfoEl)        selectionInfoEl.style.display = 'none';
    if (selectedRangeTextEl)    selectedRangeTextEl.textContent = 'None';
    if (confirmReservationBtn)  confirmReservationBtn.disabled = true;
  }

  function resetCalendarMonth() {
    const now = new Date();
    calendarMonthState.year  = now.getFullYear();
    calendarMonthState.month = now.getMonth();
  }

  // Updates the "June 2026" label above the calendar
  function updateCalendarLabel() {
    if (!calendarMonthLabel || calendarMonthState.year === null || calendarMonthState.month === null) return;
    const labelDate = new Date(calendarMonthState.year, calendarMonthState.month, 1);
    calendarMonthLabel.textContent = labelDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // Populate year dropdown with a range of years around today
  function populateYearFilterOptions() {
    if (!yearFilterSelect) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    yearFilterSelect.innerHTML = '<option value="">All years</option>';
    for (let year = currentYear - 2; year <= currentYear + 3; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilterSelect.appendChild(option);
    }
  }

  // Disable Prev/Next buttons when at the year boundary (if a year filter is active)
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
      // "All years" selected — remove filter and reset to current month
      calendarYearFilter.active = false;
      calendarYearFilter.year = null;
      resetCalendarMonth();
    } else {
      calendarYearFilter.active = true;
      calendarYearFilter.year = Number(yearValue);
      if (calendarMonthState.month === null) resetCalendarMonth();
      calendarMonthState.year = calendarYearFilter.year; // jump to Jan of selected year
    }
    updateCalendarLabel();
    updateNavButtons();
  }

  function resetFilters() {
    if (yearFilterSelect) yearFilterSelect.value = '';
    calendarYearFilter.active = false;
    calendarYearFilter.year = null;
    resetCalendarMonth();
    updateCalendarLabel();
    updateNavButtons();
    clearCalendarSelection();
  }

  // Clears the highlighted date range and resets the confirmation button
  function clearCalendarSelection() {
    calendarSelection.start = null;
    calendarSelection.end = null;
    resetCalendarSelectionDisplay();
    const calendarEl = document.getElementById('unitCalendar');
    if (!calendarEl) return;
    calendarEl.querySelectorAll('td').forEach((cell) => {
      cell.classList.remove('calendar-selected', 'calendar-start', 'calendar-end');
    });
  }

  // ── Calendar control event listeners ──────────────────────────────────────
  if (confirmReservationBtn) confirmReservationBtn.addEventListener('click', confirmCalendarReservation);
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      clearCalendarSelection();
      setDashboardMessage('Selection cleared.', 'info');
    });
  }
  if (yearFilterSelect) {
    populateYearFilterOptions();
    yearFilterSelect.addEventListener('change', (event) => {
      applyYearFilter(event.target.value);
      if (calendarSelection.unit_id) loadCalendar(calendarSelection.unit_id);
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      resetFilters();
      setDashboardMessage('Filters removed.', 'info');
      if (calendarSelection.unit_id) loadCalendar(calendarSelection.unit_id);
    });
  }
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      if (!calendarSelection.unit_id) return;
      if (calendarMonthState.month === null || calendarMonthState.year === null) resetCalendarMonth();
      if (calendarYearFilter.active && calendarMonthState.month <= 0) return;
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
      if (calendarMonthState.month === null || calendarMonthState.year === null) resetCalendarMonth();
      if (calendarYearFilter.active && calendarMonthState.month >= 11) return;
      calendarMonthState.month += 1;
      if (calendarMonthState.month > 11) {
        calendarMonthState.month = 0;
        calendarMonthState.year += 1;
      }
      loadCalendar(calendarSelection.unit_id);
    });
  }

  // ── Unit card visual helpers ───────────────────────────────────────────────
  // Match gradient colours and emoji to room type for a visual gallery
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

  // ── Load and render units ──────────────────────────────────────────────────
  // Populates three things at once:
  //   1. A hidden <select> used internally for the calendar logic
  //   2. A quick-book <select> with rate shown
  //   3. A visual gallery of clickable unit cards
  async function loadUnits() {
    try {
      const units = await apiFetch('/api/units');

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

      const quickSelect = document.getElementById('quickUnitId');
      if (quickSelect) {
        quickSelect.innerHTML = '<option value="" disabled selected>Select a unit</option>';
        units.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.unit_id;
          opt.textContent = `${u.unit_code} – ${u.type_name} ($${Number(u.nightly_rate).toFixed(0)}/night)`;
          if (u.status !== 'available') opt.disabled = true; // grey out unavailable units
          quickSelect.appendChild(opt);
        });
      }

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

  // ── Select a unit ─────────────────────────────────────────────────────────
  // Called when the user clicks a unit card in the gallery.
  // Highlights the card, shows a detail banner, and loads the availability calendar.
  function selectUnit(unit, cardEl) {
    document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');

    const unitSelect = document.getElementById('unitId');
    if (unitSelect) unitSelect.value = unit.unit_id;

    currentUnitRate = Number(unit.nightly_rate);

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

    detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    calendarSelection.unit_id = unit.unit_id;
    calendarSelection.start = null;
    calendarSelection.end = null;
    resetCalendarSelectionDisplay();
    resetCalendarMonth();
    loadCalendar(unit.unit_id);
  }

  // ── Availability calendar ─────────────────────────────────────────────────
  // Renders a month grid for the selected unit, colouring days as:
  //   past     — greyed out, not selectable
  //   booked   — red/hatched, not selectable
  //   available — green, clickable for date range selection
  async function loadCalendar(unit_id) {
    try {
      calendarSelection.unit_id = unit_id;
      calendarSelection.start = null;
      calendarSelection.end = null;
      resetCalendarSelectionDisplay();

      if (calendarMonthState.year === null || calendarMonthState.month === null) resetCalendarMonth();
      if (calendarYearFilter.active && calendarYearFilter.year !== null) {
        calendarMonthState.year = calendarYearFilter.year;
      }
      updateCalendarLabel();
      updateNavButtons();

      // Fetch confirmed bookings for this unit to mark booked days
      const bookings = await apiFetch(`/api/units/${unit_id}/availability`);
      const calendarEl = document.getElementById('unitCalendar');
      const calendarSection = document.getElementById('calendarSection');
      calendarSection.style.display = 'block';

      const year  = calendarMonthState.year;
      const month = calendarMonthState.month;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay    = new Date(year, month, 1).getDay(); // 0=Sun

      let html = `<h3>Availability for Unit ${unit_id} - ${new Date(year, month, 1).toLocaleString('default', { month: 'long' })} ${year}</h3>`;
      html += '<table style="border-collapse: collapse; width: 100%;">';
      html += '<tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr><tr>';

      for (let i = 0; i < firstDay; i++) html += '<td></td>'; // padding cells

      for (let day = 1; day <= daysInMonth; day++) {
        const date    = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const today   = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if any existing booking covers this date
        let isBooked = false;
        bookings.forEach(booking => {
          const checkIn  = new Date(booking.check_in);
          const checkOut = new Date(booking.check_out);
          if (date >= checkIn && date < checkOut) isBooked = true; // check_out day is free (checkout day)
        });

        let className;
        if (date < today)   className = 'past';
        else if (isBooked)  className = 'booked';
        else                className = 'available';

        html += `<td class="${className}" data-date="${dateStr}" style="padding: 10px; text-align: center; border: 1px solid #ddd;">${day}</td>`;
        if ((firstDay + day) % 7 === 0) html += '</tr><tr>'; // start new row each Saturday
      }

      html += '</tr></table>';
      calendarEl.innerHTML = html;
      attachCalendarHandlers(); // wire up click listeners on the newly rendered cells
    } catch (error) {
      setDashboardMessage('Unable to load calendar.', 'error');
      console.error('Load calendar error:', error);
    }
  }

  // ── Calendar date selection ────────────────────────────────────────────────
  // Users click two dates to set check-in and check-out.
  // The range must be fully consecutive available days (no booked gaps allowed).
  function attachCalendarHandlers() {
    const calendarEl = document.getElementById('unitCalendar');
    if (!calendarEl) return;

    const cells = calendarEl.querySelectorAll('td.available');
    cells.forEach((cell) => {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', async () => {
        const date = cell.dataset.date;
        if (!date) return;

        // Clicking a selected cell clears the selection
        const isSelected = cell.classList.contains('calendar-selected') ||
                           cell.classList.contains('calendar-start') ||
                           cell.classList.contains('calendar-end');
        if (isSelected && calendarSelection.start) {
          clearCalendarSelection();
          setDashboardMessage('Selection cleared.', 'info');
          return;
        }

        if (!calendarSelection.start) {
          // First click — set check-in date
          calendarSelection.start = date;
          calendarSelection.end = null;
          highlightCalendarRange(date, date);
          updateSelectionInfo();
          setDashboardMessage('Selected check-in date. Please select the last consecutive green day.', 'info');
          return;
        }

        const startDate = new Date(calendarSelection.start);
        const endDate   = new Date(date);

        // If end is before or equal to start, reset to a new start
        if (endDate <= startDate) {
          calendarSelection.start = date;
          calendarSelection.end = null;
          highlightCalendarRange(date, date);
          updateSelectionInfo();
          setDashboardMessage('Start date updated. Now select a later end date.', 'info');
          return;
        }

        // Collect all dates in the range and verify each has an available cell
        let current = new Date(startDate);
        const rangeDates = [];
        while (current <= endDate) {
          rangeDates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }

        const allAvailable = rangeDates.every((rangeDate) => {
          return Boolean(calendarEl.querySelector(`td.available[data-date="${rangeDate}"]`));
        });

        if (!allAvailable) {
          setDashboardMessage('Please select a fully consecutive green range with no booked days.', 'error');
          return;
        }

        // Valid range — confirm the selection
        calendarSelection.end = date;
        highlightCalendarRange(calendarSelection.start, calendarSelection.end);
        updateSelectionInfo();
        setDashboardMessage('Date range selected. Click Confirm Reservation to finalize.', 'info');
      });
    });
  }

  // Shows the selected date range summary and estimated cost, enables Confirm button
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

  // Adds CSS classes to calendar cells in the selected range
  function highlightCalendarRange(start, end) {
    const calendarEl = document.getElementById('unitCalendar');
    if (!calendarEl) return;
    calendarEl.querySelectorAll('td').forEach((cell) => {
      cell.classList.remove('calendar-selected', 'calendar-start', 'calendar-end');
    });

    let current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const cell = calendarEl.querySelector(`td[data-date="${dateStr}"]`);
      if (cell && cell.classList.contains('available')) cell.classList.add('calendar-selected');
      current.setDate(current.getDate() + 1);
    }

    // Mark the first and last cells distinctly (round corners, darker colour)
    const startCell = calendarEl.querySelector(`td[data-date="${start}"]`);
    const endCell   = calendarEl.querySelector(`td[data-date="${end}"]`);
    if (startCell) startCell.classList.add('calendar-start');
    if (endCell)   endCell.classList.add('calendar-end');
  }

  // Returns number of nights between two ISO date strings
  function calculateNights(start, end) {
    const startDate = new Date(start);
    const endDate   = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) return 0;
    return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  }

  // ── Confirm calendar reservation ───────────────────────────────────────────
  // Adds one day to the selected end date because our calendar lets the user pick
  // the last night they want to stay, but the API expects the actual check-out DATE
  // (the morning they leave, i.e. end + 1 day).
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
      // Refresh both the bookings list and the calendar to reflect the new booking
      await loadReservations();
      await loadInvoices();
      await loadCalendar(calendarSelection.unit_id);
      // Switch to the My Bookings tab automatically after a short delay
      setTimeout(() => { if (window.switchDashTab) window.switchDashTab('panel-bookings'); }, 1200);
    } catch (err) {
      setDashboardMessage(err.message || 'Reservation confirmation failed.', 'error');
      console.error('Confirm reservation error:', err);
    }
  }

  // ── My Reservations ────────────────────────────────────────────────────────
  // Renders each of the user's confirmed reservations as a card.
  // Past stays show a "Leave Review" button (or "Reviewed" if already reviewed).
  // Upcoming stays show a Cancel button.
  async function loadReservations() {
    try {
      const rows = await apiFetch('/api/reservations/mine');
      const container = document.getElementById('myReservations');
      if (!container) return;

      // Update summary stats
      const resCountEl = document.getElementById('statResCount');
      if (resCountEl) resCountEl.textContent = rows.length;
      const nextEl = document.getElementById('statNextCheckIn');
      if (nextEl) {
        const upcoming = rows.filter(r => new Date(r.check_in) >= new Date())
                             .sort((a,b) => new Date(a.check_in) - new Date(b.check_in));
        nextEl.textContent = upcoming.length ? formatDate(upcoming[0].check_in) : '–';
      }
      const badge = document.getElementById('bookingsBadge');
      if (badge && rows.length) badge.textContent = ` (${rows.length})`;

      if (!rows.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No active reservations yet.<br>Head to Browse &amp; Book to get started.</p></div>';
        return;
      }

      // Fetch which reservations already have a review so we can show the correct button state
      let reviewedIds = new Set();
      try {
        const ids = await apiFetch('/api/reviews/mine');
        reviewedIds = new Set(ids);
      } catch {}

      container.innerHTML = '';
      const today = new Date();
      rows.forEach((r) => {
        const nights   = calculateNights(r.check_in, r.check_out);
        const total    = (r.nightly_rate * nights).toFixed(2);
        const isPast   = new Date(r.check_out) < today;
        const reviewed = reviewedIds.has(r.reservation_id);

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
            ${isPast && !reviewed ? `<button class="btn-secondary review-btn" style="margin-top:8px;font-size:12px;padding:5px 12px">⭐ Review</button>` : ''}
            ${isPast && reviewed  ? `<div style="margin-top:8px;font-size:12px;color:#10b981;font-weight:600">✓ Reviewed</div>` : ''}
            ${!isPast ? `<button class="btn-ghost cancel-btn" style="margin-top:10px;font-size:12px;color:#dc2626;border-color:#fca5a5">Cancel</button>` : ''}
          </div>
        `;

        const cancelBtn = n.querySelector('.cancel-btn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', async () => {
            cancelBtn.disabled = true;
            try {
              await apiFetch(`/api/reservations/${r.reservation_id}/cancel`, { method: 'POST' });
              await loadReservations();
              await loadInvoices();
            } catch (err) {
              setDashboardMessage(err.message || 'Cancel failed.', 'error');
              cancelBtn.disabled = false;
            }
          });
        }
        const reviewBtn = n.querySelector('.review-btn');
        if (reviewBtn) {
          reviewBtn.addEventListener('click', () => openReviewModal(r.reservation_id, `${r.unit_code} – ${r.type_name}`));
        }
        container.appendChild(n);
      });
    } catch (err) {
      console.error('Load reservations error:', err);
      setDashboardMessage('Unable to load your reservations.', 'error');
    }
  }

  // ── My Invoices ────────────────────────────────────────────────────────────
  // Shows each invoice (one per reservation) with its paid/unpaid status.
  async function loadInvoices() {
    const container = document.getElementById('myInvoices');
    if (!container) return;
    try {
      const rows = await apiFetch('/api/invoices/mine');

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

  // ── My Tickets ─────────────────────────────────────────────────────────────
  // Shows the guest's own support tickets with live status updates (polled).
  const ticketStatusColors = { open: '#991b1b', in_progress: '#92400e', closed: '#065f46' };
  const ticketStatusBg    = { open: '#fee2e2', in_progress: '#fef3c7', closed: '#d1fae5' };

  async function loadMyTickets() {
    const container = document.getElementById('myTickets');
    if (!container) return;
    try {
      const tickets = await apiFetch('/api/tickets');
      // Flash the live indicator green briefly on each poll
      const indicator = document.getElementById('ticketLiveIndicator');
      if (indicator) {
        indicator.style.color = '#10b981';
        indicator.textContent = '● live';
        setTimeout(() => { indicator.style.color = 'var(--muted)'; }, 1500);
      }
      if (!tickets.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎫</div><p>No tickets submitted yet.</p></div>';
        return;
      }
      container.innerHTML = '';
      tickets.forEach(t => {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 16px;border:1px solid #e8f2f2;border-radius:10px;margin-bottom:10px;background:#fff;flex-wrap:wrap';
        el.innerHTML = `
          <div>
            <div style="font-weight:700;color:var(--accent-deep);font-size:14px">${t.unit_code} · ${t.ticket_type}</div>
            <div style="font-size:14px;margin:3px 0">${t.title}</div>
            ${t.description ? `<div style="font-size:12px;color:var(--muted)">${t.description}</div>` : ''}
            <div style="font-size:12px;color:var(--muted);margin-top:4px">${formatDate(t.created_at)}</div>
          </div>
          <span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap;
            background:${ticketStatusBg[t.status]};color:${ticketStatusColors[t.status]}">
            ${t.status.replace('_', ' ')}
          </span>
        `;
        container.appendChild(el);
      });
    } catch (err) {
      console.error('Load tickets error:', err);
    }
  }

  // ── Ticket submission form ─────────────────────────────────────────────────
  // Populates the unit dropdown with the user's available units and wires
  // the form submit to POST a new ticket.
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

    const ticketForm      = document.getElementById('ticketForm');
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
        const unit_id     = ticketUnitSelect.value;
        const ticket_type = document.getElementById('ticketType').value;
        const title       = document.getElementById('ticketTitle').value.trim();
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
          setTicketMessage('Ticket submitted!', 'success');
          ticketForm.reset();
          await loadMyTickets();
        } catch (err) {
          setTicketMessage(err.message, 'error');
        }
      });
    }
  }

  // ── Dashboard initialisation (runs only when #welcomeText exists) ──────────
  if (welcomeEl) {
    (async () => {
      try {
        const me   = await apiFetch('/api/auth/me');
        const user = me.user;
        if (user) {
          welcomeEl.textContent = `Welcome, ${user.first_name} ${user.last_name}`;
          // Pre-fill the edit profile form fields
          const fn = document.getElementById('profileFirstName');
          if (fn) {
            fn.value = user.first_name;
            document.getElementById('profileLastName').value = user.last_name;
            document.getElementById('profileEmail').value    = user.email;
          }
          // Show the Admin / Staff panel link in the nav if the user has that role
          if (user.role_name === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'inline-block';
          }
          if (user.role_name === 'staff') {
            const staffLink = document.getElementById('staffLink');
            if (staffLink) staffLink.style.display = 'inline-block';
          }
        } else {
          welcomeEl.textContent = 'Welcome, Guest';
        }
      } catch (err) {
        welcomeEl.textContent = 'Welcome';
      }
    })();

    // Sync the avatar from localStorage on load
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
      profileAvatar.textContent = localStorage.getItem('sc_avatar') || DEFAULT_AVATAR;
    }

    // Logout button — calls the API to destroy the server session, then redirects
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
        window.location.href = '/';
      });
    }

    // ── Quick reservation form ───────────────────────────────────────────────
    // An alternative to the calendar — pick unit and dates from dropdowns/inputs.
    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) {
      reservationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const msgEl     = document.getElementById('reservationMessage');
        const unit_id   = Number(document.getElementById('quickUnitId').value);
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

    // Load all data sections, wire the ticket form, then start polling tickets
    const units = await loadUnits();
    wireTicketForm(units || []);
    await loadReservations();
    await loadInvoices();
    await loadMyTickets();

    // Poll ticket status every 15 s so updates from staff appear without refresh
    setInterval(loadMyTickets, 15000);

    // ── Edit profile form ────────────────────────────────────────────────────
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
      editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgBox     = document.getElementById('profileMessage');
        const first_name = document.getElementById('profileFirstName').value.trim();
        const last_name  = document.getElementById('profileLastName').value.trim();
        const email      = document.getElementById('profileEmail').value.trim();
        msgBox.style.display = 'none';
        if (!first_name || !last_name || !email) {
          msgBox.textContent = 'All fields are required.';
          msgBox.className = 'message-box error';
          msgBox.style.display = 'block';
          return;
        }
        const btn = editProfileForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
          const { user } = await apiFetch('/api/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ first_name, last_name, email })
          });
          // Update the welcome text immediately without a page reload
          const welcomeEl = document.getElementById('welcomeText');
          if (welcomeEl) welcomeEl.textContent = `Welcome, ${user.first_name} ${user.last_name}`;
          msgBox.textContent = 'Profile updated successfully.';
          msgBox.className = 'message-box success';
          msgBox.style.display = 'block';
        } catch (err) {
          msgBox.textContent = err.message;
          msgBox.className = 'message-box error';
          msgBox.style.display = 'block';
        } finally {
          btn.disabled = false; btn.textContent = 'Save Changes';
        }
      });
    }

    // ── Review modal ─────────────────────────────────────────────────────────
    // A floating modal that lets the guest pick a star rating and write a comment.
    // Opened when the user clicks "Leave Review" on a past booking card.
    let _reviewReservationId = null;
    let _reviewRating = 0;

    function openReviewModal(reservation_id, unitLabel) {
      _reviewReservationId = reservation_id;
      _reviewRating = 0;
      document.getElementById('reviewModalUnit').textContent = unitLabel;
      document.getElementById('reviewComment').value = '';
      document.getElementById('reviewMessage').style.display = 'none';
      setStars(0);
      document.getElementById('reviewModal').style.display = 'flex';
    }

    // Renders filled (★) and empty (☆) stars based on the current rating
    function setStars(n) {
      _reviewRating = n;
      document.querySelectorAll('#starPicker span').forEach((s, i) => {
        s.textContent  = i < n ? '★' : '☆';
        s.style.color  = i < n ? '#f59e0b' : '#d1d5db';
      });
    }

    // Hovering previews the rating; mouseout restores the committed rating
    document.querySelectorAll('#starPicker span').forEach(s => {
      s.addEventListener('click',     () => setStars(Number(s.dataset.star)));
      s.addEventListener('mouseover', () => {
        document.querySelectorAll('#starPicker span').forEach((x, i) => {
          x.textContent = i < Number(s.dataset.star) ? '★' : '☆';
          x.style.color = i < Number(s.dataset.star) ? '#f59e0b' : '#d1d5db';
        });
      });
      s.addEventListener('mouseout', () => setStars(_reviewRating));
    });

    document.getElementById('reviewCancelBtn').addEventListener('click', () => {
      document.getElementById('reviewModal').style.display = 'none';
    });

    document.getElementById('reviewSubmitBtn').addEventListener('click', async () => {
      const msgBox = document.getElementById('reviewMessage');
      msgBox.style.display = 'none';
      if (!_reviewRating) {
        msgBox.textContent = 'Please select a star rating.';
        msgBox.className = 'message-box error';
        msgBox.style.display = 'block';
        return;
      }
      const btn = document.getElementById('reviewSubmitBtn');
      btn.disabled = true; btn.textContent = 'Submitting...';
      try {
        await apiFetch('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            reservation_id: _reviewReservationId,
            rating:         _reviewRating,
            comment:        document.getElementById('reviewComment').value.trim()
          })
        });
        document.getElementById('reviewModal').style.display = 'none';
        setDashboardMessage('Thanks for your review!', 'success');
        await loadReservations(); // re-render cards to show "Reviewed" state
      } catch (err) {
        msgBox.textContent = err.message;
        msgBox.className = 'message-box error';
        msgBox.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Submit Review';
      }
    });

    // ── Password change form ─────────────────────────────────────────────────
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
      changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgBox           = document.getElementById('pwMessage');
        const current_password = document.getElementById('currentPassword').value;
        const new_password     = document.getElementById('newPassword').value;
        const confirm_password = document.getElementById('confirmPassword').value;

        msgBox.style.display = 'none';

        if (!current_password || !new_password || !confirm_password) {
          msgBox.textContent = 'All fields are required.';
          msgBox.className = 'message-box error';
          msgBox.style.display = 'block';
          return;
        }
        if (new_password.length < 8) {
          msgBox.textContent = 'New password must be at least 8 characters.';
          msgBox.className = 'message-box error';
          msgBox.style.display = 'block';
          return;
        }
        if (new_password !== confirm_password) {
          msgBox.textContent = 'New passwords do not match.';
          msgBox.className = 'message-box error';
          msgBox.style.display = 'block';
          return;
        }

        const btn = changePasswordForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Updating...';
        try {
          await apiFetch('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password, new_password })
          });
          changePasswordForm.reset();
          msgBox.textContent = 'Password updated successfully.';
          msgBox.className = 'message-box success';
          msgBox.style.display = 'block';
        } catch (err) {
          msgBox.textContent = err.message;
          msgBox.className = 'message-box error';
          msgBox.style.display = 'block';
        } finally {
          btn.disabled = false; btn.textContent = 'Update Password';
        }
      });
    }
  }
});
