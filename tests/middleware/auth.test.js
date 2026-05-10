const { requireAuth, requireRole } = require('../../middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  it('calls next() when session.user is set', () => {
    const req  = { session: { user: { user_id: 1, role_name: 'guest' } } };
    const res  = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when session is missing', () => {
    const req  = { session: {} };
    const res  = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.session is null', () => {
    const req  = { session: null };
    const res  = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('returns an array of two middleware functions', () => {
    const mw = requireRole('admin');
    expect(Array.isArray(mw)).toBe(true);
    expect(mw).toHaveLength(2);
  });

  it('calls next() when role matches', () => {
    const [auth, roleCheck] = requireRole('admin');
    const req  = { session: { user: { user_id: 1, role_name: 'admin' } } };
    const res  = mockRes();
    const next = jest.fn();
    auth(req, res, next);
    roleCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('returns 403 when role does not match', () => {
    const [, roleCheck] = requireRole('admin');
    const req  = { session: { user: { user_id: 1, role_name: 'guest' } } };
    const res  = mockRes();
    const next = jest.fn();
    roleCheck(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows any of multiple roles', () => {
    const [, roleCheck] = requireRole('admin', 'staff');
    const staffReq = { session: { user: { role_name: 'staff' } } };
    const adminReq = { session: { user: { role_name: 'admin' } } };
    const res  = mockRes();
    const next = jest.fn();
    roleCheck(staffReq, res, next);
    roleCheck(adminReq, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('is case-insensitive for role names', () => {
    const [, roleCheck] = requireRole('Admin');
    const req  = { session: { user: { role_name: 'admin' } } };
    const res  = mockRes();
    const next = jest.fn();
    roleCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
