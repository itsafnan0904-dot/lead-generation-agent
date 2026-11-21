import { Controller, Get, Put, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SellerProfileService } from './seller-profile.service';
import {
  UpsertSellerProfileDto,
  SetResumeDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateTargetMarketDto,
  UpdateTargetMarketDto,
  CreateRestrictionRuleDto,
  UpdateRestrictionRuleDto,
  CreateInterventionRuleDto,
  UpdateInterventionRuleDto,
} from './dto/seller-profile.dto';

/** All routes act on the authenticated user's own profile only. */
@Controller('seller-profile')
@UseGuards(JwtAuthGuard)
export class SellerProfileController {
  constructor(private readonly service: SellerProfileService) {}

  @Get() getMine(@CurrentUser('id') userId: string) { return this.service.getMyProfile(userId); }
  @Put() upsert(@CurrentUser('id') userId: string, @Body() dto: UpsertSellerProfileDto) { return this.service.upsertProfile(userId, dto); }
  @Put('resume') setResume(@CurrentUser('id') userId: string, @Body() dto: SetResumeDto) { return this.service.setResume(userId, dto); }
  @Post('complete-onboarding') complete(@CurrentUser('id') userId: string) { return this.service.completeOnboarding(userId); }

  @Post('services') createService(@CurrentUser('id') u: string, @Body() dto: CreateServiceDto) { return this.service.createService(u, dto); }
  @Patch('services/:id') updateService(@CurrentUser('id') u: string, @Param('id') id: string, @Body() dto: UpdateServiceDto) { return this.service.updateService(u, id, dto); }
  @Delete('services/:id') deleteService(@CurrentUser('id') u: string, @Param('id') id: string) { return this.service.deleteService(u, id); }

  @Post('target-markets') createMarket(@CurrentUser('id') u: string, @Body() dto: CreateTargetMarketDto) { return this.service.createTargetMarket(u, dto); }
  @Patch('target-markets/:id') updateMarket(@CurrentUser('id') u: string, @Param('id') id: string, @Body() dto: UpdateTargetMarketDto) { return this.service.updateTargetMarket(u, id, dto); }
  @Delete('target-markets/:id') deleteMarket(@CurrentUser('id') u: string, @Param('id') id: string) { return this.service.deleteTargetMarket(u, id); }

  @Post('restriction-rules') createRestriction(@CurrentUser('id') u: string, @Body() dto: CreateRestrictionRuleDto) { return this.service.createRestrictionRule(u, dto); }
  @Patch('restriction-rules/:id') updateRestriction(@CurrentUser('id') u: string, @Param('id') id: string, @Body() dto: UpdateRestrictionRuleDto) { return this.service.updateRestrictionRule(u, id, dto); }
  @Delete('restriction-rules/:id') deleteRestriction(@CurrentUser('id') u: string, @Param('id') id: string) { return this.service.deleteRestrictionRule(u, id); }

  @Post('intervention-rules') createIntervention(@CurrentUser('id') u: string, @Body() dto: CreateInterventionRuleDto) { return this.service.createInterventionRule(u, dto); }
  @Patch('intervention-rules/:id') updateIntervention(@CurrentUser('id') u: string, @Param('id') id: string, @Body() dto: UpdateInterventionRuleDto) { return this.service.updateInterventionRule(u, id, dto); }
  @Delete('intervention-rules/:id') deleteIntervention(@CurrentUser('id') u: string, @Param('id') id: string) { return this.service.deleteInterventionRule(u, id); }
}
