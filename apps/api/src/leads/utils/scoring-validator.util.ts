export const SCORING_BOUNDS = {
  serviceMatch: { min: 0, max: 40, label: 'Service Match' },
  companyRelevance: { min: 0, max: 20, label: 'Company Relevance' },
  contactQuality: { min: 0, max: 15, label: 'Contact Quality' },
  projectPotential: { min: 0, max: 15, label: 'Project Potential' },
  locationMatch: { min: 0, max: 10, label: 'Location Match' },
} as const;

export interface ScoreFactors {
  scoreServiceMatch: number;
  scoreCompanyRelevance: number;
  scoreContactQuality: number;
  scoreProjectPotential: number;
  scoreLocationMatch: number;
  scoreTotal: number;
}

export interface FactorBreakdownDetail {
  score: number;
  maxScore: number;
  rawAIValue: any;
  clamped: boolean;
  notes?: string;
}

export interface ScoreBreakdownReason {
  factors: {
    serviceMatch: FactorBreakdownDetail;
    companyRelevance: FactorBreakdownDetail;
    contactQuality: FactorBreakdownDetail;
    projectPotential: FactorBreakdownDetail;
    locationMatch: FactorBreakdownDetail;
  };
  totalScore: number;
  justification: string;
  keyStrengths: string[];
  potentialRisks: string[];
  requiresHumanReview: boolean;
  aiUsageMetadata?: {
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    timestamp: Date;
    actionId?: string;
  };
}

/**
 * Backend validator & clamper for score factors.
 * LOCKED RULE: The AI must never be trusted to directly determine the final
 * persisted numeric score without backend-side validation of bounds and invariants.
 */
export function validateAndClampScoreFactors(
  rawBreakdown: any,
  justification: string = '',
  keyStrengths: string[] = [],
  potentialRisks: string[] = [],
  requiresHumanReview: boolean = false,
  aiMetadata?: any,
): { factors: ScoreFactors; breakdownReason: ScoreBreakdownReason } {
  const clampFactor = (
    val: any,
    bounds: { min: number; max: number; label: string },
  ): FactorBreakdownDetail => {
    if (typeof val !== 'number' || isNaN(val)) {
      return {
        score: bounds.min,
        maxScore: bounds.max,
        rawAIValue: val,
        clamped: true,
        notes: `Invalid numeric value '${val}' for ${bounds.label}; clamped to ${bounds.min}`,
      };
    }

    const rounded = Math.round(val);
    if (rounded < bounds.min) {
      return {
        score: bounds.min,
        maxScore: bounds.max,
        rawAIValue: val,
        clamped: true,
        notes: `Value ${val} below minimum bound ${bounds.min} for ${bounds.label}; clamped to ${bounds.min}`,
      };
    }

    if (rounded > bounds.max) {
      return {
        score: bounds.max,
        maxScore: bounds.max,
        rawAIValue: val,
        clamped: true,
        notes: `Value ${val} exceeded maximum bound ${bounds.max} for ${bounds.label}; clamped to ${bounds.max}`,
      };
    }

    return {
      score: rounded,
      maxScore: bounds.max,
      rawAIValue: val,
      clamped: false,
    };
  };

  const serviceMatch = clampFactor(rawBreakdown?.serviceMatch, SCORING_BOUNDS.serviceMatch);
  const companyRelevance = clampFactor(rawBreakdown?.companyRelevance, SCORING_BOUNDS.companyRelevance);
  const contactQuality = clampFactor(rawBreakdown?.contactQuality, SCORING_BOUNDS.contactQuality);
  const projectPotential = clampFactor(rawBreakdown?.projectPotential, SCORING_BOUNDS.projectPotential);
  const locationMatch = clampFactor(rawBreakdown?.locationMatch, SCORING_BOUNDS.locationMatch);

  const scoreTotal =
    serviceMatch.score +
    companyRelevance.score +
    contactQuality.score +
    projectPotential.score +
    locationMatch.score;

  const factors: ScoreFactors = {
    scoreServiceMatch: serviceMatch.score,
    scoreCompanyRelevance: companyRelevance.score,
    scoreContactQuality: contactQuality.score,
    scoreProjectPotential: projectPotential.score,
    scoreLocationMatch: locationMatch.score,
    scoreTotal,
  };

  const breakdownReason: ScoreBreakdownReason = {
    factors: {
      serviceMatch,
      companyRelevance,
      contactQuality,
      projectPotential,
      locationMatch,
    },
    totalScore: scoreTotal,
    justification: justification || 'Automated AI-assisted multi-factor lead evaluation.',
    keyStrengths: Array.isArray(keyStrengths) ? keyStrengths : [],

    potentialRisks: Array.isArray(potentialRisks) ? potentialRisks : [],
    requiresHumanReview: Boolean(requiresHumanReview),
    aiUsageMetadata: aiMetadata
      ? {
          modelUsed: aiMetadata.modelUsed || 'unknown',
          promptTokens: aiMetadata.usage?.promptTokens || 0,
          completionTokens: aiMetadata.usage?.completionTokens || 0,
          totalTokens: aiMetadata.usage?.totalTokens || 0,
          latencyMs: aiMetadata.latencyMs || 0,
          timestamp: aiMetadata.timestamp || new Date(),
          actionId: aiMetadata.actionId,
        }
      : undefined,
  };

  return { factors, breakdownReason };
}
