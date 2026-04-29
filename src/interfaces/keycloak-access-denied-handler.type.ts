import type { KeycloakRequest } from './keycloak-request.interface';
import type { KeycloakResponse } from './keycloak-response.interface';

export type KeycloakAccessDeniedHandler = (
  request: KeycloakRequest,
  response: KeycloakResponse | undefined,
  next?: () => void,
) => void;
