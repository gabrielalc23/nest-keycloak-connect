import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const META_PUBLIC: string = 'public';

/**
 * Allows unauthorized traffic to enter the route.
 * @since 1.2.0
 * @param skipAuth attaches authorization header to user object when `false`, defaults to `true`
 */
export const Public: () => CustomDecorator<string> = () =>
  SetMetadata(META_PUBLIC, true);
