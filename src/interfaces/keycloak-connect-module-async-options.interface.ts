import type { InjectionToken } from '@nestjs/common';
import type { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import type { KeycloakConnectOptionsFactory } from './keycloak-connect-options-factory.interface';
import type { KeycloakConnectOptions } from './keycloak-connect-options.type';

export interface KeycloakConnectModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: InjectionToken[];
  useExisting?: Type<KeycloakConnectOptionsFactory>;
  useClass?: Type<KeycloakConnectOptionsFactory>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<KeycloakConnectOptions> | KeycloakConnectOptions;
}
