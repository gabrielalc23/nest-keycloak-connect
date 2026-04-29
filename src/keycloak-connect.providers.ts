import type { Provider } from '@nestjs/common';
import * as fs from 'fs';
import KeycloakConnect from 'keycloak-connect';
import * as path from 'path';
import { createAccessDeniedHandler } from './access-denied.util';
import {
  KEYCLOAK_CONNECT_OPTIONS,
  KEYCLOAK_INSTANCE,
} from './constants';
import { TokenValidation } from './enums';
import type {
  KeycloakConnectConfig,
  KeycloakConnectOptions,
  NestKeycloakConfig,
} from './interfaces';
import { KeycloakConnectModule } from './keycloak-connect.module';

export const keycloakProvider: Provider = {
  provide: KEYCLOAK_INSTANCE,
  useFactory: (opts: KeycloakConnectOptions): KeycloakConnect.Keycloak => {
    const keycloakOpts: KeycloakConnect.KeycloakConfig | string =
      opts as unknown as KeycloakConnect.KeycloakConfig | string;
    const keycloak: KeycloakConnect.Keycloak = new KeycloakConnect(
      {},
      keycloakOpts,
    );

    // Warn if using token validation none
    if (
      typeof opts !== 'string' &&
      opts.tokenValidation &&
      opts.tokenValidation === TokenValidation.NONE
    ) {
      KeycloakConnectModule.logger.warn(
        `Token validation is disabled, please only do this on development/special use-cases.`,
      );
    }

    // Access denied is called, add a flag to request so our resource guard knows
    Object.assign(keycloak, {
      accessDenied: createAccessDeniedHandler(),
    });

    return keycloak;
  },
  inject: [KEYCLOAK_CONNECT_OPTIONS],
};

const parseConfig: (
  opts: KeycloakConnectOptions,
  config?: NestKeycloakConfig,
) => KeycloakConnectConfig = (
  opts: KeycloakConnectOptions,
  config?: NestKeycloakConfig,
): KeycloakConnectConfig => {
  if (typeof opts === 'string') {
    const configPathRelative: string = path.join(__dirname, opts);
    const configPathRoot: string = path.join(process.cwd(), opts);

    let configPath: string;

    if (fs.existsSync(configPathRelative)) {
      configPath = configPathRelative;
    } else if (fs.existsSync(configPathRoot)) {
      configPath = configPathRoot;
    } else {
      throw new Error(
        `Cannot find files, looked in [ ${configPathRelative}, ${configPathRoot} ]`,
      );
    }

    const json: Buffer = fs.readFileSync(configPath);
    const keycloakConfig: unknown = JSON.parse(json.toString());

    if (!isRecord(keycloakConfig)) {
      throw new Error(`Invalid Keycloak config file: ${configPath}`);
    }

    return {
      ...keycloakConfig,
      ...config,
    } as KeycloakConnectConfig;
  }
  return opts;
};

export const createKeycloakConnectOptionProvider: (
  opts: KeycloakConnectOptions,
  config?: NestKeycloakConfig,
) => Provider = (
  opts: KeycloakConnectOptions,
  config?: NestKeycloakConfig,
): Provider => {
  return {
    provide: KEYCLOAK_CONNECT_OPTIONS,
    useValue: parseConfig(opts, config),
  };
};

const isRecord: (value: unknown) => value is Record<string, unknown> = (
  value: unknown,
): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
