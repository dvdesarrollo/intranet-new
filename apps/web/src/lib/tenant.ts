export interface TenantBranding {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  loginBackgroundUrl: string | null;
}

export interface TenantInfo {
  slug: string;
  name: string;
}

/**
 * Resuelve el slug del tenant a partir del Host de la petición.
 * Espejo de `TenantMiddleware.resolveSlug` en el backend, para que Astro y
 * NestJS lleguen siempre al mismo tenant para una misma URL.
 *
 * - `acme.intranet.app`      -> "acme"
 * - `intranet.acme.com`      -> resuelto por dominio propio (ver nota abajo)
 * - `acme.localhost:4321` (dev, sin HTTPS) -> "acme"
 * - `localhost:4321?tenant=acme` (dev, acceso directo sin subdominio) -> "acme"
 */
export function resolveTenantSlug(host: string, url: URL): string | undefined {
  if (import.meta.env.DEV) {
    const devSlug = url.searchParams.get('tenant');
    if (devSlug) return devSlug;
  }

  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // `*.localhost` es tratado como contexto seguro por los navegadores sin
  // necesidad de HTTPS/certificados (a diferencia de cualquier otro dominio
  // local), lo que permite probar el Service Worker/PWA en desarrollo. Por
  // eso aceptamos el patrón de 2 segmentos "<tenant>.localhost" además del
  // de 3+ segmentos usado en producción.
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0].toLowerCase();
  }

  // Dominio propio del cliente (ej. intranet.acme.com): se asume que el
  // primer segmento identifica al tenant, igual que en subdominios propios
  // de la plataforma (acme.intranet.app). Si el cliente usa un dominio raíz
  // sin subdominio, debe registrarse igual con un subdominio dedicado.
  if (parts.length >= 3) {
    return parts[0].toLowerCase();
  }

  return undefined;
}
