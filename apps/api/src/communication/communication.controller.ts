import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@intranet/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CommunicationService } from './communication.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('communication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('channels')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Post()
  @Roles(SystemRole.MANAGER, SystemRole.TENANT_ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChannelDto) {
    return this.communicationService.createChannel(user.employeeId!, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.communicationService.listMyChannels(user.id);
  }

  @Get(':id/messages')
  listMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communicationService.listMessages(user.id, id);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.communicationService.sendMessage(user.id, id, dto);
  }
}
