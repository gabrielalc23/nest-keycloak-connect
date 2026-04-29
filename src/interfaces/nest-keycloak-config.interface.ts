import type { PolicyEnforcementMode, RoleMerge, TokenValidation } from '../enums';
import type { MultiTenantOptions } from './multi-tenant-options.interface';

/**
 * Library only configuration.
 */
export interface NestKeycloakConfig {
  /**
   * Cookie key.
   */
  cookieKey?: string;

  /**
   * Sets the policy enforcement mode for this adapter.
   */
  policyEnforcement?: PolicyEnforcementMode;

  /**
   * Sets the token validation method.
   */
  tokenValidation?: TokenValidation;

  /**
   * Multi tenant options.
   */
  multiTenant?: MultiTenantOptions;

  /**
   * Role merging options.
   */
  roleMerge?: RoleMerge;
}
