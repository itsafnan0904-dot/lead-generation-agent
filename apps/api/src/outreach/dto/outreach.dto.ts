import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { OutreachDraftStatus } from '@ai-sales-agent/database';

export class GenerateOutreachDraftDto {
  @IsOptional()
  @IsString()
  tone?: string = 'professional and consultative';

  @IsOptional()
  @IsString()
  additionalContext?: string;
}

export class ListOutreachDraftsQueryDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsEnum(OutreachDraftStatus)
  status?: OutreachDraftStatus;

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
}
