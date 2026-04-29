/**
 * Policy enforcement mode.
 */
export enum PolicyEnforcementMode {
  /**
   * Deny all requests when there is no matching resource.
   */
  ENFORCING = 'enforcing',
  /**
   * Allow requests even when there is no matching resource.
   */
  PERMISSIVE = 'permissive',
}
