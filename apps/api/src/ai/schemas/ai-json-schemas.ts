import { AISchemaDefinition } from '../interfaces/ai-provider.interface';

export const RESEARCH_ANALYSIS_SCHEMA: AISchemaDefinition = {
  name: 'research_analysis_response',
  description: 'Structured comprehensive research analysis schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Executive summary of research findings' },
      keyInsights: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key business insights discovered',
      },
      techStack: {
        type: 'array',
        items: { type: 'string' },
        description: 'Identified tech stack components',
      },
      painPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Potential business pain points',
      },
      recentEvents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recent corporate news or milestone events',
      },
      confidenceScore: {
        type: 'number',
        description: 'Confidence score from 0.0 to 1.0',
      },
    },
    required: ['summary', 'keyInsights', 'techStack', 'painPoints', 'recentEvents', 'confidenceScore'],
    additionalProperties: false,
  },
};

export const LEAD_ANALYSIS_SCHEMA: AISchemaDefinition = {
  name: 'lead_analysis_response',
  description: 'Structured lead analysis and scoring schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      totalScore: { type: 'number', description: 'Total lead score from 0 to 100' },
      scoreBreakdown: {
        type: 'object',
        properties: {
          serviceMatch: { type: 'number', description: 'Service match score 0-40' },
          companyRelevance: { type: 'number', description: 'Company relevance score 0-20' },
          contactQuality: { type: 'number', description: 'Contact quality score 0-15' },
          projectPotential: { type: 'number', description: 'Project potential score 0-15' },
          locationMatch: { type: 'number', description: 'Location match score 0-10' },
        },
        required: ['serviceMatch', 'companyRelevance', 'contactQuality', 'projectPotential', 'locationMatch'],
        additionalProperties: false,
      },
      recommendedStage: {
        type: 'string',
        enum: [
          'COLD_LEAD',
          'CONTACTED',
          'RESPONDED',
          'INTERESTED',
          'GATHERING_REQUIREMENTS',
          'QUALIFIED',
          'DEAL_DISCUSSION',
          'WON',
          'LOST',
          'WAITING_FOR_CLIENT',
          'FOLLOW_UP_REQUIRED',
          'HUMAN_REVIEW',
          'RESTRICTED',
          'DISQUALIFIED',
        ],
        description: 'Recommended lifecycle status stage',
      },
      justification: { type: 'string', description: 'Reasoning behind the score' },
      keyStrengths: { type: 'array', items: { type: 'string' }, description: 'Positive lead indicators' },
      potentialRisks: { type: 'array', items: { type: 'string' }, description: 'Risks or potential blockers' },
      requiresHumanReview: { type: 'boolean', description: 'Whether manual human review is required' },
    },
    required: ['totalScore', 'scoreBreakdown', 'recommendedStage', 'justification', 'keyStrengths', 'potentialRisks', 'requiresHumanReview'],
    additionalProperties: false,
  },
};

export const EMAIL_GENERATION_SCHEMA: AISchemaDefinition = {
  name: 'email_generation_response',
  description: 'Structured email draft generation schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Compelling email subject line' },
      bodyText: { type: 'string', description: 'Plain text email body' },
      bodyHtml: { type: 'string', description: 'Formatted HTML email body (optional)' },
      callToAction: { type: 'string', description: 'Primary call to action in the email' },
      rationale: { type: 'string', description: 'Strategic rationale for messaging angle' },
      personalizationPointsUsed: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific lead/company personalization details used',
      },
    },
    required: ['subject', 'bodyText', 'bodyHtml', 'callToAction', 'rationale', 'personalizationPointsUsed'],
    additionalProperties: false,
  },
};

