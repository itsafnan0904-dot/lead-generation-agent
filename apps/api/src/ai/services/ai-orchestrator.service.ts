import { Injectable, Inject, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AIProvider,
  AI_PROVIDER_TOKEN,
  AICompletionResult,
  AIUsageMetadata,
} from '../interfaces/ai-provider.interface';
import {
  ResearchAnalysisOutputDto,
  LeadAnalysisOutputDto,
  EmailGenerationOutputDto,
  ReplyAnalysisOutputDto,
  QualificationAssistOutputDto,
  RestrictionAnalysisOutputDto,
  DecisionExplanationOutputDto,
} from '../dto/ai-output.dto';
import {
  RESEARCH_ANALYSIS_SCHEMA,
  LEAD_ANALYSIS_SCHEMA,
  EMAIL_GENERATION_SCHEMA,
  REPLY_ANALYSIS_SCHEMA,
  QUALIFICATION_ASSIST_SCHEMA,
  RESTRICTION_ANALYSIS_SCHEMA,
  DECISION_EXPLANATION_SCHEMA,
} from '../schemas/ai-json-schemas';
import { AIOutputValidationError } from '../errors/ai-errors';

export interface OrchestratorContext {
  leadId?: string;
  conversationId?: string;
  messageId?: string;
  userId?: string;
}

export interface OrchestratorResponse<T> {
  data: T;
  metadata: {
    modelUsed: string;
    usage: AIUsageMetadata;
    latencyMs: number;
    timestamp: Date;
    actionId?: string;
  };
}

