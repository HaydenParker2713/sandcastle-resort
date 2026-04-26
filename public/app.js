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

  async function loadUnits() {
    try {
      const units = await apiFetch('/api/units');
      const unitSelect = document.getElementById('unitId');
      const gallery = document.getElementById('roomGallery');

      if (unitSelect) {
        unitSelect.innerHTML = '<option value="" disabled selected>Select a unit</option>';
        units.forEach((unit) => {
          const opt = document.createElement('option');
          opt.value = unit.unit_id;
          opt.textContent = `${unit.unit_code} (${unit.type_name}, ${unit.status})`;
          unitSelect.appendChild(opt);
        });

        // Add event listener to update view when unit is selected from dropdown
        unitSelect.addEventListener('change', () => {
          const selectedUnitId = unitSelect.value;
          if (selectedUnitId) {
            const selectedUnit = units.find(u => u.unit_id == selectedUnitId);
            if (selectedUnit) {
              selectUnit(selectedUnit);
            }
          }
        });
      }

      if (gallery) {
        gallery.innerHTML = '';
        const imageChoices = [
          '/room1.svg', '/room2.svg', '/room3.svg', '/room4.svg', '/room5.svg',
          '/room6.svg', '/room7.svg', '/room8.svg', '/room9.svg', '/room10.svg'
        ];

        units.forEach((unit, index) => {
          const imageSrc = imageChoices[index % imageChoices.length];
          unit.imageSrc = imageSrc;

          const thumb = document.createElement('div');
          thumb.className = 'thumb';
          thumb.innerHTML = `
            <img src="${imageSrc}" alt="room ${unit.unit_code}" />
            <p><strong>${unit.unit_code}</strong> (ID: ${unit.unit_id})</p>
          `;
          thumb.style.cursor = 'pointer';
          thumb.addEventListener('click', () => {
            selectUnit(unit);
          });
          gallery.appendChild(thumb);
        });
      }
    } catch (error) {
      setDashboardMessage('Unable to load units.', 'error');
      console.error('Load units error:', error);
    }
  }

  function selectUnit(unit) {
    document.getElementById('unitId').value = unit.unit_id;
    currentUnitRate = Number(unit.nightly_rate);
    const detailsEl = document.getElementById('unitDetails');
    detailsEl.style.display = 'block';
    const imageSrc = unit.imageSrc || '/room1.svg';
    detailsEl.innerHTML = `
      <h3>Room Views for ${unit.unit_code}</h3>
      <img src="${imageSrc}" alt="room view for ${unit.unit_code}" style="width: 300px; height: auto;" />
      <p><strong>Type:</strong> ${unit.type_name}</p>
      <p><strong>Capacity:</strong> ${unit.capacity}</p>
      <p><strong>Nightly Rate:</strong> $${Number(unit.nightly_rate).toFixed(2)}</p>
      <p><strong>Status:</strong> ${unit.status}</p>
    `;
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
      await loadCalendar(calendarSelection.unit_id);
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

      if (!rows.length) {
        container.textContent = 'No reservations yet.';
        return;
      }

      container.innerHTML = '';
      rows.forEach((r) => {
        const nights = calculateNights(r.check_in, r.check_out);
        const total = (r.nightly_rate * nights).toFixed(2);

        const n = document.createElement('div');
        n.className = 'card';
        n.style.marginBottom = '10px';
        n.innerHTML = `
          <p><strong>${r.unit_code} (${r.type_name})</strong></p>
          <p>Check-in: ${formatDate(r.check_in)} | Check-out: ${formatDate(r.check_out)} | Nights: ${nights}</p>
          <p>Adults: ${r.adults} | Status: ${r.status}</p>
          <p>Rate: $${Number(r.nightly_rate).toFixed(2)} / night | Total cost: $${total}</p>
          <button class="btn-ghost" data-id="${r.reservation_id}">Cancel</button>
        `;
        const btn = n.querySelector('button');
        btn.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/reservations/${r.reservation_id}/cancel`, { method: 'POST' });
            setDashboardMessage('Reservation cancelled.', 'success');
            n.remove();
            if (!container.querySelector('.card')) {
              container.textContent = 'No reservations yet.';
            }
          } catch (err) {
            setDashboardMessage(err.message || 'Cancel failed.', 'error');
          }
        });
        container.appendChild(n);
      });
    } catch (err) {
      console.error('Load reservations error:', err);
      setDashboardMessage('Unable to load your reservations.', 'error');
    }
  }

  if (welcomeEl) {
    (async () => {
      try {
        const me = await apiFetch('/api/auth/me');
        const user = me.user;
        if (user) {
          welcomeEl.textContent = `Welcome, ${user.first_name} ${user.last_name}`;
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
        const unit_id = Number(document.getElementById('unitId').value);
        const check_in = document.getElementById('checkIn').value;
        const check_out = document.getElementById('checkOut').value;
        const adults = Number(document.getElementById('adults').value) || 1;

        if (!unit_id || !check_in || !check_out) {
          setDashboardMessage('Unit, check-in and check-out are required.', 'error');
          return;
        }

        if (new Date(check_in) >= new Date(check_out)) {
          setDashboardMessage('Check-out must be after check-in.', 'error');
          return;
        }

        try {
          await apiFetch('/api/reservations', {
            method: 'POST',
            body: JSON.stringify({ unit_id, check_in, check_out, adults, children: 0 })
          });
          setDashboardMessage('Reservation created successfully.', 'success');
          reservationForm.reset();
          await loadReservations();
        } catch (error) {
          setDashboardMessage(error.message, 'error');
        }
      });
    }

    await loadUnits();
    await loadReservations();
  }
});