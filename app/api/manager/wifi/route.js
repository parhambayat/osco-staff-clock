import { NextResponse } from 'next/server';
import { requireManager } from '../../../../lib/auth';
import { getCafeWifiIpsSetting, setCafeWifiIpsSetting } from '../../../../lib/db';
import {
  getClientIp,
  getAllowedCafeIpsFromEnv,
  parseIpList,
} from '../../../../lib/wifi';

async function resolveAllowedIps() {
  const setting = await getCafeWifiIpsSetting();
  if (setting.ips) {
    return { ips: parseIpList(setting.ips), source: setting.source, error: setting.error };
  }
  return { ips: getAllowedCafeIpsFromEnv(), source: 'env', error: setting.error };
}

export async function GET(req) {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const clientIp = getClientIp(req);
  const { ips, source, error } = await resolveAllowedIps();
  const match = ips.includes(clientIp);

  return NextResponse.json({
    success: true,
    clientIp,
    allowedIps: ips,
    source,
    match,
    hint: match
      ? 'This phone is on an allowed café IP — staff punches should work.'
      : 'This phone is NOT on the allowed café IP. If you are on Osco Lounge Wi-Fi, tap “Use my current IP” below.',
    setupError: error || null,
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

  let ips;
  if (body.useCurrentIp) {
    const clientIp = getClientIp(req);
    if (!clientIp || clientIp === 'unknown') {
      return NextResponse.json({ success: false, message: 'Could not detect your public IP.' }, { status: 400 });
    }
    const current = await resolveAllowedIps();
    ips = parseIpList([...current.ips, clientIp]);
  } else if (typeof body.allowedIps === 'string') {
    ips = parseIpList(body.allowedIps);
  } else if (Array.isArray(body.allowedIps)) {
    ips = parseIpList(body.allowedIps);
  } else {
    return NextResponse.json(
      { success: false, message: 'Provide allowedIps or useCurrentIp: true.' },
      { status: 400 }
    );
  }

  if (!ips.length) {
    return NextResponse.json({ success: false, message: 'At least one IP is required.' }, { status: 400 });
  }

  const result = await setCafeWifiIpsSetting(ips.join(','));
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 500 });
  }

  const clientIp = getClientIp(req);
  return NextResponse.json({
    success: true,
    clientIp,
    allowedIps: ips,
    source: result.source || 'db',
    match: ips.includes(clientIp),
  });
}
