import type { CustomDecorator} from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import type * as KeycloakConnect from 'keycloak-connect';
import type { KeycloakRequest } from '../interfaces';

export const META_SCOPES: string = 'scopes';

export const META_CONDITIONAL_SCOPES: string = 'conditional-scopes';

export type ConditionalScopeFn = (
  request: KeycloakRequest,
  token: KeycloakConnect.Token,
) => string[];

/**
 * Keycloak authorization scopes.
 * @param scopes - scopes that are associated with the resource
 */
export const Scopes: (...scopes: string[]) => CustomDecorator<string> = (
  ...scopes: string[]
) => SetMetadata(META_SCOPES, scopes);

/**
 * Keycloak authorization conditional scopes.
 * @param scopes - scopes that are associated with the resource depending on the conditions
 */
export const ConditionalScopes: (
  resolver: ConditionalScopeFn,
) => CustomDecorator<string> = (resolver: ConditionalScopeFn) =>
  SetMetadata(META_CONDITIONAL_SCOPES, resolver);

import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { extractRequest } from '../internal.util';

/**
 * Retrieves the resolved scopes.
 * @since 1.5.0
 */
export const ResolvedScopes: (...dataOrPipes: unknown[]) => ParameterDecorator =
  createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string[] | undefined => {
      const [req]: ReturnType<typeof extractRequest> = extractRequest(ctx);
      return req?.scopes;
    },
  );
