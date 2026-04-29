import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import type * as KeycloakConnect from 'keycloak-connect';

export const META_ENFORCER_OPTIONS: string = 'enforcer-options';

/**
 * Keycloak enforcer options
 * @param opts - enforcer options
 * @since 1.3.0
 */
export const EnforcerOptions: (
  opts: KeycloakConnect.EnforcerOptions,
) => CustomDecorator<string> = (opts: KeycloakConnect.EnforcerOptions) =>
  SetMetadata(META_ENFORCER_OPTIONS, opts);
