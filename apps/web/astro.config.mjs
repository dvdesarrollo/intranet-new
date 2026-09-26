import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// SSR (no estático): cada request necesita resolver el tenant por
// subdominio/host y pedir su branding + sesión antes de renderizar.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
});
