import { Test, TestingModule } from '@nestjs/testing';
import { AIOrchestratorService } from '../services/ai-orchestrator.service';
import {
  AIProvider,
  AI_PROVIDER_TOKEN,
  AICompletionResult,
} from '../interfaces/ai-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AIOutputValidationError } from '../errors/ai-errors';
import { LeadLifecycleStatus, RestrictionCheckResult } from '@ai-sales-agent/database';

describe('AIOrchestratorService', () => {
  let orchestrator: AIOrchestratorService;
  let mockProvider: jest.Mocked<AIProvider>;
  let mockPrisma: any;

  beforeEach(async () => {
    mockProvider = {
      complete: jest.fn(),
    };

    mockPrisma = {
      client: {
        aIAction: {
          create: jest.fn().mockResolvedValue({ id: 'action-uuid-123' }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIOrchestratorService,
        { provide: AI_PROVIDER_TOKEN, useValue: mockProvider },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    orchestrator = module.get<AIOrchestratorService>(AIOrchestratorService);
  });

  describe('Successful Structured Output Handling', () => {
    it('1. analyzeResearch returns typed data and captures metadata', async () => {
      const mockResult: AICompletionResult = {
        rawContent: JSON.stringify({
          summary: 'Acme Corp is a cloud software leader.',
          keyInsights: ['Expanding into EMEA', 'Migrating to microservices'],
          techStack: ['React', 'Node.js', 'PostgreSQL'],
          painPoints: ['Legacy monolithic bottlenecks'],
          recentEvents: ['Series B funding raised'],
          confidenceScore: 0.95,
        }),
        parsedContent: {
          summary: 'Acme Corp is a cloud software leader.',
          keyInsights: ['Expanding into EMEA', 'Migrating to microservices'],
          techStack: ['React', 'Node.js', 'PostgreSQL'],
          painPoints: ['Legacy monolithic bottlenecks'],
          recentEvents: ['Series B funding raised'],
          confidenceScore: 0.95,
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 },
        latencyMs: 340,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.analyzeResearch({
        companyName: 'Acme Corp',
        rawResearchText: 'Raw data about Acme Corp...',
      });

      expect(res.data.summary).toBe('Acme Corp is a cloud software leader.');
      expect(res.data.confidenceScore).toBe(0.95);
      expect(res.metadata.modelUsed).toBe('gpt-4o-mini');
      expect(res.metadata.usage.totalTokens).toBe(200);
      expect(res.metadata.actionId).toBe('action-uuid-123');
      expect(mockPrisma.client.aIAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'ANALYZE_RESEARCH',
            status: 'EXECUTED',
          }),
        }),
      );
    });

    it('2. analyzeLead returns typed scoring data', async () => {
      const mockResult: AICompletionResult = {
        rawContent: '...',
        parsedContent: {
          totalScore: 85,
          scoreBreakdown: {
            serviceMatch: 35,
            companyRelevance: 18,
            contactQuality: 12,
            projectPotential: 12,
            locationMatch: 8,
          },
          recommendedStage: LeadLifecycleStatus.QUALIFIED,
          justification: 'Strong tech fit and verified budget.',
          keyStrengths: ['Budget verified', 'Decision maker contact'],
          potentialRisks: ['Long sales cycle'],
          requiresHumanReview: false,
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 250,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.analyzeLead({
        leadSummary: 'VP of Eng inquiry',
        companyData: '100 employees',
      });

      expect(res.data.totalScore).toBe(85);
      expect(res.data.recommendedStage).toBe('QUALIFIED');
      expect(res.data.scoreBreakdown.serviceMatch).toBe(35);
    });

    it('3. generateEmail returns structured outreach copy and rejects template placeholders', async () => {
      const mockResult: AICompletionResult = {
        rawContent: '...',
        parsedContent: {
          subject: 'Modernizing Acme cloud architecture',
          bodyText: 'Hi Sarah, saw your recent expansion...\n\nBest regards,\nAfnan Jawad\nSales Director',
          bodyHtml: '<p>Hi Sarah, saw your recent expansion...</p><p>Best regards,<br/>Afnan Jawad<br/>Sales Director</p>',
          callToAction: 'Can we schedule a 15-minute call this Thursday?',
          rationale: 'Addresses recent cloud migration initiatives.',
          personalizationPointsUsed: ['Series B announcement', 'Microservices migration'],
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 150, completionTokens: 90, totalTokens: 240 },
        latencyMs: 310,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.generateEmail({
        recipientName: 'Sarah',
        companyName: 'Acme',
        contextNotes: 'Recent series B funding',
        senderName: 'Afnan Jawad',
        senderTitle: 'Sales Director',
      });

      expect(res.data.subject).toBe('Modernizing Acme cloud architecture');
      expect(res.data.personalizationPointsUsed.length).toBe(2);

      // Verify prompt passed to AI contains sender details and strict negative rules
      expect(mockProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('NEVER output generic template placeholder markers'),
          prompt: expect.stringContaining('Afnan Jawad'),
        }),
      );

      // Assert that generated email body contains real values and no placeholder bracket patterns
      const placeholderPattern = /\[(Your |Name|Position|Company|Contact|Title|Phone|Email)[\w\s]*\]/i;
      expect(placeholderPattern.test(res.data.bodyText)).toBe(false);
      expect(res.data.bodyText).not.toContain('[Your Name]');
      expect(res.data.bodyText).not.toContain('[Your Company]');
      expect(res.data.bodyText).toContain('Afnan Jawad');
    });

    it('4. analyzeReply returns structured intent and sentiment', async () => {
      const mockResult: AICompletionResult = {
        rawContent: '...',
        parsedContent: {
          intent: 'MORE_INFO_REQUESTED',
          sentiment: 'POSITIVE',
          suggestedLeadStage: LeadLifecycleStatus.INTERESTED,
          objectionsIdentified: [],
          questionsAsked: ['What is your pricing tier for 50 seats?'],
          requiresHumanIntervention: false,
          recommendedNextAction: 'Send standard enterprise pricing sheet.',
          draftFollowUp: 'Hi Sarah, our pricing for 50 seats starts at...',
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 110, completionTokens: 60, totalTokens: 170 },
        latencyMs: 220,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.analyzeReply({
        messageBody: 'Thanks for reaching out! What is your pricing for 50 seats?',
      });

      expect(res.data.intent).toBe('MORE_INFO_REQUESTED');
      expect(res.data.sentiment).toBe('POSITIVE');
      expect(res.data.questionsAsked).toContain('What is your pricing tier for 50 seats?');
    });

    it('5. assistQualification returns BANT fit evaluation', async () => {
      const mockResult: AICompletionResult = {
        rawContent: '...',
        parsedContent: {
          fitEvaluation: {
            budgetFit: true,
            authorityFit: true,
            needFit: true,
            timelineFit: true,
            technicalFit: true,
          },
          fitSummary: 'All 5 qualification criteria satisfied.',
          missingInformation: [],
          dealBlockers: [],
          isQualified: true,
          recommendedQuestionsToAsk: ['When do you intend to initiate onboarding?'],
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 130, completionTokens: 70, totalTokens: 200 },
        latencyMs: 280,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.assistQualification({
        leadId: 'lead-1',
        collectedAnswers: { budget: '$50k', timeline: 'Q3' },
      });

      expect(res.data.isQualified).toBe(true);
      expect(res.data.fitEvaluation.budgetFit).toBe(true);
    });

    it('6. analyzeRestriction returns compliance classification', async () => {
      const mockResult: AICompletionResult = {
        rawContent: '...',
        parsedContent: {
          result: RestrictionCheckResult.CLEAR,
          reason: 'No restricted territory or competitor affiliation found.',
          matchedKeywordsOrEntities: [],
          requiresHumanReview: false,
          confidence: 0.99,
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 80, completionTokens: 40, totalTokens: 120 },
        latencyMs: 190,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.analyzeRestriction({
        entityName: 'Standard Corp',
      });

      expect(res.data.result).toBe('CLEAR');
      expect(res.data.confidence).toBe(0.99);
    });

    it('7. explainDecision returns audit explanation', async () => {
      const mockResult: AICompletionResult = {
        rawContent: '...',
        parsedContent: {
          actionType: 'SCORE_LEAD',
          primaryReason: 'High domain match with enterprise cloud requirements.',
          supportingFactors: ['Tech stack includes AWS and Kubernetes'],
          tradeoffsConsidered: ['Low team size vs high budget'],
          confidenceAssessment: 'High confidence based on verified data.',
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 90, completionTokens: 50, totalTokens: 140 },
        latencyMs: 200,
      };

      mockProvider.complete.mockResolvedValue(mockResult);

      const res = await orchestrator.explainDecision({
        decisionType: 'SCORE_LEAD',
        contextData: { score: 85 },
      });

      expect(res.data.actionType).toBe('SCORE_LEAD');
      expect(res.data.primaryReason).toBe('High domain match with enterprise cloud requirements.');
    });
  });

  describe('Schema Validation & Bounded Correction Retry Handling', () => {
    it('successfully recovers when initial output fails validation but self-correction retry succeeds', async () => {
      // 1st attempt: malformed (missing summary and keyInsights)
      const invalidResult: AICompletionResult = {
        rawContent: JSON.stringify({ summary: 123 }), // invalid type
        parsedContent: { summary: 123 },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        latencyMs: 150,
      };

      // 2nd attempt (correction retry): valid
      const validResult: AICompletionResult = {
        rawContent: JSON.stringify({
          summary: 'Corrected company summary',
          keyInsights: ['Insight A'],
          techStack: ['Node'],
          painPoints: ['Slow build'],
          recentEvents: ['Hiring'],
          confidenceScore: 0.8,
        }),
        parsedContent: {
          summary: 'Corrected company summary',
          keyInsights: ['Insight A'],
          techStack: ['Node'],
          painPoints: ['Slow build'],
          recentEvents: ['Hiring'],
          confidenceScore: 0.8,
        },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 90, completionTokens: 40, totalTokens: 130 },
        latencyMs: 220,
      };

      mockProvider.complete
        .mockResolvedValueOnce(invalidResult)
        .mockResolvedValueOnce(validResult);

      const res = await orchestrator.analyzeResearch({
        companyName: 'Test Corp',
        rawResearchText: '...',
      });

      expect(mockProvider.complete).toHaveBeenCalledTimes(2);
      expect(res.data.summary).toBe('Corrected company summary');
    });

    it('throws AIOutputValidationError and logs FAILED AIAction when correction retry also fails validation', async () => {
      const invalidResult: AICompletionResult = {
        rawContent: JSON.stringify({ invalidField: true }),
        parsedContent: { invalidField: true },
        modelUsed: 'gpt-4o-mini',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        latencyMs: 150,
      };

      mockProvider.complete
        .mockResolvedValueOnce(invalidResult)
        .mockResolvedValueOnce(invalidResult);

      await expect(
        orchestrator.analyzeResearch({
          companyName: 'Failing Corp',
          rawResearchText: '...',
        }),
      ).rejects.toThrow(AIOutputValidationError);

      expect(mockPrisma.client.aIAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });
  });

  describe('Transient Error Handling & Audit Persistence', () => {
    it('persists FAILED audit record when AIProvider throws an unhandled error', async () => {
      mockProvider.complete.mockRejectedValue(new Error('OpenAI service unavailable'));

      await expect(
        orchestrator.analyzeResearch({
          companyName: 'Error Corp',
          rawResearchText: '...',
        }),
      ).rejects.toThrow('OpenAI service unavailable');

      expect(mockPrisma.client.aIAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: 'ANALYZE_RESEARCH',
            status: 'FAILED',
            errorMessage: 'OpenAI service unavailable',
          }),
        }),
      );
    });
  });
});
