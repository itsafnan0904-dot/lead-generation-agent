import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { UserRole } from '@ai-sales-agent/database';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AIOrchestratorService } from '../services/ai-orchestrator.service';


/**
 * Diagnostic & Connectivity Test Controller for AI Orchestrator.
 * Gated behind JwtAuthGuard and ADMIN role to prevent unauthorized credit consumption.
 */
@Controller('ai/diagnostic')
export class AIDiagnosticController {
  constructor(private readonly aiOrchestrator: AIOrchestratorService) {}

  /**
   * Diagnostic test endpoint executing a lightweight restriction analysis
   * to verify end-to-end OpenAI API connectivity and schema validation.
   */
  @Post('test-connectivity')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async testConnectivity(
    @Body('entityName') entityName = 'Acme Corp',
  ) {
    return this.aiOrchestrator.analyzeRestriction({
      entityName,
      domain: 'acme.com',
      notes: 'Diagnostic sanity check testing live OpenAI API connectivity',
    });
  }
}
