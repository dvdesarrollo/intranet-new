import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * El tenant ya fue resuelto por `TenantMiddleware` antes de llegar aquí,
   * así que `this.prisma.client` (con tenant-scoping automático) sólo verá
   * usuarios de esa empresa.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.client.user.findFirst({
      where: { email: dto.email.toLowerCase(), isActive: true },
      include: {
        employee: { select: { id: true } },
        roles: { include: { role: true } },
      },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const roles = user.roles.map((userRole) => userRole.role.name);

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      employeeId: user.employee?.id,
      email: user.email,
      roles,
    });

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        employeeId: user.employee?.id,
        roles,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}
