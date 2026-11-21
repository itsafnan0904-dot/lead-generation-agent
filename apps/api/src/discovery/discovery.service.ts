import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { AuditService } from '../audit/audit.service';
import { DeterministicRestrictionChecker } from '../restrictions/layers/deterministic-checker.layer';
import {
  ImportRow,
  checkMarketFit,
  csvToImportRows,
  normalizeCountry,
  normalizeDomain,
} from './discovery.util';
import { ImportProspectsDto } from './discovery.dto';

export type RowStatus =
  | 'CREATED'
  | 'WOULD_CREATE'
  | 'SKIPPED_DUPLICATE'
  | 'SKIPPED_OUT_OF_MARKET'
  | 'SKIPPED_RESTRICTED'
  | 'INVALID'
  | 'ERROR';

export interface ImportRowResult {
  row: number;
  companyName: string;
  status: RowStatus;
  reason?: string;
  warnings?: string[];
  companyId?: string;
  contactId?: string;
  leadId?: string;
}

export interface ImportSummary {
  dryRun: boolean;
  total: number;
  counts: Record<RowStatus, number>;
  unknownColumns: string[];
  results: ImportRowResult[];
}

const MAX_ROWS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly checker = new DeterministicRestrictionChecker();

  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly contacts: ContactsService,
    private readonly leads: LeadsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Imports prospects (from CSV text or JSON rows), keeping only those that fit the importer's target markets
   * and pass their restriction rules. Each row is validated, screened, de-duplicated and then created.
   * dryRun=true reports what would happen and writes nothing.
   */
  async importProspects(userId: string, dto: ImportProspectsDto): Promise<ImportSummary> {
    let rows: ImportRow[];
    let unknownColumns: string[] = [];
    if (dto.csv && dto.rows) throw new BadRequestException('Provide either csv or rows, not both.');
    if (dto.csv) {
      const parsed = csvToImportRows(dto.csv);
      rows = parsed.rows;
      unknownColumns = parsed.unknownColumns;
    } else if (dto.rows) {
      rows = dto.rows as unknown as ImportRow[];
    } else {
      throw new BadRequestException('Provide csv text or a rows array.');
    }
    if (rows.length === 0) throw new BadRequestException('No data rows found.');
    if (rows.length > MAX_ROWS) throw new BadRequestException(`Too many rows (${rows.length}). The limit is ${MAX_ROWS} per import.`);

    const dryRun = dto.dryRun === true;
    const createLeads = dto.createLeads !== false;

    const profile = await this.prisma.client.sellerProfile.findUnique({
      where: { userId },
      include: { targetMarkets: true, restrictionRules: { where: { isActive: true } } },
    });
    const markets = profile?.targetMarkets ?? [];
    const restrictionTerms = (profile?.restrictionRules ?? []).map((r) => ({ term: r.value, source: r.type, reason: r.reason }));

    const results: ImportRowResult[] = [];
    const seenDomains = new Set<string>();
    const seenNames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const res = await this.processRow(i + 1, rows[i], {
        userId, dryRun, createLeads, markets, restrictionTerms, seenDomains, seenNames,
      });
      results.push(res);
    }

    const counts = {
      CREATED: 0, WOULD_CREATE: 0, SKIPPED_DUPLICATE: 0, SKIPPED_OUT_OF_MARKET: 0, SKIPPED_RESTRICTED: 0, INVALID: 0, ERROR: 0,
    } as Record<RowStatus, number>;
    for (const r of results) counts[r.status]++;

    if (!dryRun) {
      await this.audit.log({
        actorType: 'USER', actorId: userId, userId, action: 'PROSPECTS_IMPORTED', entityType: 'COMPANY', entityId: 'bulk-import',
        metadata: { total: results.length, counts },
      });
    }
    this.logger.log(`Prospect import (${dryRun ? 'dry run' : 'live'}) by ${userId}: ${JSON.stringify(counts)}`);
    return { dryRun, total: results.length, counts, unknownColumns, results };
  }

  private async processRow(
    index: number,
    raw: ImportRow,
    ctx: {
      userId: string; dryRun: boolean; createLeads: boolean;
      markets: { countryCode: string; industries: string[]; isActive: boolean }[];
      restrictionTerms: { term: string; source: any; reason?: string | null }[];
      seenDomains: Set<string>; seenNames: Set<string>;
    },
  ): Promise<ImportRowResult> {
    const companyName = String(raw?.companyName ?? '').trim();
    const base = { row: index, companyName: companyName || '(blank)' };
    const warnings: string[] = [];

    if (!companyName) return { ...base, status: 'INVALID', reason: 'Company name is required' };
    const email = raw.contactEmail?.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { ...base, status: 'INVALID', reason: `Invalid contact email '${raw.contactEmail}'` };
    if (email && !raw.contactFirstName?.trim()) warnings.push('Contact skipped: first name is required to create a contact');

    const domain = normalizeDomain(raw.domain) ?? normalizeDomain(raw.website);
    const nameKey = companyName.toLowerCase();

    // 1. Target market fit
    const fit = checkMarketFit(raw.country, raw.industry, ctx.markets);
    if (fit.ok === false) return { ...base, status: 'SKIPPED_OUT_OF_MARKET', reason: fit.reason };
    if (fit.ok && fit.warning) warnings.push(fit.warning);

    // 2. Restriction pre-screen (built-in list + the importer's own rules)
    const screen = this.checker.check(
      [companyName, raw.industry, domain, raw.website, raw.location].filter(Boolean).join(' '),
      ctx.restrictionTerms,
    );
    if (screen.hasMatch) {
      return { ...base, status: 'SKIPPED_RESTRICTED', reason: `Matches restricted terms: ${screen.matchedTerms.join(', ')}` };
    }

    // 3. Duplicates (within this file, then against existing companies)
    if ((domain && ctx.seenDomains.has(domain)) || ctx.seenNames.has(nameKey)) {
      return { ...base, status: 'SKIPPED_DUPLICATE', reason: 'Duplicate of an earlier row in this import' };
    }
    if (domain) ctx.seenDomains.add(domain);
    ctx.seenNames.add(nameKey);

    const existing = domain
      ? await this.prisma.client.company.findUnique({ where: { domain } })
      : await this.prisma.client.company.findFirst({ where: { name: { equals: companyName, mode: 'insensitive' } } });
    if (existing) {
      return { ...base, status: 'SKIPPED_DUPLICATE', reason: `Already exists as '${existing.name}'`, companyId: existing.id };
    }

    if (ctx.dryRun) return { ...base, status: 'WOULD_CREATE', warnings: warnings.length ? warnings : undefined };

    // 4. Create company -> contact -> lead
    try {
      const country = normalizeCountry(raw.country) ?? raw.country?.trim();
      const company = await this.companies.createCompany({
        name: companyName,
        domain: domain ?? undefined,
        industry: raw.industry,
        size: raw.size,
        location: raw.location,
        country,
        website: raw.website,
      });

      let contactId: string | undefined;
      if (email && raw.contactFirstName?.trim()) {
        try {
          const contact = await this.contacts.createContact(company.id, {
            email,
            firstName: raw.contactFirstName.trim(),
            lastName: raw.contactLastName?.trim(),
            title: raw.contactTitle?.trim(),
            isPrimary: true,
          });
          contactId = contact.id;
        } catch (err: any) {
          warnings.push(`Contact not created: ${err.message}`);
        }
      }

      let leadId: string | undefined;
      if (ctx.createLeads) {
        const lead = await this.leads.createLead({
          companyId: company.id,
          primaryContactId: contactId,
          assignedUserId: ctx.userId,
        });
        leadId = lead.id;
      }

      return { ...base, status: 'CREATED', companyId: company.id, contactId, leadId, warnings: warnings.length ? warnings : undefined };
    } catch (err: any) {
      this.logger.warn(`Import row ${index} ('${companyName}') failed: ${err.message}`);
      return { ...base, status: 'ERROR', reason: err.message };
    }
  }
}
