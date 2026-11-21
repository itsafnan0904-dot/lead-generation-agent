import { IsArray, ArrayMaxSize, IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ImportProspectsDto {
  /** CSV text with a header row (company, domain, industry, size, location, country, website, email, firstName, lastName, title). */
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  csv?: string;

  /** Alternative to csv: structured rows. Validated per row by the service. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  rows?: Record<string, unknown>[];

  /** Report what would happen without writing anything. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /** Put every created lead into this campaign. */
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  /** Create a lead for every imported company (default true). */
  @IsOptional()
  @IsBoolean()
  createLeads?: boolean;
}
