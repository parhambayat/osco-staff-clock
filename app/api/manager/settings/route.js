import { NextResponse } from 'next/server';
import { requireManager } from '../../../../lib/auth';
import { getConfig, updateConfig } from '../../../../lib/config';
import { whatsappStatus } from '../../../../lib/whatsapp';

export async function GET() {
  const auth = requireManager();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const cfg = getConfig();
  return NextResponse.json({
    success: true,
    config: {
      managerWhatsApp: cfg.managerWhatsApp,
      callmebotApiKeySet: !!cfg.callmebotApiKey,
    },
    whatsapp: whatsappStatus(),
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

  const patch = {};
  if (typeof body.managerWhatsApp === 'string' && body.managerWhatsApp.trim()) {
    patch.managerWhatsApp = body.managerWhatsApp.trim();
  }
  if (typeof body.callmebotApiKey === 'string') {
    patch.callmebotApiKey = body.callmebotApiKey.trim();
  }

  const cfg = updateConfig(patch);
  return NextResponse.json({
    success: true,
    config: {
      managerWhatsApp: cfg.managerWhatsApp,
      callmebotApiKeySet: !!cfg.callmebotApiKey,
    },
    whatsapp: whatsappStatus(),
  });
}
