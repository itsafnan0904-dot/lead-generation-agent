import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ScoringService } from './services/scoring.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';
import { OutreachModule } from '../outreach/outreach.module';

@Module({
  imports: [PrismaModule, AuthModule, AIModule, OutreachModule],
  controllers: [LeadsController],
  providers: [LeadsService, ScoringService],
  exports: [LeadsService, ScoringService],
})
export class LeadsModule {}

