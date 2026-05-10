const { AppError, NotFoundError, ConflictError, ValidationError, ForbiddenError } = require('../errors');

describe('AppError', () => {
  it('sets message, status, and code', () => {
    const err = new AppError('something broke', 500, 'INTERNAL');
    expect(err.message).toBe('something broke');
    expect(err.status).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('NotFoundError', () => {
  it('defaults to 404 NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Not found.');
  });

  it('accepts a custom message', () => {
    const err = new NotFoundError('Unit not found.');
    expect(err.message).toBe('Unit not found.');
    expect(err.status).toBe(404);
  });

  it('is an instance of AppError and Error', () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ConflictError', () => {
  it('defaults to 409 CONFLICT', () => {
    const err = new ConflictError('Already exists.');
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('accepts a custom code', () => {
    const err = new ConflictError('Unit unavailable.', 'UNIT_UNAVAILABLE');
    expect(err.code).toBe('UNIT_UNAVAILABLE');
  });
});

describe('ValidationError', () => {
  it('defaults to 400 VALIDATION_ERROR', () => {
    const err = new ValidationError('Invalid input.');
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('accepts a custom code', () => {
    const err = new ValidationError('Bad token.', 'INVALID_TOKEN');
    expect(err.code).toBe('INVALID_TOKEN');
  });
});

describe('ForbiddenError', () => {
  it('defaults to 403 FORBIDDEN', () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Access denied.');
  });

  it('accepts a custom message', () => {
    const err = new ForbiddenError('Not your reservation.');
    expect(err.message).toBe('Not your reservation.');
  });
});
