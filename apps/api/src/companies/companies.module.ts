import { Module, forwardRef } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { ManualEntryProvider } from './providers/manual-entry.provider';
import { LEAD_DISCOVERY_PROVIDER_TOKEN } from './interfaces/lead-discovery-provider.interface';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';

@Module({
  imports: [PrismaModule, AIModule, AuthModule, RestrictionsModule],
  controllers: [CompaniesController],

  providers: [
    CompaniesService,
    ManualEntryProvider,
    {
      provide: LEAD_DISCOVERY_PROVIDER_TOKEN,
      useExisting: ManualEntryProvider,
    },
  ],
  exports: [CompaniesService, LEAD_DISCOVERY_PROVIDER_TOKEN],
})
export class CompaniesModule {}
