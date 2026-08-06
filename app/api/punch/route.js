import { NextResponse } from 'next/server';
import {
  getStaffById,
  getOpenShift,
  clockIn,
  clockOut,
  getCafeLocationSetting,
  isValidLocationBypass,
  isStaffLocationExempt,
  autoCloseOverdueOpenShifts,
} from '../../../lib/db';
import { checkCafeGeofence, parseCafeLocation, shouldSkipGeofence } from '../../../lib/geofence';

export async function POST(req) {
  try {
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

    if (!shouldSkipGeofence()) {
      const staffExempt = await isStaffLocationExempt(staffId);
      const bypassOk =
        !staffExempt &&
        (await isValidLocationBypass({
          staffId,
          token: body.bypassToken,
        }));

      if (!staffExempt && !bypassOk) {
        const locationSetting = await getCafeLocationSetting();
        const cafeLocation = parseCafeLocation(locationSetting.raw);
        if (!cafeLocation) {
          return NextResponse.json(
            {
              success: false,
              message:
                'Café location is not set yet. Ask the manager to open Manager → Set café location here while at Osco Lounge.',
            },
            { status: 403 }
          );
        }

        const geo = checkCafeGeofence(cafeLocation, body.lat, body.lng, body.accuracy);
        if (!geo.ok) {
          console.warn('[punch geofence]', {
            reason: geo.reason,
            distanceM: geo.distanceM,
            accuracyM: geo.accuracyM,
          });
          return NextResponse.json(
            {
              success: false,
              message: geo.reason,
              needBypass: /permission|GPS|inaccurate|timed? ?out/i.test(geo.reason || ''),
            },
            { status: 403 }
          );
        }
      }
    }

    const staff = await getStaffById(staffId);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: 'Staff not found. Please register again.', needReregister: true },
        { status: 404 }
      );
    }

    // Close forgotten overnight opens at 00:40 before toggling,
    // so the next punch starts a fresh clock-in instead of a huge clock-out.
    await autoCloseOverdueOpenShifts({ staffId: staff.id });

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
