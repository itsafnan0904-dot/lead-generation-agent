import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';
import { ImportProspectsDto } from './discovery.dto';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  /** Bulk-import prospects, filtered by the caller's target markets and restriction rules. */
  @Post('import')
  importProspects(@CurrentUser('id') userId: string, @Body() dto: ImportProspectsDto) {
    return this.discovery.importProspects(userId, dto);
  }
}
