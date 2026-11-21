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
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // CSV prospect imports can exceed Express's 100kb default JSON limit
  app.useBodyParser('json', { limit: '3mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '3mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();

