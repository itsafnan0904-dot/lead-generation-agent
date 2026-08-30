import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthDependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: HealthDependencyStatus;
  redis: HealthDependencyStatus;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<Response> {
    const timestamp = new Date().toISOString();
    const uptimeSeconds = Math.floor(process.uptime());

    // 1. Database Check (Postgres via Prisma $queryRaw)
    const dbStart = Date.now();
    let dbStatus: HealthDependencyStatus = { status: 'down' };
    try {
      await this.prismaService.client.$queryRaw`SELECT 1`;
      dbStatus = {
        status: 'up',
        latencyMs: Date.now() - dbStart,
      };
    } catch (error) {
      dbStatus = {
        status: 'down',
        latencyMs: Date.now() - dbStart,
        error: (error as Error).message || 'Database query failed',
      };
    }

    // 2. Redis Check (ioredis ping)
    const redisRes = await this.redisService.ping();
    const redisStatus: HealthDependencyStatus = {
      status: redisRes.ok ? 'up' : 'down',
      latencyMs: redisRes.latencyMs,
      ...(redisRes.error ? { error: redisRes.error } : {}),
    };

    // 3. Overall Status Determination
    // If Database is down -> 'error' (503 Service Unavailable)
    // If Database is up but Redis is down -> 'degraded' (200 OK or 503)
    // Here: Database down -> 503; Redis down -> 503; Both up -> 200 OK
    let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
    let httpStatusCode = HttpStatus.OK;

    if (dbStatus.status === 'down' && redisStatus.status === 'down') {
      overallStatus = 'error';
      httpStatusCode = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (dbStatus.status === 'down') {
      overallStatus = 'error';
      httpStatusCode = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (redisStatus.status === 'down') {
      overallStatus = 'degraded';
      httpStatusCode = HttpStatus.SERVICE_UNAVAILABLE;
    }

    const payload: HealthResponse = {
      status: overallStatus,
      timestamp,
      uptimeSeconds,
      database: dbStatus,
      redis: redisStatus,
    };

    return res.status(httpStatusCode).json(payload);
  }
}
