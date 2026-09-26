import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertFamilyMemberDto } from './dto/upsert-family-member.dto';
import { UpsertBankAccountDto } from './dto/upsert-bank-account.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(employeeId: string) {
    const employee = await this.prisma.client.employee.findFirst({
      where: { id: employeeId },
      include: {
        department: true,
        city: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        familyMembers: true,
        bankAccounts: { include: { bank: true } },
      },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee;
  }

  async updateMyProfile(employeeId: string, dto: UpdateProfileDto) {
    return this.prisma.client.employee.update({
      where: { id: employeeId },
      data: dto,
    });
  }

  async listFamilyMembers(employeeId: string) {
    return this.prisma.client.familyMember.findMany({ where: { employeeId } });
  }

  async addFamilyMember(employeeId: string, dto: UpsertFamilyMemberDto) {
    return this.prisma.client.familyMember.create({
      data: {
        employeeId,
        fullName: dto.fullName,
        relationship: dto.relationship,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        documentId: dto.documentId,
        isDependent: dto.isDependent ?? true,
      },
    });
  }

  async removeFamilyMember(employeeId: string, familyMemberId: string) {
    // FamilyMember no tiene tenantId propio; se valida pertenencia al
    // empleado (que sí está scopeado al tenant actual) antes de borrar.
    await this.assertFamilyMemberBelongsToEmployee(employeeId, familyMemberId);
    return this.prisma.client.familyMember.delete({ where: { id: familyMemberId } });
  }

  async listBankAccounts(employeeId: string) {
    return this.prisma.client.bankAccount.findMany({
      where: { employeeId },
      include: { bank: true },
    });
  }

  async upsertBankAccount(employeeId: string, dto: UpsertBankAccountDto) {
    if (dto.isPrimary) {
      await this.prisma.client.bankAccount.updateMany({
        where: { employeeId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.client.bankAccount.create({
      data: {
        employeeId,
        bankId: dto.bankId,
        accountType: dto.accountType,
        accountNumber: dto.accountNumber,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  private async assertFamilyMemberBelongsToEmployee(employeeId: string, familyMemberId: string) {
    const record = await this.prisma.client.familyMember.findFirst({
      where: { id: familyMemberId, employeeId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException('Carga familiar no encontrada');
  }
}
