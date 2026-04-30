import type { ExecutionContext } from '@nestjs/common';
import type {
  HttpArgumentsHost,
  WsArgumentsHost,
} from '@nestjs/common/interfaces';
import type KeycloakConnect from 'keycloak-connect';
import type {
  KeycloakConnectConfig,
  KeycloakRequest,
  KeycloakRequestHeaders,
  KeycloakRequestHeaderValue,
  KeycloakRequestResponse,
  KeycloakResponse,
  KeycloakTokenPayload,
} from './interfaces';
import type { KeycloakMultiTenantService } from './services/keycloak-multitenant.service';
import { parseToken } from './util';

const WEBSOCKET_REQUEST_KEY: string = '__keycloakRequest';

type WebSocketClient = {
  auth?: unknown;
  handshake?: unknown;
  headers?: unknown;
  query?: unknown;
  req?: unknown;
  request?: unknown;
  upgradeReq?: unknown;
  url?: unknown;
  __keycloakRequest?: KeycloakRequest;
  [property: string]: unknown;
};

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
  } else if (context.getType() === 'ws') {
    const wsContext: WsArgumentsHost = context.switchToWs();
    request = extractWebSocketRequest(wsContext.getClient<unknown>());
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

const extractWebSocketRequest: (
  client: unknown,
) => KeycloakRequest | undefined = (
  client: unknown,
): KeycloakRequest | undefined => {
  if (!isRecord(client)) {
    return undefined;
  }

  const webSocketClient: WebSocketClient = client;

  if (webSocketClient.__keycloakRequest) {
    return webSocketClient.__keycloakRequest;
  }

  const source: unknown =
    webSocketClient.handshake ??
    webSocketClient.upgradeReq ??
    webSocketClient.request ??
    webSocketClient.req;

  const request: KeycloakRequest = isRecord(source)
    ? (source as KeycloakRequest)
    : {
        headers: normalizeHeaders(webSocketClient.headers),
      };

  normalizeWebSocketRequest(request, webSocketClient);
  webSocketClient[WEBSOCKET_REQUEST_KEY] = request;

  return request;
};

const normalizeWebSocketRequest: (
  request: KeycloakRequest,
  client: WebSocketClient,
) => KeycloakRequest = (
  request: KeycloakRequest,
  client: WebSocketClient,
): KeycloakRequest => {
  request.headers = normalizeHeaders(request.headers ?? client.headers);

  if (!request.url) {
    request.url = readStringProperty(request, 'url') ?? readStringProperty(
      client,
      'url',
    );
  }

  const authorization: string | undefined = extractWebSocketAuthorization(
    request,
    client,
  );

  if (!request.headers.authorization && authorization) {
    request.headers.authorization = authorization;
  }

  if (!request.cookies) {
    const cookies: Record<string, string | undefined> | undefined =
      parseCookieHeader(getHeaderValue(request.headers, 'cookie'));

    if (cookies) {
      request.cookies = cookies;
    }
  }

  if (typeof request.get !== 'function') {
    request.get = (header: string): string | undefined =>
      stringifyHeaderValue(getHeaderValue(request.headers, header));
  }

  return request;
};

const extractWebSocketAuthorization: (
  request: KeycloakRequest,
  client: WebSocketClient,
) => string | undefined = (
  request: KeycloakRequest,
  client: WebSocketClient,
): string | undefined => {
  const auth: Record<string, unknown> | undefined =
    readRecordProperty(request, 'auth') ?? readRecordProperty(client, 'auth');
  const query: Record<string, unknown> | undefined =
    readRecordProperty(request, 'query') ?? readRecordProperty(client, 'query');
  const urlSearchParams: URLSearchParams | undefined =
    readUrlSearchParams(request) ?? readUrlSearchParams(client);

  const authorization: string | undefined =
    readStringProperty(auth, 'authorization') ??
    readStringProperty(auth, 'Authorization') ??
    readStringProperty(query, 'authorization') ??
    readStringProperty(query, 'Authorization') ??
    readSearchParam(urlSearchParams, 'authorization') ??
    readSearchParam(urlSearchParams, 'Authorization');

  if (authorization) {
    return authorization;
  }

  const token: string | undefined =
    readStringProperty(auth, 'token') ??
    readStringProperty(auth, 'accessToken') ??
    readStringProperty(auth, 'access_token') ??
    readStringProperty(query, 'token') ??
    readStringProperty(query, 'accessToken') ??
    readStringProperty(query, 'access_token') ??
    readSearchParam(urlSearchParams, 'token') ??
    readSearchParam(urlSearchParams, 'accessToken') ??
    readSearchParam(urlSearchParams, 'access_token');

  return token ? toBearerAuthorization(token) : undefined;
};

const normalizeHeaders: (headers: unknown) => KeycloakRequestHeaders = (
  headers: unknown,
): KeycloakRequestHeaders => {
  const normalized: KeycloakRequestHeaders = {};

  if (!isRecord(headers)) {
    return normalized;
  }

  Object.entries(headers).forEach(([header, value]: [string, unknown]): void => {
    const headerValue: KeycloakRequestHeaderValue =
      normalizeHeaderValue(value);

    if (headerValue !== undefined) {
      normalized[header.toLowerCase()] = headerValue;
    }
  });

  return normalized;
};

const normalizeHeaderValue: (
  value: unknown,
) => KeycloakRequestHeaderValue = (
  value: unknown,
): KeycloakRequestHeaderValue => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values: string[] = value.filter(
      (item: unknown): item is string => typeof item === 'string',
    );

    return values.length > 0 ? values : undefined;
  }

  return undefined;
};

