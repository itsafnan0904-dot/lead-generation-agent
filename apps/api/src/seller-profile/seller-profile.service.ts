import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpsertSellerProfileDto,
  SetResumeDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateTargetMarketDto,
  UpdateTargetMarketDto,
  CreateRestrictionRuleDto,
  UpdateRestrictionRuleDto,
  CreateInterventionRuleDto,
  UpdateInterventionRuleDto,
} from './dto/seller-profile.dto';
import { parseResumeText } from './utils/resume-parser.util';

const FULL_INCLUDE = {
  services: { orderBy: { createdAt: 'asc' as const } },
  targetMarkets: { orderBy: { createdAt: 'asc' as const } },
  restrictionRules: { orderBy: { createdAt: 'asc' as const } },
  interventionRules: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class SellerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- profile

  async getMyProfile(userId: string) {
    const profile = await this.prisma.client.sellerProfile.findUnique({
      where: { userId },
      include: FULL_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException('Seller profile not found. Complete onboarding first.');
    }
    return profile;
  }

  async upsertProfile(userId: string, dto: UpsertSellerProfileDto) {
    const { caseStudies, ...rest } = dto;
    const data = {
      ...rest,
      ...(caseStudies !== undefined ? { caseStudies: caseStudies as any } : {}),
    };
    return this.prisma.client.sellerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: FULL_INCLUDE,
    });
  }

  async setResume(userId: string, dto: SetResumeDto) {
    const profile = await this.requireProfile(userId);
    const parsed = parseResumeText(dto.resumeText);

    const data: Record<string, unknown> = {
      resumeText: dto.resumeText,
      resumeFileName: dto.resumeFileName ?? null,
      resumeParsedData: parsed as any,
    };

    if (dto.applyToProfile) {
      const merged = new Set([...profile.skills, ...parsed.skills]);
      data.skills = [...merged];
      if (parsed.yearsExperience !== null && profile.yearsExperience === null) {
        data.yearsExperience = parsed.yearsExperience;
      }
    }

    const updated = await this.prisma.client.sellerProfile.update({
      where: { id: profile.id },
      data,
      include: FULL_INCLUDE,
    });
    return { profile: updated, parsed };
  }

  /**
   * Onboarding is complete only when the AI has enough to pitch with:
   * a profile, at least one active service and at least one active target market.
   */
  async completeOnboarding(userId: string) {
    const profile = await this.getMyProfile(userId);
    const missing: string[] = [];
    if (!profile.services.some((s) => s.isActive)) missing.push('at least one active service');
    if (!profile.targetMarkets.some((m) => m.isActive)) missing.push('at least one target country');
    if (missing.length) {
      throw new BadRequestException(`Onboarding incomplete: add ${missing.join(' and ')}.`);
    }
    return this.prisma.client.sellerProfile.update({
      where: { id: profile.id },
      data: { onboardingComplete: true },
      include: FULL_INCLUDE,
    });
  }

  // --------------------------------------------------------------- services

  async createService(userId: string, dto: CreateServiceDto) {
    this.assertPriceRange(dto.priceMin, dto.priceMax);
    const profile = await this.requireProfile(userId);
    return this.prisma.client.sellerService.create({
      data: { profileId: profile.id, ...dto, currency: dto.currency?.toUpperCase() },
    });
  }

  async updateService(userId: string, id: string, dto: UpdateServiceDto) {
    const existing = await this.requireOwned('sellerService', userId, id);
    this.assertPriceRange(dto.priceMin ?? Number(existing.priceMin ?? undefined), dto.priceMax ?? Number(existing.priceMax ?? undefined));
    return this.prisma.client.sellerService.update({
      where: { id },
      data: { ...dto, currency: dto.currency?.toUpperCase() },
    });
  }

  async deleteService(userId: string, id: string) {
    await this.requireOwned('sellerService', userId, id);
    await this.prisma.client.sellerService.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------- target markets

  async createTargetMarket(userId: string, dto: CreateTargetMarketDto) {
    this.assertSizeRange(dto.minCompanySize, dto.maxCompanySize);
    const profile = await this.requireProfile(userId);
    const countryCode = dto.countryCode.toUpperCase();
    const dup = await this.prisma.client.targetMarket.findUnique({
      where: { profileId_countryCode: { profileId: profile.id, countryCode } },
    });
    if (dup) throw new ConflictException(`Target market '${countryCode}' already exists.`);
    return this.prisma.client.targetMarket.create({
      data: { profileId: profile.id, ...dto, countryCode },
    });
  }

  async updateTargetMarket(userId: string, id: string, dto: UpdateTargetMarketDto) {
    const existing = await this.requireOwned('targetMarket', userId, id);
    this.assertSizeRange(dto.minCompanySize ?? existing.minCompanySize ?? undefined, dto.maxCompanySize ?? existing.maxCompanySize ?? undefined);
    return this.prisma.client.targetMarket.update({ where: { id }, data: dto });
  }

  async deleteTargetMarket(userId: string, id: string) {
    await this.requireOwned('targetMarket', userId, id);
    await this.prisma.client.targetMarket.delete({ where: { id } });
    return { deleted: true };
  }

  // -------------------------------------------------------- restriction rules

  async createRestrictionRule(userId: string, dto: CreateRestrictionRuleDto) {
    const profile = await this.requireProfile(userId);
    const value = dto.value.trim();
    const dup = await this.prisma.client.restrictionRule.findUnique({
      where: { profileId_type_value: { profileId: profile.id, type: dto.type, value } },
    });
    if (dup) throw new ConflictException(`Restriction '${value}' already exists for type ${dto.type}.`);
    return this.prisma.client.restrictionRule.create({
      data: { profileId: profile.id, ...dto, value },
    });
  }

  async updateRestrictionRule(userId: string, id: string, dto: UpdateRestrictionRuleDto) {
    await this.requireOwned('restrictionRule', userId, id);
    return this.prisma.client.restrictionRule.update({
      where: { id },
      data: { ...dto, ...(dto.value ? { value: dto.value.trim() } : {}) },
    });
  }

  async deleteRestrictionRule(userId: string, id: string) {
    await this.requireOwned('restrictionRule', userId, id);
    await this.prisma.client.restrictionRule.delete({ where: { id } });
    return { deleted: true };
  }

  // ------------------------------------------------------ intervention rules

  async createInterventionRule(userId: string, dto: CreateInterventionRuleDto) {
    this.assertInterventionShape(dto.trigger, dto.threshold, dto.keyword);
    const profile = await this.requireProfile(userId);
    return this.prisma.client.interventionRule.create({
      data: { profileId: profile.id, ...dto },
    });
  }

  async updateInterventionRule(userId: string, id: string, dto: UpdateInterventionRuleDto) {
    const existing = await this.requireOwned('interventionRule', userId, id);
    this.assertInterventionShape(
      existing.trigger,
      dto.threshold ?? (existing.threshold !== null ? Number(existing.threshold) : undefined),
      dto.keyword ?? existing.keyword ?? undefined,
    );
    return this.prisma.client.interventionRule.update({ where: { id }, data: dto });
  }

  async deleteInterventionRule(userId: string, id: string) {
    await this.requireOwned('interventionRule', userId, id);
    await this.prisma.client.interventionRule.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- helpers

  private async requireProfile(userId: string) {
    const profile = await this.prisma.client.sellerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Seller profile not found. Create your profile first.');
    }
    return profile;
  }

  /** Loads a child record and verifies it belongs to the caller's profile. */
  private async requireOwned(
    model: 'sellerService' | 'targetMarket' | 'restrictionRule' | 'interventionRule',
    userId: string,
    id: string,
  ): Promise<any> {
    const profile = await this.requireProfile(userId);
    const record = await (this.prisma.client as any)[model].findUnique({ where: { id } });
    // Same error for missing and foreign records so IDs can't be probed.
    if (!record || record.profileId !== profile.id) {
      throw new NotFoundException(`Record '${id}' not found.`);
    }
    return record;
  }

  private assertPriceRange(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && !Number.isNaN(min) && !Number.isNaN(max) && min > max) {
      throw new BadRequestException('priceMin cannot be greater than priceMax.');
    }
  }

  private assertSizeRange(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && min > max) {
      throw new BadRequestException('minCompanySize cannot be greater than maxCompanySize.');
    }
  }

  private assertInterventionShape(trigger: string, threshold?: number, keyword?: string) {
    if ((trigger === 'DEAL_VALUE_ABOVE' || trigger === 'READINESS_ABOVE') && threshold === undefined) {
      throw new BadRequestException(`Trigger ${trigger} requires a threshold.`);
    }
    if (trigger === 'READINESS_ABOVE' && threshold !== undefined && threshold > 100) {
      throw new BadRequestException('READINESS_ABOVE threshold must be between 0 and 100.');
    }
    if (trigger === 'CUSTOM_KEYWORD' && !keyword?.trim()) {
      throw new BadRequestException('Trigger CUSTOM_KEYWORD requires a keyword.');
    }
  }
}
