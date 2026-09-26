import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@intranet/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('folders')
  @Roles(SystemRole.TENANT_ADMIN, SystemRole.HR)
  createFolder(@Body() dto: CreateFolderDto) {
    return this.documentsService.createFolder(dto);
  }

  @Post()
  @Roles(SystemRole.TENANT_ADMIN, SystemRole.HR, SystemRole.MANAGER)
  upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: UploadDocumentDto) {
    return this.documentsService.upload(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderId') folderId: string | null,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.documentsService.listFolder(user, folderId ?? null, departmentId);
  }

  @Get(':id/download')
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.documentsService.getDownloadUrl(user, id, departmentId);
  }
}
