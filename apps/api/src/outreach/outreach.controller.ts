import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OutreachService } from './outreach.service';
import { GenerateOutreachDraftDto, ListOutreachDraftsQueryDto } from './dto/outreach.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  /**
   * Step 2: Generates a personalized outreach email draft for a lead without sending.
   */
  @Post('leads/:id/outreach/draft')
  @HttpCode(HttpStatus.CREATED)
  async generateDraft(
    @Param('id') leadId: string,
    @Body() dto: GenerateOutreachDraftDto,
  ) {
    return this.outreachService.generateDraft(leadId, dto);
  }

  /**
   * Step 3: Explicit human-gated endpoint to send an approved draft.
   */
  @Post('outreach/:draftId/send')
  @HttpCode(HttpStatus.OK)
  async sendDraft(@Param('draftId') draftId: string) {
    return this.outreachService.sendDraft(draftId);
  }

  /**
   * Retrieves an outreach draft by ID.
   */
  @Get('outreach/:draftId')
  async getDraftById(@Param('draftId') draftId: string) {
    return this.outreachService.getDraftById(draftId);
  }

  /**
   * Lists outreach drafts with optional filters.
   */
  @Get('outreach')
  async listDrafts(@Query() query: ListOutreachDraftsQueryDto) {
    return this.outreachService.listDrafts(query);
  }
}
