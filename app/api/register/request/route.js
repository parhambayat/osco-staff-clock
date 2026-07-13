import { NextResponse } from 'next/server';
import { createPending } from '../../../../lib/db';
import { sendManagerWhatsApp, managerWhatsAppNumber } from '../../../../lib/whatsapp';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();

  if (!name || name.length < 2) {
    return NextResponse.json({ success: false, message: 'Enter your full name.' }, { status: 400 });
  }
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ success: false, message: 'Enter a valid phone number.' }, { status: 400 });
  }

  const result = createPending({ name, phone });
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error }, { status: 409 });
  }

  const { pending } = result;
  const message =
    `Osco Lounge — Staff registration\n` +
    `Name: ${pending.name}\n` +
    `Phone: ${pending.phone}\n` +
    `Code: ${pending.code}\n` +
    `Enter this code on the staff phone to approve registration.\n` +
    `(Expires in 30 minutes)`;

  // Optional: if a real WhatsApp API is configured later, this still sends.
  // By default codes appear in the manager panel (Pending).
  const sent = await sendManagerWhatsApp(message);

  return NextResponse.json({
    success: true,
    phone: pending.phone,
    managerWhatsApp: managerWhatsAppNumber(),
    delivery: sent.via,
    message: 'Ask the manager for the code (shown in Manager → Pending), then enter it here.',
  });
}
