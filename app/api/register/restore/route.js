import { NextResponse } from 'next/server';
import { createRestorePending } from '../../../../lib/db';
import { sendManagerWhatsApp, managerWhatsAppNumber } from '../../../../lib/whatsapp';

export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const phone = (body.phone || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      return NextResponse.json({ success: false, message: 'Enter a valid phone number.' }, { status: 400 });
    }

    const result = await createRestorePending({ phone });
    if (result.error) {
      const status = result.error.includes('Database') ? 503 : 404;
      return NextResponse.json({ success: false, message: result.error }, { status });
    }

    const { pending, staff } = result;
    const message =
      `Osco Lounge — Restore device\n` +
      `Staff: ${staff.name}\n` +
      `Phone: ${pending.phone}\n` +
      `Code: ${pending.code}\n` +
      `Enter this code on the staff phone to open their account.\n` +
      `(Expires in 30 minutes)`;

    void sendManagerWhatsApp(message).catch((e) => console.error('[whatsapp]', e.message));

    return NextResponse.json({
      success: true,
      phone: pending.phone,
      staffName: staff.name,
      managerWhatsApp: managerWhatsAppNumber(),
      message: 'Ask the manager for the code (Manager → Pending), then enter it here.',
    });
  } catch (e) {
    console.error('[register/restore]', e);
    return NextResponse.json(
      { success: false, message: e.message || 'Server error' },
      { status: 500 }
    );
  }
}
