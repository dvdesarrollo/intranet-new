import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SystemRole } from '@intranet/database';

export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  employeeId?: string;
  email: string;
  roles: SystemRole[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // La validación de que payload.tenantId === request.tenant.id ocurre en
    // JwtAuthGuard, que sí tiene acceso al `request` completo (el `Request`
    // de Passport aquí no expone lo que TenantMiddleware ya resolvió).
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      employeeId: payload.employeeId,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
