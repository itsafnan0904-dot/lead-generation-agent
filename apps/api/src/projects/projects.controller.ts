import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('leads/:leadId/projects')
  create(@Param('leadId', ParseUUIDPipe) leadId: string, @Body() dto: CreateProjectDto, @CurrentUser('id') userId: string) {
    return this.projects.create(leadId, dto, userId);
  }

  @Get('leads/:leadId/projects')
  list(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.projects.listForLead(leadId);
  }

  @Patch('projects/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto, @CurrentUser('id') userId: string) {
    return this.projects.update(id, dto, userId);
  }

  @Delete('projects/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.projects.remove(id, userId);
  }

  /** Deal pipeline grouped by stage with per-currency value totals. */
  @Get('opportunities')
  pipeline() {
    return this.projects.getPipeline();
  }
}
