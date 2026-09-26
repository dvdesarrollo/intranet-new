import { defineMiddleware } from 'astro:middleware';
import { resolveTenantSlug, type TenantBranding, type TenantInfo } from './lib/tenant';
import { decodeSessionUser, getSessionToken, type SessionUser } from './lib/session';

declare global {
  namespace App {
    interface Locals {
      tenant: TenantInfo;
      branding: TenantBranding;
      user: SessionUser | null;
      accessToken?: string;
    }
  }
}

const API_BASE_URL = import.meta.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const PUBLIC_PATHS = ['/login', '/favicon.svg'];

const DEFAULT_BRANDING: TenantBranding = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#0F172A',
  secondaryColor: '#2563EB',
  accentColor: '#F59E0B',
  textColor: '#0F172A',
  backgroundColor: '#FFFFFF',
  fontFamily: 'Inter',
  loginBackgroundUrl: null,
};

/**
 * Se ejecuta en CADA request SSR, antes de renderizar cualquier página:
 *  1. Resuelve el tenant por subdominio/host.
 *  2. Pide su branding a la API (logo/colores) para theming dinámico.
 *  3. Lee la sesión (cookie httpOnly) para saber quién está logueado.
 *  4. Protege rutas: sin sesión -> redirige a /login.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get('host') ?? '';
  const slug = resolveTenantSlug(host, context.url);

  if (!slug) {
    return new Response('No se pudo determinar la empresa (tenant) de esta URL', { status: 404 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/platform/tenants/${slug}/branding`);
    if (!res.ok) {
      return new Response(`Empresa '${slug}' no encontrada`, { status: 404 });
    }
    const data = (await res.json()) as { tenant: TenantInfo; branding: TenantBranding | null };
    context.locals.tenant = data.tenant;
    context.locals.branding = { ...DEFAULT_BRANDING, ...(data.branding ?? {}) };
  } catch {
    context.locals.tenant = { slug, name: slug };
    context.locals.branding = DEFAULT_BRANDING;
  }

  const token = getSessionToken(context.cookies);
  context.locals.accessToken = token;
  context.locals.user = token ? decodeSessionUser(token) : null;

  const isPublic = PUBLIC_PATHS.some((p) => context.url.pathname.startsWith(p));
  if (!isPublic && !context.locals.user) {
    return context.redirect(`/login?next=${encodeURIComponent(context.url.pathname)}`);
  }

  return next();
});