export const REPLY_ANALYSIS_SCHEMA: AISchemaDefinition = {
  name: 'reply_analysis_response',
  description: 'Structured inbound email reply analysis schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'INTERESTED',
          'NOT_INTERESTED',
          'MORE_INFO_REQUESTED',
          'OUT_OF_OFFICE',
          'OBJECTION_RAISED',
          'UNSUBSCRIBE',
          'NEUTRAL',
        ],
        description: 'Detected prospect intent',
      },
      sentiment: {
        type: 'string',
        enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'HOSTILE'],
        description: 'Overall sentiment',
      },
      suggestedLeadStage: {
        type: 'string',
        enum: [
          'COLD_LEAD',
          'CONTACTED',
          'RESPONDED',
          'INTERESTED',
          'GATHERING_REQUIREMENTS',
          'QUALIFIED',
          'DEAL_DISCUSSION',
          'WON',
          'LOST',
          'WAITING_FOR_CLIENT',
          'FOLLOW_UP_REQUIRED',
          'HUMAN_REVIEW',
          'RESTRICTED',
          'DISQUALIFIED',
        ],
        description: 'Next appropriate lifecycle stage',
      },
      objectionsIdentified: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific objections raised',
      },
      questionsAsked: {
        type: 'array',
        items: { type: 'string' },
        description: 'Questions asked by the prospect',
      },
      requiresHumanIntervention: {
        type: 'boolean',
        description: 'Whether human intervention is needed',
      },
      recommendedNextAction: {
        type: 'string',
        description: 'Recommended next tactical action',
      },
      draftFollowUp: {
        type: 'string',
        description: 'Initial draft response suggested by AI',
      },
    },
    required: [
      'intent',
      'sentiment',
      'suggestedLeadStage',
      'objectionsIdentified',
      'questionsAsked',
      'requiresHumanIntervention',
      'recommendedNextAction',
      'draftFollowUp',
    ],
    additionalProperties: false,
  },
};

export const QUALIFICATION_ASSIST_SCHEMA: AISchemaDefinition = {
  name: 'qualification_assist_response',
  description: 'Structured lead BANT/qualification assist schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      fitEvaluation: {
        type: 'object',
        properties: {
          budgetFit: { type: 'boolean', description: 'Budget alignment' },
          authorityFit: { type: 'boolean', description: 'Decision maker authority alignment' },
          needFit: { type: 'boolean', description: 'Business problem need alignment' },
          timelineFit: { type: 'boolean', description: 'Delivery timeline feasibility' },
          technicalFit: { type: 'boolean', description: 'Technical scope alignment' },
        },
        required: ['budgetFit', 'authorityFit', 'needFit', 'timelineFit', 'technicalFit'],
        additionalProperties: false,
      },
      fitSummary: { type: 'string', description: 'Concise qualification summary' },
      missingInformation: {
        type: 'array',
        items: { type: 'string' },
        description: 'Missing criteria needing discovery',
      },
      dealBlockers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Potential deal-breaking blockers',
      },
      isQualified: { type: 'boolean', description: 'Whether the lead meets qualification threshold' },
      recommendedQuestionsToAsk: {
        type: 'array',
        items: { type: 'string' },
        description: 'High-impact qualification questions for the next touchpoint',
      },
    },
    required: ['fitEvaluation', 'fitSummary', 'missingInformation', 'dealBlockers', 'isQualified', 'recommendedQuestionsToAsk'],
    additionalProperties: false,
  },
};

export const RESTRICTION_ANALYSIS_SCHEMA: AISchemaDefinition = {
  name: 'restriction_analysis_response',
  description: 'Structured enterprise restriction and compliance analysis schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      result: {
        type: 'string',
        enum: ['CLEAR', 'HUMAN_REVIEW', 'RESTRICTED'],
        description: 'Compliance & restriction classification',
      },
      reason: { type: 'string', description: 'Detailed compliance justification' },
      matchedKeywordsOrEntities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Identified restriction triggers or competitor entities',
      },
      requiresHumanReview: { type: 'boolean', description: 'Whether compliance officer review is needed' },
      confidence: { type: 'number', description: 'Confidence level between 0.0 and 1.0' },
    },
    required: ['result', 'reason', 'matchedKeywordsOrEntities', 'requiresHumanReview', 'confidence'],
    additionalProperties: false,
  },
};

export const DECISION_EXPLANATION_SCHEMA: AISchemaDefinition = {
  name: 'decision_explanation_response',
  description: 'Structured AI decision explanation and audit schema',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      actionType: { type: 'string', description: 'Action type explained' },
      primaryReason: { type: 'string', description: 'Primary rationale' },
      supportingFactors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Supporting evidence and data points',
      },
      tradeoffsConsidered: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alternative options or tradeoffs evaluated',
      },
      confidenceAssessment: { type: 'string', description: 'Qualitative confidence summary' },
    },
    required: ['actionType', 'primaryReason', 'supportingFactors', 'tradeoffsConsidered', 'confidenceAssessment'],
    additionalProperties: false,
  },
};
