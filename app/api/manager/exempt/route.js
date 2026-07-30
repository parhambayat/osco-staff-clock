import { NextResponse } from 'next/server';
import { requireManager } from '../../../../lib/auth';
import {
  listLocationExemptStaffIds,
  setStaffLocationExempt,
} from '../../../../lib/db';

export async function GET() {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const staffIds = await listLocationExemptStaffIds();
  return NextResponse.json({
    success: true,
    staffIds,
    hint: 'Exempt staff can punch without GPS. Toggle per person in their staff detail.',
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

  const enabled = !!body.enabled;
  const result = await setStaffLocationExempt(body.staffId, enabled);
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    staffId: result.staffId,
    staffName: result.staffName,
    exempt: result.exempt,
    staffIds: result.staffIds,
    message: result.exempt
      ? `${result.staffName} can punch without location.`
      : `${result.staffName} must use café location again.`,
  });
}
