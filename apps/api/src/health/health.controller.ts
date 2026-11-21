import { Controller, Get, Logger, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthDependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: HealthDependencyStatus;
  redis: HealthDependencyStatus;
}

@SkipThrottle() // load balancers and CI poll this constantly
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Public liveness/readiness probe for load balancers and CI. Deliberately reveals nothing but an overall status:
   * no uptime, latencies or dependency names.
   */
  @Get()
  async check(@Res() res: Response): Promise<Response> {
    const { payload, httpStatusCode } = await this.collect();
    return res.status(httpStatusCode).json({ status: payload.status, timestamp: payload.timestamp });
  }

  /** Full dependency status for signed-in users (the dashboard). Raw error text is logged, never returned. */
  @Get('details')
  @UseGuards(JwtAuthGuard)
  async details(@Res() res: Response): Promise<Response> {
    const { payload, httpStatusCode } = await this.collect();
    return res.status(httpStatusCode).json(payload);
  }

  private async collect(): Promise<{ payload: HealthResponse; httpStatusCode: number }> {
    const timestamp = new Date().toISOString();
    const uptimeSeconds = Math.floor(process.uptime());

    const dbStart = Date.now();
    let dbStatus: HealthDependencyStatus;
    try {
      await this.prismaService.client.$queryRaw`SELECT 1`;
      dbStatus = { status: 'up', latencyMs: Date.now() - dbStart };
    } catch (error) {
      this.logger.error(`Database health check failed: ${(error as Error).message}`);
      dbStatus = { status: 'down', latencyMs: Date.now() - dbStart };
    }

    const redisRes = await this.redisService.ping();
    if (!redisRes.ok && redisRes.error) this.logger.error(`Redis health check failed: ${redisRes.error}`);
    const redisStatus: HealthDependencyStatus = { status: redisRes.ok ? 'up' : 'down', latencyMs: redisRes.latencyMs };

    let status: HealthResponse['status'] = 'ok';
    let httpStatusCode: number = HttpStatus.OK;
    if (dbStatus.status === 'down') {
      status = 'error';
      httpStatusCode = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (redisStatus.status === 'down') {
      status = 'degraded';
      httpStatusCode = HttpStatus.SERVICE_UNAVAILABLE;
    }

    return { payload: { status, timestamp, uptimeSeconds, database: dbStatus, redis: redisStatus }, httpStatusCode };
  }
}
