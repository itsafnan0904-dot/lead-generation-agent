import {
  IsString, IsNotEmpty, IsOptional, IsArray, ArrayMaxSize, ArrayMinSize, IsUUID, IsEnum, IsDateString,
  IsObject, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus } from '@ai-sales-agent/database';

export class TargetCriteriaDto {
  @IsOptional() @IsArray() @IsString({ each: true }) countries?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) industries?: string[];
}

export class CreateCampaignDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => TargetCriteriaDto) targetCriteria?: TargetCriteriaDto;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => TargetCriteriaDto) targetCriteria?: TargetCriteriaDto;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  /** Lifecycle change, validated against the allowed transitions. */
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
}

export class AssignLeadsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true })
  leadIds: string[];
}
