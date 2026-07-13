import { NextResponse } from 'next/server';
import { listStaff, listPending } from '../../../../lib/db';
import { requireManager } from '../../../../lib/auth';

export async function GET() {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    staff: listStaff(),
    pending: listPending(),
  });
}
