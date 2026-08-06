import { NextResponse } from 'next/server';
import {
  listShifts,
  updateShift,
  deleteShift,
  createManualShift,
  getStaffById,
  autoCloseOverdueOpenShifts,
} from '../../../../lib/db';
import { requireManager } from '../../../../lib/auth';
import { cafeDateKey, cafeMonthIndex, cafeYear } from '../../../../lib/time';

export async function GET(req) {
  try {
    const auth = requireManager();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staffId');
    const date = searchParams.get('date');
    const year = Number(searchParams.get('year')) || cafeYear();

    if (!staffId) {
      return NextResponse.json({ success: false, message: 'staffId required' }, { status: 400 });
    }

    const staff = await getStaffById(staffId);
    if (!staff) {
      return NextResponse.json({ success: false, message: 'Staff not found' }, { status: 404 });
    }

    await autoCloseOverdueOpenShifts({ staffId });

    const shifts = await listShifts({
      staffId,
      from: `${year - 1}-12-01T00:00:00Z`,
      to: `${year + 1}-02-01T00:00:00Z`,
    });

    const monthTotals = new Array(12).fill(0);
    const dayMap = {};
    const nowMs = Date.now();

    shifts.forEach((s) => {
      const inD = new Date(s.clock_in);
      const outD = s.clock_out ? new Date(s.clock_out) : new Date(nowMs);
      const sec = Math.max(0, (outD - inD) / 1000);

      if (cafeYear(inD) === year) {
        monthTotals[cafeMonthIndex(inD)] += sec;
      }

      const key = cafeDateKey(inD);
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
      cafeTz: 'Asia/Muscat',
    });
  } catch (e) {
    console.error('[manager/shifts GET]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
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

    const staffId = body.staffId || body.staff_id;
    if (!staffId) {
      return NextResponse.json({ success: false, message: 'staffId required.' }, { status: 400 });
    }
    if (!body.clock_in) {
      return NextResponse.json({ success: false, message: 'Clock in is required.' }, { status: 400 });
    }

    const result = await createManualShift({
      staffId,
      clock_in: body.clock_in,
      clock_out: body.clock_out,
    });

    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, shift: result.shift });
  } catch (e) {
    console.error('[manager/shifts POST]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
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

    const result = await updateShift(id, {
      clock_in: body.clock_in,
      clock_out: body.clock_out,
    });

    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, shift: result.shift });
  } catch (e) {
    console.error('[manager/shifts PATCH]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const auth = requireManager();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
    }

    const result = await deleteShift(id);
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[manager/shifts DELETE]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
