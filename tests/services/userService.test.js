jest.mock('../../repositories/userRepository');

const userRepo   = require('../../repositories/userRepository');
const userService = require('../../services/userService');
const { ValidationError, ConflictError } = require('../../errors');

describe('userService.getAllUsers', () => {
  it('delegates to userRepo.findAll', async () => {
    const users = [{ user_id: 1 }, { user_id: 2 }];
    userRepo.findAll.mockResolvedValue(users);
    const result = await userService.getAllUsers();
    expect(userRepo.findAll).toHaveBeenCalled();
    expect(result).toBe(users);
  });
});

describe('userService.getUserById', () => {
  it('returns the user when found', async () => {
    const user = { user_id: 5, first_name: 'Bob' };
    userRepo.findById.mockResolvedValue(user);
    const result = await userService.getUserById(5);
    expect(userRepo.findById).toHaveBeenCalledWith(5);
    expect(result).toBe(user);
  });

  it('returns null when user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);
    const result = await userService.getUserById(999);
    expect(result).toBeNull();
  });
});

describe('userService.updateUserRole', () => {
  it('throws ValidationError for an invalid role', async () => {
    userRepo.findRoleByName.mockResolvedValue(null);
    await expect(userService.updateUserRole(1, 'superuser')).rejects.toThrow(ValidationError);
  });

  it('updates the role when valid', async () => {
    userRepo.findRoleByName.mockResolvedValue({ role_id: 2 });
    userRepo.updateRole.mockResolvedValue();
    await userService.updateUserRole(1, 'staff');
    expect(userRepo.updateRole).toHaveBeenCalledWith(1, 2);
  });
});

describe('userService.updateProfile', () => {
  it('throws ConflictError when email is taken by another account', async () => {
    userRepo.findByEmailExcluding.mockResolvedValue([{ user_id: 99 }]);
    await expect(
      userService.updateProfile(1, { first_name: 'Alice', last_name: 'Smith', email: 'taken@x.com' })
    ).rejects.toThrow(ConflictError);
  });

  it('updates and returns the user when email is unique', async () => {
    const updated = { user_id: 1, first_name: 'Alice', last_name: 'Smith', email: 'alice@x.com' };
    userRepo.findByEmailExcluding.mockResolvedValue([]);
    userRepo.updateProfile.mockResolvedValue();
    userRepo.findById.mockResolvedValue(updated);

    const result = await userService.updateProfile(1, { first_name: 'Alice', last_name: 'Smith', email: 'alice@x.com' });
    expect(userRepo.updateProfile).toHaveBeenCalledWith(1, { first_name: 'Alice', last_name: 'Smith', email: 'alice@x.com' });
    expect(result).toBe(updated);
  });
});
