import { findWeakSecrets, validateEnv } from '../config/validate-env';
import { parseCorsOrigins, parseTrustProxy } from './http-security';

describe('findWeakSecrets', () => {
  const strong = () => ({
    JWT_ACCESS_SECRET: 'Zq8f2Lm0Vb7Xk3Rt9Yw5Ne1Hc6Ju4Pd8Sa2Gf0Kl7Mn3Bv',
    JWT_REFRESH_SECRET: 'Tk4w9Pd2Xr7Lm1Cz8Vb3Nf6Hj0Qs5Ya2Eg9Ku4Ro7Ti1',
    JWT_LINK_SECRET: 'Mn6b3Vc9Xz1Lk8Jh4Gf2Ds7Aq0Wp5Er9Ty3Ui6Oo1Pl4',
    GMAIL_TOKEN_ENCRYPTION_KEY: 'a3f1c9e8b7d6025f4e3d2c1b0a9f8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7',
    GMAIL_OAUTH_CLIENT_SECRET: 'x',
    DATABASE_URL: 'postgresql://u:p@localhost/db',
  });

  it('accepts long random secrets', () => {
    expect(findWeakSecrets(strong())).toEqual([]);
  });

  it('flags short, placeholder, reused secrets and the public example encryption key, without printing values', () => {
    const problems = findWeakSecrets({
      ...strong(),
      JWT_ACCESS_SECRET: 'your_jwt_access_secret_change_in_production',
      JWT_REFRESH_SECRET: 'short',
      JWT_LINK_SECRET: 'short',
      GMAIL_TOKEN_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });
    const text = problems.join(' | ');
    expect(text).toMatch(/JWT_ACCESS_SECRET looks like a placeholder/);
    expect(text).toMatch(/JWT_REFRESH_SECRET is shorter than 32/);
    expect(text).toMatch(/must all be different/);
    expect(text).toMatch(/example key/);
    expect(text).not.toContain('your_jwt_access_secret_change_in_production');
  });

  it('is fatal in production and only a warning elsewhere', () => {
    const weak = { ...strong(), JWT_ACCESS_SECRET: 'too-short' };
    expect(() => validateEnv({ ...weak, NODE_ENV: 'production' })).toThrow(/FATAL STARTUP ERROR.*JWT_ACCESS_SECRET/s);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => validateEnv({ ...weak, NODE_ENV: 'development' })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(() => validateEnv({ ...strong(), NODE_ENV: 'production' })).not.toThrow();
  });
});

describe('HTTP security config parsing', () => {
  it('CORS allows nothing by default and never a wildcard', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('*')).toEqual([]);
    expect(parseCorsOrigins('https://app.example.com/, https://admin.example.com , *')).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('trust proxy defaults to loopback only and understands counts and lists', () => {
    expect(parseTrustProxy(undefined)).toBe('loopback');
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('10.0.0.0/8, loopback')).toEqual(['10.0.0.0/8', 'loopback']);
  });
});
