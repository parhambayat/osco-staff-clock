import { NextResponse } from 'next/server';
import { requireManager } from '../../../../lib/auth';
import { getStaffById } from '../../../../lib/db';
import { staffLoginUrl } from '../../../../lib/session';

export async function GET(req) {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const staffId = (new URL(req.url).searchParams.get('staffId') || '').trim();
  if (!staffId) {
    return NextResponse.json({ success: false, message: 'staffId required' }, { status: 400 });
  }

  const staff = await getStaffById(staffId);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Staff not found.' }, { status: 404 });
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'osco-staff-clock.vercel.app';
  const origin = `${proto}://${host}`;
  const url = staffLoginUrl(staff, origin);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;

  return NextResponse.json({
    success: true,
    staff: { id: staff.id, name: staff.name, phone: staff.phone },
    url,
    qrImageUrl,
    hint: 'Print this QR for this staff. Scanning it opens their clock-in directly — no phone entry.',
  });
}
