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
 * - `localhost:4321?tenant=acme` (solo dev) -> "acme"
 */
export function resolveTenantSlug(host: string, url: URL): string | undefined {
  if (import.meta.env.DEV) {
    const devSlug = url.searchParams.get('tenant');
    if (devSlug) return devSlug;
  }

  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // Dominio propio del cliente (ej. intranet.acme.com): se asume que el
  // primer segmento identifica al tenant, igual que en subdominios propios
  // de la plataforma (acme.intranet.app). Si el cliente usa un dominio raíz
  // sin subdominio, debe registrarse igual con un subdominio dedicado.
  if (parts.length >= 3) {
    return parts[0].toLowerCase();
  }

  return undefined;
}
