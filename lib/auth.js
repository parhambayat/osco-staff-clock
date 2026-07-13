import { cookies } from 'next/headers';
import { SESSION_COOKIE, isValidManagerToken } from './session';
import { checkManagerCredentials } from './db';

export { SESSION_COOKIE };

export function getSessionToken() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

export function requireManager() {
  const token = getSessionToken();
  if (!isValidManagerToken(token)) {
    return { ok: false, token: null };
  }
  return { ok: true, token };
}

export { checkManagerCredentials };
