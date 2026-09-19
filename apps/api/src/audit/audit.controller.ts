import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { ListAuditEventsQueryDto } from './dto/audit-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ai-sales-agent/database';

@Controller('audit-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * ADMIN-only endpoint to list and filter system audit events.
   */
  @Get()
  @Roles(UserRole.ADMIN)
  async listAuditEvents(@Query() query: ListAuditEventsQueryDto) {
    return this.auditService.listAuditEvents(query);
  }
}
