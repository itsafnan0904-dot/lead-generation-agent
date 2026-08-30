import { Module } from '@nestjs/common';
import { RestrictionEngineService } from './restriction-engine.service';
import { LeadRestrictionController } from './restriction.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, AIModule],
  controllers: [LeadRestrictionController],
  providers: [RestrictionEngineService],
  exports: [RestrictionEngineService],
})
export class RestrictionsModule {}
