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
import { META_ENFORCER_OPTIONS } from '../decorators/enforcer-options.decorator';
import { META_PUBLIC } from '../decorators/public.decorator';
import { META_RESOURCE } from '../decorators/resource.decorator';
import {
  META_CONDITIONAL_SCOPES,
  META_SCOPES,
} from '../decorators/scopes.decorator';
import { PolicyEnforcementMode } from '../enums';
import type { ConditionalScopeFn } from '../decorators/scopes.decorator';
import type {
  KeycloakConnectConfig,
  KeycloakRequest,
  KeycloakRequestHeaderValue,
  KeycloakRequestResponse,
  KeycloakResponse,
} from '../interfaces';
import { extractRequestAndAttachCookie, useKeycloak } from '../internal.util';
import { KeycloakMultiTenantService } from '../services/keycloak-multitenant.service';

/**
 * This adds a resource guard, which is policy enforcement by default is permissive.
 * Only controllers annotated with `@Resource` and methods with `@Scopes`
 * are handled by this guard.
 */
@Injectable()
export class ResourceGuard implements CanActivate {
  private readonly logger: Logger = new Logger(ResourceGuard.name);
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
    const defaultEnforcerOpts: KeycloakConnect.EnforcerOptions = {
      claims: (request: KeycloakRequest): Record<string, string[]> => {
        const httpUri: string = request.url ?? '';
        const userAgent: KeycloakRequestHeaderValue =
          request.headers['user-agent'];
        const userAgentValue: string = Array.isArray(userAgent)
          ? userAgent.join(', ')
          : (userAgent ?? '');

        this.logger.verbose(
          `Enforcing claims, http.uri: ${httpUri}, user.agent: ${userAgentValue}`,
        );

        return {
          'http.uri': [httpUri],
          'user.agent': [userAgentValue],
        };
      },
    };

    const resourceHandler: string = this.reflector.get<string>(
      META_RESOURCE,
      context.getHandler(),
    );
    const resourceClass: string = this.reflector.get<string>(
      META_RESOURCE,
      context.getClass(),
    );
    // Prioritize handler level then class
    const resource: string = resourceHandler ?? resourceClass;
    const explicitScopes: string[] =
      this.reflector.get<string[]>(META_SCOPES, context.getHandler()) ?? [];
    const conditionalScopes: ConditionalScopeFn | undefined =
      this.reflector.get<ConditionalScopeFn>(
        META_CONDITIONAL_SCOPES,
        context.getHandler(),
      );
    const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(
      META_PUBLIC,
      [context.getClass(), context.getHandler()],
    );
    const enforcerOpts: KeycloakConnect.EnforcerOptions =
      this.reflector.getAllAndOverride<KeycloakConnect.EnforcerOptions>(
        META_ENFORCER_OPTIONS,
        [context.getClass(), context.getHandler()],
      ) ?? defaultEnforcerOpts;

    // Default to permissive
    const policyEnforcementMode: PolicyEnforcementMode =
      this.keycloakOpts.policyEnforcement || PolicyEnforcementMode.PERMISSIVE;

    const shouldAllow: boolean =
      policyEnforcementMode === PolicyEnforcementMode.PERMISSIVE;

    // Extract request/response
    const cookieKey: string =
      this.keycloakOpts.cookieKey || KEYCLOAK_COOKIE_DEFAULT;

    const [request, response]: KeycloakRequestResponse =
      extractRequestAndAttachCookie(context, cookieKey);

    // if is not an HTTP request ignore this guard
    if (!request) {
      return true;
    }

    if (!request.user && isPublic) {
      this.logger.verbose(`Route has no user, and is public, allowed`);
      return true;
    }

    const { accessToken }: { accessToken?: string } = request;

    if (!accessToken) {
      this.logger.warn(
        'No access token found in request, are you sure AuthGuard is first in the chain?',
      );
      return shouldAllow;
    }

    const keycloak: KeycloakConnect.Keycloak = await useKeycloak(
      request,
      accessToken,
      this.singleTenant,
      this.multiTenant,
      this.keycloakOpts,
    );

    const grant: KeycloakConnect.Grant =
      await keycloak.grantManager.createGrant({
      access_token: accessToken as unknown as KeycloakConnect.Token,
    });

    // No resource given, check policy enforcement mode
    if (!resource) {
      if (shouldAllow) {
        this.logger.verbose(
          `Controller has no @Resource defined, request allowed due to policy enforcement`,
        );
      } else {
        this.logger.verbose(
          `Controller has no @Resource defined, request denied due to policy enforcement`,
        );
      }
      return shouldAllow;
    }

    if (!grant.access_token) {
      this.logger.warn(`Access token is undefined`);
      return shouldAllow;
    }

    // Build the required scopes
    const conditionalScopesResult: string[] =
      conditionalScopes !== null && conditionalScopes !== undefined
        ? conditionalScopes(request, grant.access_token)
        : [];

    const scopes: string[] = [...explicitScopes, ...conditionalScopesResult];

    // Attach resolved scopes
    request.scopes = scopes;

    // No scopes given, check policy enforcement mode
    if (!scopes || scopes.length === 0) {
      if (shouldAllow) {
        this.logger.verbose(
          `Route has no @Scope/@ConditionalScopes defined, request allowed due to policy enforcement`,
        );
      } else {
        this.logger.verbose(
          `Route has no @Scope/@ConditionalScopes defined, request denied due to policy enforcement`,
        );
      }
      return shouldAllow;
    }

    this.logger.verbose(
      `Protecting resource [ ${resource} ] with scopes: [ ${scopes.join(', ')} ]`,
    );

    const user: string = request.user?.preferred_username ?? 'user';

    const enforcerFn: EnforcerContext = createEnforcerContext(
      request,
      response,
      enforcerOpts,
    );

    // Build permissions
    const permissions: string[] = scopes.map(
      (scope: string): string => `${resource}:${scope}`,
    );
    const isAllowed: boolean = await enforcerFn(keycloak, permissions);

    // If statement for verbose logging only
    if (!isAllowed) {
      this.logger.verbose(`Resource [ ${resource} ] denied to [ ${user} ]`);
    } else {
      this.logger.verbose(`Resource [ ${resource} ] granted to [ ${user} ]`);
    }

    return isAllowed;
  }
}

type EnforcerMiddleware = (
  request: KeycloakRequest,
  response: KeycloakResponse | undefined,
  next: (error?: unknown) => void,
) => void;

type EnforcerContext = (
  keycloak: KeycloakConnect.Keycloak,
  permissions: string[],
) => Promise<boolean>;

const createEnforcerContext: (
  request: KeycloakRequest,
  response: KeycloakResponse | undefined,
  options?: KeycloakConnect.EnforcerOptions,
) => EnforcerContext =
  (
    request: KeycloakRequest,
    response: KeycloakResponse | undefined,
    options?: KeycloakConnect.EnforcerOptions,
  ): EnforcerContext =>
  (
    keycloak: KeycloakConnect.Keycloak,
    permissions: string[],
  ): Promise<boolean> =>
    new Promise<boolean>((resolve: (value: boolean) => void): void => {
      const enforcer: EnforcerMiddleware = keycloak.enforcer(
        permissions,
        options,
      ) as unknown as EnforcerMiddleware;

      enforcer(request, response, (_error?: unknown): void => {
        if (request.resourceDenied) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
