import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Solo los campos que el propio empleado puede editar de su perfil.
 * Cargo, departamento, jefe, salario, etc. son de solo lectura para el
 * empleado (los administra RRHH desde el módulo `employees` con rol HR).
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
