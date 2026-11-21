import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SellerProfileController } from './seller-profile.controller';
import { SellerProfileService } from './seller-profile.service';
import { SellerContextService } from './seller-context.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SellerProfileController],
  providers: [SellerProfileService, SellerContextService],
  exports: [SellerProfileService, SellerContextService],
})
export class SellerProfileModule {}
