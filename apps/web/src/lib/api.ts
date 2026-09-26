const API_BASE_URL = import.meta.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface ApiFetchOptions extends RequestInit {
  tenantSlug: string;
  accessToken?: string;
}

/**
 * Cliente HTTP hacia la API de NestJS. SIEMPRE envía `X-Tenant-Slug` para
 * que `TenantMiddleware` (backend) resuelva la empresa correcta, sin
 * depender de que el navegador y la API compartan el mismo dominio/host.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const { tenantSlug, accessToken, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenantSlug,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? 'Error de API');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
