import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let db: any, audit: any, service: UsersService;
  const admin = { id: 'a1', role: 'ADMIN', isActive: true };

  beforeEach(() => {
    db = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (a: any) => ({ id: 'n1', ...a.data, passwordHash: undefined })),
        update: jest.fn().mockImplementation(async (a: any) => ({ id: a.where.id, role: 'SALES_REP', isActive: true, ...a.data })),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new UsersService({ client: db } as any, audit);
  });

  it('creates a user with a bcrypt-hashed password, lower-cased email and an audit record; never selects hashes', async () => {
    await service.create({ email: ' New@Example.com ', name: ' New ', password: 'Str0ng-Password!', role: 'SALES_REP' as any }, 'a1');
    const args = db.user.create.mock.calls[0][0];
    expect(args.data.email).toBe('new@example.com');
    expect(args.data.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('Str0ng-Password!', args.data.passwordHash)).toBe(true);
    expect(args.select).not.toHaveProperty('passwordHash');
    expect(args.select).not.toHaveProperty('refreshTokenHash');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_CREATED', actorId: 'a1' }));
  });

  it('rejects a duplicate email', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(service.create({ email: 'a@b.com', name: 'x', password: 'Str0ng-Password!', role: 'VIEWER' as any }, 'a1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('stops admins from deactivating or demoting themselves', async () => {
    db.user.findUnique.mockResolvedValue(admin);
    await expect(service.update('a1', { isActive: false }, 'a1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('a1', { role: 'VIEWER' as any }, 'a1')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('never removes the last active administrator', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'a2', role: 'ADMIN', isActive: true });
    db.user.count.mockResolvedValue(1);
    await expect(service.update('a2', { isActive: false }, 'a1')).rejects.toThrow(/At least one active administrator/);
    db.user.count.mockResolvedValue(2);
    await expect(service.update('a2', { isActive: false }, 'a1')).resolves.toBeDefined();
  });

  it('revokes the refresh token when a user is deactivated or changes role, and audits the change', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', role: 'SALES_REP', isActive: true });
    await service.update('u1', { isActive: false }, 'a1');
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({ isActive: false, refreshTokenHash: null });
    await service.update('u1', { role: 'MANAGER' as any }, 'a1');
    expect(db.user.update.mock.calls[1][0].data).toMatchObject({ role: 'MANAGER', refreshTokenHash: null });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_UPDATED' }));
  });

  it('resets a password with a fresh hash and revokes sessions; 404s for unknown users', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', role: 'VIEWER', isActive: true });
    await service.resetPassword('u1', { password: 'An0ther-Str0ng-One' }, 'a1');
    const data = db.user.update.mock.calls[0][0].data;
    expect(data.refreshTokenHash).toBeNull();
    expect(await bcrypt.compare('An0ther-Str0ng-One', data.passwordHash)).toBe(true);
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.resetPassword('nope', { password: 'An0ther-Str0ng-One' }, 'a1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
