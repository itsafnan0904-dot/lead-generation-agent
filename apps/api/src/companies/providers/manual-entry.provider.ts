import { Injectable, Inject, forwardRef } from '@nestjs/common';
import {
  LeadDiscoveryProvider,
  SubmitCompanyCandidateInput,
} from '../interfaces/lead-discovery-provider.interface';
import { CompaniesService } from '../companies.service';
import { Company } from '@ai-sales-agent/database';


@Injectable()
export class ManualEntryProvider implements LeadDiscoveryProvider {
  constructor(
    @Inject(forwardRef(() => CompaniesService))
    private readonly companiesService: CompaniesService,
  ) {}

  /**
   * Submits a company candidate through the manual entry provider pipeline.
   * Performs standard field trimming/normalization and calls the CompaniesService.
   */
  async submitCandidate(input: SubmitCompanyCandidateInput): Promise<Company> {
    return this.companiesService.createCompany({
      name: input.name,
      domain: input.domain,
      industry: input.industry,
      size: input.size,
      location: input.location,
      country: input.country,
      website: input.website,
      linkedinUrl: input.linkedinUrl,
      metadata: input.metadata,
    });
  }
}
