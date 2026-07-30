import assert from 'assert';
import {
  haversineMeters,
  parseCafeLocation,
  checkCafeGeofence,
  shouldSkipGeofence,
  DEFAULT_CAFE_RADIUS_M,
  MIN_CAFE_RADIUS_M,
} from '../lib/geofence.js';

function withEnv(patch, fn) {
  const saved = {};
  for (const key of Object.keys(patch)) saved[key] = process.env[key];
  Object.assign(process.env, patch);
  try {
    fn();
  } finally {
    for (const key of Object.keys(patch)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

assert.ok(haversineMeters(23.6, 58.4, 23.6, 58.4) < 1);
assert.ok(haversineMeters(23.6, 58.4, 23.601, 58.4) > 50);

const cafe = parseCafeLocation({ lat: 23.6, lng: 58.4, radiusM: 250 });
assert.strictEqual(cafe.radiusM, MIN_CAFE_RADIUS_M); // bumped from old 250
assert.strictEqual(DEFAULT_CAFE_RADIUS_M, 800);

const ok = checkCafeGeofence(cafe, 23.6001, 58.4);
assert.strictEqual(ok.ok, true);

const far = checkCafeGeofence(cafe, 24.0, 58.4);
assert.strictEqual(far.ok, false);

const missing = checkCafeGeofence(cafe, null, null);
assert.strictEqual(missing.ok, false);

// Poor accuracy should expand buffer, not hard-fail
const fuzzy = checkCafeGeofence(cafe, 23.605, 58.4, 400);
assert.strictEqual(fuzzy.ok, true);

withEnv({ LOCAL_DEV: 'true', VERCEL: '' }, () => {
  assert.strictEqual(shouldSkipGeofence(), true);
});
withEnv({ LOCAL_DEV: 'false', VERCEL: '1' }, () => {
  assert.strictEqual(shouldSkipGeofence(), false);
});

console.log(JSON.stringify({ ok: true }));
