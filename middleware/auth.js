// ── Auth middleware ──────────────────────────────────────────────────────────
// These two functions are used as Express route middleware to protect endpoints.
// They rely on express-session: after login, req.session.user is set server-side.

// requireAuth — gates any route that needs a logged-in user.
// If no session exists the request is rejected with 401 (Unauthorized).
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

// requireRole(...roles) — returns middleware that first calls requireAuth,
// then checks whether the session user's role is in the allowed list.
// Usage: router.get('/', requireRole('admin', 'staff'), handler)
// Returns 403 (Forbidden) if the role doesn't match.
function requireRole(...allowedRoles) {
  const normalized = allowedRoles.map(r => String(r).toLowerCase());
  return [
    requireAuth,
    (req, res, next) => {
      const userRole = String(req.session.user.role_name || '').toLowerCase();
      if (!normalized.includes(userRole)) {
        return res.status(403).json({ error: 'Access denied.' });
      }
      next();
    }
  ];
}

module.exports = { requireAuth, requireRole };
