import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { BankAccountType } from '@intranet/database';

/**
 * `bankId` referencia el catálogo estandarizado y seleccionable
 * `BankCatalog` (ver GET /catalogs/banks) en lugar de texto libre.
 */
export class UpsertBankAccountDto {
  @IsString()
  bankId: string;

  @IsEnum(BankAccountType)
  accountType: BankAccountType;

  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
