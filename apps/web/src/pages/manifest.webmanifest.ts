import type { APIRoute } from 'astro';

/**
 * Manifest de Web App Manifest generado DINÁMICAMENTE por tenant: usa el
 * nombre y los colores de marca que `middleware.ts` ya resolvió en
 * `Astro.locals` (igual que el resto del theming). Así cada empresa ve su
 * propio nombre/color al instalar la intranet como app, sin necesidad de
 * un build distinto por cliente.
 *
 * Si la empresa configuró su propio logo (`TenantBranding.logoUrl`) se usa
 * como ícono; si no, se usan los íconos genéricos de `/icons`. Para mejor
 * compatibilidad (recorte "maskable" correcto en Android), lo ideal es que
 * cada tenant suba también una variante cuadrada de su logo pensada para
 * maskable icons — por ahora se reutiliza el mismo logo para ambos usos.
 */
export const GET: APIRoute = ({ locals }) => {
  const { tenant, branding } = locals;

  const icons = branding.logoUrl
    ? [
        { src: branding.logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: branding.logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ];

  const manifest = {
    name: `Intranet ${tenant.name}`,
    short_name: tenant.name,
    description: `Intranet corporativa de ${tenant.name}`,
    id: `/?tenant=${tenant.slug}`,
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: branding.backgroundColor,
    theme_color: branding.primaryColor,
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
};
