import { NextResponse } from 'next/server';
import {
  checkManagerCredentials,
  createManagerSession,
  destroyManagerSession,
} from '../../../../lib/db';
import { SESSION_COOKIE, getSessionToken, requireManager } from '../../../../lib/auth';

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

  const token = createManagerSession();
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const token = getSessionToken();
  destroyManagerSession(token);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

export async function GET() {
  const auth = requireManager();
  return NextResponse.json({ success: true, authenticated: auth.ok });
}
