import { NextResponse } from 'next/server';
import {
  listStaff,
  listPending,
  deleteStaff,
  hasDatabase,
  isLocalDevMode,
} from '../../../../lib/db';
import { requireManager } from '../../../../lib/auth';

function dbNotConfigured() {
  return NextResponse.json(
    {
      success: false,
      message:
        'Database is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel.',
    },
    { status: 503 }
  );
}

export async function GET() {
  try {
    const auth = requireManager();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!hasDatabase() && !isLocalDevMode()) return dbNotConfigured();

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

export async function DELETE(request) {
  try {
    const auth = requireManager();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!hasDatabase() && !isLocalDevMode()) return dbNotConfigured();

    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
    }

    const result = await deleteStaff(id);
    if (result.error) {
      const status = result.error === 'Staff not found.' ? 404 : 400;
      return NextResponse.json({ success: false, message: result.error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[manager/staff DELETE]', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
