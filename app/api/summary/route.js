import { NextResponse } from 'next/server';
import { getStaffById, listShifts, autoCloseOverdueOpenShifts } from '../../../lib/db';
import { cafeDateKey, cafeMonthIndex, cafeYear } from '../../../lib/time';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = (searchParams.get('staffId') || '').trim();
    const year = Number(searchParams.get('year')) || cafeYear();

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

    // Apply nightly 00:40 auto clock-out even if the cron did not run yet.
    await autoCloseOverdueOpenShifts({ staffId: staff.id });

    const data = await listShifts({
      staffId,
      from: `${year - 1}-12-01T00:00:00Z`,
      to: `${year + 1}-02-01T00:00:00Z`,
    });

    const monthTotals = new Array(12).fill(0);
    const todayKey = cafeDateKey();
    const nowMs = Date.now();
    let todaySeconds = 0;
    const todayShifts = [];
    let openShift = null;

    data.forEach((s) => {
      const inD = new Date(s.clock_in);
      const inKey = cafeDateKey(inD);
      const inYear = cafeYear(inD);
      const inMonth = cafeMonthIndex(inD);

      if (!s.clock_out) {
        openShift = s;
        const openSec = Math.max(0, (nowMs - inD.getTime()) / 1000);
        if (inYear === year) monthTotals[inMonth] += openSec;
        // Business day rolls at 01:00 — overnight before 01:00 stays on clock-in day.
        if (inKey === todayKey) {
          todaySeconds += openSec;
          todayShifts.push(s);
        } else {
          // Still open from an earlier business day (should be rare after auto-close).
          todayShifts.push(s);
        }
        return;
      }

      const outD = new Date(s.clock_out);
      const sec = Math.max(0, (outD - inD) / 1000);
      if (inYear === year) monthTotals[inMonth] += sec;
      if (inKey === todayKey) {
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
      todayKey,
      cafeTz: 'Asia/Muscat',
      businessDayStartsAt: '01:00',
      autoClockOutAt: '00:40',
    });
  } catch (e) {
    console.error('[summary]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
