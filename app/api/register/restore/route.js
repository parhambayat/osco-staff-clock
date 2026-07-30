import { NextResponse } from 'next/server';
import { getStaffByPhone } from '../../../../lib/db';
import { applyStaffCookie } from '../../../../lib/session';

/** Already-registered staff open their account with phone only (no manager code). */
export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const phone = (body.phone || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      return NextResponse.json({ success: false, message: 'Enter a valid phone number.' }, { status: 400 });
    }

    const staff = await getStaffByPhone(phone);
    if (!staff) {
      return NextResponse.json(
        {
          success: false,
          message: 'This phone is not registered yet. Use New register instead.',
        },
        { status: 404 }
      );
    }

    const payload = {
      success: true,
      staff: { id: staff.id, name: staff.name, phone: staff.phone },
      message: `Welcome back, ${staff.name}.`,
    };
    const res = NextResponse.json(payload);
    applyStaffCookie(res, staff);
    return res;
  } catch (e) {
    console.error('[register/restore]', e);
    return NextResponse.json(
      { success: false, message: e.message || 'Server error' },
      { status: 500 }
    );
  }
}
