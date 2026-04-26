function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function requireRole(...allowedRoles) {
  const normalized = allowedRoles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userRole = String(req.session.user.role_name || '').toLowerCase();
    if (!normalized.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};