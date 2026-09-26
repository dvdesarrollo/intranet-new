import { TimeEntryType } from '@intranet/database';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTimeEntryDto {
  @IsEnum(TimeEntryType)
  type: TimeEntryType;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
