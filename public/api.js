// ── Shared utilities (loaded on every page via <script src="/api.js">) ────────

// escapeHTML converts special characters to HTML entities so that
// user-supplied strings can safely be inserted with innerHTML without
// creating XSS attack vectors (e.g., a name like <script>alert(1)</script>
// becomes &lt;script&gt;alert(1)&lt;/script&gt; and is rendered as text).
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// apiFetch wraps the native fetch() with sensible defaults:
//   - always sends/receives JSON
//   - includes session cookies (credentials: 'same-origin')
//   - throws a proper Error with the server's error message if the
//     status is not 2xx, so callers can catch a single error type
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
