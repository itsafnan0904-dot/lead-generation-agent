import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginAttemptTracker } from './login-attempt-tracker';

describe('AuthService access control', () => {
  let service: AuthService;
  let db: any;

  beforeEach(async () => {
    delete process.env.ALLOW_PUBLIC_REGISTRATION;
    delete process.env.GOOGLE_ALLOWED_DOMAINS;
    db = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { client: db } },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('tok'), verify: jest.fn() } },
      ],
    }).compile();
    service = mod.get(AuthService);
  });
  afterEach(() => { delete process.env.ALLOW_PUBLIC_REGISTRATION; delete process.env.GOOGLE_ALLOWED_DOMAINS; });

  const reg = { email: 'new@example.com', name: 'New', password: 'Str0ng-Password!' };

  it('refuses public registration by default and creates nothing', async () => {
    await expect(service.register(reg)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('only allows registration when explicitly enabled, and never lets the caller pick a role', async () => {
    process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 'u1', email: reg.email, name: 'New', role: 'SALES_REP' });
    await service.register({ ...reg, role: 'ADMIN' } as any);
    expect(db.user.create.mock.calls[0][0].data).not.toHaveProperty('role');
  });

  it('does not provision a brand-new account for an arbitrary Google user', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.handleGoogleLogin({ googleId: 'g1', email: 'stranger@gmail.com', name: 'S' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('allows Google sign-up only for an allowed email domain', async () => {
    process.env.GOOGLE_ALLOWED_DOMAINS = 'acme.com, example.org';
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 'u2', email: 'a@acme.com', name: 'A', role: 'SALES_REP' });
    await expect(service.handleGoogleLogin({ googleId: 'g2', email: 'a@acme.com', name: 'A' })).resolves.toBeDefined();
    await expect(service.handleGoogleLogin({ googleId: 'g3', email: 'a@evil-acme.com', name: 'A' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('login brute-force protection', () => {
    const user = async () => ({ id: 'u1', email: 'a@example.com', name: 'A', role: 'SALES_REP', isActive: true, passwordHash: await bcrypt.hash('Correct-Pass-1!', 4) });

    it('locks an account after 10 failures, even for the right password, with a 429', async () => {
      db.user.findUnique.mockResolvedValue(await user());
      for (let i = 0; i < 10; i++) {
        await expect(service.login({ email: 'a@example.com', password: 'wrong' }, `10.0.0.${i}`)).rejects.toBeInstanceOf(UnauthorizedException);
      }
      const err: any = await service.login({ email: 'A@Example.com', password: 'Correct-Pass-1!' }, '10.9.9.9').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
    });

    it('blocks an IP spraying many accounts after 30 failures', async () => {
      db.user.findUnique.mockResolvedValue(null);
      for (let i = 0; i < 30; i++) {
        await expect(service.login({ email: `u${i}@example.com`, password: 'x' }, '203.0.113.7')).rejects.toBeInstanceOf(UnauthorizedException);
      }
      const err: any = await service.login({ email: 'fresh@example.com', password: 'x' }, '203.0.113.7').catch((e) => e);
      expect(err.getStatus()).toBe(429);
      // another address is unaffected
      await expect(service.login({ email: 'fresh@example.com', password: 'x' }, '203.0.113.8')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('does real bcrypt work for unknown emails so response time does not reveal valid accounts', async () => {
      db.user.findUnique.mockResolvedValue(null);
      const spy = jest.spyOn(bcrypt, 'compare');
      await service.login({ email: 'ghost@example.com', password: 'whatever' }).catch(() => undefined);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('a successful login clears that account failure count', async () => {
      db.user.findUnique.mockResolvedValue(await user());
      for (let i = 0; i < 9; i++) await service.login({ email: 'a@example.com', password: 'wrong' }).catch(() => undefined);
      await expect(service.login({ email: 'a@example.com', password: 'Correct-Pass-1!' })).resolves.toBeDefined();
      for (let i = 0; i < 9; i++) await service.login({ email: 'a@example.com', password: 'wrong' }).catch(() => undefined);
      await expect(service.login({ email: 'a@example.com', password: 'Correct-Pass-1!' })).resolves.toBeDefined(); // would be locked without the reset
    });
  });
});

describe('LoginAttemptTracker', () => {
  it('unlocks once the window has passed and reports a retry time', () => {
    let t = 1_000_000;
    const tracker = new LoginAttemptTracker({ maxPerAccount: 2, maxPerIp: 100, windowMs: 60_000 }, () => t);
    tracker.recordFailure('a@x.com');
    tracker.recordFailure('a@x.com');
    expect(tracker.retryAfterSeconds('a@x.com')).toBe(60);
    t += 30_000;
    expect(tracker.retryAfterSeconds('A@X.com ')).toBe(30);
    t += 31_000;
    expect(tracker.retryAfterSeconds('a@x.com')).toBe(0);
  });
});

describe('JwtAuthGuard viewer read-only rule', () => {
  const guard = new JwtAuthGuard();
  const ctx = (method: string, url: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ method, originalUrl: url }) }) }) as unknown as ExecutionContext;

  it('lets viewers read but not change anything', () => {
    const viewer = { id: 'v', role: 'VIEWER' };
    expect(guard.handleRequest(null, viewer, null, ctx('GET', '/leads?limit=5'))).toBe(viewer);
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(() => guard.handleRequest(null, viewer, null, ctx(m, '/leads/1'))).toThrow(ForbiddenException);
    }
    expect(guard.handleRequest(null, viewer, null, ctx('POST', '/auth/logout'))).toBe(viewer);
  });

  it('does not restrict other roles and still rejects missing users', () => {
    const rep = { id: 'r', role: 'SALES_REP' };
    expect(guard.handleRequest(null, rep, null, ctx('POST', '/leads'))).toBe(rep);
    expect(() => guard.handleRequest(null, false, { message: 'jwt expired' }, ctx('GET', '/leads'))).toThrow(UnauthorizedException);
  });
});
