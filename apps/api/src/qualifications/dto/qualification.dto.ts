import {
  IsBoolean,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

export class CreateQualificationDto {
  @IsOptional()
  @IsBoolean()
  budgetFit?: boolean;

  @IsOptional()
  @IsBoolean()
  authorityFit?: boolean;

  @IsOptional()
  @IsBoolean()
  needFit?: boolean;

  @IsOptional()
  @IsBoolean()
  timelineFit?: boolean;

  @IsOptional()
  @IsBoolean()
  technicalFit?: boolean;

  @IsOptional()
  @IsString()
  fitSummary?: string;

  @IsOptional()
  @IsObject()
  dealBlockers?: Record<string, any>;

  @IsOptional()
  @IsObject()
  answers?: Record<string, any>;

  @IsOptional()
  @IsString()
  qualifiedBy?: string;
}

export class UpdateQualificationDto {
  @IsOptional()
  @IsBoolean()
  budgetFit?: boolean;

  @IsOptional()
  @IsBoolean()
  authorityFit?: boolean;

  @IsOptional()
  @IsBoolean()
  needFit?: boolean;

  @IsOptional()
  @IsBoolean()
  timelineFit?: boolean;

  @IsOptional()
  @IsBoolean()
  technicalFit?: boolean;

  @IsOptional()
  @IsString()
  fitSummary?: string;

  @IsOptional()
  @IsObject()
  dealBlockers?: Record<string, any>;

  @IsOptional()
  @IsObject()
  answers?: Record<string, any>;

  @IsOptional()
  @IsString()
  qualifiedBy?: string;
}
