import { NextResponse } from 'next/server';
import { listShifts, updateShift, deleteShift, getStaffById } from '../../../../lib/db';
import { requireManager } from '../../../../lib/auth';

export async function GET(req) {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  const date = searchParams.get('date'); // YYYY-MM-DD local intent
  const year = Number(searchParams.get('year')) || new Date().getFullYear();

  if (!staffId) {
    return NextResponse.json({ success: false, message: 'staffId required' }, { status: 400 });
  }

  const staff = getStaffById(staffId);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Staff not found' }, { status: 404 });
  }

  const shifts = listShifts({
    staffId,
    from: `${year - 1}-12-01T00:00:00Z`,
    to: `${year + 1}-02-01T00:00:00Z`,
  });

  const monthTotals = new Array(12).fill(0);
  const dayMap = {}; // dateKey -> { seconds, shifts }
  const nowMs = Date.now();

  shifts.forEach((s) => {
    const inD = new Date(s.clock_in);
    const outD = s.clock_out ? new Date(s.clock_out) : new Date(nowMs);
    const sec = Math.max(0, (outD - inD) / 1000);

    if (inD.getFullYear() === year) {
      monthTotals[inD.getMonth()] += sec;
    }

    const key = [
      inD.getFullYear(),
      String(inD.getMonth() + 1).padStart(2, '0'),
      String(inD.getDate()).padStart(2, '0'),
    ].join('-');

    if (!dayMap[key]) dayMap[key] = { date: key, seconds: 0, shifts: [] };
    dayMap[key].seconds += sec;
    dayMap[key].shifts.push(s);
  });

  let dayDetail = null;
  if (date) {
    dayDetail = dayMap[date] || { date, seconds: 0, shifts: [] };
  }

  const days = Object.values(dayMap).sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({
    success: true,
    staff,
    monthTotals,
    days,
    dayDetail,
  });
}

export async function PATCH(req) {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  }

  const id = body.id;
  if (!id) {
    return NextResponse.json({ success: false, message: 'Shift id required.' }, { status: 400 });
  }

  const result = updateShift(id, {
    clock_in: body.clock_in,
    clock_out: body.clock_out,
  });

  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, shift: result.shift });
}

export async function DELETE(req) {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
  }

  const result = deleteShift(id);
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
