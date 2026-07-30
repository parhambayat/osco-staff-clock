import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStaffById } from '../../../../lib/db';
import {
  STAFF_SESSION_COOKIE,
  readStaffToken,
  clearStaffCookie,
} from '../../../../lib/session';

export async function GET() {
  try {
    const token = cookies().get(STAFF_SESSION_COOKIE)?.value || '';
    const session = readStaffToken(token);
    if (!session) {
      return NextResponse.json({ success: true, authenticated: false, staff: null });
    }

    const staff = await getStaffById(session.id);
    if (!staff) {
      const res = NextResponse.json({
        success: true,
        authenticated: false,
        staff: null,
        needReregister: true,
      });
      clearStaffCookie(res);
      return res;
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      staff: { id: staff.id, name: staff.name, phone: staff.phone },
    });
  } catch (e) {
    console.error('[staff/me]', e);
    return NextResponse.json({ success: false, message: e.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  clearStaffCookie(res);
  return res;
}
