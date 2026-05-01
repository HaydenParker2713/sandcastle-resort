// Tab switching
document.querySelectorAll('.fac-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fac-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.fac-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.panel).classList.add('active');
  });
});

// Theme toggle
(function() {
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

// Load events from API
const BANNER_GRADIENTS = [
  'linear-gradient(135deg,#0c4a4a,#0ea5a4)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#0369a1,#38bdf8)',
  'linear-gradient(135deg,#065f46,#10b981)',
  'linear-gradient(135deg,#be185d,#f472b6)'
];

function fmtEventDate(dateStr, timeStr) {
  if (!dateStr) return timeStr || '';
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  return timeStr ? `${label} · ${timeStr}` : label;
}

function buildEventCard(ev, idx) {
  const card = document.createElement('div');
  card.className = 'event-card';

  const bannerHTML = ev.image_path
    ? `<img src="${escapeHTML(ev.image_path)}" alt="${escapeHTML(ev.title)}" style="width:100%;height:160px;object-fit:cover;display:block">`
    : `<div class="event-banner" style="background:${BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length]}">${escapeHTML(ev.banner_emoji || '🎉')}</div>`;

  card.innerHTML = `
    ${bannerHTML}
    <div class="event-body">
      <div class="event-date">${fmtEventDate(ev.event_date, ev.event_time)}</div>
      <h4 class="event-title">${escapeHTML(ev.title)}</h4>
      <p class="event-desc">${escapeHTML(ev.description || '')}</p>
      <div class="event-meta">
        ${ev.location   ? `<span>📍 ${escapeHTML(ev.location)}</span>` : ''}
        ${ev.ticket_info ? `<span>🎟️ ${escapeHTML(ev.ticket_info)}</span>` : ''}
      </div>
    </div>`;
  return card;
}

async function loadEvents() {
  const grid = document.getElementById('eventsGrid');
  try {
    const res  = await fetch('/api/events');
    const events = await res.json();
    grid.innerHTML = '';
    if (!events.length) {
      grid.innerHTML = '<p class="muted" style="font-size:14px">No upcoming events posted yet. Check back soon!</p>';
      return;
    }
    events.forEach((ev, i) => grid.appendChild(buildEventCard(ev, i)));
  } catch {
    grid.innerHTML = '<p class="muted">Could not load events.</p>';
  }
}

loadEvents();

// ── Bar & Dining ──────────────────────────────────────────────────────
async function loadBarMenu() {
  const container = document.getElementById('barMenuContainer');
  if (!container) return;
  try {
    const res   = await fetch('/api/bar');
    const items = await res.json();
    if (!items.length) {
      container.innerHTML = '<p class="muted" style="font-size:14px">Menu coming soon — check back later!</p>';
      return;
    }
    const byCategory = {};
    items.forEach(item => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    });
    container.innerHTML = Object.entries(byCategory).map(([cat, catItems]) => `
      <div class="menu-category">
        <h3>${escapeHTML(cat)}</h3>
        <div class="menu-grid">
          ${catItems.map(item => `
            <div class="menu-item">
              <div class="menu-item-info">
                <h4>${escapeHTML(item.name)}</h4>
                ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
              </div>
              <div class="menu-price">${item.price != null ? '$' + Number(item.price).toFixed(2) : ''}</div>
            </div>`).join('')}
        </div>
      </div>`).join('');
  } catch {
    container.innerHTML = '<p class="muted">Could not load menu.</p>';
  }
}

// ── Activities ────────────────────────────────────────────────────────
async function loadActivities() {
  const container = document.getElementById('activitiesContainer');
  if (!container) return;
  try {
    const res   = await fetch('/api/activity-items');
    const items = await res.json();
    if (!items.length) {
      container.innerHTML = '<p class="muted" style="font-size:14px">Activities coming soon — check back later!</p>';
      return;
    }
    container.innerHTML = items.map(item => {
      const tags = (item.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const tagHtml = tags.map(t => {
        const cls = /free/i.test(t) ? 'free' : /\$|per /i.test(t) ? 'paid' : '';
        return `<span class="activity-tag ${cls}">${escapeHTML(t)}</span>`;
      }).join('');
      return `
        <div class="activity-card">
          <div class="activity-icon">${escapeHTML(item.icon || '🏄')}</div>
          <h3>${escapeHTML(item.name)}</h3>
          ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
          ${tagHtml ? `<div class="activity-tags">${tagHtml}</div>` : ''}
        </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<p class="muted">Could not load activities.</p>';
  }
}

loadBarMenu();
loadActivities();
