import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadLifecycleStatus } from '@ai-sales-agent/database';

export class CreateLeadDto {
  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsOptional()
  @IsUUID()
  primaryContactId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsUUID()
  primaryContactId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsEnum(LeadLifecycleStatus)
  status?: LeadLifecycleStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ListLeadsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsEnum(LeadLifecycleStatus)
  status?: LeadLifecycleStatus;
}
