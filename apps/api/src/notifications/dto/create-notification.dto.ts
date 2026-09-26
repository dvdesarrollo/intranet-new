import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationScope } from '@intranet/database';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationScope)
  scope: NotificationScope;

  @IsOptional()
  @IsString()
  targetDepartmentId?: string;

  @IsOptional()
  @IsString()
  targetCityId?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;
}
