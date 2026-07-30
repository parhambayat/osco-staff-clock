import { NextResponse } from 'next/server';
import {
  getStaffById,
  getOpenShift,
  clockIn,
  clockOut,
  getCafeWifiIpsSetting,
  getCafeLocationSetting,
} from '../../../lib/db';
import {
  getClientIp,
  getAllowedCafeIpsFromEnv,
  parseIpList,
  shouldRejectPunch,
  wifiRejectResponse,
} from '../../../lib/wifi';
import { checkCafeGeofence, parseCafeLocation } from '../../../lib/geofence';

async function resolveAllowedIps() {
  const setting = await getCafeWifiIpsSetting();
  if (setting.ips) return parseIpList([...getAllowedCafeIpsFromEnv(), ...parseIpList(setting.ips)]);
  return getAllowedCafeIpsFromEnv();
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

    const locationSetting = await getCafeLocationSetting();
    const cafeLocation = parseCafeLocation(locationSetting.raw);

    // Prefer stable café GPS geofence over Omantel's rotating public IP.
    if (cafeLocation) {
      const geo = checkCafeGeofence(cafeLocation, body.lat, body.lng);
      if (!geo.ok) {
        console.warn('[punch geofence]', { ip, reason: geo.reason, distanceM: geo.distanceM });
        return NextResponse.json({ success: false, message: geo.reason }, { status: 403 });
      }
    } else {
      const allowed = await resolveAllowedIps();
      if (shouldRejectPunch(ip, allowed)) {
        const reject = wifiRejectResponse(ip, allowed);
        return NextResponse.json(
          {
            ...reject.body,
            message:
              'Not connected to Osco Lounge Wi-Fi. Ask the manager to set the café location in the Manager panel (recommended — stops IP changes from breaking punches).',
          },
          { status: reject.status }
        );
      }
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
