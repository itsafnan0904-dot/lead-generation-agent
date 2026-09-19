import * as dotenv from 'dotenv';
import * as path from 'path';

// Pre-load environment variables for Jest test environment
const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const envPath of envCandidates) {
  dotenv.config({ path: envPath });
}

// Fallback test secrets for isolated unit testing
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_for_unit_tests_only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_for_unit_tests_only';
process.env.JWT_LINK_SECRET = process.env.JWT_LINK_SECRET || 'test_jwt_link_secret_for_unit_tests_only';
process.env.GMAIL_TOKEN_ENCRYPTION_KEY = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test?schema=public';
process.env.GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET || 'test_gmail_client_secret';
