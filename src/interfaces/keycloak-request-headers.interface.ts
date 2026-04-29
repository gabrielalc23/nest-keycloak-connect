export type KeycloakRequestHeaderValue = string | string[] | undefined;

export interface KeycloakRequestHeaders {
  authorization?: string;
  [header: string]: KeycloakRequestHeaderValue;
}
