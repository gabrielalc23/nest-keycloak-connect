import type { KeycloakTokenPayload } from './interfaces';

export const parseToken: <
  Payload extends KeycloakTokenPayload = KeycloakTokenPayload,
>(
  token: string,
) => Payload = <Payload extends KeycloakTokenPayload = KeycloakTokenPayload>(
  token: string,
): Payload => {
  const parts: string[] = token.split('.');
  const payload: string | undefined = parts[1];

  if (!payload) {
    throw new Error('Invalid JWT token.');
  }

  const normalizedPayload: string = payload
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return JSON.parse(
    Buffer.from(normalizedPayload, 'base64').toString(),
  ) as Payload;
};
