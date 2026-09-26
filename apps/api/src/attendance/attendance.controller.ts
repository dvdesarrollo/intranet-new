import { Controller, Get, Ip, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock')
  clock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimeEntryDto,
    @Ip() ip: string,
  ) {
    return this.attendanceService.clock(user.employeeId!, dto, ip);
  }

  @Get('me')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.history(
      user.employeeId!,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
