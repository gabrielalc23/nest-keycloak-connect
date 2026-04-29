import type { KeycloakRequestHeaders } from './keycloak-request-headers.interface';
import type { KeycloakTokenPayload } from './keycloak-token-payload.interface';

export interface KeycloakRequest {
  headers: KeycloakRequestHeaders;
  cookies?: Record<string, string | undefined>;
  user?: KeycloakTokenPayload;
  accessToken?: string;
  scopes?: string[];
  resourceDenied?: boolean;
  url?: string;
  get?: (header: string) => string | undefined;
  [property: string]: unknown;
}
