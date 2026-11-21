import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { OutreachModule } from '../outreach/outreach.module';
import { SellerProfileModule } from '../seller-profile/seller-profile.module';
import { FollowUpService } from './follow-up.service';

@Module({
  imports: [PrismaModule, AIModule, OutreachModule, SellerProfileModule],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpsModule {}
