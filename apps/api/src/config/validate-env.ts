export interface RequiredSecretDef {
  name: string;
  description: string;
}

export const REQUIRED_SECURITY_SECRETS: RequiredSecretDef[] = [
  {
    name: 'JWT_ACCESS_SECRET',
    description: 'Secret key used to sign and verify JWT access tokens',
  },
  {
    name: 'JWT_REFRESH_SECRET',
    description: 'Secret key used to sign and verify JWT refresh tokens',
  },
  {
    name: 'JWT_LINK_SECRET',
    description: 'Secret key used to sign and verify Google account link tokens',
  },
  {
    name: 'GMAIL_TOKEN_ENCRYPTION_KEY',
    description: 'Hex key or secret string used for AES-256-GCM token encryption',
  },
  {
    name: 'GMAIL_OAUTH_CLIENT_SECRET',
    description: 'Google OAuth client secret used for authorization code exchange and HMAC state signing',
  },
  {
    name: 'DATABASE_URL',
    description: 'PostgreSQL database connection URL',
  },
];

/**
 * Validates that all security-sensitive environment variables are present and non-empty.
 * Throws a fatal Error if any required secret is missing, preventing the application
 * from booting in an insecure state.
 */
export function validateEnv(config: Record<string, any> = process.env): Record<string, any> {
  const missing: string[] = [];

  for (const secret of REQUIRED_SECURITY_SECRETS) {
    const value = config[secret.name];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      missing.push(`  - ${secret.name}: ${secret.description}`);
    }
  }

  // Weak, placeholder or reused secrets. Fatal in production, a loud warning everywhere else.
  const weak = findWeakSecrets(config);
  if (weak.length > 0) {
    const message = [
      'Weak or placeholder security configuration:',
      ...weak.map((w) => `  - ${w}`),
      'Generate real secrets, e.g. node -e "console.log(require(' + "'crypto'" + ').randomBytes(48).toString(' + "'base64url'" + '))"',
    ].join('\n');
    if (config.NODE_ENV === 'production') {
      throw new Error(`[FATAL STARTUP ERROR] ${message}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[SECURITY WARNING] ${message}\n(This is fatal when NODE_ENV=production.)`);
  }

  if (missing.length > 0) {
    const errorMessage = [
      '================================================================================',
      '[FATAL STARTUP ERROR] MISSING REQUIRED SECURITY CONFIGURATION SECRETS',
      'The application refused to start because security-sensitive environment variables',
      'are missing or empty. Fallback default secrets have been removed to prevent latent vulnerabilities.',
      '',
      'Missing variables:',
      ...missing,
      '',
      'Please configure these variables in your environment or apps/api/.env file.',
      '================================================================================',
    ].join('\n');

    throw new Error(errorMessage);
  }

  return config;
}

const PLACEHOLDER_PATTERN = /(change[_-]?in[_-]?production|change[_-]?me|your[_-]|example|placeholder|test[_-]?secret|^secret$|password)/i;
const EXAMPLE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const MIN_SECRET_LENGTH = 32;

/**
 * Returns human-readable problems with the configured secrets (too short, placeholder text, reused between purposes,
 * or the well-known example encryption key). Pure: it never throws and never prints the secret values.
 */
export function findWeakSecrets(config: Record<string, any> = process.env): string[] {
  const problems: string[] = [];
  const jwtNames = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_LINK_SECRET'];

  for (const name of jwtNames) {
    const v = config[name];
    if (typeof v !== 'string' || v.trim() === '') continue; // missing secrets are reported separately
    if (v.length < MIN_SECRET_LENGTH) problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters`);
    if (PLACEHOLDER_PATTERN.test(v)) problems.push(`${name} looks like a placeholder value`);
  }

  const jwtValues = jwtNames.map((n) => config[n]).filter((v) => typeof v === 'string' && v.trim() !== '');
  if (new Set(jwtValues).size !== jwtValues.length) problems.push('JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and JWT_LINK_SECRET must all be different');

  const key = config.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (typeof key === 'string' && key.trim() !== '') {
    if (key === EXAMPLE_ENCRYPTION_KEY) problems.push('GMAIL_TOKEN_ENCRYPTION_KEY is the public example key from .env.example');
    else if (!/^[0-9a-fA-F]{64}$/.test(key) && key.length < MIN_SECRET_LENGTH) problems.push('GMAIL_TOKEN_ENCRYPTION_KEY should be 64 hex characters (32 bytes)');
  }

  return problems;
}
