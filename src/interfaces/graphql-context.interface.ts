import type { KeycloakRequest } from './keycloak-request.interface';
import type { KeycloakResponse } from './keycloak-response.interface';

export interface GraphqlContext {
  req?: KeycloakRequest;
  res?: KeycloakResponse;
}
