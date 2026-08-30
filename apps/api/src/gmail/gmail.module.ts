import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { TokenEncryptionService } from './token-encryption.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GmailController],
  providers: [GmailService, TokenEncryptionService],
  exports: [GmailService, TokenEncryptionService],
})
export class GmailModule {}
