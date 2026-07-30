import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const MANAGER_COOKIE = 'osco_manager_session';
const STAFF_COOKIE = 'osco_staff_session';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STAFF_YEAR_MS = 400 * 24 * 60 * 60 * 1000;

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
    // Printed personal QR login links do not expire.
    if (payload.role !== 'staff-login') {
      if (!payload.exp || Date.now() > payload.exp) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = MANAGER_COOKIE;
export const STAFF_SESSION_COOKIE = STAFF_COOKIE;

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
    secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
    maxAge: 7 * 24 * 60 * 60,
    value: token,
  };
}

export function createStaffToken(staff) {
  return sign({
    role: 'staff',
    staffId: staff.id,
    name: staff.name,
    phone: staff.phone,
    jti: randomBytes(8).toString('hex'),
    exp: Date.now() + STAFF_YEAR_MS,
  });
}

export function readStaffToken(token) {
  const payload = verify(token);
  if (!payload || payload.role !== 'staff' || !payload.staffId) return null;
  return {
    id: payload.staffId,
    name: payload.name || '',
    phone: payload.phone || '',
  };
}

export function staffCookieOptions(token) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
    maxAge: Math.floor(STAFF_YEAR_MS / 1000),
    value: token,
  };
}

export function applyStaffCookie(res, staff) {
  const token = createStaffToken(staff);
  const opts = staffCookieOptions(token);
  res.cookies.set(STAFF_SESSION_COOKIE, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    path: opts.path,
    secure: opts.secure,
    maxAge: opts.maxAge,
  });
  return res;
}

export function clearStaffCookie(res) {
  res.cookies.set(STAFF_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

/** Stable token for a staff member's personal QR / deep link (does not expire or rotate). */
export function createStaffLoginLinkToken(staff) {
  return sign({
    role: 'staff-login',
    staffId: staff.id,
  });
}

export function readStaffLoginLinkToken(token) {
  const payload = verify(token);
  if (!payload || payload.role !== 'staff-login' || !payload.staffId) return null;
  return {
    id: payload.staffId,
    name: payload.name || '',
    phone: payload.phone || '',
  };
}

export function staffLoginUrl(staff, origin) {
  const token = createStaffLoginLinkToken(staff);
  const base = String(origin || '').replace(/\/$/, '') || '';
  return `${base}/?t=${encodeURIComponent(token)}`;
}
