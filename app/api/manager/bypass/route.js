import { NextResponse } from 'next/server';
import { requireManager } from '../../../../lib/auth';
import {
  listLocationBypasses,
  createLocationBypass,
  revokeLocationBypass,
} from '../../../../lib/db';

export async function GET() {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const devices = await listLocationBypasses();
  return NextResponse.json({
    success: true,
    devices,
    hint: 'Create a code for a staff phone with broken GPS. Enter that code once on that phone.',
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

  const result = await createLocationBypass({
    staffId: body.staffId,
    label: body.label,
  });
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    device: result.device,
    redeemCode: result.redeemCode,
    message: result.message,
  });
}

export async function DELETE(req) {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  const result = await revokeLocationBypass(id);
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
