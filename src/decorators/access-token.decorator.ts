import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { extractRequest } from '../internal.util';

/**
 * Retrieves the currently used access token
 * @since 2.0.0
 */
export const AccessToken: (...dataOrPipes: unknown[]) => ParameterDecorator =
  createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string | undefined => {
      const [req]: ReturnType<typeof extractRequest> = extractRequest(ctx);
      return req?.accessToken;
    },
  );
