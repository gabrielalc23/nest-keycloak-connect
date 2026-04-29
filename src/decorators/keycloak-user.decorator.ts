import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { extractRequest } from '../internal.util';
import type { KeycloakTokenPayload } from '../interfaces';

/**
 * Retrieves the current Keycloak logged-in user.
 * @since 1.5.0
 */
export const KeycloakUser: (...dataOrPipes: unknown[]) => ParameterDecorator =
  createParamDecorator(
    (
      data: unknown,
      ctx: ExecutionContext,
    ): KeycloakTokenPayload | undefined => {
      const [req]: ReturnType<typeof extractRequest> = extractRequest(ctx);
      return req?.user;
    },
  );
