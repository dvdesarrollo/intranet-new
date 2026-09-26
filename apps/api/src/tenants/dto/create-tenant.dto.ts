import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug debe ser minúsculas, números y guiones' })
  slug: string;

  @IsOptional()
  @IsString()
  ruc?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsString()
  adminEmail: string;

  @IsString()
  adminPassword: string;
}
