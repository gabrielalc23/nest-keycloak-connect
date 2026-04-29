import type { KeycloakRequest } from './keycloak-request.interface';
import type { KeycloakResponse } from './keycloak-response.interface';

export type KeycloakRequestResponse = [
  request: KeycloakRequest | undefined,
  response: KeycloakResponse | undefined,
];
