import { NextResponse } from 'next/server';
import { verifyPending } from '../../../../lib/db';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  }

  const phone = (body.phone || '').trim();
  const code = (body.code || '').trim();

  if (!phone || !code) {
    return NextResponse.json({ success: false, message: 'Phone and code are required.' }, { status: 400 });
  }

  const result = verifyPending({ phone, code });
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    staff: {
      id: result.staff.id,
      name: result.staff.name,
      phone: result.staff.phone,
    },
  });
}
