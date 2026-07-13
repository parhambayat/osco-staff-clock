import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const COOKIE = 'osco_manager_session';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  return (
    process.env.MANAGER_SESSION_SECRET ||
    process.env.MANAGER_PASSWORD ||
    'osco-lounge-dev-secret'
  );
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;

export function createManagerToken() {
  return sign({
    role: 'manager',
    jti: randomBytes(8).toString('hex'),
    exp: Date.now() + WEEK_MS,
  });
}

export function isValidManagerToken(token) {
  const payload = verify(token);
  return !!(payload && payload.role === 'manager');
}

export function sessionCookieOptions(token) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60,
    value: token,
  };
}
