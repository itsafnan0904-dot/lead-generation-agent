/**
 * Preliminary restriction keywords representing prohibited structural steel / joist / decking items.
 * NOTE: This is explicitly a lightweight placeholder check and is NOT the full multi-layered
 * RestrictionCheck policy engine (which will be built in Prompt 10).
 */
export const PRELIMINARY_RESTRICTION_KEYWORDS = [
  'OWSJ',
  'K-Series',
  'LH-Series',
  'DLH-Series',
  'Joist girders',
  'Steel decking',
  'Decking',
  'deck work',
];

export interface PreliminaryRestrictionResult {
  flagged: boolean;
  matchedKeywords: string[];
  explanation: string;
}

export function checkPreliminaryRestrictionKeywords(
  textCorpus: string,
): PreliminaryRestrictionResult {
  if (!textCorpus) {
    return {
      flagged: false,
      matchedKeywords: [],
      explanation: 'No text provided for preliminary restriction scan.',
    };
  }

  const lowerText = textCorpus.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const keyword of PRELIMINARY_RESTRICTION_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    // Use word-boundary or substring check
    const regex = new RegExp(`\\b${lowerKeyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
    if (regex.test(lowerText) || lowerText.includes(lowerKeyword)) {
      matchedKeywords.push(keyword);
    }
  }

  const flagged = matchedKeywords.length > 0;
  const explanation = flagged
    ? `Preliminary scan detected potential restricted structural keywords: [${matchedKeywords.join(', ')}]. Pending full policy evaluation in Prompt 10.`
    : 'Preliminary scan clear: No prohibited structural keywords detected in known text.';

  return {
    flagged,
    matchedKeywords,
    explanation,
  };
}
