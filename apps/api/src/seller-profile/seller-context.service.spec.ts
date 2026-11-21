import { SellerContextService } from './seller-context.service';

describe('SellerContextService', () => {
  let db: any;
  let service: SellerContextService;
  const profile = {
    displayName: 'Jane Doe', companyName: 'Doe Digital', title: 'Founder', tone: 'Warm', signature: 'Best,\nJane',
    bio: 'Builds web apps.', skills: ['React', 'Node.js'], yearsExperience: 8,
    services: [{ name: 'Web development', description: 'Custom sites', keywords: ['web'], priceMin: '1000', priceMax: '5000', currency: 'USD' }],
    targetMarkets: [{ countryCode: 'US', industries: ['Retail'] }, { countryCode: 'GB', industries: [] }],
  };

  beforeEach(() => {
    db = { sellerProfile: { findUnique: jest.fn(), findFirst: jest.fn() } };
    service = new SellerContextService({ client: db } as any);
  });

  it("uses the given user's profile and builds scoring and pitch context", async () => {
    db.sellerProfile.findUnique.mockResolvedValue(profile);
    const ctx = await service.getContext('u1');
    expect(db.sellerProfile.findFirst).not.toHaveBeenCalled();
    expect(ctx?.targetCountryCodes).toEqual(['US', 'GB']);
    expect(ctx?.scoringContext).toContain('Web development');
    expect(ctx?.scoringContext).toContain('US (industries: Retail); GB');
    expect(ctx?.pitchContext).toContain('Jane Doe, Founder at Doe Digital');
    expect(ctx?.pitchContext).toContain('never invent other services');
    expect(ctx?.signature).toBe('Best,\nJane');
  });

  it('falls back to the earliest completed profile when the user has none', async () => {
    db.sellerProfile.findUnique.mockResolvedValue(null);
    db.sellerProfile.findFirst.mockResolvedValue(profile);
    expect((await service.getContext('u2'))?.displayName).toBe('Jane Doe');
    expect(db.sellerProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { onboardingComplete: true } }));
  });

  it('returns null when no seller profile exists so callers keep defaults', async () => {
    db.sellerProfile.findUnique.mockResolvedValue(null);
    db.sellerProfile.findFirst.mockResolvedValue(null);
    expect(await service.getContext(null)).toBeNull();
  });
});
