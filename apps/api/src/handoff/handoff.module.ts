import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LeadsModule } from '../leads/leads.module';
import { HandoffService } from './handoff.service';
import { HandoffController } from './handoff.controller';

@Module({
  imports: [PrismaModule, AuthModule, LeadsModule],
  controllers: [HandoffController],
  providers: [HandoffService],
  exports: [HandoffService],
})
export class HandoffModule {}
