import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TimeEntryType } from '@intranet/database';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context';
import { haversineDistanceMeters } from '../common/geo/geo.util';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';

// Orden esperado del ciclo diario; se usa para rechazar marcaciones
// fuera de secuencia (ej. un CHECK_OUT sin CHECK_IN previo).
const NEXT_EXPECTED: Record<TimeEntryType, TimeEntryType[]> = {
  [TimeEntryType.CHECK_IN]: [TimeEntryType.BREAK_START, TimeEntryType.CHECK_OUT],
  [TimeEntryType.BREAK_START]: [TimeEntryType.BREAK_END],
  [TimeEntryType.BREAK_END]: [TimeEntryType.BREAK_START, TimeEntryType.CHECK_OUT],
  [TimeEntryType.CHECK_OUT]: [],
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async clock(employeeId: string, dto: CreateTimeEntryDto, ipAddress?: string) {
    await this.assertSequenceIsValid(employeeId, dto.type);

    const nearest = await this.findNearestOfficeLocation(dto.latitude, dto.longitude);

    if (!nearest || !nearest.isValid) {
      // Georeferenciación obligatoria: si no hay ninguna sede dentro del
      // radio permitido, la marcación se RECHAZA (no se persiste), para
      // que el empleado no pueda registrar asistencia fuera del sitio.
      throw new ForbiddenException({
        message: 'No es posible marcar: fuera del rango permitido de la oficina',
        distanceMeters: nearest?.distanceMeters ?? null,
        nearestOffice: nearest?.officeLocation.name ?? null,
      });
    }

    return this.prisma.client.timeEntry.create({
      data: {
        tenantId: this.tenantContext.getOrThrow().tenantId,
        employeeId,
        type: dto.type,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        deviceInfo: dto.deviceInfo,
        ipAddress,
        officeLocationId: nearest.officeLocation.id,
        distanceMeters: nearest.distanceMeters,
        isLocationValid: true,
      },
    });
  }

  async history(employeeId: string, from?: Date, to?: Date) {
    return this.prisma.client.timeEntry.findMany({
      where: {
        employeeId,
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  private async assertSequenceIsValid(employeeId: string, type: TimeEntryType) {
    const last = await this.prisma.client.timeEntry.findFirst({
      where: { employeeId },
      orderBy: { timestamp: 'desc' },
    });

    if (!last) {
      if (type !== TimeEntryType.CHECK_IN) {
        throw new BadRequestException('La primera marcación del día debe ser CHECK_IN');
      }
      return;
    }

    const allowedNext = NEXT_EXPECTED[last.type];
    if (!allowedNext.includes(type)) {
      throw new BadRequestException(
        `Marcación fuera de secuencia: después de ${last.type} se espera ${allowedNext.join(' o ')}`,
      );
    }
  }

  private async findNearestOfficeLocation(latitude: number, longitude: number) {
    const offices = await this.prisma.client.officeLocation.findMany({
      where: { isActive: true },
    });

    if (offices.length === 0) return null;

    let best: { officeLocation: (typeof offices)[number]; distanceMeters: number } | null = null;

    for (const office of offices) {
      const distanceMeters = haversineDistanceMeters(
        { latitude, longitude },
        { latitude: office.latitude, longitude: office.longitude },
      );
      if (!best || distanceMeters < best.distanceMeters) {
        best = { officeLocation: office, distanceMeters };
      }
    }

    return {
      ...best!,
      isValid: best!.distanceMeters <= best!.officeLocation.radiusMeters,
    };
  }
}
