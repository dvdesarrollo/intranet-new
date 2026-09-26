import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../lib/session';

export const POST: APIRoute = ({ cookies, redirect }) => {
  clearSessionCookie(cookies);
  return redirect('/login');
};
