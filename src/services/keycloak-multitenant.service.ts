import { Inject, Injectable } from '@nestjs/common';
import KeycloakConnect from 'keycloak-connect';
import { createAccessDeniedHandler } from '../access-denied.util';
import type {
  KeycloakConnectConfig,
  KeycloakConnectOptions,
  KeycloakRequest,
} from '../interfaces';
import { KEYCLOAK_CONNECT_OPTIONS } from '../constants';

/**
 * Stores all keycloak instances when multi tenant option is defined.
 */
@Injectable()
export class KeycloakMultiTenantService {
  private instances: Map<string, KeycloakConnect.Keycloak> = new Map();

  constructor(
    @Inject(KEYCLOAK_CONNECT_OPTIONS)
    private keycloakOpts: KeycloakConnectOptions,
  ) {}

  /**
   * Clears the cached Keycloak instances.
   */
  clear(): void {
    this.instances.clear();
  }

  /**
   * Retrieves a keycloak instance based on the realm provided.
   * @param realm the realm to retrieve from
   * @param request the request instance, defaults to undefined
   * @returns the multi tenant keycloak instance
   */
  async get(
    realm: string,
    request: KeycloakRequest | undefined = undefined,
  ): Promise<KeycloakConnect.Keycloak> {
    if (typeof this.keycloakOpts === 'string') {
      throw new Error(
        'Keycloak configuration is a configuration path. This should not happen after module load.',
      );
    }
    if (
      this.keycloakOpts.multiTenant === null ||
      this.keycloakOpts.multiTenant === undefined
    ) {
      throw new Error(
        'Multi tenant is not defined yet multi tenant service is being called.',
      );
    }

    const authServerUrl: string = await this.resolveAuthServerUrl(
      realm,
      request,
    );
    const secret: string = await this.resolveSecret(realm, request);
    const clientId: string = await this.resolveClientId(realm, request);

    const existingKeycloak: KeycloakConnect.Keycloak | undefined =
      this.instances.get(realm);

    if (existingKeycloak && !this.keycloakOpts.multiTenant.resolveAlways) {
      return existingKeycloak;
    }

    const keycloakOpts: KeycloakConnectConfig = {
      ...this.keycloakOpts,
      authServerUrl,
      realm,
      secret,
      clientId,
    };
    const keycloakConfig: KeycloakConnect.KeycloakConfig =
      keycloakOpts as unknown as KeycloakConnect.KeycloakConfig;
    const keycloak: KeycloakConnect.Keycloak = new KeycloakConnect(
      {},
      keycloakConfig,
    );

    Object.assign(keycloak, {
      accessDenied: createAccessDeniedHandler(),
    });

    this.instances.set(realm, keycloak);
    return keycloak;
  }

  async resolveAuthServerUrl(
    realm: string,
    request: KeycloakRequest | undefined = undefined,
  ): Promise<string> {
    if (typeof this.keycloakOpts === 'string') {
      throw new Error(
        'Keycloak configuration is a configuration path. This should not happen after module load.',
      );
    }
    if (
      this.keycloakOpts.multiTenant === null ||
      this.keycloakOpts.multiTenant === undefined
    ) {
      throw new Error(
        'Multi tenant is not defined yet multi tenant service is being called.',
      );
    }

    // If no realm auth server url resolver is defined, return defaults
    if (!this.keycloakOpts.multiTenant.realmAuthServerUrlResolver) {
      return this.requireConfigValue(
        this.keycloakOpts.authServerUrl ||
          this.keycloakOpts['auth-server-url'] ||
          this.keycloakOpts.serverUrl ||
          this.keycloakOpts['server-url'],
        'auth server url',
      );
    }

    // Resolve realm authServerUrl
    const resolvedAuthServerUrl: string = await Promise.resolve(
      this.keycloakOpts.multiTenant.realmAuthServerUrlResolver(realm, request),
    );

    // Override auth server url
    // Order of priority: resolved realm auth server url > provided auth server url
    return this.requireConfigValue(
      resolvedAuthServerUrl ||
        this.keycloakOpts.authServerUrl ||
        this.keycloakOpts['auth-server-url'] ||
        this.keycloakOpts.serverUrl ||
        this.keycloakOpts['server-url'],
      'auth server url',
    );
  }

  async resolveClientId(
    realm: string,
    request: KeycloakRequest | undefined = undefined,
  ): Promise<string> {
    if (typeof this.keycloakOpts === 'string') {
      throw new Error(
        'Keycloak configuration is a configuration path. This should not happen after module load.',
      );
    }
    if (
      this.keycloakOpts.multiTenant === null ||
      this.keycloakOpts.multiTenant === undefined
    ) {
      throw new Error(
        'Multi tenant is not defined yet multi tenant service is being called.',
      );
    }

    // If no realm client-id resolver is defined, return defaults
    if (!this.keycloakOpts.multiTenant.realmClientIdResolver) {
      return this.requireConfigValue(
        this.keycloakOpts.clientId || this.keycloakOpts['client-id'],
        'client id',
      );
    }

    // Resolve realm client-id
    const resolvedClientId: string = await Promise.resolve(
      this.keycloakOpts.multiTenant.realmClientIdResolver(realm, request),
    );

    // Override client-id
    // Order of priority: resolved realm secret > default global secret
    return this.requireConfigValue(
      resolvedClientId ||
        this.keycloakOpts.clientId ||
        this.keycloakOpts['client-id'],
      'client id',
    );
  }

  async resolveSecret(
    realm: string,
    request: KeycloakRequest | undefined = undefined,
  ): Promise<string> {
    if (typeof this.keycloakOpts === 'string') {
      throw new Error(
        'Keycloak configuration is a configuration path. This should not happen after module load.',
      );
    }
    if (
      this.keycloakOpts.multiTenant === null ||
      this.keycloakOpts.multiTenant === undefined
    ) {
      throw new Error(
        'Multi tenant is not defined yet multi tenant service is being called.',
      );
    }

    // If no realm secret resolver is defined, return defaults
    if (!this.keycloakOpts.multiTenant.realmSecretResolver) {
      return this.keycloakOpts.secret;
    }

    // Resolve realm secret
    const resolvedRealmSecret: string = await Promise.resolve(
      this.keycloakOpts.multiTenant.realmSecretResolver(realm, request),
    );

    // Override secret
    // Order of priority: resolved realm secret > default global secret
    return this.requireConfigValue(
      resolvedRealmSecret || this.keycloakOpts.secret,
      'client secret',
    );
  }

  private requireConfigValue(
    value: string | undefined,
    configName: string,
  ): string {
    if (!value) {
      throw new Error(`Missing Keycloak ${configName}.`);
    }

    return value;
  }
}
