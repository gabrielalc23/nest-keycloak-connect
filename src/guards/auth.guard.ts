import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as KeycloakConnect from 'keycloak-connect';
import {
  KEYCLOAK_CONNECT_OPTIONS,
  KEYCLOAK_COOKIE_DEFAULT,
  KEYCLOAK_INSTANCE,
  KEYCLOAK_MULTITENANT_SERVICE,
} from '../constants';
import { META_PUBLIC } from '../decorators/public.decorator';
import { TokenValidation } from '../enums';
import type {
  KeycloakConnectConfig,
  KeycloakRequestResponse,
  KeycloakRequestHeaders,
} from '../interfaces';
import { extractRequestAndAttachCookie, useKeycloak } from '../internal.util';
import { KeycloakMultiTenantService } from '../services/keycloak-multitenant.service';
import { parseToken } from '../util';

/**
 * An authentication guard. Will return a 401 unauthorized when it is unable to
 * verify the JWT token or Bearer header is missing.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger: Logger = new Logger(AuthGuard.name);
  private readonly reflector: Reflector = new Reflector();

  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private singleTenant: KeycloakConnect.Keycloak,
    @Inject(KEYCLOAK_CONNECT_OPTIONS)
    private keycloakOpts: KeycloakConnectConfig,
    @Inject(KEYCLOAK_MULTITENANT_SERVICE)
    private multiTenant: KeycloakMultiTenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(
      META_PUBLIC,
      [context.getClass(), context.getHandler()],
    );

    // Extract request/response
    const cookieKey: string =
      this.keycloakOpts.cookieKey || KEYCLOAK_COOKIE_DEFAULT;
    const [request]: KeycloakRequestResponse =
      extractRequestAndAttachCookie(context, cookieKey);

    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    const jwt: string | null = this.extractJwt(request.headers);

    if (jwt === null) {
      if (isPublic) {
        return true;
      }

      throw new UnauthorizedException('Jwt token not exists');
    }

    this.logger.verbose(`Validating jwt`, { jwt });

    const keycloak: KeycloakConnect.Keycloak = await useKeycloak(
      request,
      jwt,
      this.singleTenant,
      this.multiTenant,
      this.keycloakOpts,
    );
    const isValidToken: boolean = await this.validateToken(keycloak, jwt);

    if (isValidToken) {
      // Attach user info object
      request.user = parseToken(jwt);
      // Attach raw access token JWT extracted from bearer/cookie
      request.accessToken = jwt;

      this.logger.verbose(`User authenticated`, { user: request.user });
      return true;
    }

    // Valid token should return, this time we warn
    if (isPublic) {
      this.logger.warn(`A jwt token was retrieved but failed validation.`, {
        jwt,
      });
      return true;
    }

    throw new UnauthorizedException();
  }

  private async validateToken(
    keycloak: KeycloakConnect.Keycloak,
    jwt: string,
  ): Promise<boolean> {
    const tokenValidation: TokenValidation =
      this.keycloakOpts.tokenValidation || TokenValidation.ONLINE;

    const gm: KeycloakConnect.GrantManager = keycloak.grantManager;
    let grant: KeycloakConnect.Grant;

    try {
      grant = await gm.createGrant({
        access_token: jwt as unknown as KeycloakConnect.Token,
      });
    } catch (error: unknown) {
      this.logger.warn(`Cannot validate access token: ${String(error)}`);
      // It will fail to create grants on invalid access token (i.e expired or wrong domain)
      return false;
    }

    const token: KeycloakConnect.Token | undefined = grant.access_token;

    if (token === undefined) {
      throw new UnauthorizedException('token not exists');
    }

    this.logger.verbose(
      `Using token validation method: ${tokenValidation.toUpperCase()}`,
    );

    try {
      let result: boolean | KeycloakConnect.Token | string;

      switch (tokenValidation) {
        case TokenValidation.ONLINE:
          result = await gm.validateAccessToken(token);
          return result === token;
        case TokenValidation.OFFLINE:
          result = await gm.validateToken(token, 'Bearer');
          return result === token;
        case TokenValidation.NONE:
          return true;
        default:
          this.logger.warn(
            `Unknown validation method: ${String(tokenValidation)}`,
          );
          return false;
      }
    } catch (error: unknown) {
      this.logger.warn(`Cannot validate access token: ${String(error)}`);
    }

    return false;
  }

  private extractJwt(headers: KeycloakRequestHeaders): string | null {
    if (headers && !headers.authorization) {
      this.logger.verbose(`No authorization header`);
      return null;
    }

    if (typeof headers.authorization !== 'string') {
      this.logger.verbose(`Authorization header is not a string`);
      return null;
    }

    const auth: string[] = headers.authorization.split(' ');

    // We only allow bearer
    const scheme: string | undefined = auth[0];
    const token: string | undefined = auth[1];

    if (!scheme || scheme.toLowerCase() !== 'bearer') {
      this.logger.verbose(`No bearer header`);
      return null;
    }

    return token ?? null;
  }
}
