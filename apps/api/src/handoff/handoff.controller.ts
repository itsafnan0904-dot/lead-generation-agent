import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HandoffService } from './handoff.service';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  /** Current handoff brief for a lead: why the human is needed and what to do first. */
  @Get(':id/handoff')
  getBrief(@Param('id', ParseUUIDPipe) id: string) {
    return this.handoffService.buildBrief(id);
  }
}
