let accessToken: string | null = null;

export function setEphemeralAccessToken(token: string | null | undefined): void {
  accessToken = typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
}

export function getEphemeralAccessToken(): string | null {
  return accessToken;
}

export function clearEphemeralAccessToken(): void {
  accessToken = null;
}
