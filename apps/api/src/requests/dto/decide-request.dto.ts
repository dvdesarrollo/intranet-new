import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApprovalDecision } from '@intranet/database';

const DECIDABLE = [ApprovalDecision.APPROVED, ApprovalDecision.REJECTED] as const;

export class DecideRequestDto {
  @IsIn(DECIDABLE)
  decision: (typeof DECIDABLE)[number];

  @IsOptional()
  @IsString()
  comments?: string;
}
