import { Module } from '@nestjs/common';
import { OpenAIProvider } from './providers/openai.provider';
import { AIOrchestratorService } from './services/ai-orchestrator.service';
import { AIDiagnosticController } from './controllers/ai-diagnostic.controller';
import { AI_PROVIDER_TOKEN } from './interfaces/ai-provider.interface';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AIDiagnosticController],
  providers: [
    OpenAIProvider,
    {
      provide: AI_PROVIDER_TOKEN,
      useExisting: OpenAIProvider,
    },
    AIOrchestratorService,
  ],
  exports: [AIOrchestratorService, AI_PROVIDER_TOKEN],
})
export class AIModule {}
