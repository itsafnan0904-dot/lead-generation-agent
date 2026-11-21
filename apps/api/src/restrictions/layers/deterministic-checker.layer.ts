/**
 * Hardcoded restricted keywords/phrases representing prohibited structural steel, joist, and decking scopes.
 * LOCKED LIST:
 * - OWSJ (Open Web Steel Joists)
 * - K-Series, LH-Series, DLH-Series
 * - Joist girders
 * - Steel decking, Decking, Deck work
 */
export const RESTRICTED_TERMS_LIST = [
  'OWSJ',
  'Open Web Steel Joist',
  'Open Web Steel Joists',
  'K-Series',
  'LH-Series',
  'DLH-Series',
  'Joist girder',
  'Joist girders',
  'Steel decking',
  'Steel deck',
  'Decking',
  'Deck work',
] as const;

export interface DeterministicMatchResult {
  hasMatch: boolean;
  matchedTerms: string[];
  matchDetails: {
    term: string;
    matchedPattern: string;
    snippet?: string;
  }[];
}

/**
 * A seller-defined restriction term (from RestrictionRule) layered on top of the built-in list.
 */
export interface ExtraRestrictionTerm {
  term: string;
  source: 'SERVICE' | 'INDUSTRY' | 'KEYWORD';
  reason?: string | null;
}

export class DeterministicRestrictionChecker {
  /**
   * Performs high-recall keyword and phrase matching against provided text payloads.
   * Matches word boundaries, case-insensitively, and handles hyphens/plurals.
   */
  check(textCorpus: string, extraTerms: ExtraRestrictionTerm[] = []): DeterministicMatchResult {
    if (!textCorpus || typeof textCorpus !== 'string') {
      return {
        hasMatch: false,
        matchedTerms: [],
        matchDetails: [],
      };
    }

    const matchedTermsSet = new Set<string>();
    const matchDetails: DeterministicMatchResult['matchDetails'] = [];

    // Built-in locked list plus seller-defined terms (de-duplicated, case-insensitive).
    const seen = new Set<string>(RESTRICTED_TERMS_LIST.map((t) => t.toLowerCase()));
    const terms: string[] = [...RESTRICTED_TERMS_LIST];
    for (const extra of extraTerms) {
      const t = extra.term?.trim();
      if (t && !seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        terms.push(t);
      }
    }

    for (const term of terms) {
      // Escape regex special chars
      const escapedTerm = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Construct regex with word boundaries. For terms with hyphens (e.g. K-Series), allow flexible spacing/hyphens
      const normalizedPattern = escapedTerm.replace(/\\-/g, '[-\\s]?').replace(/ +/g, '\\s+');
      const regex = new RegExp(`\\b${normalizedPattern}(?:s|es|ing)?\\b`, 'i');

      const match = textCorpus.match(regex);
      if (match) {
        matchedTermsSet.add(term);
        // Extract surrounding context snippet (up to 50 chars before and after)
        const matchIdx = match.index ?? -1;
        let snippet = match[0];
        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 30);
          const end = Math.min(textCorpus.length, matchIdx + match[0].length + 30);
          snippet = `...${textCorpus.substring(start, end).trim()}...`;
        }

        matchDetails.push({
          term,
          matchedPattern: match[0],
          snippet,
        });
      }
    }

    const matchedTerms = Array.from(matchedTermsSet);
    return {
      hasMatch: matchedTerms.length > 0,
      matchedTerms,
      matchDetails,
    };
  }
}
