import { IsEnum, IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { HumanReviewStatus, HumanReviewTriggerSource } from '@ai-sales-agent/database';

export class ResolveHumanReviewDto {
  @IsEnum(HumanReviewStatus, {
    message: 'decision must be either APPROVED or REJECTED',
  })
  decision: 'APPROVED' | 'REJECTED';

  /**
   * Mandatory justification for compliance resolutions.
   * Locked requirement: Must be a non-empty string with at least 10 characters to prevent perfunctory resolutions.
   */
  @IsString()
  @IsNotEmpty({ message: 'A non-empty resolution justification is required.' })
  @MinLength(10, {
    message: 'Resolution justification must be at least 10 characters long explaining the rationale.',
  })
  justification: string;
}

export class ListHumanReviewsQueryDto {
  @IsOptional()
  @IsEnum(HumanReviewStatus)
  status?: HumanReviewStatus;

  @IsOptional()
  @IsEnum(HumanReviewTriggerSource)
  triggerSource?: HumanReviewTriggerSource;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
