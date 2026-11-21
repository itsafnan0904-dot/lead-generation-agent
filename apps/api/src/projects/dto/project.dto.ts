import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Length, MaxLength, IsObject } from 'class-validator';

export class CreateProjectDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  /** Deal value. Feeds the "deal value above X" handoff rule and the opportunities pipeline totals. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  budget?: number;

  @IsOptional() @IsString() @Length(3, 3)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(200)
  timeline?: string;

  /** Free-form requirements gathered from the client. */
  @IsOptional() @IsObject()
  scope?: Record<string, unknown>;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  budget?: number;

  @IsOptional() @IsString() @Length(3, 3)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(200)
  timeline?: string;

  @IsOptional() @IsObject()
  scope?: Record<string, unknown>;
}
