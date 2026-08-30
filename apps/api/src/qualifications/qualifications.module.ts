import { Module } from '@nestjs/common';
import { QualificationsController } from './qualifications.controller';
import { QualificationsService } from './qualifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [QualificationsController],
  providers: [QualificationsService],
  exports: [QualificationsService],
})
export class QualificationsModule {}
