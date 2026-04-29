import type { KeycloakRequest } from './keycloak-request.interface';

/**
 * Multi tenant configuration.
 */
export interface MultiTenantOptions {
  /**
   * Option to always resolve the realm and secret. Disabled by default.
   */
  resolveAlways?: boolean;
  /**
   * The realm resolver function.
   */
  realmResolver: (
    request: KeycloakRequest | undefined,
  ) => Promise<string> | string;
  /**
   * The realm secret resolver function.
   */
  realmSecretResolver?: (
    realm: string,
    request?: KeycloakRequest,
  ) => Promise<string> | string;
  /**
   * The realm auth server url resolver function.
   */
  realmAuthServerUrlResolver?: (
    realm: string,
    request?: KeycloakRequest,
  ) => Promise<string> | string;
  /**
   * The realm client id resolver function.
   */
  realmClientIdResolver: (
    realm: string,
    request?: KeycloakRequest,
  ) => Promise<string> | string;
}
