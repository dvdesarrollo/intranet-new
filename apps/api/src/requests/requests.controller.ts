import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@intranet/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { DecideRequestDto } from './dto/decide-request.dto';

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(user.employeeId!, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.listMine(user.employeeId!);
  }

  @Get('pending-approval')
  @Roles(SystemRole.MANAGER, SystemRole.HR, SystemRole.APPROVER, SystemRole.TENANT_ADMIN)
  listPendingApproval(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.listPendingForApprover(user);
  }

  @Patch(':id/decision')
  @Roles(SystemRole.MANAGER, SystemRole.HR, SystemRole.APPROVER, SystemRole.TENANT_ADMIN)
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideRequestDto,
  ) {
    return this.requestsService.decide(user, id, dto);
  }
}
