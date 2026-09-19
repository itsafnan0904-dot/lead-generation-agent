import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveAutonomousEngagementDto {
  @IsUUID()
  @IsNotEmpty()
  draftId: string;
}

export class RejectAutonomousEngagementDto {
  @IsOptional()
  @IsUUID()
  draftId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
