/** Default punch radius around the café (indoor GPS drift). */
export const DEFAULT_CAFE_RADIUS_M = 250;

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
  return {
    lat,
    lng,
    radiusM:
      Number.isFinite(radiusM) && radiusM > 0 ? Math.min(radiusM, 2000) : DEFAULT_CAFE_RADIUS_M,
  };
}

/**
 * @returns {{ ok: true, distanceM: number } | { ok: false, reason: string, distanceM?: number }}
 */
export function checkCafeGeofence(cafe, clientLat, clientLng) {
  const loc = parseCafeLocation(cafe);
  if (!loc) return { ok: false, reason: 'Cafe location is not configured.' };

  if (clientLat == null || clientLng == null || clientLat === '' || clientLng === '') {
    return { ok: false, reason: 'Location permission required to clock in/out at the café.' };
  }

  const lat = Number(clientLat);
  const lng = Number(clientLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'Location permission required to clock in/out at the café.' };
  }

  const distanceM = haversineMeters(loc.lat, loc.lng, lat, lng);
  if (distanceM > loc.radiusM) {
    return {
      ok: false,
      reason: `You must be at Osco Lounge to clock in/out (about ${Math.round(distanceM)}m away).`,
      distanceM,
    };
  }
  return { ok: true, distanceM };
}
