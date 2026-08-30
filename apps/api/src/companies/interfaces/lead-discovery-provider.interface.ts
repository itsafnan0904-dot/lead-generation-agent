import { Company } from '@ai-sales-agent/database';

export interface SubmitCompanyCandidateInput {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  country?: string;
  website?: string;
  linkedinUrl?: string;
  metadata?: Record<string, any>;
}

export interface LeadDiscoveryProvider {
  /**
   * Submits a company candidate through the discovery provider ingestion pipeline.
   * Handles provider-specific normalization and forwards to deduplication.
   */
  submitCandidate(input: SubmitCompanyCandidateInput): Promise<Company>;
}

export const LEAD_DISCOVERY_PROVIDER_TOKEN = 'LEAD_DISCOVERY_PROVIDER_TOKEN';
