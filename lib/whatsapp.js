import { getConfig } from './config';

/**
 * Sends a WhatsApp message to the café manager.
 * Priority: env webhook → Meta Cloud → CallMeBot (env or manager panel config) → console.
 * Codes always also appear in the manager panel.
 */

export async function sendManagerWhatsApp(message) {
  const cfg = getConfig();
  const to = (process.env.MANAGER_WHATSAPP || cfg.managerWhatsApp || '+96898983134').replace(/\s/g, '');
  const callmebotKey = process.env.CALLMEBOT_APIKEY || cfg.callmebotApiKey || '';

  if (process.env.WHATSAPP_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message }),
      });
      if (!res.ok) throw new Error(`Webhook status ${res.status}`);
      return { ok: true, via: 'webhook' };
    } catch (e) {
      console.error('[whatsapp] webhook failed:', e.message);
    }
  }

  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const phone = to.replace(/^\+/, '');
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message },
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return { ok: true, via: 'meta' };
    } catch (e) {
      console.error('[whatsapp] Meta API failed:', e.message);
    }
  }

  if (callmebotKey) {
    try {
      const url =
        `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(to)}` +
        `&text=${encodeURIComponent(message)}` +
        `&apikey=${encodeURIComponent(callmebotKey)}`;
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) throw new Error(text || `status ${res.status}`);
      return { ok: true, via: 'callmebot' };
    } catch (e) {
      console.error('[whatsapp] CallMeBot failed:', e.message);
      return { ok: false, via: 'callmebot', error: e.message };
    }
  }

  console.log(`[whatsapp → ${to}]\n${message}`);
  return { ok: true, via: 'panel', queued: true };
}

export function managerWhatsAppNumber() {
  const cfg = getConfig();
  return process.env.MANAGER_WHATSAPP || cfg.managerWhatsApp || '+96898983134';
}

export function whatsappStatus() {
  const cfg = getConfig();
  const hasKey = !!(process.env.CALLMEBOT_APIKEY || cfg.callmebotApiKey);
  const hasMeta = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const hasWebhook = !!process.env.WHATSAPP_WEBHOOK_URL;
  return {
    configured: hasKey || hasMeta || hasWebhook,
    via: hasWebhook ? 'webhook' : hasMeta ? 'meta' : hasKey ? 'callmebot' : 'panel-only',
    managerWhatsApp: managerWhatsAppNumber(),
    callmebotConfigured: hasKey,
  };
}
