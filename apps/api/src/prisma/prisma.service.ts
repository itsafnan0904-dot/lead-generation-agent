import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { prisma, PrismaClient } from '@ai-sales-agent/database';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client: PrismaClient = prisma;

  async onModuleInit() {
    try {
      await this.client.$connect();
      this.logger.log('Prisma client successfully connected to PostgreSQL database.');
    } catch (error) {
      this.logger.error('Failed to connect Prisma client to PostgreSQL database on init:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.$disconnect();
      this.logger.log('Prisma client disconnected from PostgreSQL database.');
    } catch (error) {
      this.logger.error('Error disconnecting Prisma client from PostgreSQL database:', error);
    }
  }
}
