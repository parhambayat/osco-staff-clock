/** Public IP of the café Omantel BROVI router (H155-383). */
export const DEFAULT_CAFE_WIFI_IP = '37.40.226.51';

export function getAllowedCafeIp() {
  return (process.env.CAFE_WIFI_IP || DEFAULT_CAFE_WIFI_IP).trim();
}

export function isWifiCheckEnabled() {
  if (process.env.SKIP_WIFI_CHECK === 'true') return false;
  // Hosted on Vercel — always enforce (dashboard LOCAL_DEV must not disable this).
  if (process.env.VERCEL_URL) return true;
  if (process.env.LOCAL_DEV === 'true') return false;
  return true;
}

export function getClientIp(req) {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0].trim();

  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function isAllowedCafeIp(ip) {
  const allowed = getAllowedCafeIp();
  if (!allowed) return true;
  return ip === allowed;
}

export function wifiRejectResponse(ip) {
  console.warn('[wifi] reject', { ip, allowed: getAllowedCafeIp() });
  return {
    status: 403,
    body: { success: false, message: 'Not connected to Osco Lounge Wi-Fi.' },
  };
}
