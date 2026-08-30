import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  IsEnum,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadLifecycleStatus, RestrictionCheckResult } from '@ai-sales-agent/database';

/**
 * 1. Research Analysis Contract
 */
export class ResearchAnalysisOutputDto {
  @IsString()
  summary: string;

  @IsArray()
  @IsString({ each: true })
  keyInsights: string[];

  @IsArray()
  @IsString({ each: true })
  techStack: string[];

  @IsArray()
  @IsString({ each: true })
  painPoints: string[];

  @IsArray()
  @IsString({ each: true })
  recentEvents: string[];

  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore: number;
}

/**
 * 2. Lead Analysis & Scoring Contract
 */
export class LeadScoreBreakdownDto {
  @IsNumber()
  @Min(0)
  @Max(40)
  serviceMatch: number;

  @IsNumber()
  @Min(0)
  @Max(20)
  companyRelevance: number;

  @IsNumber()
  @Min(0)
  @Max(15)
  contactQuality: number;

  @IsNumber()
  @Min(0)
  @Max(15)
  projectPotential: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  locationMatch: number;
}

export class LeadAnalysisOutputDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  totalScore: number;

  @ValidateNested()
  @Type(() => LeadScoreBreakdownDto)
  scoreBreakdown: LeadScoreBreakdownDto;

  @IsEnum(LeadLifecycleStatus)
  recommendedStage: LeadLifecycleStatus;

  @IsString()
  justification: string;

  @IsArray()
  @IsString({ each: true })
  keyStrengths: string[];

  @IsArray()
  @IsString({ each: true })
  potentialRisks: string[];

  @IsBoolean()
  requiresHumanReview: boolean;
}

/**
 * 3. Email Generation Contract
 */
export class EmailGenerationOutputDto {
  @IsString()
  subject: string;

  @IsString()
  bodyText: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsString()
  callToAction: string;

  @IsString()
  rationale: string;

  @IsArray()
  @IsString({ each: true })
  personalizationPointsUsed: string[];
}

/**
 * 4. Reply Analysis Contract
 */
export class ReplyAnalysisOutputDto {
  @IsEnum(['INTERESTED', 'NOT_INTERESTED', 'MORE_INFO_REQUESTED', 'OUT_OF_OFFICE', 'OBJECTION_RAISED', 'UNSUBSCRIBE', 'NEUTRAL'])
  intent: 'INTERESTED' | 'NOT_INTERESTED' | 'MORE_INFO_REQUESTED' | 'OUT_OF_OFFICE' | 'OBJECTION_RAISED' | 'UNSUBSCRIBE' | 'NEUTRAL';

  @IsEnum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'HOSTILE'])
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'HOSTILE';

  @IsEnum(LeadLifecycleStatus)
  suggestedLeadStage: LeadLifecycleStatus;

  @IsArray()
  @IsString({ each: true })
  objectionsIdentified: string[];

  @IsArray()
  @IsString({ each: true })
  questionsAsked: string[];

  @IsBoolean()
  requiresHumanIntervention: boolean;

  @IsString()
  recommendedNextAction: string;

  @IsOptional()
  @IsString()
  draftFollowUp?: string;
}

/**
 * 5. Qualification Assistance Contract
 */
export class QualificationFitDto {
  @IsBoolean()
  budgetFit: boolean;

  @IsBoolean()
  authorityFit: boolean;

  @IsBoolean()
  needFit: boolean;

  @IsBoolean()
  timelineFit: boolean;

  @IsBoolean()
  technicalFit: boolean;
}

export class QualificationAssistOutputDto {
  @ValidateNested()
  @Type(() => QualificationFitDto)
  fitEvaluation: QualificationFitDto;

  @IsString()
  fitSummary: string;

  @IsArray()
  @IsString({ each: true })
  missingInformation: string[];

  @IsArray()
  @IsString({ each: true })
  dealBlockers: string[];

  @IsBoolean()
  isQualified: boolean;

  @IsArray()
  @IsString({ each: true })
  recommendedQuestionsToAsk: string[];
}

/**
 * 6. Restriction Analysis Contract
 */
export class RestrictionAnalysisOutputDto {
  @IsEnum(RestrictionCheckResult)
  result: RestrictionCheckResult;

  @IsString()
  reason: string;

  @IsArray()
  @IsString({ each: true })
  matchedKeywordsOrEntities: string[];

  @IsBoolean()
  requiresHumanReview: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}

/**
 * 7. Decision Explanation Contract
 */
export class DecisionExplanationOutputDto {
  @IsString()
  actionType: string;

  @IsString()
  primaryReason: string;

  @IsArray()
  @IsString({ each: true })
  supportingFactors: string[];

  @IsArray()
  @IsString({ each: true })
  tradeoffsConsidered: string[];

  @IsString()
  confidenceAssessment: string;
}
