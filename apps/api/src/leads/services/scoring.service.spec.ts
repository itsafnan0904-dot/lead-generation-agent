import { ScoringService } from './scoring.service';
import { validateAndClampScoreFactors, SCORING_BOUNDS } from '../utils/scoring-validator.util';
import { NotFoundException } from '@nestjs/common';
import { LeadLifecycleStatus } from '@ai-sales-agent/database';

describe('ScoringService & Bounds Clamping Engine', () => {
  let scoringService: ScoringService;
  let mockPrismaClient: any;
  let mockAIOrchestrator: any;

  const mockLead = {
    id: 'lead-test-uuid-1',
    companyId: 'comp-1',
    primaryContactId: 'contact-1',
    status: LeadLifecycleStatus.COLD_LEAD,
    scoreTotal: 0,
    company: {
      id: 'comp-1',
      name: 'Apex Industrial Supply',
      domain: 'apex.com',
      industry: 'Manufacturing',
      size: '100-250',
      location: 'Chicago, IL',
      country: 'USA',
    },
    primaryContact: {
      id: 'contact-1',
      firstName: 'Sarah',
      lastName: 'Connor',
      title: 'VP of Procurement',
      email: 'sarah@apex.com',
      phone: '+1-555-0199',
    },
    research: [
      {
        companySummary: 'Industrial supply leader.',
        techStack: ['Node', 'React'],
        painPoints: ['Manual inventory'],
      },
    ],
  };

  beforeEach(() => {
    mockPrismaClient = {
      lead: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockAIOrchestrator = {
      analyzeLead: jest.fn(),
    };

    const mockPrismaService = { client: mockPrismaClient } as any;

    scoringService = new ScoringService(mockPrismaService, mockAIOrchestrator);
  });

  describe('Seller context', () => {
    it('passes the seller scoring context (services and target countries) to the AI', async () => {
      const sellerContext = { getContext: jest.fn().mockResolvedValue({ scoringContext: 'SELLER OFFERING: Web development' }) };
      const svc = new ScoringService({ client: mockPrismaClient } as any, mockAIOrchestrator, sellerContext as any);
      mockPrismaClient.lead.findUnique.mockResolvedValue({ ...mockLead, assignedUserId: 'u1' });
      mockPrismaClient.lead.update.mockResolvedValue(mockLead);
      mockAIOrchestrator.analyzeLead.mockResolvedValue({
        data: { scoreBreakdown: { serviceMatch: 10, companyRelevance: 5, contactQuality: 5, projectPotential: 5, locationMatch: 5 }, justification: 'ok', keyStrengths: [], potentialRisks: [], requiresHumanReview: false },
        metadata: null,
      });

      await svc.calculateLeadScore('lead-test-uuid-1');

      expect(sellerContext.getContext).toHaveBeenCalledWith('u1');
      expect(mockAIOrchestrator.analyzeLead.mock.calls[0][0].sellerContext).toBe('SELLER OFFERING: Web development');
    });
  });

  describe('Deterministic location match', () => {
    const run = async (country: string | null, targets: string[], aiLocation: number) => {
      const sellerContext = { getContext: jest.fn().mockResolvedValue({ scoringContext: 'x', targetCountryCodes: targets }) };
      const svc = new ScoringService({ client: mockPrismaClient } as any, mockAIOrchestrator, sellerContext as any);
      mockPrismaClient.lead.findUnique.mockResolvedValue({ ...mockLead, company: { ...mockLead.company, country } });
      mockPrismaClient.lead.update.mockImplementation(async (args: any) => args.data);
      mockAIOrchestrator.analyzeLead.mockResolvedValue({
        data: { scoreBreakdown: { serviceMatch: 20, companyRelevance: 10, contactQuality: 10, projectPotential: 5, locationMatch: aiLocation }, justification: 'ok', keyStrengths: [], potentialRisks: [], requiresHumanReview: false },
        metadata: null,
      });
      return (await svc.calculateLeadScore('lead-test-uuid-1')) as any;
    };

    it('gives full location marks (and fixes the total) for a target country, whatever the AI said', async () => {
      const r = await run('United States', ['US'], 0);
      expect(r.scoreLocationMatch).toBe(10);
      expect(r.scoreTotal).toBe(20 + 10 + 10 + 5 + 10);
    });
    it('gives zero outside every target country', async () => {
      const r = await run('Germany', ['US'], 9);
      expect(r.scoreLocationMatch).toBe(0);
      expect(r.scoreTotal).toBe(20 + 10 + 10 + 5);
    });
    it('keeps the AI value when the country is unknown or no targets are configured', async () => {
      expect((await run(null, ['US'], 6)).scoreLocationMatch).toBe(6);
      expect((await run('United States', [], 6)).scoreLocationMatch).toBe(6);
    });
  });

  describe('Valid AI Response Scoring', () => {
    it('calculates points within bounds and correctly sums total score', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue(mockLead);
      mockAIOrchestrator.analyzeLead.mockResolvedValue({
        data: {
          totalScore: 85,
          scoreBreakdown: {
            serviceMatch: 35, // max 40
            companyRelevance: 18, // max 20
            contactQuality: 12, // max 15
            projectPotential: 12, // max 15
            locationMatch: 8, // max 10
          },
          recommendedStage: 'QUALIFIED',
          justification: 'High fit across service offerings and verified contact authority.',
          keyStrengths: ['Decision maker identified', 'Strong service alignment'],
          potentialRisks: ['Long sales cycle'],
          requiresHumanReview: false,
        },
        metadata: {
          modelUsed: 'gpt-4o-mini',
          usage: { promptTokens: 150, completionTokens: 60, totalTokens: 210 },
          latencyMs: 310,
          timestamp: new Date(),
          actionId: 'action-score-001',
        },
      });

      mockPrismaClient.lead.update.mockImplementation((args: any) => ({
        ...mockLead,
        ...args.data,
      }));

      const result = await scoringService.calculateLeadScore('lead-test-uuid-1');

      expect(result.scoreServiceMatch).toBe(35);
      expect(result.scoreCompanyRelevance).toBe(18);
      expect(result.scoreContactQuality).toBe(12);
      expect(result.scoreProjectPotential).toBe(12);
      expect(result.scoreLocationMatch).toBe(8);
      expect(result.scoreTotal).toBe(85);
      expect(result.scoreTotal).toBe(35 + 18 + 12 + 12 + 8);
      expect(mockPrismaClient.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-test-uuid-1' },
          data: expect.objectContaining({
            scoreTotal: 85,
            scoreServiceMatch: 35,
          }),
        }),
      );
    });
  });

  describe('Out-of-Bounds / Malformed AI Response Clamping (LOCKED RULE)', () => {
    it('safely clamps out-of-range and negative AI point values to strict bounds without erroring', () => {
      const badAiBreakdown = {
        serviceMatch: 999, // Exceeds max 40 -> clamp to 40
        companyRelevance: -50, // Below min 0 -> clamp to 0
        contactQuality: 'invalid_string', // Not a number -> clamp to 0
        projectPotential: 25, // Exceeds max 15 -> clamp to 15
        locationMatch: 15, // Exceeds max 10 -> clamp to 10
      };

      const { factors, breakdownReason } = validateAndClampScoreFactors(
        badAiBreakdown,
        'Test malformed handling',
      );

      expect(factors.scoreServiceMatch).toBe(40);
      expect(factors.scoreCompanyRelevance).toBe(0);
      expect(factors.scoreContactQuality).toBe(0);
      expect(factors.scoreProjectPotential).toBe(15);
      expect(factors.scoreLocationMatch).toBe(10);
      expect(factors.scoreTotal).toBe(40 + 0 + 0 + 15 + 10); // 65

      // Check clamping flags
      expect(breakdownReason.factors.serviceMatch.clamped).toBe(true);
      expect(breakdownReason.factors.companyRelevance.clamped).toBe(true);
      expect(breakdownReason.factors.contactQuality.clamped).toBe(true);
      expect(breakdownReason.factors.projectPotential.clamped).toBe(true);
      expect(breakdownReason.factors.locationMatch.clamped).toBe(true);
    });

    it('handles AI failure gracefully and defaults scores to 0 with human review flag', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue(mockLead);
      mockAIOrchestrator.analyzeLead.mockRejectedValue(new Error('OpenAI timeout'));

      mockPrismaClient.lead.update.mockImplementation((args: any) => ({
        ...mockLead,
        ...args.data,
      }));

      const result = await scoringService.calculateLeadScore('lead-test-uuid-1');

      expect(result.scoreTotal).toBe(0);
      expect(result.scoreServiceMatch).toBe(0);
      expect(result.scoreBreakdownReason.requiresHumanReview).toBe(true);
      expect(result.scoreBreakdownReason.justification).toContain('AI scoring calculation failed');
    });

    it('rejects scoring with 404 NotFound if lead does not exist', async () => {
      mockPrismaClient.lead.findUnique.mockResolvedValue(null);

      await expect(
        scoringService.calculateLeadScore('nonexistent-lead'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
