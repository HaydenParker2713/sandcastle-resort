jest.mock('../../repositories/userRepository');
jest.mock('bcrypt');
jest.mock('crypto');

const userRepo       = require('../../repositories/userRepository');
const bcrypt         = require('bcrypt');
const crypto         = require('crypto');
const passwordService = require('../../services/passwordService');
const { ValidationError } = require('../../errors');

describe('passwordService.changePassword', () => {
  it('hashes the new password and updates the record', async () => {
    bcrypt.hash.mockResolvedValue('new_hash');
    userRepo.updatePassword.mockResolvedValue();
    await passwordService.changePassword(1, 'newSecret99');
    expect(bcrypt.hash).toHaveBeenCalledWith('newSecret99', 10);
    expect(userRepo.updatePassword).toHaveBeenCalledWith(1, 'new_hash');
  });
});

describe('passwordService.createPasswordResetToken', () => {
  it('returns null when email is not found', async () => {
    userRepo.findForReset.mockResolvedValue(null);
    const result = await passwordService.createPasswordResetToken('noone@x.com');
    expect(result).toBeNull();
  });

  it('generates and stores a reset token', async () => {
    const user = { user_id: 7, first_name: 'Sam', email: 'sam@x.com' };
    userRepo.findForReset.mockResolvedValue(user);
    userRepo.setResetToken.mockResolvedValue();
    crypto.randomUUID.mockReturnValue('test-uuid-1234');

    const result = await passwordService.createPasswordResetToken('sam@x.com');
    expect(result.token).toBe('test-uuid-1234');
    expect(result.user).toBe(user);
    expect(userRepo.setResetToken).toHaveBeenCalledWith(7, 'test-uuid-1234', expect.any(String));
  });
});

describe('passwordService.resetPasswordByToken', () => {
  it('throws ValidationError when token is invalid or expired', async () => {
    bcrypt.hash.mockResolvedValue('hash');
    userRepo.resetByToken.mockResolvedValue(0);
    await expect(passwordService.resetPasswordByToken('bad-token', 'newpass')).rejects.toThrow(ValidationError);
  });

  it('succeeds when token is valid', async () => {
    bcrypt.hash.mockResolvedValue('hash');
    userRepo.resetByToken.mockResolvedValue(1);
    await expect(passwordService.resetPasswordByToken('good-token', 'newpass')).resolves.toBeUndefined();
    expect(userRepo.resetByToken).toHaveBeenCalledWith('good-token', 'hash');
  });
});
