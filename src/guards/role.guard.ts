import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as KeycloakConnect from 'keycloak-connect';
import {
  KEYCLOAK_CONNECT_OPTIONS,
  KEYCLOAK_COOKIE_DEFAULT,
  KEYCLOAK_INSTANCE,
  KEYCLOAK_MULTITENANT_SERVICE,
} from '../constants';
import {
  META_ROLE_MATCHING_MODE,
  META_ROLES,
} from '../decorators/roles.decorator';
import { RoleMatch, RoleMerge } from '../enums';
import type {
  KeycloakConnectConfig,
  KeycloakRequestResponse,
} from '../interfaces';
import { extractRequestAndAttachCookie, useKeycloak } from '../internal.util';
import { KeycloakMultiTenantService } from '../services/keycloak-multitenant.service';

/**
 * A permissive type of role guard. Roles are set via `@Roles` decorator.
 * @since 1.1.0
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger: Logger = new Logger(RoleGuard.name);
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
    const roleMerge: RoleMerge = this.keycloakOpts.roleMerge
      ? this.keycloakOpts.roleMerge
      : RoleMerge.OVERRIDE;

    const roles: string[] = [];

    const matchingMode: RoleMatch | undefined =
      this.reflector.getAllAndOverride<RoleMatch>(
      META_ROLE_MATCHING_MODE,
      [context.getClass(), context.getHandler()],
    );

    if (roleMerge === RoleMerge.ALL) {
      const mergedRoles: string[] = this.reflector.getAllAndMerge<string[]>(
        META_ROLES,
        [context.getClass(), context.getHandler()],
      );

      if (mergedRoles) {
        roles.push(...mergedRoles);
      }
    } else if (roleMerge === RoleMerge.OVERRIDE) {
      const resultRoles: string[] | undefined =
        this.reflector.getAllAndOverride<string[]>(
        META_ROLES,
        [context.getHandler(), context.getClass()],
      );

      if (resultRoles) {
        roles.push(...resultRoles);
      }
    } else {
      throw Error(`Unknown role merge: ${String(roleMerge)}`);
    }

    if (roles.length === 0) {
      return true;
    }

    const roleMatchingMode: RoleMatch = matchingMode ?? RoleMatch.ANY;

    this.logger.verbose(`Using matching mode: ${roleMatchingMode}`, { roles });

    // Extract request
    const cookieKey: string =
      this.keycloakOpts.cookieKey || KEYCLOAK_COOKIE_DEFAULT;
    const [request]: KeycloakRequestResponse =
      extractRequestAndAttachCookie(context, cookieKey);

    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    const { accessToken }: { accessToken?: string } = request;

    if (!accessToken) {
      // No access token attached, auth guard should have attached the necessary token
      this.logger.warn(
        'No access token found in request, are you sure AuthGuard is first in the chain?',
      );
      return false;
    }

    // Create grant
    const keycloak: KeycloakConnect.Keycloak = await useKeycloak(
      request,
      accessToken,
      this.singleTenant,
      this.multiTenant,
      this.keycloakOpts,
    );
    const grant: KeycloakConnect.Grant = await keycloak.grantManager.createGrant({
      access_token: accessToken as unknown as KeycloakConnect.Token,
    });

    // Grab access token from grant
    const grantAccessToken: KeycloakConnect.Token | undefined =
      grant.access_token;

    if (!grantAccessToken) {
      this.logger.warn('Grant access token is undefined');
      return false;
    }

    // For verbose logging, we store it instead of returning it immediately
    const granted: boolean =
      roleMatchingMode === RoleMatch.ANY
        ? roles.some((role: string): boolean => grantAccessToken.hasRole(role))
        : roles.every((role: string): boolean =>
            grantAccessToken.hasRole(role),
          );

    if (granted) {
      this.logger.verbose(`Resource granted due to role(s)`);
    } else {
      this.logger.verbose(`Resource denied due to mismatched role(s)`);
    }

    return granted;
  }
}
