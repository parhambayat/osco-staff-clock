import { NextResponse } from 'next/server';
import { getStaffById, getOpenShift, clockIn, clockOut, isLocalDevMode } from '../../../lib/db';

const ALLOWED_IP = process.env.CAFE_WIFI_IP;

function getClientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req) {
  const ip = getClientIp(req);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const staffId = (body.staffId || '').trim();
  if (!staffId) {
    return NextResponse.json({ success: false, message: 'Staff session required. Please register.' }, { status: 400 });
  }

  const staff = getStaffById(staffId);
  if (!staff) {
    return NextResponse.json(
      { success: false, message: 'Staff not found. Please register again.', needReregister: true },
      { status: 404 }
    );
  }

  // Production: only café Wi-Fi. Local preview skips this.
  if (!isLocalDevMode()) {
    if (!ALLOWED_IP) {
      return NextResponse.json(
        { success: false, message: 'Server is missing CAFE_WIFI_IP configuration.' },
        { status: 500 }
      );
    }
    if (ip !== ALLOWED_IP) {
      return NextResponse.json(
        { success: false, message: 'Not connected to Osco Lounge Wi-Fi.', detectedIp: ip },
        { status: 403 }
      );
    }
  }

  const open = getOpenShift(staff.id);
  if (open) {
    const result = clockOut(open.id);
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: 'out', shift: result.shift });
  }

  const shift = clockIn(staff);
  return NextResponse.json({ success: true, action: 'in', shift });
}
