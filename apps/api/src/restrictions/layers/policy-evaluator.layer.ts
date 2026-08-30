import { RestrictionCheckResult } from '@ai-sales-agent/database';
import { DeterministicMatchResult } from './deterministic-checker.layer';
import { RestrictionAnalysisOutputDto } from '../../ai/dto/ai-output.dto';

export interface EvaluatedPolicyOutcome {
  finalResult: RestrictionCheckResult;
  reason: string;
  matchedRules: Record<string, any>;
  requiresHumanReview: boolean;
}

/**
 * Layer 3: Policy Evaluator
 * Combines Deterministic pattern matches and AI contextual assessment into an authoritative decision.
 *
 * DECISION TABLE:
 * 1. Deterministic Match + AI Confirms In-Scope / Restriction -> RESTRICTED
 *    - Hard block: Prohibited scope identified and confirmed relevant.
 * 2. Deterministic Match + AI Claims Out-of-Scope -> HUMAN_REVIEW (Never auto-CLEAR)
 *    - Locked rule: AI cannot override hard keyword detections to clear them autonomously.
 * 3. Deterministic Match + AI Analysis Failed / Ambiguous / Low Confidence -> HUMAN_REVIEW
 *    - Safe default: Do not allow unverified keyword detections to pass or fail silently.
 * 4. No Deterministic Match + AI Detects Restrictive Sub-Scope -> RESTRICTED or HUMAN_REVIEW
 *    - Respects AI finding if AI detected a restricted pattern not caught by pure keyword scanner.
 * 5. No Deterministic Match + AI Clear / Confirmed Unrestricted -> CLEAR
 *    - Clean path: Zero prohibited keywords and zero AI compliance flags.
 * 6. No Deterministic Match + AI Analysis Failed -> HUMAN_REVIEW (Safe fallback)
 *    - Never silently mark CLEAR when verification failed.
 */
export class PolicyEvaluator {
  evaluate(
    deterministicResult: DeterministicMatchResult,
    aiAnalysis: {
      data?: RestrictionAnalysisOutputDto | null;
      failed?: boolean;
      error?: string;
    },
  ): EvaluatedPolicyOutcome {
    const hasDeterministicMatch = deterministicResult.hasMatch;
    const aiData = aiAnalysis.data;
    const aiFailed = aiAnalysis.failed || !aiData;

    // Case A: Deterministic keywords detected
    if (hasDeterministicMatch) {
      if (aiFailed) {
        return {
          finalResult: RestrictionCheckResult.HUMAN_REVIEW,
          reason: `Prohibited terms detected [${deterministicResult.matchedTerms.join(', ')}], but AI contextual verification failed (${aiAnalysis.error || 'unknown error'}). Routed to Human Review.`,
          matchedRules: {
            deterministicMatches: deterministicResult.matchDetails,
            aiContextStatus: 'FAILED',
            ruleApplied: 'DETERMINISTIC_MATCH_AI_FAILED_FALLBACK',
          },
          requiresHumanReview: true,
        };
      }

      // If AI confirms restricted scope
      if (aiData.result === RestrictionCheckResult.RESTRICTED) {
        return {
          finalResult: RestrictionCheckResult.RESTRICTED,
          reason: `Prohibited structural scope detected [${deterministicResult.matchedTerms.join(', ')}] and confirmed by contextual analysis: ${aiData.reason}`,
          matchedRules: {
            deterministicMatches: deterministicResult.matchDetails,
            aiAnalysis: {
              result: aiData.result,
              reason: aiData.reason,
              confidence: aiData.confidence,
              matchedEntities: aiData.matchedKeywordsOrEntities,
            },
            ruleApplied: 'CONFIRMED_RESTRICTED_SCOPE',
          },
          requiresHumanReview: true, // Requires human intervention to unblock
        };
      }

      // If AI claims CLEAR (out of scope or small component), LOCKED RULE: Cannot auto-clear. Must route to HUMAN_REVIEW.
      return {
        finalResult: RestrictionCheckResult.HUMAN_REVIEW,
        reason: `Prohibited terms detected [${deterministicResult.matchedTerms.join(', ')}]. While AI assessed terms as potentially out of core scope (${aiData.reason}), policy requires mandatory Human Review for any prohibited structural terms.`,
        matchedRules: {
          deterministicMatches: deterministicResult.matchDetails,
          aiAnalysis: {
            result: aiData.result,
            reason: aiData.reason,
            confidence: aiData.confidence,
          },
          ruleApplied: 'DETERMINISTIC_MATCH_MANDATORY_HUMAN_REVIEW',
        },
        requiresHumanReview: true,
      };
    }

    // Case B: No deterministic matches found
    if (aiFailed) {
      return {
        finalResult: RestrictionCheckResult.HUMAN_REVIEW,
        reason: `No prohibited keywords detected, but AI contextual compliance check failed (${aiAnalysis.error || 'unknown error'}). Routed to Human Review for verification.`,
        matchedRules: {
          deterministicMatches: [],
          aiContextStatus: 'FAILED',
          ruleApplied: 'NO_KEYWORD_AI_FAILED_FALLBACK',
        },
        requiresHumanReview: true,
      };
    }

    // AI found restricted scope even without deterministic keyword
    if (aiData.result === RestrictionCheckResult.RESTRICTED) {
      return {
        finalResult: RestrictionCheckResult.RESTRICTED,
        reason: `Contextual analysis identified prohibited scope without explicit exact keyword match: ${aiData.reason}`,
        matchedRules: {
          deterministicMatches: [],
          aiAnalysis: {
            result: aiData.result,
            reason: aiData.reason,
            confidence: aiData.confidence,
          },
          ruleApplied: 'AI_DETECTED_RESTRICTION',
        },
        requiresHumanReview: true,
      };
    }

    if (aiData.result === RestrictionCheckResult.HUMAN_REVIEW || aiData.requiresHumanReview) {
      return {
        finalResult: RestrictionCheckResult.HUMAN_REVIEW,
        reason: `Contextual analysis flagged potential compliance ambiguity: ${aiData.reason}`,
        matchedRules: {
          deterministicMatches: [],
          aiAnalysis: {
            result: aiData.result,
            reason: aiData.reason,
            confidence: aiData.confidence,
          },
          ruleApplied: 'AI_REQUESTED_HUMAN_REVIEW',
        },
        requiresHumanReview: true,
      };
    }

    // Clean pass
    return {
      finalResult: RestrictionCheckResult.CLEAR,
      reason: `No prohibited structural steel keywords detected and contextual compliance check passed: ${aiData.reason}`,
      matchedRules: {
        deterministicMatches: [],
        aiAnalysis: {
          result: aiData.result,
          reason: aiData.reason,
          confidence: aiData.confidence,
        },
        ruleApplied: 'COMPLIANCE_CLEAR',
      },
      requiresHumanReview: false,
    };
  }
}
