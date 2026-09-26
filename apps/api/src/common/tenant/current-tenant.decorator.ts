import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): { id: string; slug: string } => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenant;
  },
);
