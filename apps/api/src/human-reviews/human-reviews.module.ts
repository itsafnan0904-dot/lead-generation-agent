import { Module } from '@nestjs/common';
import { HumanReviewsController } from './human-reviews.controller';
import { HumanReviewsService } from './human-reviews.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [HumanReviewsController],
  providers: [HumanReviewsService],
  exports: [HumanReviewsService],
})
export class HumanReviewsModule {}
