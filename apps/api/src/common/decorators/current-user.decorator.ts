import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SystemRole } from '@intranet/database';

export interface AuthenticatedUser {
  id: string;
  employeeId?: string;
  email: string;
  roles: SystemRole[];
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
