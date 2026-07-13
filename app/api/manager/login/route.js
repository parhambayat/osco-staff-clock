import { NextResponse } from 'next/server';
import { checkManagerCredentials } from '../../../../lib/db';
import {
  SESSION_COOKIE,
  createManagerToken,
  sessionCookieOptions,
} from '../../../../lib/session';
import { getSessionToken, requireManager } from '../../../../lib/auth';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!checkManagerCredentials(username, password)) {
    return NextResponse.json({ success: false, message: 'Wrong username or password.' }, { status: 401 });
  }

  const token = createManagerToken();
  const opts = sessionCookieOptions(token);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    path: opts.path,
    secure: opts.secure,
    maxAge: opts.maxAge,
  });
  return res;
}

export async function DELETE() {
  getSessionToken();
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

export async function GET() {
  const auth = requireManager();
  return NextResponse.json({ success: true, authenticated: auth.ok });
}
