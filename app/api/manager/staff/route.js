import { NextResponse } from 'next/server';
import { listStaff, listPending, hasDatabase, isLocalDevMode } from '../../../../lib/db';
import { requireManager } from '../../../../lib/auth';

export async function GET() {
  try {
    const auth = requireManager();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!hasDatabase() && !isLocalDevMode()) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Database is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: await listStaff(),
      pending: await listPending(),
    });
  } catch (e) {
    console.error('[manager/staff]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
