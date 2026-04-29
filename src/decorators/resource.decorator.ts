import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const META_RESOURCE: string = 'resource';

/**
 * Keycloak Resource.
 * @param resource - name of resource
 */
export const Resource: (resource: string) => CustomDecorator<string> = (
  resource: string,
) => SetMetadata(META_RESOURCE, resource);
