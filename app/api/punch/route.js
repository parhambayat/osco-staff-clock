import { NextResponse } from 'next/server';
import {
  getStaffById,
  getOpenShift,
  clockIn,
  clockOut,
  isLocalDevMode,
} from '../../../lib/db';

const ALLOWED_IP = process.env.CAFE_WIFI_IP;

function getClientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

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

    const staff = await getStaffById(staffId);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: 'Staff not found. Please register again.', needReregister: true },
        { status: 404 }
      );
    }

    // Enforce café Wi-Fi in production (skip while LOCAL_DEV / missing IP for first launch)
    const skipIp = isLocalDevMode() || process.env.SKIP_WIFI_CHECK === 'true' || !ALLOWED_IP;
    if (!skipIp && ip !== ALLOWED_IP) {
      return NextResponse.json(
        { success: false, message: 'Not connected to Osco Lounge Wi-Fi.', detectedIp: ip },
        { status: 403 }
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
