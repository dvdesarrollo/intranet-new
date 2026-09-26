import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@intranet/database';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

const ADMIN_BYPASS_ROLES = [SystemRole.SUPER_ADMIN, SystemRole.TENANT_ADMIN];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async createFolder(dto: CreateFolderDto) {
    return this.prisma.client.documentFolder.create({
      data: { ...dto, tenantId: this.tenantContext.getOrThrow().tenantId },
    });
  }

  async upload(uploadedById: string, dto: UploadDocumentDto) {
    return this.prisma.client.document.create({
      data: { ...dto, uploadedById, tenantId: this.tenantContext.getOrThrow().tenantId },
    });
  }

  /** Lista documentos de una carpeta filtrando por lo que el usuario puede leer. */
  async listFolder(user: AuthenticatedUser, folderId: string | null, departmentId?: string) {
    if (ADMIN_BYPASS_ROLES.some((r) => user.roles.includes(r))) {
      return this.prisma.client.document.findMany({ where: { folderId } });
    }

    return this.prisma.client.document.findMany({
      where: {
        folderId,
        permissions: {
          some: {
            canRead: true,
            role: { in: user.roles },
            OR: [{ departmentId: null }, { departmentId }],
          },
        },
      },
    });
  }

  async getDownloadUrl(user: AuthenticatedUser, documentId: string, departmentId?: string) {
    const document = await this.prisma.client.document.findFirst({
      where: { id: documentId },
      include: { permissions: true },
    });
    if (!document) throw new NotFoundException('Documento no encontrado');

    if (!this.canRead(user, document.permissions, departmentId)) {
      throw new ForbiddenException('No tienes permiso para leer este documento');
    }

    return { fileUrl: document.fileUrl };
  }

  private canRead(
    user: AuthenticatedUser,
    permissions: { role: SystemRole; departmentId: string | null; canRead: boolean }[],
    departmentId?: string,
  ): boolean {
    if (ADMIN_BYPASS_ROLES.some((r) => user.roles.includes(r))) return true;
    // Sin reglas explícitas -> documento visible para todo el tenant.
    if (permissions.length === 0) return true;

    return permissions.some(
      (p) =>
        p.canRead &&
        user.roles.includes(p.role) &&
        (p.departmentId === null || p.departmentId === departmentId),
    );
  }
}
