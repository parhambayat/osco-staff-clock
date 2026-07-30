import { NextResponse } from 'next/server';
import { verifyRestore } from '../../../../lib/db';
import { applyStaffCookie } from '../../../../lib/session';

/** Legacy endpoint — prefer POST /api/register/restore with phone only. */
export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const phone = (body.phone || '').trim();
    const code = (body.code || '').trim();

    if (!phone || !code) {
      return NextResponse.json({ success: false, message: 'Phone and code are required.' }, { status: 400 });
    }

    const result = await verifyRestore({ phone, code });
    if (result.error) {
      const status = result.error.includes('Database') ? 503 : 400;
      return NextResponse.json({ success: false, message: result.error }, { status });
    }

    const staff = {
      id: result.staff.id,
      name: result.staff.name,
      phone: result.staff.phone,
    };
    const res = NextResponse.json({ success: true, staff });
    applyStaffCookie(res, staff);
    return res;
  } catch (e) {
    console.error('[register/restore-verify]', e);
    return NextResponse.json(
      { success: false, message: e.message || 'Server error' },
      { status: 500 }
    );
  }
}
