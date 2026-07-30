import { NextResponse } from 'next/server';
import { requireManager } from '../../../../lib/auth';
import { getCafeLocationSetting, setCafeLocationSetting } from '../../../../lib/db';
import {
  checkCafeGeofence,
  parseCafeLocation,
  DEFAULT_CAFE_RADIUS_M,
  MAX_ACCEPTABLE_ACCURACY_M,
} from '../../../../lib/geofence';

export async function GET() {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const setting = await getCafeLocationSetting();
  const location = parseCafeLocation(setting.raw);

  return NextResponse.json({
    success: true,
    configured: !!location,
    location,
    source: setting.source,
    defaultRadiusM: DEFAULT_CAFE_RADIUS_M,
    hint: location
      ? 'Staff punches work when they are at Osco Lounge.'
      : 'Set café location once while you are at Osco Lounge.',
  });
}

export async function POST(req) {
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

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracy = Number(body.accuracy);
  const radiusM = body.radiusM != null ? Number(body.radiusM) : DEFAULT_CAFE_RADIUS_M;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { success: false, message: 'Could not read your GPS location. Allow location access and try again.' },
      { status: 400 }
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ success: false, message: 'Invalid GPS coordinates.' }, { status: 400 });
  }
  if (Number.isFinite(accuracy) && accuracy > MAX_ACCEPTABLE_ACCURACY_M) {
    return NextResponse.json(
      {
        success: false,
        message: 'GPS is too inaccurate right now. Step outside or near a window and try again.',
      },
      { status: 400 }
    );
  }

  const result = await setCafeLocationSetting({ lat, lng, radiusM });
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 500 });
  }

  const location = parseCafeLocation(result.value);
  const selfCheck = checkCafeGeofence(location, lat, lng, accuracy);

  return NextResponse.json({
    success: true,
    configured: true,
    location,
    source: result.source,
    match: selfCheck.ok,
    message: 'Café location saved. Staff can punch when they are at Osco Lounge.',
  });
}
