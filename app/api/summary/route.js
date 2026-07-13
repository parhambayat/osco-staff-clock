import { NextResponse } from 'next/server';
import { getStaffById, listShifts } from '../../../lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = (searchParams.get('staffId') || '').trim();
    const year = Number(searchParams.get('year')) || new Date().getFullYear();

    if (!staffId) {
      return NextResponse.json({ success: false, message: 'Staff session required.' }, { status: 400 });
    }

    const staff = await getStaffById(staffId);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: 'Staff not found.', needReregister: true },
        { status: 404 }
      );
    }

    const data = await listShifts({
      staffId,
      from: `${year - 1}-12-01T00:00:00Z`,
      to: `${year + 1}-02-01T00:00:00Z`,
    });

    const monthTotals = new Array(12).fill(0);
    const today = new Date();
    const todayKey = today.toDateString();
    const nowMs = today.getTime();
    let todaySeconds = 0;
    const todayShifts = [];
    let openShift = null;

    data.forEach((s) => {
      const inD = new Date(s.clock_in);

      if (!s.clock_out) {
        openShift = s;
        const openSec = Math.max(0, (nowMs - inD.getTime()) / 1000);
        if (inD.getFullYear() === year) monthTotals[inD.getMonth()] += openSec;
        if (inD.toDateString() === todayKey) {
          todaySeconds += openSec;
          todayShifts.push(s);
        }
        return;
      }

      const outD = new Date(s.clock_out);
      const sec = Math.max(0, (outD - inD) / 1000);
      if (inD.getFullYear() === year) monthTotals[inD.getMonth()] += sec;
      if (inD.toDateString() === todayKey) {
        todaySeconds += sec;
        todayShifts.push(s);
      }
    });

    todayShifts.sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));

    return NextResponse.json({
      success: true,
      staff: { id: staff.id, name: staff.name, phone: staff.phone },
      monthTotals,
      todaySeconds,
      todayShifts,
      openShift,
    });
  } catch (e) {
    console.error('[summary]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
