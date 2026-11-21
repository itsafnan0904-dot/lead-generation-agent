import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { AssignLeadsDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post() create(@Body() dto: CreateCampaignDto, @CurrentUser('id') userId: string) { return this.campaigns.create(dto, userId); }
  @Get() list(@Query('status') status?: string) { return this.campaigns.list(status); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.campaigns.getById(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto, @CurrentUser('id') userId: string) { return this.campaigns.update(id, dto, userId); }

  @Post(':id/leads')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignLeadsDto, @CurrentUser('id') userId: string) {
    return this.campaigns.assignLeads(id, dto, userId);
  }

  @Delete(':id/leads/:leadId')
  removeLead(@Param('id', ParseUUIDPipe) id: string, @Param('leadId', ParseUUIDPipe) leadId: string, @CurrentUser('id') userId: string) {
    return this.campaigns.removeLead(id, leadId, userId);
  }
}
