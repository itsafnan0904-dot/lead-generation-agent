import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import { ScoringService } from './services/scoring.service';
import { CreateLeadDto, UpdateLeadDto, ListLeadsQueryDto } from './dto/lead.dto';
import {
  ApproveAutonomousEngagementDto,
  RejectAutonomousEngagementDto,
} from './dto/autonomous-engagement.dto';
import { UserRole } from '@ai-sales-agent/database';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * Creates a new Lead requiring an existing companyId.
   */
  @Post()
  async createLead(@Body() dto: CreateLeadDto) {
    return this.leadsService.createLead(dto);
  }

  /**
   * Triggers lead scoring calculation using AI analysis and backend bounds validation.
   */
  @Post(':id/score')
  async scoreLead(@Param('id') id: string) {
    return this.scoringService.calculateLeadScore(id);
  }

  /**
   * Lists Leads with pagination and filters.
   */
  @Get()
  async listLeads(@Query() query: ListLeadsQueryDto) {
    return this.leadsService.listLeads(query);
  }

  /**
   * Step 1: Generates an informed pre-approval summary for autonomous engagement.
   * Gated strictly behind RolesGuard(ADMIN).
   * Read-only with zero side effects: does NOT enable autonomous mode or send emails.
   */
  @Get(':id/autonomous-engagement-preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAutonomousEngagementPreview(@Param('id') id: string) {
    return this.leadsService.getAutonomousEngagementPreview(id);
  }

  /**
   * Step 2: One-click ADMIN approval endpoint for autonomous engagement.
   * Gated strictly behind RolesGuard(ADMIN).
   * Atomically enables autonomousConversationMode = true AND dispatches the previewed draft.
   */
  @Post(':id/approve-autonomous-engagement')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async approveAutonomousEngagement(
    @Param('id') id: string,
    @Body() dto: ApproveAutonomousEngagementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.approveAutonomousEngagement(id, dto, user.id);
  }

  /**
   * Step 3: ADMIN rejection endpoint for autonomous engagement.
   * Gated strictly behind RolesGuard(ADMIN).
   * Leaves Lead in normal manual mode (autonomousConversationMode = false) and logs AuditEvent.
   */
  @Post(':id/reject-autonomous-engagement')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rejectAutonomousEngagement(
    @Param('id') id: string,
    @Body() dto: RejectAutonomousEngagementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.rejectAutonomousEngagement(id, dto, user.id);
  }

  /**
   * Retrieves a single Lead by ID.
   */
  @Get(':id')
  async getLeadById(@Param('id') id: string) {
    return this.leadsService.getLeadById(id);
  }

  /**
   * Updates an existing Lead.
   */
  @Patch(':id')
  async updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(id, dto);
  }

  /**
   * Pauses AI actions and autonomous sync processing for a specific Lead.
   * Routine operational action gated by JwtAuthGuard only.
   */
  @Post(':id/pause-ai')
  @HttpCode(HttpStatus.OK)
  async pauseAI(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.pauseAI(id, user.id);
  }

  /**
   * Marks a Lead as taken over by a human operator.
   * Routine operational action gated by JwtAuthGuard only.
   */
  @Post(':id/take-over')
  @HttpCode(HttpStatus.OK)
  async takeOver(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.takeOver(id, user.id);
  }

  /**
   * Resumes AI actions and autonomous processing for a specific Lead.
   * Routine operational action gated by JwtAuthGuard only.
   */
  @Post(':id/resume-ai')
  @HttpCode(HttpStatus.OK)
  async resumeAI(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.resumeAI(id, user.id);
  }
}



