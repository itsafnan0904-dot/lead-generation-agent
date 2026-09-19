import { validateEnv, REQUIRED_SECURITY_SECRETS } from './validate-env';

describe('validateEnv (Fail-fast security configuration check)', () => {
  const validConfig = {
    JWT_ACCESS_SECRET: 'test_access_secret_123',
    JWT_REFRESH_SECRET: 'test_refresh_secret_456',
    JWT_LINK_SECRET: 'test_link_secret_789',
    GMAIL_TOKEN_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    GMAIL_OAUTH_CLIENT_SECRET: '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t',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test?schema=public',
  };

  it('passes when all required security secrets are present and non-empty', () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it('throws a fatal error when JWT_ACCESS_SECRET is missing', () => {
    const invalidConfig = { ...validConfig, JWT_ACCESS_SECRET: '' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /MISSING REQUIRED SECURITY CONFIGURATION SECRETS/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws a fatal error when JWT_REFRESH_SECRET is missing', () => {
    const invalidConfig = { ...validConfig, JWT_REFRESH_SECRET: undefined };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /MISSING REQUIRED SECURITY CONFIGURATION SECRETS/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('throws a fatal error when JWT_LINK_SECRET is missing', () => {
    const invalidConfig = { ...validConfig, JWT_LINK_SECRET: '   ' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /MISSING REQUIRED SECURITY CONFIGURATION SECRETS/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/JWT_LINK_SECRET/);
  });

  it('throws a fatal error when GMAIL_TOKEN_ENCRYPTION_KEY is missing', () => {
    const invalidConfig = { ...validConfig, GMAIL_TOKEN_ENCRYPTION_KEY: '   ' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /MISSING REQUIRED SECURITY CONFIGURATION SECRETS/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/GMAIL_TOKEN_ENCRYPTION_KEY/);
  });

  it('throws a fatal error when GMAIL_OAUTH_CLIENT_SECRET is missing', () => {
    const invalidConfig = { ...validConfig, GMAIL_OAUTH_CLIENT_SECRET: '' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /MISSING REQUIRED SECURITY CONFIGURATION SECRETS/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/GMAIL_OAUTH_CLIENT_SECRET/);
  });

  it('throws a fatal error when DATABASE_URL is missing', () => {
    const invalidConfig = { ...validConfig, DATABASE_URL: '' };
    expect(() => validateEnv(invalidConfig)).toThrow(
      /MISSING REQUIRED SECURITY CONFIGURATION SECRETS/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/DATABASE_URL/);
  });

  it('lists all missing variables when multiple secrets are missing', () => {
    const emptyConfig = {};
    let caughtError: Error | null = null;
    try {
      validateEnv(emptyConfig);
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    for (const secret of REQUIRED_SECURITY_SECRETS) {
      expect(caughtError!.message).toContain(secret.name);
    }
  });
});
