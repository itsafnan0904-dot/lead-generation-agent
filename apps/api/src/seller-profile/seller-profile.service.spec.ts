import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SellerProfileService } from './seller-profile.service';

describe('SellerProfileService', () => {
  let service: SellerProfileService;
  let db: any;
  const profile = { id: 'p1', userId: 'u1', skills: ['A'], yearsExperience: null };

  beforeEach(() => {
    db = {
      sellerProfile: { findUnique: jest.fn().mockResolvedValue(profile), upsert: jest.fn(), update: jest.fn() },
      sellerService: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      targetMarket: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      restrictionRule: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      interventionRule: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    service = new SellerProfileService({ client: db } as any);
  });

  it('throws NotFound when the user has no profile', async () => {
    db.sellerProfile.findUnique.mockResolvedValue(null);
    await expect(service.getMyProfile('u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createService('u1', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a service with min price above max price', async () => {
    await expect(service.createService('u1', { name: 'x', priceMin: 10, priceMax: 5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uppercases country code and rejects duplicates', async () => {
    db.targetMarket.findUnique.mockResolvedValueOnce(null);
    await service.createTargetMarket('u1', { countryCode: 'us' });
    expect(db.targetMarket.create.mock.calls[0][0].data.countryCode).toBe('US');
    db.targetMarket.findUnique.mockResolvedValueOnce({ id: 'm' });
    await expect(service.createTargetMarket('u1', { countryCode: 'US' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides records owned by another profile', async () => {
    db.sellerService.findUnique.mockResolvedValue({ id: 's1', profileId: 'other' });
    await expect(service.deleteService('u1', 's1')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.sellerService.delete).not.toHaveBeenCalled();
  });

  it('requires threshold / keyword for threshold and keyword triggers', async () => {
    await expect(service.createInterventionRule('u1', { trigger: 'DEAL_VALUE_ABOVE' as any })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createInterventionRule('u1', { trigger: 'READINESS_ABOVE' as any, threshold: 150 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createInterventionRule('u1', { trigger: 'CUSTOM_KEYWORD' as any })).rejects.toBeInstanceOf(BadRequestException);
    await service.createInterventionRule('u1', { trigger: 'PRICING_DISCUSSION' as any });
    expect(db.interventionRule.create).toHaveBeenCalled();
  });

  it('blocks onboarding completion without an active service and market', async () => {
    db.sellerProfile.findUnique.mockResolvedValue({ ...profile, services: [], targetMarkets: [] });
    await expect(service.completeOnboarding('u1')).rejects.toBeInstanceOf(BadRequestException);
    db.sellerProfile.findUnique.mockResolvedValue({ ...profile, services: [{ isActive: true }], targetMarkets: [{ isActive: true }] });
    db.sellerProfile.update.mockResolvedValue({ onboardingComplete: true });
    await expect(service.completeOnboarding('u1')).resolves.toEqual({ onboardingComplete: true });
  });

  it('merges resume skills into the profile only when asked', async () => {
    db.sellerProfile.update.mockResolvedValue({});
    await service.setResume('u1', { resumeText: 'Skills: Sales, Design\n5 years of relevant experience' });
    expect(db.sellerProfile.update.mock.calls[0][0].data.skills).toBeUndefined();
    await service.setResume('u1', { resumeText: 'Skills: Sales, Design\n5 years of relevant experience', applyToProfile: true });
    const data = db.sellerProfile.update.mock.calls[1][0].data;
    expect(data.skills).toEqual(['A', 'Sales', 'Design']);
    expect(data.yearsExperience).toBe(5);
  });
});
