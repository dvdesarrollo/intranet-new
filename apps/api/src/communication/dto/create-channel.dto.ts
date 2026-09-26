import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ChannelType } from '@intranet/database';

export class CreateChannelDto {
  @IsEnum(ChannelType)
  type: ChannelType;

  @IsOptional()
  @IsString()
  name?: string;

  /** userIds de los miembros (equipo a cargo, o gerentes de la línea) */
  @IsArray()
  @ArrayMinSize(1)
  memberUserIds: string[];
}
