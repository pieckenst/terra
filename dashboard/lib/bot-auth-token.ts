let cached: { token: string; expiresAtMs: number } | null = null;
const SKEW_MS = 30_000;

export async function getBotAuthToken(): Promise<string | null> {
  if (cached && cached.expiresAtMs > Date.now() + SKEW_MS) {
    return cached.token;
  }

  const res = await fetch('/api/bot/auth-token', {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { token: string; expiresAt: number };
  cached = { token: data.token, expiresAtMs: data.expiresAt };
  return data.token;
}

export function clearBotAuthTokenCache(): void {
  cached = null;
}
