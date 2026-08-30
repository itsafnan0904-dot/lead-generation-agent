import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    GmailModule,
    AIModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    QualificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}





