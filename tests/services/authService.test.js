jest.mock('../../repositories/userRepository');
jest.mock('bcrypt');

const userRepo   = require('../../repositories/userRepository');
const bcrypt     = require('bcrypt');
const authService = require('../../services/auth');

describe('authService.findByEmail', () => {
  it('delegates to userRepo.findByEmail', async () => {
    const user = { user_id: 1, email: 'a@b.com' };
    userRepo.findByEmail.mockResolvedValue(user);
    const result = await authService.findByEmail('a@b.com');
    expect(userRepo.findByEmail).toHaveBeenCalledWith('a@b.com');
    expect(result).toBe(user);
  });

  it('returns null when user does not exist', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    const result = await authService.findByEmail('missing@x.com');
    expect(result).toBeNull();
  });
});

describe('authService.register', () => {
  it('hashes the password and inserts the user', async () => {
    bcrypt.hash.mockResolvedValue('hashed_pw');
    userRepo.insert.mockResolvedValue(42);
    const newUser = { user_id: 42, first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com', role_name: 'guest' };
    userRepo.findById.mockResolvedValue(newUser);

    const result = await authService.register({
      first_name: 'Alice', last_name: 'Smith',
      email: 'alice@test.com', password: 'secret123',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
    expect(userRepo.insert).toHaveBeenCalledWith({
      first_name: 'Alice', last_name: 'Smith',
      email: 'alice@test.com', passwordHash: 'hashed_pw',
    });
    expect(userRepo.findById).toHaveBeenCalledWith(42);
    expect(result).toBe(newUser);
  });
});

describe('authService.verifyPassword', () => {
  it('returns true when password matches hash', async () => {
    bcrypt.compare.mockResolvedValue(true);
    const result = await authService.verifyPassword('mypassword', '$2b$hash');
    expect(bcrypt.compare).toHaveBeenCalledWith('mypassword', '$2b$hash');
    expect(result).toBe(true);
  });

  it('returns false when password does not match', async () => {
    bcrypt.compare.mockResolvedValue(false);
    const result = await authService.verifyPassword('wrong', '$2b$hash');
    expect(result).toBe(false);
  });
});
