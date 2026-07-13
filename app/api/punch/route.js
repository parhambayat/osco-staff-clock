import { NextResponse } from 'next/server';
import { getStaffById, getOpenShift, clockIn, clockOut } from '../../../lib/db';
import {
  getClientIp,
  shouldRejectPunch,
  wifiRejectResponse,
} from '../../../lib/wifi';

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
    }

    const staffId = (body.staffId || '').trim();
    if (!staffId) {
      return NextResponse.json(
        { success: false, message: 'Staff session required. Please register.' },
        { status: 400 }
      );
    }

    if (shouldRejectPunch(ip)) {
      const reject = wifiRejectResponse(ip);
      return NextResponse.json(reject.body, { status: reject.status });
    }

    const staff = await getStaffById(staffId);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: 'Staff not found. Please register again.', needReregister: true },
        { status: 404 }
      );
    }

    const open = await getOpenShift(staff.id);
    if (open) {
      const result = await clockOut(open.id);
      if (result.error) {
        return NextResponse.json({ success: false, message: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, action: 'out', shift: result.shift });
    }

    const shift = await clockIn(staff);
    if (shift?.error) {
      return NextResponse.json({ success: false, message: shift.error }, { status: 503 });
    }
    return NextResponse.json({ success: true, action: 'in', shift });
  } catch (e) {
    console.error('[punch]', e);
    return NextResponse.json({ success: false, message: e.message || 'Server error' }, { status: 500 });
  }
}
