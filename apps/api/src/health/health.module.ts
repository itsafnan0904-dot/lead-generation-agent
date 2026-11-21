import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RedisModule, AuthModule],
  controllers: [HealthController],
})
export class HealthModule {}
