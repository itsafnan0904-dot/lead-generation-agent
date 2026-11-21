import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SellerContext {
  displayName: string;
  companyName: string | null;
  title: string | null;
  tone: string | null;
  signature: string | null;
  /** Prompt-ready description of who is selling and what. */
  pitchContext: string;
  /** Prompt-ready description of what the seller sells and where they sell it. */
  scoringContext: string;
  targetCountryCodes: string[];
}

const PROFILE_INCLUDE = {
  services: { where: { isActive: true }, orderBy: { createdAt: 'asc' as const } },
  targetMarkets: { where: { isActive: true }, orderBy: { createdAt: 'asc' as const } },
};

/**
 * Turns a seller profile into prompt-ready context for scoring and outreach.
 * Profile selection: the given user's profile, else the earliest completed profile
 * (single-seller deployments), else null so callers keep their existing defaults.
 */
@Injectable()
export class SellerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(userId?: string | null): Promise<SellerContext | null> {
    let profile = userId
      ? await this.prisma.client.sellerProfile.findUnique({ where: { userId }, include: PROFILE_INCLUDE })
      : null;

    if (!profile) {
      profile = await this.prisma.client.sellerProfile.findFirst({
        where: { onboardingComplete: true },
        orderBy: { createdAt: 'asc' },
        include: PROFILE_INCLUDE,
      });
    }
    if (!profile) return null;

    const services = profile.services.map((s) => {
      const price = s.priceMin || s.priceMax ? ` (${s.currency} ${s.priceMin ?? '?'}–${s.priceMax ?? '?'})` : '';
      const kw = s.keywords.length ? ` [keywords: ${s.keywords.join(', ')}]` : '';
      return `- ${s.name}${s.description ? `: ${s.description}` : ''}${price}${kw}`;
    });
    const markets = profile.targetMarkets.map(
      (m) => `${m.countryCode}${m.industries.length ? ` (industries: ${m.industries.join(', ')})` : ''}`,
    );

    const scoringContext = [
      'SELLER OFFERING (score serviceMatch against these services only):',
      services.length ? services.join('\n') : '- (no services defined)',
      `SELLER TARGET COUNTRIES (score locationMatch against these; a lead outside them should score low): ${markets.length ? markets.join('; ') : 'not specified'}`,
    ].join('\n');

    const pitchContext = [
      `Seller: ${profile.displayName}${profile.title ? `, ${profile.title}` : ''}${profile.companyName ? ` at ${profile.companyName}` : ''}`,
      profile.bio ? `About the seller: ${profile.bio}` : '',
      profile.skills.length ? `Skills: ${profile.skills.join(', ')}` : '',
      profile.yearsExperience != null ? `Experience: ${profile.yearsExperience} years` : '',
      'Services the seller can offer (pitch only these; never invent other services):',
      services.length ? services.join('\n') : '- (no services defined)',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      displayName: profile.displayName,
      companyName: profile.companyName,
      title: profile.title,
      tone: profile.tone,
      signature: profile.signature,
      pitchContext,
      scoringContext,
      targetCountryCodes: profile.targetMarkets.map((m) => m.countryCode),
    };
  }
}
