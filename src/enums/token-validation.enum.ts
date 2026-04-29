/**
 * Token validation methods.
 */
export enum TokenValidation {
  /**
   * Performs live validation through Keycloak.
   */
  ONLINE = 'online',
  /**
   * Validates offline against the configured Keycloak options.
   */
  OFFLINE = 'offline',
  /**
   * Disables validation. Use only for development or special internal cases.
   */
  NONE = 'none',
}
