export interface KeycloakTokenPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  auth_time?: number;
  jti?: string;
  typ?: string;
  azp?: string;
  sid?: string;
  acr?: string;
  scope?: string;
  email_verified?: boolean;
  preferred_username?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
  [claim: string]: unknown;
}
