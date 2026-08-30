import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto, ListLeadsQueryDto } from './dto/lead.dto';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * Creates a new Lead requiring an existing companyId.
   */
  @Post()
  async createLead(@Body() dto: CreateLeadDto) {
    return this.leadsService.createLead(dto);
  }

  /**
   * Lists Leads with pagination and filters.
   */
  @Get()
  async listLeads(@Query() query: ListLeadsQueryDto) {
    return this.leadsService.listLeads(query);
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
}
