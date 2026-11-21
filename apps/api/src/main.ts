import * as dotenv from 'dotenv';
import * as path from 'path';
import { validateEnv } from './config/validate-env';

// Pre-load environment variables so process.env is populated before any bootstrap logic (Reloaded with safe test mode)
const envCandidates = [
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envPath of envCandidates) {
  dotenv.config({ path: envPath });
}

// Fail fast: Verify that all required security-sensitive environment variables are present and non-empty
validateEnv();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { applyHttpSecurity } from './security/http-security';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  // Production logs no debug/verbose output (those can include request details); development keeps everything.
  const logger: LogLevel[] = isProduction ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug', 'verbose'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger });
  applyHttpSecurity(app);
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      // Generic 400s in production would hide which field failed; keep messages but never echo the offending values
      disableErrorMessages: false,
      validationError: { target: false, value: false },
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();
