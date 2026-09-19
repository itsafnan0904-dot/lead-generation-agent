import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { GmailModule } from './gmail/gmail.module';
import { AIModule } from './ai/ai.module';
import { CompaniesModule } from './companies/companies.module';
import { ContactsModule } from './contacts/contacts.module';
import { LeadsModule } from './leads/leads.module';
import { QualificationsModule } from './qualifications/qualifications.module';
import { RestrictionsModule } from './restrictions/restrictions.module';
import { ConversationsModule } from './conversations/conversations.module';
import { OutreachModule } from './outreach/outreach.module';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './audit/audit.module';
import { HumanReviewsModule } from './human-reviews/human-reviews.module';
import { NotificationsModule } from './notifications/notifications.module';

import { validateEnv } from './config/validate-env';

const envFilePaths = [
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    HumanReviewsModule,
    GmailModule,
    AIModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    QualificationsModule,
    RestrictionsModule,
    ConversationsModule,
    OutreachModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}






