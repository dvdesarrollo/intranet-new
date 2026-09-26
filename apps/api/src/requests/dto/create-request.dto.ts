import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';
import { RequestType } from '@intranet/database';

export class CreateRequestDto {
  @IsEnum(RequestType)
  type: RequestType;

  // LOAN
  @ValidateIf((o) => o.type === RequestType.LOAN)
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ValidateIf((o) => o.type === RequestType.LOAN)
  @IsNumber()
  @IsPositive()
  installments?: number;

  // VACATION / PERMISSION
  @ValidateIf((o) => o.type === RequestType.VACATION || o.type === RequestType.PERMISSION)
  @IsDateString()
  startDate?: string;

  @ValidateIf((o) => o.type === RequestType.VACATION || o.type === RequestType.PERMISSION)
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
