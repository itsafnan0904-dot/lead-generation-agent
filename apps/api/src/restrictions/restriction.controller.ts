import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RestrictionEngineService } from './restriction-engine.service';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadRestrictionController {
  constructor(private readonly restrictionEngine: RestrictionEngineService) {}

  /**
   * Direct trigger point: Runs full 3-layer restriction evaluation against an existing Lead.
   */
  @Post(':id/restriction-check')
  async evaluateLeadRestrictions(
    @Param('id') leadId: string,
    @Body('notes') notes?: string,
  ) {
    return this.restrictionEngine.evaluateLead(leadId, notes);
  }
}
