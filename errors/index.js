class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code   = code;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found.') { super(message, 404, 'NOT_FOUND'); }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') { super(message, 409, code); }
}

class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') { super(message, 400, code); }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied.') { super(message, 403, 'FORBIDDEN'); }
}

module.exports = { AppError, NotFoundError, ConflictError, ValidationError, ForbiddenError };
