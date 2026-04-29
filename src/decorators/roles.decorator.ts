import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import type { RoleMatch } from '../enums';

export const META_ROLES: string = 'roles';
export const META_ROLE_MATCHING_MODE: string = 'role-matching-mode';

/**
 * Keycloak user roles.
 * @param roles - the roles to match
 * @since 2.0.0
 */
export const Roles: (...roles: string[]) => CustomDecorator<string> = (
  ...roles: string[]
): CustomDecorator<string> => SetMetadata(META_ROLES, roles);

export const RoleMatchingMode: (mode: RoleMatch) => CustomDecorator<string> = (
  mode: RoleMatch,
) => SetMetadata(META_ROLE_MATCHING_MODE, mode);
