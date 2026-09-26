import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@intranet/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(SystemRole.TENANT_ADMIN, SystemRole.HR, SystemRole.MANAGER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(user.id, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
