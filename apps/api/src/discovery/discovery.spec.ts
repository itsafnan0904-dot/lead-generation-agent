import { BadRequestException } from '@nestjs/common';
import { checkMarketFit, csvToImportRows, normalizeCountry, normalizeDomain, parseCsv } from './discovery.util';
import { DiscoveryService } from './discovery.service';

describe('discovery utils', () => {
  it('normalises countries from names, aliases and codes', () => {
    expect(normalizeCountry('United States')).toBe('US');
    expect(normalizeCountry(' usa ')).toBe('US');
    expect(normalizeCountry('UK')).toBe('GB');
    expect(normalizeCountry('de')).toBe('DE');
    expect(normalizeCountry('Atlantis')).toBeNull();
    expect(normalizeCountry('')).toBeNull();
  });

  it('normalises domains', () => {
    expect(normalizeDomain('https://www.Acme.com/about')).toBe('acme.com');
    expect(normalizeDomain('acme.io')).toBe('acme.io');
    expect(normalizeDomain(undefined)).toBeNull();
  });

  describe('checkMarketFit', () => {
    const us = { countryCode: 'US', industries: [] as string[], isActive: true };
    it('allows everything when no markets are configured', () => {
      expect(checkMarketFit('Brazil', 'Retail', [])).toEqual({ ok: true });
      expect(checkMarketFit('Brazil', 'Retail', [{ ...us, isActive: false }])).toEqual({ ok: true });
    });
    it('rejects a known country outside the markets', () => {
      expect(checkMarketFit('Germany', 'Retail', [us])).toEqual({ ok: false, reason: 'Country DE is not one of your target countries' });
    });
    it('accepts a matching country and warns on an unknown one', () => {
      expect(checkMarketFit('United States', undefined, [us])).toEqual({ ok: true });
      expect(checkMarketFit(undefined, 'Retail', [us])).toMatchObject({ ok: true, warning: expect.any(String) });
    });
    it('applies the industry focus only when the market has one and the industry is known', () => {
      const focused = { countryCode: 'US', industries: ['Healthcare'], isActive: true };
      expect(checkMarketFit('US', 'Digital healthcare services', [focused])).toEqual({ ok: true });
      expect(checkMarketFit('US', 'Mining', [focused])).toMatchObject({ ok: false });
      expect(checkMarketFit('US', undefined, [focused])).toEqual({ ok: true });
      expect(checkMarketFit('US', 'Mining', [focused, us])).toEqual({ ok: true }); // another US market has no focus
    });
  });

  describe('CSV parsing', () => {
    it('handles quotes, escaped quotes, commas, CRLF, BOM and blank lines', () => {
      const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2');
      expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']]);
    });
    it('maps forgiving headers to import rows and reports unknown columns', () => {
      const { rows, unknownColumns } = csvToImportRows(
        'Company Name,Website,Country,Email,First Name,Job Title,Favourite Colour\nAcme,acme.com,USA,sam@acme.com,Sam,CTO,blue\n,x.com,,,,,',
      );
      expect(unknownColumns).toEqual(['Favourite Colour']);
      expect(rows[0]).toEqual({
        companyName: 'Acme', website: 'acme.com', country: 'USA', contactEmail: 'sam@acme.com', contactFirstName: 'Sam', contactTitle: 'CTO',
      });
      expect(rows[1].companyName).toBeUndefined();
    });
  });
});

