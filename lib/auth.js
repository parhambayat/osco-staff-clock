import { cookies } from 'next/headers';
import { validateManagerSession } from './db';

export const SESSION_COOKIE = 'osco_manager_session';

export function getSessionToken() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

export function requireManager() {
  const token = getSessionToken();
  if (!validateManagerSession(token)) {
    return { ok: false, token: null };
  }
  return { ok: true, token };
}
