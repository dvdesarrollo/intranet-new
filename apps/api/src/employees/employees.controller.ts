import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/rbac/roles.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { EmployeesService } from './employees.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertFamilyMemberDto } from './dto/upsert-family-member.dto';
import { UpsertBankAccountDto } from './dto/upsert-bank-account.dto';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.getMyProfile(user.employeeId!);
  }

  @Patch('me')
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.employeesService.updateMyProfile(user.employeeId!, dto);
  }

  @Get('me/family-members')
  listFamilyMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.listFamilyMembers(user.employeeId!);
  }

  @Post('me/family-members')
  addFamilyMember(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertFamilyMemberDto) {
    return this.employeesService.addFamilyMember(user.employeeId!, dto);
  }

  @Delete('me/family-members/:id')
  removeFamilyMember(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employeesService.removeFamilyMember(user.employeeId!, id);
  }

  @Get('me/bank-accounts')
  listBankAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.listBankAccounts(user.employeeId!);
  }

  @Post('me/bank-accounts')
  upsertBankAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertBankAccountDto) {
    return this.employeesService.upsertBankAccount(user.employeeId!, dto);
  }
}