describe('DiscoveryService.importProspects', () => {
  let db: any, companies: any, contacts: any, leads: any, audit: any, service: DiscoveryService;

  beforeEach(() => {
    db = {
      sellerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          targetMarkets: [{ countryCode: 'US', industries: [], isActive: true }],
          restrictionRules: [{ type: 'INDUSTRY', value: 'Gambling', reason: null }],
        }),
      },
      company: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    };
    companies = { createCompany: jest.fn().mockImplementation(async (d: any) => ({ id: `c-${d.name}`, name: d.name })) };
    contacts = { createContact: jest.fn().mockResolvedValue({ id: 'ct1' }) };
    leads = { createLead: jest.fn().mockResolvedValue({ id: 'l1' }) };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new DiscoveryService({ client: db } as any, companies, contacts, leads, audit);
  });

  const rows = [
    { companyName: 'Good Co', domain: 'good.com', country: 'US', industry: 'Retail', contactEmail: 'a@good.com', contactFirstName: 'Ann' },
    { companyName: 'Euro Co', domain: 'euro.de', country: 'Germany' },
    { companyName: 'Lucky Bets', domain: 'bets.com', country: 'US', industry: 'Online Gambling' },
    { companyName: 'Steel Joists Inc', domain: 'sj.com', country: 'US', industry: 'OWSJ fabrication' },
    { companyName: 'Good Co Again', domain: 'GOOD.com', country: 'US' },
    { companyName: '', country: 'US' },
    { companyName: 'Bad Email', country: 'US', contactEmail: 'nope' },
  ];

  it('creates in-market, unrestricted prospects and skips the rest with reasons', async () => {
    const r = await service.importProspects('u1', { rows: rows as any });
    expect(r.counts).toMatchObject({
      CREATED: 1, SKIPPED_OUT_OF_MARKET: 1, SKIPPED_RESTRICTED: 2, SKIPPED_DUPLICATE: 1, INVALID: 2,
    });
    expect(r.results[0]).toMatchObject({ status: 'CREATED', companyId: 'c-Good Co', contactId: 'ct1', leadId: 'l1' });
    expect(r.results[1].reason).toMatch(/DE/);
    expect(r.results[2].reason).toMatch(/Gambling/);
    expect(r.results[3].reason).toMatch(/OWSJ/); // built-in locked list still applies
    expect(companies.createCompany).toHaveBeenCalledTimes(1);
    expect(leads.createLead).toHaveBeenCalledWith({ companyId: 'c-Good Co', primaryContactId: 'ct1', assignedUserId: 'u1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PROSPECTS_IMPORTED' }));
  });

  it('dry run reports WOULD_CREATE and writes nothing', async () => {
    const r = await service.importProspects('u1', { rows: [rows[0]] as any, dryRun: true });
    expect(r.counts.WOULD_CREATE).toBe(1);
    expect(companies.createCompany).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('skips companies that already exist and does not create leads when createLeads=false', async () => {
    db.company.findUnique.mockResolvedValueOnce({ id: 'old', name: 'Good Co' });
    const dup = await service.importProspects('u1', { rows: [rows[0]] as any });
    expect(dup.results[0]).toMatchObject({ status: 'SKIPPED_DUPLICATE', companyId: 'old' });

    const r = await service.importProspects('u1', { rows: [{ companyName: 'Fresh', domain: 'fresh.com', country: 'US' }] as any, createLeads: false });
    expect(r.counts.CREATED).toBe(1);
    expect(leads.createLead).not.toHaveBeenCalled();
  });

  it('keeps the company when its contact fails, with a warning, and isolates row errors', async () => {
    contacts.createContact.mockRejectedValueOnce(new Error('email exists'));
    companies.createCompany.mockRejectedValueOnce(new Error('boom'));
    const r = await service.importProspects('u1', {
      rows: [
        { companyName: 'Breaks', domain: 'b.com', country: 'US' },
        rows[0],
      ] as any,
    });
    expect(r.results[0]).toMatchObject({ status: 'ERROR', reason: 'boom' });
    expect(r.results[1].status).toBe('CREATED');
    expect(r.results[1].warnings?.[0]).toMatch(/Contact not created: email exists/);
  });

  it('accepts CSV text and rejects empty, ambiguous and oversized input', async () => {
    const r = await service.importProspects('u1', { csv: 'Company,Domain,Country\nCsv Co,csv.com,US' });
    expect(r.counts.CREATED).toBe(1);
    await expect(service.importProspects('u1', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.importProspects('u1', { csv: 'Company\n' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.importProspects('u1', { csv: 'a', rows: [] })).rejects.toBeInstanceOf(BadRequestException);
    const big = Array.from({ length: 501 }, (_, i) => ({ companyName: `Co ${i}` }));
    await expect(service.importProspects('u1', { rows: big as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still applies the built-in restriction list when the user has no seller profile', async () => {
    db.sellerProfile.findUnique.mockResolvedValue(null);
    const r = await service.importProspects('u1', { rows: [{ companyName: 'Joist Girders LLC', country: 'France' }] as any });
    expect(r.results[0].status).toBe('SKIPPED_RESTRICTED');
  });
});
