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
