import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { DeterministicRestrictionChecker, DeterministicMatchResult } from './layers/deterministic-checker.layer';
import { PolicyEvaluator, EvaluatedPolicyOutcome } from './layers/policy-evaluator.layer';
import {
  RestrictionEntityType,
  RestrictionCheckResult,
  LeadLifecycleStatus,
  RestrictionCheck,
} from '@ai-sales-agent/database';

export interface EvaluateRestrictionOptions {
  entityType: RestrictionEntityType;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  sourceTrigger: 'research' | 'qualification' | 'manual' | 'conversation' | 'document';
  textCorpus: string;
  notes?: string;
}

@Injectable()
export class RestrictionEngineService {
  private readonly logger = new Logger(RestrictionEngineService.name);
  private readonly deterministicChecker = new DeterministicRestrictionChecker();
  private readonly policyEvaluator = new PolicyEvaluator();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AIOrchestratorService,
  ) {}

  /**
   * Evaluates restrictions through the 3-layer pipeline:
   * Layer 1: Deterministic keyword matching (high recall)
   * Layer 2: AI contextual analysis (with 'small component of larger project is still unacceptable' rule)
   * Layer 3: Authoritative policy evaluation (deterministic matrix)
   * Persists a RestrictionCheck audit record, and blocks Lead if RESTRICTED or HUMAN_REVIEW.
   */
  async evaluate(options: EvaluateRestrictionOptions): Promise<RestrictionCheck> {
    const { entityType, companyId, contactId, leadId, sourceTrigger, textCorpus, notes } = options;

    // Layer 1: Deterministic Check
    const deterministicMatches = this.deterministicChecker.check(textCorpus);

    // Layer 2: AI Contextual Analysis
    const promptNotes = [
      notes || '',
      `Deterministic Scanner Findings: ${
        deterministicMatches.hasMatch
          ? `Detected potential restricted terms: [${deterministicMatches.matchedTerms.join(', ')}]`
          : 'No exact prohibited keyword matches detected.'
      }`,
      `CRITICAL POLICY RULE: Prohibited structural steel scope (OWSJ, K/LH/DLH Series joists, steel decking, joist girders, and related deck work) is STRICTLY PROHIBITED and does NOT become acceptable merely because it is a small or minor component of a larger project.`,
      `Context Content Snapshot: ${textCorpus.substring(0, 1500)}`,
    ].join('\n');

    let aiAnalysisResult: { data?: any; failed?: boolean; error?: string } = {};
    try {
      const aiResponse = await this.aiOrchestrator.analyzeRestriction(
        {
          entityName: `${entityType} Check (${companyId || leadId || contactId || 'N/A'})`,
          notes: promptNotes,
        },
        { leadId },
      );
      aiAnalysisResult = { data: aiResponse.data, failed: false };
    } catch (err: any) {

      this.logger.warn(`AI restriction contextual analysis failed for ${entityType}: ${err.message}. Falling back to deterministic fallback evaluation.`);
      aiAnalysisResult = { failed: true, error: err.message };
    }

    // Layer 3: Policy Evaluator Matrix
    const outcome = this.policyEvaluator.evaluate(deterministicMatches, aiAnalysisResult);

    // Step 4: Persistence of RestrictionCheck record
    const restrictionCheck = await this.prisma.client.restrictionCheck.create({
      data: {
        entityType,
        companyId: companyId || null,
        contactId: contactId || null,
        leadId: leadId || null,
        result: outcome.finalResult,
        reason: outcome.reason,
        matchedRules: {
          ...outcome.matchedRules,
          sourceTrigger,
        },
        checkedPayload: {
          textLength: textCorpus.length,
          preview: textCorpus.substring(0, 300),
          deterministicMatches: deterministicMatches.matchDetails,
          aiOutcome: aiAnalysisResult.data || { status: 'FAILED', error: aiAnalysisResult.error },
        },
      },
    });

    // Step 5: Lead Blocking Behavior
    if (leadId) {
      await this.handleLeadBlocking(leadId, outcome.finalResult, outcome.reason);
    } else if (companyId) {
      // If checking a Company, check and block any associated active Leads
      await this.handleCompanyLeadsBlocking(companyId, outcome.finalResult, outcome.reason);
    }

    return restrictionCheck;
  }

  /**
   * Directly triggers restriction check against an existing Lead.
   */
  async evaluateLead(leadId: string, notes?: string): Promise<RestrictionCheck> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        primaryContact: true,
        research: { orderBy: { createdAt: 'desc' }, take: 1 },
        qualifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${leadId}' not found.`);
    }

    const research = lead.research?.[0];
    const qualification = lead.qualifications?.[0];

    const textCorpus = [
      `Company: ${lead.company.name}`,
      `Industry: ${lead.company.industry || ''}`,
      `Summary: ${research?.companySummary || ''}`,
      `Key Insights: ${JSON.stringify(research?.keyInsights || [])}`,
      `Tech Stack / Scope: ${JSON.stringify(research?.techStack || [])}`,
      `Pain Points: ${JSON.stringify(research?.painPoints || [])}`,
      `Raw Data: ${JSON.stringify(research?.rawResearchData || {})}`,
      `Qualification Fit Summary: ${qualification?.fitSummary || ''}`,
      `Qualification Deal Blockers: ${JSON.stringify(qualification?.dealBlockers || {})}`,
      `Qualification Answers: ${JSON.stringify(qualification?.answers || {})}`,
    ].join('\n');

    return this.evaluate({
      entityType: RestrictionEntityType.LEAD,
      leadId: lead.id,
      companyId: lead.companyId,
      contactId: lead.primaryContactId || undefined,
      sourceTrigger: 'manual',
      textCorpus,
      notes: notes || 'Direct lead restriction evaluation requested.',
    });
  }

  /**
   * Applies the locked blocking rule:
   * RESTRICTED or HUMAN_REVIEW -> Sets Lead.status to RESTRICTED and halts progress.
   * CLEAR -> Leaves Lead.status unchanged (does not reset/downgrade).
   */
  private async handleLeadBlocking(leadId: string, result: RestrictionCheckResult, reason: string): Promise<void> {
    if (result === RestrictionCheckResult.CLEAR) {
      return; // Do not touch existing progress
    }

    const currentLead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      select: { id: true, status: true },
    });

    if (!currentLead) return;

    const isAdvancedStatus = (
      [
        LeadLifecycleStatus.WON,
        LeadLifecycleStatus.LOST,
        LeadLifecycleStatus.DEAL_DISCUSSION,
        LeadLifecycleStatus.QUALIFIED,
      ] as LeadLifecycleStatus[]
    ).includes(currentLead.status);


    if (isAdvancedStatus) {
      this.logger.warn(
        `[CRITICAL COMPLIANCE OVERRIDE] Restriction check returned '${result}' for Lead '${leadId}' which was previously at advanced stage '${currentLead.status}'. Overriding status to RESTRICTED for regulatory compliance.`,
      );
    }

    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: {
        status: LeadLifecycleStatus.RESTRICTED,
        metadata: {
          restrictionBlocked: true,
          restrictionResult: result,
          blockReason: reason,
          previousStatus: currentLead.status,
          overrodeAdvancedStatus: isAdvancedStatus,
          blockedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Lead '${leadId}' status transitioned from '${currentLead.status}' to RESTRICTED due to ${result} restriction evaluation.`);
  }


  private async handleCompanyLeadsBlocking(companyId: string, result: RestrictionCheckResult, reason: string): Promise<void> {
    if (result === RestrictionCheckResult.CLEAR) return;

    const leads = await this.prisma.client.lead.findMany({
      where: { companyId, status: { not: LeadLifecycleStatus.RESTRICTED } },
      select: { id: true },
    });

    for (const lead of leads) {
      await this.handleLeadBlocking(lead.id, result, reason);
    }
  }
}
