// ── Shared utilities (loaded on every page via <script src="/api.js">) ────────

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

// Converts ISO date strings and Date objects to a localised readable date.
// Handles plain "YYYY-MM-DD" without timezone conversion (avoids off-by-one day).
function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString();
}

// Renders a coloured pill badge — colour controlled by CSS .badge-{cls} rules
function badge(text, cls) {
  return `<span class="badge badge-${escapeHTML(cls)}">${escapeHTML(text)}</span>`;
}

// Maps room type name to a fallback gradient colour used behind room images
function unitGradient(typeName) {
  const t = (typeName || '').toLowerCase();
  if (t.includes('oceanfront'))  return 'linear-gradient(135deg,#0c4a6e,#0ea5e9)';
  if (t.includes('poolside'))    return 'linear-gradient(135deg,#065f46,#10b981)';
  if (t.includes('queen'))       return 'linear-gradient(135deg,#4c1d95,#8b5cf6)';
  if (t.includes('two bedroom')) return 'linear-gradient(135deg,#7c2d12,#f97316)';
  if (t.includes('one bedroom')) return 'linear-gradient(135deg,#1e3a5f,#3b82f6)';
  if (t.includes('studio'))      return 'linear-gradient(135deg,#713f12,#eab308)';
  return                                'linear-gradient(135deg,#374151,#6b7280)';
}

// Maps room type name to a representative emoji icon
function unitEmoji(typeName) {
  const t = (typeName || '').toLowerCase();
  if (t.includes('oceanfront')) return '🌊';
  if (t.includes('poolside'))   return '🏊';
  if (t.includes('two bedroom'))return '🏠';
  if (t.includes('queen'))      return '👑';
  if (t.includes('studio'))     return '🏖️';
  return '🛏️';
}

// Maps room type name to an illustrated SVG scene
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
