import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIOrchestratorService } from '../../ai/services/ai-orchestrator.service';
import { validateAndClampScoreFactors, ScoreBreakdownReason } from '../utils/scoring-validator.util';
import { Lead } from '@ai-sales-agent/database';


@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AIOrchestratorService,
  ) {}

  /**
   * Calculates a Lead's score:
   * 1. Fetches Lead with Company, Contact, and latest Research data.
   * 2. Calls AIOrchestratorService.analyzeLead() for qualitative per-factor assessment.
   * 3. Independently validates and clamps all factor scores backend-side before persistence.
   * 4. Persists scoreTotal, the five factor scores, and scoreBreakdownReason on the Lead record.
   */
  async calculateLeadScore(leadId: string): Promise<Lead & { scoreBreakdownReason: ScoreBreakdownReason }> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
        research: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    const company = lead.company;
    const contact = lead.primaryContact;
    const latestResearch = lead.research?.[0];

    // Build context strings for AI lead analysis
    const leadSummary = `Lead ID: ${lead.id}\nCompany: ${company.name}\nLifecycle Stage: ${lead.status}`;
    const companyData = `Name: ${company.name}\nDomain: ${company.domain || 'N/A'}\nIndustry: ${company.industry || 'N/A'}\nSize: ${company.size || 'N/A'}\nLocation: ${company.location || 'N/A'}\nCountry: ${company.country || 'N/A'}\nResearch Summary: ${latestResearch?.companySummary || 'None'}\nTech Stack: ${JSON.stringify(latestResearch?.techStack || [])}\nPain Points: ${JSON.stringify(latestResearch?.painPoints || [])}`;
    const contactData = contact
      ? `Name: ${contact.firstName} ${contact.lastName || ''}\nTitle: ${contact.title || 'N/A'}\nEmail: ${contact.email}\nPhone: ${contact.phone || 'N/A'}`
      : 'No primary contact assigned';

    // 1. Call AIOrchestratorService.analyzeLead()
    let aiResponse: any;
    try {
      aiResponse = await this.aiOrchestrator.analyzeLead(
        {
          leadSummary,
          companyData,
          contactData,
        },
        { leadId: lead.id },
      );
    } catch (err: any) {
      this.logger.warn(`AI analyzeLead failed for lead '${leadId}': ${err.message}. Falling back to safe bounded default scoring.`);
      aiResponse = {
        data: {
          scoreBreakdown: {
            serviceMatch: 0,
            companyRelevance: 0,
            contactQuality: 0,
            projectPotential: 0,
            locationMatch: 0,
          },
          justification: `AI scoring calculation failed: ${err.message}. Scores safely defaulted to 0.`,
          keyStrengths: [],
          potentialRisks: ['AI assessment unavailable'],
          requiresHumanReview: true,
        },
        metadata: null,
      };
    }

    const aiData = aiResponse.data;

    // 2. BACKEND VALIDATION & CLAMPING (LOCKED RULE: Backend validates and clamps bounds)
    const { factors, breakdownReason } = validateAndClampScoreFactors(
      aiData.scoreBreakdown,
      aiData.justification,
      aiData.keyStrengths,
      aiData.potentialRisks,
      aiData.requiresHumanReview,
      aiResponse.metadata,
    );

    // 3. Persist scoreTotal, factor columns, and scoreBreakdownReason
    const updatedLead = await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        scoreTotal: factors.scoreTotal,
        scoreServiceMatch: factors.scoreServiceMatch,
        scoreCompanyRelevance: factors.scoreCompanyRelevance,
        scoreContactQuality: factors.scoreContactQuality,
        scoreProjectPotential: factors.scoreProjectPotential,
        scoreLocationMatch: factors.scoreLocationMatch,
        scoreBreakdownReason: breakdownReason as any,
      },
      include: {
        company: true,
        primaryContact: true,
        assignedUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    return updatedLead as unknown as Lead & { scoreBreakdownReason: ScoreBreakdownReason };
  }
}