const getHeaderValue: (
  headers: KeycloakRequestHeaders,
  header: string,
) => KeycloakRequestHeaderValue = (
  headers: KeycloakRequestHeaders,
  header: string,
): KeycloakRequestHeaderValue => {
  const lowerHeader: string = header.toLowerCase();
  const directValue: KeycloakRequestHeaderValue = headers[lowerHeader];

  if (directValue !== undefined) {
    return directValue;
  }

  const matchingHeader: string | undefined = Object.keys(headers).find(
    (key: string): boolean => key.toLowerCase() === lowerHeader,
  );

  return matchingHeader ? headers[matchingHeader] : undefined;
};

const stringifyHeaderValue: (
  value: KeycloakRequestHeaderValue,
) => string | undefined = (
  value: KeycloakRequestHeaderValue,
): string | undefined => {
  return Array.isArray(value) ? value.join(', ') : value;
};

const parseCookieHeader: (
  cookieHeader: KeycloakRequestHeaderValue,
) => Record<string, string | undefined> | undefined = (
  cookieHeader: KeycloakRequestHeaderValue,
): Record<string, string | undefined> | undefined => {
  const header: string | undefined = Array.isArray(cookieHeader)
    ? cookieHeader.join('; ')
    : cookieHeader;

  if (!header) {
    return undefined;
  }

  return header.split(';').reduce(
    (
      cookies: Record<string, string | undefined>,
      cookie: string,
    ): Record<string, string | undefined> => {
      const separatorIndex: number = cookie.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key: string = cookie.slice(0, separatorIndex).trim();
      const value: string = cookie.slice(separatorIndex + 1).trim();

      if (key) {
        cookies[key] = decodeCookieValue(value);
      }

      return cookies;
    },
    {},
  );
};

const decodeCookieValue: (value: string) => string = (
  value: string,
): string => {
  try {
    return decodeURIComponent(value);
  } catch (_error: unknown) {
    return value;
  }
};

const toBearerAuthorization: (token: string) => string = (
  token: string,
): string => {
  return /^bearer\s+/i.test(token) ? token : `Bearer ${token}`;
};

const readRecordProperty: (
  source: unknown,
  property: string,
) => Record<string, unknown> | undefined = (
  source: unknown,
  property: string,
): Record<string, unknown> | undefined => {
  if (!isRecord(source)) {
    return undefined;
  }

  const value: unknown = source[property];
  return isRecord(value) ? value : undefined;
};

const readStringProperty: (
  source: unknown,
  property: string,
) => string | undefined = (
  source: unknown,
  property: string,
): string | undefined => {
  if (!isRecord(source)) {
    return undefined;
  }

  const value: unknown = source[property];

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find(
      (item: unknown): item is string => typeof item === 'string',
    );
  }

  return undefined;
};

const readUrlSearchParams: (source: unknown) => URLSearchParams | undefined = (
  source: unknown,
): URLSearchParams | undefined => {
  const url: string | undefined = readStringProperty(source, 'url');

  if (!url) {
    return undefined;
  }

  try {
    return new URL(url, 'ws://localhost').searchParams;
  } catch (_error: unknown) {
    return undefined;
  }
};

const readSearchParam: (
  searchParams: URLSearchParams | undefined,
  property: string,
) => string | undefined = (
  searchParams: URLSearchParams | undefined,
  property: string,
): string | undefined => {
  return searchParams?.get(property) ?? undefined;
};

const isRecord: (value: unknown) => value is Record<string, unknown> = (
  value: unknown,
): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
