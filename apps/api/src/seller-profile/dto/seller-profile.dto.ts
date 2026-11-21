import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  Min,
  Max,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { RestrictionRuleType, InterventionTrigger } from '@ai-sales-agent/database';

export class UpsertSellerProfileDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  displayName: string;

  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(80) yearsExperience?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) portfolioUrls?: string[];
  @IsOptional() @IsObject({ each: true }) caseStudies?: Record<string, unknown>[];
  @IsOptional() @IsString() @MaxLength(100) tone?: string;
  @IsOptional() @IsString() @MaxLength(2000) signature?: string;
}

export class SetResumeDto {
  @IsString() @IsNotEmpty() @MaxLength(100000)
  resumeText: string;

  @IsOptional() @IsString() @MaxLength(255)
  resumeFileName?: string;

  /** When true, skills/years found in the resume are merged into the profile. */
  @IsOptional() @IsBoolean()
  applyToProfile?: boolean;
}

export class CreateServiceDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsNumber() @Min(0) priceMin?: number;
  @IsOptional() @IsNumber() @Min(0) priceMax?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsNumber() @Min(0) priceMin?: number;
  @IsOptional() @IsNumber() @Min(0) priceMax?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateTargetMarketDto {
  @IsString() @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must be a 2-letter ISO code' })
  countryCode: string;

  @IsOptional() @IsArray() @IsString({ each: true }) regions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) industries?: string[];
  @IsOptional() @IsInt() @Min(0) minCompanySize?: number;
  @IsOptional() @IsInt() @Min(0) maxCompanySize?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateTargetMarketDto {
  @IsOptional() @IsArray() @IsString({ each: true }) regions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) industries?: string[];
  @IsOptional() @IsInt() @Min(0) minCompanySize?: number;
  @IsOptional() @IsInt() @Min(0) maxCompanySize?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateRestrictionRuleDto {
  @IsEnum(RestrictionRuleType) type: RestrictionRuleType;
  @IsString() @IsNotEmpty() @MaxLength(200) value: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateRestrictionRuleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) value?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateInterventionRuleDto {
  @IsEnum(InterventionTrigger) trigger: InterventionTrigger;
  @IsOptional() @IsNumber() @Min(0) threshold?: number;
  @IsOptional() @IsString() @MaxLength(200) keyword?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateInterventionRuleDto {
  @IsOptional() @IsNumber() @Min(0) threshold?: number;
  @IsOptional() @IsString() @MaxLength(200) keyword?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
