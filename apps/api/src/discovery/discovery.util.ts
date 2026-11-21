export interface ImportRow {
  companyName: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  country?: string;
  website?: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactTitle?: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'US', 'united states of america': 'US', usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', america: 'US',
  'united kingdom': 'GB', uk: 'GB', 'u.k.': 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  canada: 'CA', australia: 'AU', 'new zealand': 'NZ', ireland: 'IE', germany: 'DE', france: 'FR', spain: 'ES', italy: 'IT',
  netherlands: 'NL', holland: 'NL', belgium: 'BE', sweden: 'SE', norway: 'NO', denmark: 'DK', finland: 'FI', switzerland: 'CH',
  austria: 'AT', poland: 'PL', portugal: 'PT', 'united arab emirates': 'AE', uae: 'AE', dubai: 'AE', 'saudi arabia': 'SA',
  qatar: 'QA', kuwait: 'KW', bahrain: 'BH', oman: 'OM', israel: 'IL', turkey: 'TR', egypt: 'EG', 'south africa': 'ZA',
  nigeria: 'NG', kenya: 'KE', india: 'IN', pakistan: 'PK', bangladesh: 'BD', 'sri lanka': 'LK', singapore: 'SG',
  malaysia: 'MY', indonesia: 'ID', philippines: 'PH', thailand: 'TH', vietnam: 'VN', japan: 'JP', 'south korea': 'KR',
  korea: 'KR', china: 'CN', 'hong kong': 'HK', taiwan: 'TW', brazil: 'BR', mexico: 'MX', argentina: 'AR', chile: 'CL', colombia: 'CO',
};

/** Normalises a free-text country to an ISO 3166-1 alpha-2 code, or null when it can't be identified. */
export function normalizeCountry(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) {
    const up = v.toUpperCase();
    return up === 'UK' ? 'GB' : up;
  }
  return COUNTRY_ALIASES[v.toLowerCase()] ?? null;
}

export interface MarketInput {
  countryCode: string;
  industries: string[];
  isActive: boolean;
}

export type MarketVerdict =
  | { ok: true; warning?: string }
  | { ok: false; reason: string };

/**
 * Does a prospect fall inside the seller's target markets?
 * - No active markets configured: everything is allowed.
 * - Known country outside every market: rejected.
 * - Unknown country: allowed with a warning (we can't prove it's out of market).
 * - Matching market with an industry focus: a known industry must match one of them.
 */
export function checkMarketFit(country: string | null | undefined, industry: string | null | undefined, markets: MarketInput[]): MarketVerdict {
  const active = markets.filter((m) => m.isActive);
  if (active.length === 0) return { ok: true };

  const code = normalizeCountry(country);
  if (!code) return { ok: true, warning: 'Country missing or unrecognised; could not verify target market' };

  const inCountry = active.filter((m) => m.countryCode.toUpperCase() === code);
  if (inCountry.length === 0) return { ok: false, reason: `Country ${code} is not one of your target countries` };

  const focused = inCountry.filter((m) => m.industries.length > 0);
  if (focused.length === inCountry.length && industry?.trim()) {
    const ind = industry.toLowerCase();
    const matches = focused.some((m) => m.industries.some((i) => ind.includes(i.toLowerCase()) || i.toLowerCase().includes(ind)));
    if (!matches) return { ok: false, reason: `Industry '${industry}' is outside your focus industries for ${code}` };
  }
  return { ok: true };
}

export function normalizeDomain(raw?: string | null): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  return v.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || null;
}

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  company: 'companyName', companyname: 'companyName', name: 'companyName', organization: 'companyName', organisation: 'companyName',
  domain: 'domain', website: 'website', url: 'website', industry: 'industry', sector: 'industry',
  size: 'size', employees: 'size', location: 'location', city: 'location', country: 'country',
  email: 'contactEmail', contactemail: 'contactEmail', firstname: 'contactFirstName', contactfirstname: 'contactFirstName',
  lastname: 'contactLastName', contactlastname: 'contactLastName', title: 'contactTitle', jobtitle: 'contactTitle', contacttitle: 'contactTitle',
};

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/** CSV text with a header row -> import rows. Unknown columns are ignored; header names are forgiving. */
export function csvToImportRows(text: string): { rows: ImportRow[]; unknownColumns: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], unknownColumns: [] };
  const [header, ...body] = table;
  const map = header.map((h) => HEADER_ALIASES[h.toLowerCase().replace(/[^a-z]/g, '')]);
  const unknownColumns = header.filter((_, i) => !map[i]);

  const rows = body.map((cells) => {
    const r: Record<string, string> = {};
    cells.forEach((v, i) => {
      const key = map[i];
      if (key && v.trim()) r[key] = v.trim();
    });
    return r as unknown as ImportRow;
  });
  return { rows, unknownColumns };
}
