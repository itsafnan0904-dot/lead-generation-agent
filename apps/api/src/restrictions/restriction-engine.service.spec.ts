import { DeterministicRestrictionChecker, RESTRICTED_TERMS_LIST } from './layers/deterministic-checker.layer';
import { PolicyEvaluator } from './layers/policy-evaluator.layer';
import { RestrictionEngineService } from './restriction-engine.service';
import {
  RestrictionEntityType,
  RestrictionCheckResult,
  LeadLifecycleStatus,
} from '@ai-sales-agent/database';

describe('Restriction Engine Pipeline', () => {
  let deterministicChecker: DeterministicRestrictionChecker;
  let policyEvaluator: PolicyEvaluator;
  let service: RestrictionEngineService;
  let mockPrismaClient: any;
  let mockAIOrchestrator: any;

  beforeEach(() => {
    deterministicChecker = new DeterministicRestrictionChecker();
    policyEvaluator = new PolicyEvaluator();

    mockPrismaClient = {
      restrictionCheck: {
        create: jest.fn().mockImplementation((args) => ({
          id: 'restr-check-uuid-1',
          ...args.data,
          createdAt: new Date(),
        })),
      },
      humanReview: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({
          id: 'human-review-uuid-1',
          ...args.data,
          createdAt: new Date(),
        })),
      },
      lead: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-uuid-1' }),
      },
    };

    mockAIOrchestrator = {
      analyzeRestriction: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-event-1' }),
    };

    const mockNotificationsService = {
      create: jest.fn().mockResolvedValue([]),
    };

    const mockPrismaService = { client: mockPrismaClient } as any;

    service = new RestrictionEngineService(
      mockPrismaService,
      mockAIOrchestrator,
      mockAuditService as any,
      mockNotificationsService as any,
    );
  });

  describe('Layer 1: Deterministic Check Layer', () => {
    it('matches exact prohibited structural steel terms with high recall', () => {
      const corpus = 'We specialize in industrial warehouse framing with OWSJ and K-Series joists.';
      const result = deterministicChecker.check(corpus);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedTerms).toContain('OWSJ');
      expect(result.matchedTerms).toContain('K-Series');
    });

    it('matches variations such as Steel decking and Joist girders case-insensitively', () => {
      const corpus = 'Supplier of corrugated steel decking and custom joist girders.';
      const result = deterministicChecker.check(corpus);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedTerms).toContain('Steel decking');
      expect(result.matchedTerms).toContain('Joist girders');
    });

    it('correctly does NOT match unrelated non-restricted text', () => {
      const corpus = 'We manufacture standard reinforced concrete pillars and architectural glass facades.';
      const result = deterministicChecker.check(corpus);

      expect(result.hasMatch).toBe(false);
      expect(result.matchedTerms.length).toBe(0);
    });
  });

  describe('Layer 3: Policy Evaluator Matrix', () => {
    it('evaluates to RESTRICTED when deterministic match exists and AI confirms restriction', () => {
      const deterministicResult = {
        hasMatch: true,
        matchedTerms: ['OWSJ'],
        matchDetails: [{ term: 'OWSJ', matchedPattern: 'OWSJ' }],
      };
      const aiAnalysis = {
        data: {
          result: RestrictionCheckResult.RESTRICTED,
          reason: 'Company provides open web steel joist fabrication as core commercial offering.',
          matchedKeywordsOrEntities: ['OWSJ'],
          requiresHumanReview: true,
          confidence: 0.95,
        },
      };

      const outcome = policyEvaluator.evaluate(deterministicResult, aiAnalysis);

      expect(outcome.finalResult).toBe(RestrictionCheckResult.RESTRICTED);
      expect(outcome.reason).toContain('Prohibited structural scope detected [OWSJ]');
    });

    it('evaluates to HUMAN_REVIEW (not auto-CLEAR) when deterministic match exists but AI claims out-of-scope (LOCKED RULE)', () => {
      const deterministicResult = {
        hasMatch: true,
        matchedTerms: ['Steel decking'],
        matchDetails: [{ term: 'Steel decking', matchedPattern: 'Steel decking' }],
      };
      const aiAnalysis = {
        data: {
          result: RestrictionCheckResult.CLEAR,
          reason: 'Steel decking appears to be a subcontracted minor component.',
          matchedKeywordsOrEntities: [],
          requiresHumanReview: false,
          confidence: 0.85,
        },
      };

      const outcome = policyEvaluator.evaluate(deterministicResult, aiAnalysis);

      // Must be HUMAN_REVIEW because AI cannot autonomously clear detected hard keywords
      expect(outcome.finalResult).toBe(RestrictionCheckResult.HUMAN_REVIEW);
      expect(outcome.requiresHumanReview).toBe(true);
      expect(outcome.reason).toContain('policy requires mandatory Human Review');
    });

    it('evaluates to CLEAR when no deterministic matches exist and AI confirms clean compliance', () => {
      const deterministicResult = {
        hasMatch: false,
        matchedTerms: [],
        matchDetails: [],
      };
      const aiAnalysis = {
        data: {
          result: RestrictionCheckResult.CLEAR,
          reason: 'No competitor conflicts or structural steel restrictions found.',
          matchedKeywordsOrEntities: [],
          requiresHumanReview: false,
          confidence: 0.99,
        },
      };

      const outcome = policyEvaluator.evaluate(deterministicResult, aiAnalysis);

      expect(outcome.finalResult).toBe(RestrictionCheckResult.CLEAR);
      expect(outcome.requiresHumanReview).toBe(false);
    });

    it('evaluates to HUMAN_REVIEW on AI analysis failure (never silently CLEAR)', () => {
      const deterministicResult = {
        hasMatch: false,
        matchedTerms: [],
        matchDetails: [],
      };
      const aiAnalysis = {
        failed: true,
        error: 'OpenAI 500 server error',
      };

      const outcome = policyEvaluator.evaluate(deterministicResult, aiAnalysis);

      expect(outcome.finalResult).toBe(RestrictionCheckResult.HUMAN_REVIEW);
      expect(outcome.requiresHumanReview).toBe(true);
      expect(outcome.reason).toContain('AI contextual compliance check failed');
    });
  });

  describe('Full Pipeline & Lead Blocking Integration', () => {
    it('sets Lead.status to RESTRICTED and halts progress when check returns RESTRICTED', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue({
        id: 'lead-test-1',
        status: LeadLifecycleStatus.COLD_LEAD,
      });

      mockAIOrchestrator.analyzeRestriction.mockResolvedValue({
        data: {
          result: RestrictionCheckResult.RESTRICTED,
          reason: 'Confirmed OWSJ fabrication.',
          matchedKeywordsOrEntities: ['OWSJ'],
          requiresHumanReview: true,
          confidence: 0.98,
        },
      });

      const check = await service.evaluate({
        entityType: RestrictionEntityType.LEAD,
        leadId: 'lead-test-1',
        sourceTrigger: 'research',
        textCorpus: 'Scope includes OWSJ open web joists.',
      });

      expect(check.result).toBe(RestrictionCheckResult.RESTRICTED);
      expect(mockPrismaClient.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-test-1' },
        data: expect.objectContaining({
          status: LeadLifecycleStatus.RESTRICTED,
          metadata: expect.objectContaining({
            restrictionBlocked: true,
            restrictionResult: RestrictionCheckResult.RESTRICTED,
          }),
        }),
      });
    });

    it('sets Lead.status to RESTRICTED when check returns HUMAN_REVIEW', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue({
        id: 'lead-test-2',
        status: LeadLifecycleStatus.QUALIFIED,
      });

      mockAIOrchestrator.analyzeRestriction.mockResolvedValue({
        data: {
          result: RestrictionCheckResult.CLEAR,
          reason: 'K-Series is minor subpart.',
          matchedKeywordsOrEntities: [],
          requiresHumanReview: false,
          confidence: 0.8,
        },
      });

      const check = await service.evaluate({
        entityType: RestrictionEntityType.LEAD,
        leadId: 'lead-test-2',
        sourceTrigger: 'qualification',
        textCorpus: 'Includes small K-Series support.',
      });

      // Policy evaluator forces HUMAN_REVIEW because K-Series was matched
      expect(check.result).toBe(RestrictionCheckResult.HUMAN_REVIEW);
      expect(mockPrismaClient.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-test-2' },
        data: expect.objectContaining({
          status: LeadLifecycleStatus.RESTRICTED,
        }),
      });
    });

    it('leaves Lead.status untouched when check returns CLEAR on an ALREADY-ADVANCED lead (non-downgrade invariant)', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue({
        id: 'lead-test-advanced',
        status: LeadLifecycleStatus.QUALIFIED,
      });

      mockAIOrchestrator.analyzeRestriction.mockResolvedValue({
        data: {
          result: RestrictionCheckResult.CLEAR,
          reason: 'Clean architectural woodwork.',
          matchedKeywordsOrEntities: [],
          requiresHumanReview: false,
          confidence: 0.99,
        },
      });

      const check = await service.evaluate({
        entityType: RestrictionEntityType.LEAD,
        leadId: 'lead-test-advanced',
        sourceTrigger: 'manual',
        textCorpus: 'High-end timber and glass construction.',
      });

      expect(check.result).toBe(RestrictionCheckResult.CLEAR);
      // Lead.update must NOT be called for CLEAR, preserving QUALIFIED status
      expect(mockPrismaClient.lead.update).not.toHaveBeenCalled();
    });

    it('overrides an advanced terminal status (e.g. WON) to RESTRICTED with prominent audit metadata when restriction is found', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue({
        id: 'lead-test-won',
        status: LeadLifecycleStatus.WON,
      });

      mockAIOrchestrator.analyzeRestriction.mockResolvedValue({
        data: {
          result: RestrictionCheckResult.RESTRICTED,
          reason: 'Post-award audit identified prohibited DLH-Series joist scope.',
          matchedKeywordsOrEntities: ['DLH-Series'],
          requiresHumanReview: true,
          confidence: 0.99,
        },
      });

      const check = await service.evaluate({
        entityType: RestrictionEntityType.LEAD,
        leadId: 'lead-test-won',
        sourceTrigger: 'manual',
        textCorpus: 'Post-award drawings specify DLH-Series longspan joists.',
      });

      expect(check.result).toBe(RestrictionCheckResult.RESTRICTED);
      expect(mockPrismaClient.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-test-won' },
        data: {
          status: LeadLifecycleStatus.RESTRICTED,
          metadata: expect.objectContaining({
            restrictionBlocked: true,
            restrictionResult: RestrictionCheckResult.RESTRICTED,
            previousStatus: LeadLifecycleStatus.WON,
            overrodeAdvancedStatus: true,
          }),
        },
      });
    });


    it('evaluates lead directly via evaluateLead() and persists RestrictionCheck', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue({
        id: 'lead-uuid-direct',
        companyId: 'comp-uuid-direct',
        company: { name: 'Timberland Works', industry: 'Carpentry' },
        primaryContact: { id: 'cont-1' },
        research: [{ companySummary: 'Fine timber millwork.' }],
        qualifications: [],
        status: LeadLifecycleStatus.COLD_LEAD,
      });

      mockAIOrchestrator.analyzeRestriction.mockResolvedValue({
        data: {
          result: RestrictionCheckResult.CLEAR,
          reason: 'No steel scope.',
          matchedKeywordsOrEntities: [],
          requiresHumanReview: false,
          confidence: 0.99,
        },
      });

      const check = await service.evaluateLead('lead-uuid-direct');

      expect(check.result).toBe(RestrictionCheckResult.CLEAR);
      expect(mockPrismaClient.restrictionCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: RestrictionEntityType.LEAD,
            leadId: 'lead-uuid-direct',
            result: RestrictionCheckResult.CLEAR,
          }),
        }),
      );
    });
  });
});
