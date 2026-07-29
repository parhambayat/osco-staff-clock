/** Known public IPs of the café Omantel BROVI router (dynamic lease). */
export const DEFAULT_CAFE_WIFI_IPS = ['37.40.224.218', '37.40.226.51', '37.40.228.63'];

export function parseIpList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v || '').trim()).filter(Boolean))];
  }
  return [
    ...new Set(
      String(value || '')
        .split(/[\s,;]+/)
        .map((v) => v.trim())
        .filter(Boolean)
    ),
  ];
}

/** Env / build defaults (comma-separated CAFE_WIFI_IP supported). */
export function getAllowedCafeIpsFromEnv() {
  const raw = (process.env.CAFE_WIFI_IP || '').trim();
  const list = parseIpList(raw);
  return list.length ? list : [...DEFAULT_CAFE_WIFI_IPS];
}

/** @deprecated Prefer getAllowedCafeIpsFromEnv / resolveAllowedCafeIps */
export function getAllowedCafeIp() {
  return getAllowedCafeIpsFromEnv()[0] || DEFAULT_CAFE_WIFI_IPS[0];
}

export function getClientIp(req) {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0].trim();

  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * True when punch must be blocked for this client IP.
 * @param {string} ip
 * @param {string[]|string} [allowedOverride] optional list (from DB); else env defaults
 */
export function shouldRejectPunch(ip, allowedOverride) {
  const allowed = parseIpList(
    allowedOverride !== undefined ? allowedOverride : getAllowedCafeIpsFromEnv()
  );
  if (!allowed.length) return false;

  // Vercel production build — always enforce; ignore dashboard SKIP_WIFI_CHECK / LOCAL_DEV.
  if (process.env.OSCO_ENFORCE_WIFI === 'true') return !allowed.includes(ip);

  if (process.env.SKIP_WIFI_CHECK === 'true') return false;
  if (process.env.LOCAL_DEV === 'true') return false;
  return !allowed.includes(ip);
}

export function wifiRejectResponse(ip, allowed) {
  const list = parseIpList(allowed !== undefined ? allowed : getAllowedCafeIpsFromEnv());
  console.warn('[wifi] reject', { ip, allowed: list });
  return {
    status: 403,
    body: {
      success: false,
      message:
        'Not connected to Osco Lounge Wi-Fi. If you are on café Wi-Fi, ask the manager to update the café IP in the Manager panel.',
    },
  };
}
