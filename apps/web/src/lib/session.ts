import type { AstroCookies } from 'astro';

const SESSION_COOKIE = 'intranet_session';

export interface SessionUser {
  id: string;
  email: string;
  employeeId?: string;
  roles: string[];
}

/**
 * Decodifica (sin verificar firma) el payload del JWT para uso de UI
 * (nombre de rol, menú visible, etc). La verificación real de firma y
 * expiración la hace siempre la API en cada request — esto es solo para
 * decidir qué renderizar, nunca para autorizar acciones.
 */
export function decodeSessionUser(token: string): SessionUser | null {
  try {
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    return {
      id: payload.sub,
      email: payload.email,
      employeeId: payload.employeeId,
      roles: payload.roles ?? [],
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(cookies: AstroCookies, accessToken: string) {
  cookies.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h, igual que JWT_EXPIRES_IN en la API
  });
}

export function getSessionToken(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE)?.value;
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
