import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@intranet/database';

export const ROLES_KEY = 'roles';

/**
 * Restringe un endpoint a uno o más roles del sistema.
 * Ejemplo: `@Roles(SystemRole.MANAGER, SystemRole.HR)`
 */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
