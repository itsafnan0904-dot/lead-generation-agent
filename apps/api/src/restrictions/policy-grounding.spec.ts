import { PolicyEvaluator, isGroundedInText } from './layers/policy-evaluator.layer';
import { RestrictionCheckResult } from '@ai-sales-agent/database';

describe('PolicyEvaluator: AI-only flags must be grounded in the text', () => {
  const evaluator = new PolicyEvaluator();
  const noMatch = { hasMatch: false, matchedTerms: [], matchDetails: [] };
  const corpus = 'Subject: Re: Enhancing Your Online Presence\nBody: Could you tell me about the online stores you have built?\nCompany: Harbor & Pine Outfitters';
  const ai = (over: any = {}) => ({
    data: { result: 'RESTRICTED', reason: 'may be gambling', matchedKeywordsOrEntities: ['Gambling'], requiresHumanReview: true, confidence: 0.85, ...over },
  }) as any;

  it('ignores a RESTRICTED flag that quotes nothing (the hallucination seen in the live run)', () => {
    const r = evaluator.evaluate(noMatch, ai({ evidenceQuote: '' }), corpus);
    expect(r.finalResult).toBe(RestrictionCheckResult.CLEAR);
    expect(r.matchedRules.ruleApplied).toBe('AI_FLAG_UNGROUNDED_IGNORED');
    expect(r.requiresHumanReview).toBe(false);
  });

  it('ignores a flag whose quote does not appear in the text', () => {
    const r = evaluator.evaluate(noMatch, ai({ evidenceQuote: 'we run an online casino' }), corpus);
    expect(r.finalResult).toBe(RestrictionCheckResult.CLEAR);
  });

  it('ignores an ungrounded HUMAN_REVIEW flag too', () => {
    const r = evaluator.evaluate(noMatch, ai({ result: 'HUMAN_REVIEW', evidenceQuote: undefined }), corpus);
    expect(r.finalResult).toBe(RestrictionCheckResult.CLEAR);
  });

  it('still restricts when the AI quotes real words from the text, ignoring case and punctuation', () => {
    const text = 'Hello, we operate a sports-betting and Gambling site and need a storefront.';
    const r = evaluator.evaluate(noMatch, ai({ evidenceQuote: 'Sports betting and gambling site' }), text);
    expect(r.finalResult).toBe(RestrictionCheckResult.RESTRICTED);
    expect(r.matchedRules.ruleApplied).toBe('AI_DETECTED_RESTRICTION');
  });

  it('never weakens a deterministic keyword match', () => {
    const det = { hasMatch: true, matchedTerms: ['Gambling'], matchDetails: [{ term: 'Gambling', matchedPattern: 'gambling' }] };
    const r = evaluator.evaluate(det, ai({ result: 'CLEAR', evidenceQuote: '', requiresHumanReview: false }), 'a gambling site');
    expect(r.finalResult).toBe(RestrictionCheckResult.HUMAN_REVIEW);
  });

  it('keeps the previous behaviour when no text is supplied (older callers)', () => {
    const r = evaluator.evaluate(noMatch, ai({ evidenceQuote: undefined }));
    expect(r.finalResult).toBe(RestrictionCheckResult.RESTRICTED);
  });

  it('a clean AI result stays CLEAR', () => {
    const r = evaluator.evaluate(noMatch, ai({ result: 'CLEAR', requiresHumanReview: false, evidenceQuote: '' }), corpus);
    expect(r.finalResult).toBe(RestrictionCheckResult.CLEAR);
  });
});

describe('isGroundedInText', () => {
  it('requires a real, long-enough verbatim quote', () => {
    expect(isGroundedInText('online stores', 'tell me about the Online   Stores you built')).toBe(true);
    expect(isGroundedInText('abc', 'abc abc')).toBe(false); // too short to count as evidence
    expect(isGroundedInText(undefined, 'anything')).toBe(false);
    expect(isGroundedInText('online casino', 'online stores')).toBe(false);
  });
});
