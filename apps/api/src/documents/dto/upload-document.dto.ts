import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Metadatos del documento; el binario se sube antes a un storage externo
 * (S3/GCS) mediante URL prefirmada y `fileUrl` referencia ese objeto.
 * El controlador no procesa el archivo directamente para evitar cargar
 * el proceso de Node con uploads grandes.
 */
export class UploadDocumentDto {
  @IsString()
  title: string;

  @IsString()
  fileUrl: string;

  @IsString()
  mimeType: string;

  @IsInt()
  @Min(0)
  sizeBytes: number;

  @IsOptional()
  @IsString()
  folderId?: string;
}
