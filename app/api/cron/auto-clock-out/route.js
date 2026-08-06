import { NextResponse } from 'next/server';
import { autoCloseOverdueOpenShifts, hasDatabase, isLocalDevMode } from '../../../../lib/db';

function unauthorized() {
  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
}

function isAuthorized(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization') || '';
  if (secret && auth === `Bearer ${secret}`) return true;
  // Local / manual trigger without secret when not on Vercel
  if (!secret && process.env.VERCEL !== '1') return true;
  // Also allow ?secret= for manual ops when CRON_SECRET is set
  if (secret) {
    const url = new URL(req.url);
    if (url.searchParams.get('secret') === secret) return true;
  }
  return false;
}

async function runAutoClockOut() {
  if (!hasDatabase() && !isLocalDevMode()) {
    return NextResponse.json(
      { success: false, message: 'Database is not configured.' },
      { status: 503 }
    );
  }

  const result = await autoCloseOverdueOpenShifts();
  return NextResponse.json({
    success: true,
    closed: result.closed?.length || 0,
    shifts: (result.closed || []).map((s) => ({
      id: s.id,
      staff_id: s.staff_id,
      staff_name: s.staff_name,
      clock_in: s.clock_in,
      clock_out: s.clock_out,
    })),
  });
}

/** Vercel Cron: 00:40 Asia/Muscat (= 20:40 UTC). */
export async function GET(req) {
  try {
    if (!isAuthorized(req)) return unauthorized();
    return await runAutoClockOut();
  } catch (e) {
    console.error('[cron/auto-clock-out]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!isAuthorized(req)) return unauthorized();
    return await runAutoClockOut();
  } catch (e) {
    console.error('[cron/auto-clock-out]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
