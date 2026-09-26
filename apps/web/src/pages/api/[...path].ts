import type { APIRoute } from 'astro';

const API_BASE_URL = import.meta.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

/**
 * Proxy BFF (Backend-For-Frontend) genérico: reenvía `/api/*` del lado del
 * cliente hacia la API de NestJS, inyectando el JWT (que vive en una cookie
 * httpOnly, invisible para JS del navegador) y el tenant resuelto por el
 * middleware. Así el cliente nunca ve el token, y toda mutación desde
 * scripts (fetch de marcación, aprobaciones, etc.) pasa por aquí en lugar
 * de exponer `accessToken` al bundle del navegador.
 */
const handler: APIRoute = async ({ params, request, locals }) => {
  const path = params.path ?? '';
  const url = new URL(request.url);

  const response = await fetch(`${API_BASE_URL}/${path}${url.search}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': locals.tenant.slug,
      ...(locals.accessToken ? { Authorization: `Bearer ${locals.accessToken}` } : {}),
    },
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
  });

  // `arrayBuffer` (no `.text()`) para no corromper binarios como el PDF del
  // rol de pagos con marca de agua (ver /payroll/me/:id/pdf).
  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Content-Disposition': response.headers.get('Content-Disposition') ?? '',
    },
  });
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
