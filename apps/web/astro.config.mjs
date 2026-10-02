import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// SSR (no estático): cada request necesita resolver el tenant por
// subdominio/host y pedir su branding + sesión antes de renderizar.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
  vite: {
    server: {
      // La app resuelve el tenant por subdominio (acme.localhost,
      // dvnet.localhost, ...), así que en dev no tiene sentido que Vite
      // rechace hosts arbitrarios con su protección anti DNS-rebinding.
      // Solo afecta a `astro dev`; el servidor de producción (@astrojs/node)
      // no usa esta opción.
      allowedHosts: true,
    },
  },
});
