import { Injectable } from '@nestjs/common';
import { NotificationScope } from '@intranet/database';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createdById: string, dto: CreateNotificationDto) {
    return this.prisma.client.notification.create({
      data: { ...dto, createdById, tenantId: this.tenantContext.getOrThrow().tenantId },
    });
  }

  /**
   * Bandeja segmentada del usuario: generales de la empresa, de su
   * departamento, de su ciudad, e individuales dirigidas a él.
   */
  async listForUser(user: AuthenticatedUser) {
    const employee = user.employeeId
      ? await this.prisma.client.employee.findFirst({
          where: { id: user.employeeId },
          select: { departmentId: true, cityId: true },
        })
      : null;

    return this.prisma.client.notification.findMany({
      where: {
        OR: [
          { scope: NotificationScope.COMPANY },
          employee?.departmentId
            ? { scope: NotificationScope.DEPARTMENT, targetDepartmentId: employee.departmentId }
            : undefined,
          employee?.cityId
            ? { scope: NotificationScope.CITY, targetCityId: employee.cityId }
            : undefined,
          { scope: NotificationScope.INDIVIDUAL, targetUserId: user.id },
        ].filter(Boolean) as object[],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reads: { where: { userId: user.id }, select: { readAt: true } },
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.client.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      update: { readAt: new Date() },
      create: { notificationId, userId },
    });
  }
}
