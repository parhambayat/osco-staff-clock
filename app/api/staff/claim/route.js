import { NextResponse } from 'next/server';
import { getStaffById } from '../../../../lib/db';
import {
  readStaffLoginLinkToken,
  applyStaffCookie,
} from '../../../../lib/session';

/** Claim a personal QR / deep-link token and open that staff clock session. */
export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const token = String(body.token || '').trim();
    const session = readStaffLoginLinkToken(token);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Invalid or expired staff link.' }, { status: 400 });
    }

    const staff = await getStaffById(session.id);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: 'Staff not found. Register again.', needReregister: true },
        { status: 404 }
      );
    }

    const payload = {
      success: true,
      staff: { id: staff.id, name: staff.name, phone: staff.phone },
    };
    const res = NextResponse.json(payload);
    applyStaffCookie(res, staff);
    return res;
  } catch (e) {
    console.error('[staff/claim]', e);
    return NextResponse.json({ success: false, message: e.message || 'Server error' }, { status: 500 });
  }
}
