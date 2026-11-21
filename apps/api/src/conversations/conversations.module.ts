import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GmailModule } from '../gmail/gmail.module';
import { AIModule } from '../ai/ai.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';
import { AuthModule } from '../auth/auth.module';
import { HandoffModule } from '../handoff/handoff.module';
import { AutoReplyModule } from '../auto-reply/auto-reply.module';

@Module({
  imports: [
    PrismaModule,
    GmailModule,
    AIModule,
    RestrictionsModule,
    AuthModule,
    HandoffModule,
    AutoReplyModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
