import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';
import { OutreachModule } from '../outreach/outreach.module';
import { SellerProfileModule } from '../seller-profile/seller-profile.module';
import { AutoReplyService } from './auto-reply.service';

@Module({
  imports: [PrismaModule, AIModule, OutreachModule, SellerProfileModule],
  providers: [AutoReplyService],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}
