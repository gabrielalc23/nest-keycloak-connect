import type { KeycloakConnectOptions } from './keycloak-connect-options.type';

export interface KeycloakConnectOptionsFactory {
  createKeycloakConnectOptions():
    | Promise<KeycloakConnectOptions>
    | KeycloakConnectOptions;
}
