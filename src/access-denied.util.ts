import type {
  KeycloakAccessDeniedHandler,
  KeycloakRequest,
  KeycloakResponse,
} from './interfaces';

export const createAccessDeniedHandler: () => KeycloakAccessDeniedHandler =
  (): KeycloakAccessDeniedHandler => {
    return (
      request: KeycloakRequest,
      _response: KeycloakResponse | undefined,
      next?: () => void,
    ): void => {
      request.resourceDenied = true;
      next?.();
    };
  };