@Injectable()
export class AIOrchestratorService {
  private readonly logger = new Logger(AIOrchestratorService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly aiProvider: AIProvider,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 1. Capability: Analyze Research
   * NOTE: Prompt content is a baseline placeholder — will be refined when ResearchModule is implemented.
   */
  async analyzeResearch(
    input: { companyName: string; rawResearchText: string },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<ResearchAnalysisOutputDto>> {
    const systemPrompt =
      'You are an expert enterprise sales research analyst. Extract key business insights, tech stack, pain points, and company summary into the exact requested JSON schema.';
    const prompt = `Analyze the following company data for "${input.companyName}":\n\n${input.rawResearchText}`;

    return this.executeCapability<ResearchAnalysisOutputDto>(
      'ANALYZE_RESEARCH',
      ResearchAnalysisOutputDto,
      RESEARCH_ANALYSIS_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );
  }

  /**
   * 2. Capability: Analyze Lead & Score
   * NOTE: Prompt content is a baseline placeholder — will be refined when LeadScoringModule is implemented.
   */
  async analyzeLead(
    input: { leadSummary: string; companyData: string; contactData?: string },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<LeadAnalysisOutputDto>> {
    const systemPrompt =
      'You are an expert sales qualification and lead scoring AI. Evaluate lead fit across service match, company relevance, contact quality, project potential, and location into the exact requested JSON schema.';
    const prompt = `Evaluate the following lead data:\nSummary: ${input.leadSummary}\nCompany: ${input.companyData}\nContact: ${input.contactData || 'N/A'}`;

    return this.executeCapability<LeadAnalysisOutputDto>(
      'SCORE_LEAD',
      LeadAnalysisOutputDto,
      LEAD_ANALYSIS_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );
  }

  /**
   * 3. Capability: Generate Personalized Email
   */
  async generateEmail(
    input: {
      recipientName: string;
      companyName: string;
      contextNotes: string;
      tone?: string;
      senderName?: string;
      senderTitle?: string;
      senderCompany?: string;
      senderEmail?: string;
    },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<EmailGenerationOutputDto>> {
    const senderName = input.senderName?.trim() || 'Sales Team';
    const senderTitle = input.senderTitle?.trim() || 'Account Executive';
    const senderCompany = input.senderCompany?.trim() || process.env.SENDER_COMPANY_NAME || 'Enterprise Solutions';
    const senderEmail = input.senderEmail?.trim() || '';

    const systemPrompt =
      'You are a high-converting enterprise B2B sales copywriter. Write a concise, personalized outreach email adhering to the exact requested JSON schema.\n\n' +
      'SENDER AND IDENTITY INSTRUCTIONS:\n' +
      `1. You represent "${senderCompany}". When referencing your company in the email body, refer to it as "${senderCompany}" or "our team".\n` +
      `2. Sign off the email using the real Sender Name ("${senderName}"), Title ("${senderTitle}"), and provided Contact Info.\n` +
      '3. CRITICAL: NEVER output generic template placeholder markers or bracketed tokens under ANY circumstances (e.g. "[Your Name]", "[Your Title]", "[Your Position]", "[Your Company]", "[Company Name]", "[Your Contact Information]", "[Phone Number]", "[Email]", or any text enclosed in square brackets "[...]").\n' +
      '4. All output MUST be concrete, fully substituted, production-ready text.';

    const senderDetails: string[] = [
      `- Sender Name: ${senderName}`,
      `- Sender Title: ${senderTitle}`,
      `- Sender Company: ${senderCompany}`,
    ];
    if (senderEmail) senderDetails.push(`- Sender Email: ${senderEmail}`);

    const prompt =
      `Write a personalized sales outreach email to ${input.recipientName} at ${input.companyName}.\n` +
      `Tone: ${input.tone || 'professional and consultative'}\n\n` +
      `SENDER DETAILS (Use these exact details for identity and signature):\n` +
      `${senderDetails.join('\n')}\n\n` +
      `CONTEXT & PROSPECT DATA:\n` +
      `${input.contextNotes}\n\n` +
      `STRICT INSTRUCTION:\n` +
      `Represent "${senderCompany}" and sign off directly with "${senderName}". Do NOT use bracketed placeholder tokens like "[Your Name]" or "[Your Company]" anywhere in the subject or body. All values must be real and concrete.`;

    const response = await this.executeCapability<EmailGenerationOutputDto>(
      'DRAFT_EMAIL',
      EmailGenerationOutputDto,
      EMAIL_GENERATION_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );

    // Defense-in-depth: Sanitize any stray bracketed placeholder tokens from the AI output
    if (response.data) {
      const replacements = {
        senderName,
        senderCompany,
        senderTitle,
        senderEmail,
        recipientName: input.recipientName,
        companyName: input.companyName,
      };
      response.data.subject = this.sanitizePlaceholders(response.data.subject, replacements);
      response.data.bodyText = this.sanitizePlaceholders(response.data.bodyText, replacements);
      if (response.data.bodyHtml) {
        response.data.bodyHtml = this.sanitizePlaceholders(response.data.bodyHtml, replacements);
      }
    }

    return response;
  }

  private sanitizePlaceholders(
    text: string,
    replacements: {
      senderName: string;
      senderCompany: string;
      senderTitle?: string;
      senderEmail?: string;
      recipientName?: string;
      companyName?: string;
    },
  ): string {
    if (!text) return text;
    return text
      .replace(/\[(?:Your\s+)?(?:Company(?:\s+Name)?|Sender\s+Company)\]/gi, replacements.senderCompany)
      .replace(/\[(?:Your\s+)?(?:Name|Sender\s+Name)\]/gi, replacements.senderName)
      .replace(/\[(?:Your\s+)?(?:Title|Position|Role|Job\s+Title)\]/gi, replacements.senderTitle || 'Account Executive')
      .replace(/\[(?:Your\s+)?(?:Contact(?:\s+Information)?|Email|Phone(?:\s+Number)?)\]/gi, replacements.senderEmail || '')
      .replace(/\[(?:Recipient(?:\s+Name)?|Prospect(?:\s+Name)?)\]/gi, replacements.recipientName || '')
      .replace(/\[(?:Recipient|Prospect|Target)\s+Company(?:\s+Name)?\]/gi, replacements.companyName || '');
  }

  /**
   * 4. Capability: Analyze Inbound Email Reply
   * NOTE: Prompt content is a baseline placeholder — will be refined when ConversationModule is implemented.
   */
  async analyzeReply(
    input: { messageBody: string; emailSubject?: string; previousThreadSummary?: string },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<ReplyAnalysisOutputDto>> {
    const systemPrompt =
      'You are an expert sales conversation intelligence AI. Analyze inbound email replies for intent, sentiment, objections, and suggest the next best action and stage.';
    const prompt = `Analyze this email reply:\nSubject: ${input.emailSubject || 'N/A'}\nThread Context: ${input.previousThreadSummary || 'N/A'}\nMessage: ${input.messageBody}`;

    return this.executeCapability<ReplyAnalysisOutputDto>(
      'ANALYZE_REPLY',
      ReplyAnalysisOutputDto,
      REPLY_ANALYSIS_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );
  }

  /**
   * 5. Capability: Assist Qualification (BANT Fit)
   * NOTE: Prompt content is a baseline placeholder — will be refined when QualificationModule is implemented.
   */
  async assistQualification(
    input: { leadId: string; collectedAnswers: Record<string, any>; notes?: string },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<QualificationAssistOutputDto>> {
    const systemPrompt =
      'You are an expert sales qualification engineer. Assess budget, authority, need, timeline, and technical fit into the exact requested JSON schema.';
    const prompt = `Evaluate qualification data for Lead ID ${input.leadId}:\nAnswers: ${JSON.stringify(input.collectedAnswers, null, 2)}\nNotes: ${input.notes || 'None'}`;

    return this.executeCapability<QualificationAssistOutputDto>(
      'EXTRACT_REQUIREMENTS',
      QualificationAssistOutputDto,
      QUALIFICATION_ASSIST_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );
  }

  /**
   * 6. Capability: Analyze Restrictions & Compliance
   * NOTE: Prompt content is a baseline placeholder — will be refined when RestrictionModule is implemented.
   */
  async analyzeRestriction(
    input: { entityName: string; domain?: string; notes?: string },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<RestrictionAnalysisOutputDto>> {
    const systemPrompt =
      'You are an enterprise compliance and restriction engine. Check for competitor conflicts, embargoes, or blacklists into the exact requested JSON schema.';
    const prompt = `Check restriction status for:\nEntity: ${input.entityName}\nDomain: ${input.domain || 'N/A'}\nNotes: ${input.notes || 'None'}`;

    return this.executeCapability<RestrictionAnalysisOutputDto>(
      'RESTRICTION_CHECK',
      RestrictionAnalysisOutputDto,
      RESTRICTION_ANALYSIS_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );
  }

  /**
   * 7. Capability: Explain Decision & Provide Audit Trail
   * NOTE: Prompt content is a baseline placeholder — will be refined when Audit/Explanation logic is implemented.
   */
  async explainDecision(
    input: { decisionType: string; contextData: Record<string, any> },
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<DecisionExplanationOutputDto>> {
    const systemPrompt =
      'You are a transparent AI decision-auditing assistant. Formulate clear, concise explanations of why an automated action was taken into the exact requested JSON schema.';
    const prompt = `Explain decision "${input.decisionType}" based on this context:\n${JSON.stringify(input.contextData, null, 2)}`;

    return this.executeCapability<DecisionExplanationOutputDto>(
      'EXPLAIN_DECISION',
      DecisionExplanationOutputDto,
      DECISION_EXPLANATION_SCHEMA,
      prompt,
      systemPrompt,
      context,
    );
  }

  /**
   * Central core execution pipeline:
   * 1. Calls AIProvider with schema enforcement
   * 2. Validates output using class-validator / class-transformer
   * 3. Implements 1 bounded correction retry if output fails schema validation
   * 4. Persists execution audit and usage metadata in AIAction table
   * 5. Returns typed result and metadata (never exposing internal chain-of-thought)
   */
  private async executeCapability<T extends object>(
    actionType: string,
    dtoClass: new () => T,
    schemaDef: any,
    prompt: string,
    systemPrompt?: string,
    context?: OrchestratorContext,
  ): Promise<OrchestratorResponse<T>> {
    const timestamp = new Date();
    let completionResult: AICompletionResult;

    try {
      completionResult = await this.aiProvider.complete({
        prompt,
        systemPrompt,
        schema: schemaDef,
      });
    } catch (err: any) {
      await this.persistUsageLog({
        actionType,
        promptSnapshot: prompt,
        rawOutput: null,
        parsedPayload: null,
        modelUsed: process.env.AI_MODEL || 'gpt-4o-mini',
        tokenUsage: null,
        latencyMs: null,
        status: 'FAILED',
        errorMessage: err.message,
        context,
      });
      throw err;
    }

    // Validate structured output against DTO schema
    let validatedDto: T;
    try {
      validatedDto = await this.validateAndTransform(dtoClass, completionResult.parsedContent);
    } catch (validationErr: any) {
      this.logger.warn(`Initial schema validation failed for ${actionType}: ${validationErr.message}. Attempting 1 self-correction retry...`);

      // Bounded 1-time correction retry
      try {
        const correctionPrompt = `${prompt}\n\nIMPORTANT: Your previous output failed schema validation with errors: ${JSON.stringify(validationErr.errors)}. Please correct your response and adhere strictly to the JSON schema.`;
        completionResult = await this.aiProvider.complete({
          prompt: correctionPrompt,
          systemPrompt,
          schema: schemaDef,
        });
        validatedDto = await this.validateAndTransform(dtoClass, completionResult.parsedContent);
      } catch (retryErr: any) {
        this.logger.error(`Self-correction retry failed for ${actionType}: ${retryErr.message}`);
        await this.persistUsageLog({
          actionType,
          promptSnapshot: prompt,
          rawOutput: completionResult.rawContent,
          parsedPayload: completionResult.parsedContent || null,
          modelUsed: completionResult.modelUsed,
          tokenUsage: completionResult.usage,
          latencyMs: completionResult.latencyMs,
          status: 'FAILED',
          errorMessage: `Schema validation failed: ${retryErr.message}`,
          context,
        });
        throw new AIOutputValidationError(
          `AI output failed schema validation after correction retry: ${retryErr.message}`,
          retryErr.errors || validationErr.errors,
          completionResult.rawContent,
        );
      }
    }

    // Persist successful execution audit record
    const savedActionId = await this.persistUsageLog({
      actionType,
      promptSnapshot: prompt,
      rawOutput: completionResult.rawContent,
      parsedPayload: validatedDto as any,
      modelUsed: completionResult.modelUsed,
      tokenUsage: completionResult.usage,
      latencyMs: completionResult.latencyMs,
      status: 'EXECUTED',
      context,
    });

    return {
      data: validatedDto,
      metadata: {
        modelUsed: completionResult.modelUsed,
        usage: completionResult.usage,
        latencyMs: completionResult.latencyMs,
        timestamp,
        actionId: savedActionId,
      },
    };
  }

  private async validateAndTransform<T extends object>(
    dtoClass: new () => T,
    parsedData: any,
  ): Promise<T> {
    if (!parsedData || typeof parsedData !== 'object') {
      throw new AIOutputValidationError('Parsed AI output is empty or not a valid JSON object');
    }

    const instance = plainToInstance(dtoClass, parsedData);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((e) => Object.values(e.constraints || {})).flat();
      throw new AIOutputValidationError(
        `Validation constraints violated: ${errorMessages.join('; ')}`,
        errors,
      );
    }

    return instance;
  }

  private async persistUsageLog(params: {
    actionType: string;
    promptSnapshot: string;
    rawOutput: string | null;
    parsedPayload: any;
    modelUsed: string;
    tokenUsage: AIUsageMetadata | null;
    latencyMs: number | null;
    status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'REJECTED';
    errorMessage?: string;
    context?: OrchestratorContext;
  }): Promise<string | undefined> {
    try {
      if (!this.prisma?.client?.aIAction) {
        return undefined;
      }

      const created = await this.prisma.client.aIAction.create({
        data: {
          actionType: params.actionType,
          promptSnapshot: params.promptSnapshot,
          rawOutput: params.rawOutput,
          parsedPayload: params.parsedPayload,
          modelUsed: params.modelUsed,
          tokenUsage: params.tokenUsage ? (params.tokenUsage as any) : undefined,
          latencyMs: params.latencyMs,
          status: params.status,
          errorMessage: params.errorMessage || null,
          leadId: params.context?.leadId || null,
          conversationId: params.context?.conversationId || null,
          messageId: params.context?.messageId || null,
        },
        select: { id: true },
      });

      return created.id;
    } catch (err: any) {
      // Non-fatal logging: Orchestration result should not be lost if audit persistence fails
      this.logger.warn(`Failed to persist AIAction log: ${err.message}`);
      return undefined;
    }
  }
}
