import type { ContextType, ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces';
import type KeycloakConnect from 'keycloak-connect';
import { createRequire } from 'node:module';
import type {
  GraphqlContext,
  GraphqlModule,
  KeycloakConnectConfig,
  KeycloakRequest,
  KeycloakRequestResponse,
  KeycloakResponse,
  KeycloakTokenPayload,
} from './interfaces';
import type { KeycloakMultiTenantService } from './services/keycloak-multitenant.service';
import { parseToken } from './util';

type GqlContextType = 'graphql' | ContextType;

export const useKeycloak: (
  request: KeycloakRequest,
  jwt: string,
  singleTenant: KeycloakConnect.Keycloak,
  multiTenant: KeycloakMultiTenantService,
  opts: KeycloakConnectConfig,
) => Promise<KeycloakConnect.Keycloak> = async (
  request: KeycloakRequest,
  jwt: string,
  singleTenant: KeycloakConnect.Keycloak,
  multiTenant: KeycloakMultiTenantService,
  opts: KeycloakConnectConfig,
): Promise<KeycloakConnect.Keycloak> => {
  if (opts.multiTenant && opts.multiTenant.realmResolver) {
    const resolvedRealm: string | Promise<string> =
      opts.multiTenant.realmResolver(request);
    const realm: string = await Promise.resolve(resolvedRealm);
    return await multiTenant.get(realm, request);
  }

  if (!opts.realm) {
    const payload: KeycloakTokenPayload = parseToken(jwt);
    const issuerRealm: string | undefined = payload.iss?.split('/').pop();

    if (!issuerRealm) {
      throw new Error('Cannot resolve Keycloak realm from token issuer.');
    }

    return await multiTenant.get(issuerRealm, request);
  }

  return singleTenant;
};

export const attachCookieToHeader: (
  request: KeycloakRequest | undefined,
  cookieKey: string,
) => KeycloakRequest | undefined = (
  request: KeycloakRequest | undefined,
  cookieKey: string,
): KeycloakRequest | undefined => {
  const token: string | undefined = request?.cookies?.[cookieKey];

  if (request && token) {
    request.headers.authorization = `Bearer ${token}`;
  }

  return request;
};

export const extractRequest: (
  context: ExecutionContext,
) => KeycloakRequestResponse = (
  context: ExecutionContext,
): KeycloakRequestResponse => {
  let request: KeycloakRequest | undefined;
  let response: KeycloakResponse | undefined;

  if (context.getType() === 'http') {
    const httpContext: HttpArgumentsHost = context.switchToHttp();

    request = httpContext.getRequest<KeycloakRequest>();
    response = httpContext.getResponse<KeycloakResponse>();
  } else if (context.getType<GqlContextType>() === 'graphql') {
    const nodeRequire: NodeRequire = createRequire(__filename);
    const gql: GraphqlModule = nodeRequire('@nestjs/graphql') as GraphqlModule;
    const gqlContext: GraphqlContext =
      gql.GqlExecutionContext.create(context).getContext();

    request = gqlContext.req;
    response = gqlContext.res;
  }

  return [request, response];
};

export const extractRequestAndAttachCookie: (
  context: ExecutionContext,
  cookieKey: string,
) => KeycloakRequestResponse = (
  context: ExecutionContext,
  cookieKey: string,
): KeycloakRequestResponse => {
  const [tmpRequest, response]: KeycloakRequestResponse =
    extractRequest(context);
  const request: KeycloakRequest | undefined = attachCookieToHeader(
    tmpRequest,
    cookieKey,
  );

  return [request, response];
};
