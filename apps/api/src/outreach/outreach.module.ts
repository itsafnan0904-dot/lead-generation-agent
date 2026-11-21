import { Module } from '@nestjs/common';
import { OutreachService } from './outreach.service';
import { OutreachController } from './outreach.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GmailModule } from '../gmail/gmail.module';
import { AIModule } from '../ai/ai.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';
import { AuthModule } from '../auth/auth.module';
import { SellerProfileModule } from '../seller-profile/seller-profile.module';

@Module({
  imports: [
    PrismaModule,
    GmailModule,
    AIModule,
    RestrictionsModule,
    AuthModule,
    SellerProfileModule,
  ],
  controllers: [OutreachController],
  providers: [OutreachService],
  exports: [OutreachService],
})
export class OutreachModule {}
