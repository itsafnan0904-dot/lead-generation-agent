import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  ListCompaniesQueryDto,
  TriggerResearchDto,
} from './dto/company.dto';
import {
  LeadDiscoveryProvider,
  LEAD_DISCOVERY_PROVIDER_TOKEN,
} from './interfaces/lead-discovery-provider.interface';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    @Inject(LEAD_DISCOVERY_PROVIDER_TOKEN)
    private readonly discoveryProvider: LeadDiscoveryProvider,
  ) {}

  /**
   * Creates a new company candidate via the configured LeadDiscoveryProvider (ManualEntryProvider).
   */
  @Post()
  async createCompany(@Body() dto: CreateCompanyDto) {
    return this.discoveryProvider.submitCandidate(dto);
  }

  /**
   * Lists companies with pagination and search filtering.
   */
  @Get()
  async listCompanies(@Query() query: ListCompaniesQueryDto) {
    return this.companiesService.listCompanies(query);
  }

  /**
   * Retrieves a single company by ID including contacts, leads, and research history.
   */
  @Get(':id')
  async getCompanyById(@Param('id') id: string) {
    return this.companiesService.getCompanyById(id);
  }

  /**
   * Updates an existing company record.
   */
  @Patch(':id')
  async updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(id, dto);
  }

  /**
   * Triggers AI research for the company and scans for preliminary restriction keywords.
   */
  @Post(':id/research')
  async triggerResearch(
    @Param('id') id: string,
    @Body() dto: TriggerResearchDto,
  ) {
    return this.companiesService.triggerResearch(id, dto);
  }
}
