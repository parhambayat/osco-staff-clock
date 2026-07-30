/** Default punch radius around the café (indoor GPS + 5G modem drift). */
export const DEFAULT_CAFE_RADIUS_M = 800;

/** Never use a tighter radius than this — old 250m settings caused false rejects. */
export const MIN_CAFE_RADIUS_M = 600;

export function shouldSkipGeofence() {
  if (process.env.VERCEL === '1') return false;
  return process.env.LOCAL_DEV === 'true' || process.env.SKIP_GEO_CHECK === 'true';
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function parseCafeLocation(raw) {
  if (!raw) return null;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  const radiusM = Number(obj.radiusM);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const requested =
    Number.isFinite(radiusM) && radiusM > 0 ? Math.min(radiusM, 3000) : DEFAULT_CAFE_RADIUS_M;
  return {
    lat,
    lng,
    radiusM: Math.max(MIN_CAFE_RADIUS_M, requested),
  };
}

/**
 * @returns {{ ok: true, distanceM: number, accuracyM?: number } | { ok: false, reason: string, distanceM?: number, accuracyM?: number }}
 */
export function checkCafeGeofence(cafe, clientLat, clientLng, clientAccuracy) {
  const loc = parseCafeLocation(cafe);
  if (!loc) return { ok: false, reason: 'Café location is not configured.' };

  if (clientLat == null || clientLng == null || clientLat === '' || clientLng === '') {
    return { ok: false, reason: 'Location permission required to clock in/out at the café.' };
  }

  const lat = Number(clientLat);
  const lng = Number(clientLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'Location permission required to clock in/out at the café.' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: 'Invalid GPS coordinates. Try again near a window.' };
  }

  const accuracyM = Number(clientAccuracy);
  const hasAccuracy = Number.isFinite(accuracyM) && accuracyM >= 0;
  const distanceM = haversineMeters(loc.lat, loc.lng, lat, lng);
  // Expand allowed radius by GPS uncertainty (indoors often 50–200m+).
  const bufferM = hasAccuracy ? Math.min(Math.max(accuracyM, 0), 300) : 100;
  if (distanceM > loc.radiusM + bufferM) {
    return {
      ok: false,
      reason: `You must be at Osco Lounge to clock in/out (about ${Math.round(distanceM)}m away).`,
      distanceM,
      accuracyM: hasAccuracy ? accuracyM : undefined,
    };
  }
  return { ok: true, distanceM, accuracyM: hasAccuracy ? accuracyM : undefined };
}
