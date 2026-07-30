import { NextResponse } from 'next/server';
import { redeemLocationBypass } from '../../../../lib/db';

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const result = await redeemLocationBypass({
      staffId: body.staffId,
      code: body.code,
    });
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      token: result.token,
      staffId: result.staffId,
      label: result.label,
      message: 'This phone can now clock in/out without GPS.',
    });
  } catch (e) {
    console.error('[bypass redeem]', e);
    return NextResponse.json({ success: false, message: e.message || 'Server error' }, { status: 500 });
  }
}
