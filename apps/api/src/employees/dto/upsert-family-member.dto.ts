import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FamilyRelationship } from '@intranet/database';

export class UpsertFamilyMemberDto {
  @IsString()
  fullName: string;

  @IsEnum(FamilyRelationship)
  relationship: FamilyRelationship;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsBoolean()
  isDependent?: boolean;
}
