import assert from 'assert';
import {
  haversineMeters,
  parseCafeLocation,
  checkCafeGeofence,
  shouldSkipGeofence,
  DEFAULT_CAFE_RADIUS_M,
  MAX_ACCEPTABLE_ACCURACY_M,
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
assert.ok(haversineMeters(23.6, 58.4, 23.601, 58.4) < 150);

const cafe = parseCafeLocation({ lat: 23.6, lng: 58.4, radiusM: 250 });
assert.strictEqual(cafe.radiusM, 250);
assert.strictEqual(parseCafeLocation('nope'), null);
assert.strictEqual(DEFAULT_CAFE_RADIUS_M, 250);
assert.strictEqual(MAX_ACCEPTABLE_ACCURACY_M, 500);

const ok = checkCafeGeofence(cafe, 23.6001, 58.4);
assert.strictEqual(ok.ok, true);

const far = checkCafeGeofence(cafe, 24.0, 58.4);
assert.strictEqual(far.ok, false);
assert.ok(/Osco Lounge/.test(far.reason));

const missing = checkCafeGeofence(cafe, null, null);
assert.strictEqual(missing.ok, false);
assert.ok(/Location permission/.test(missing.reason));

const badAccuracy = checkCafeGeofence(cafe, 23.6001, 58.4, 999);
assert.strictEqual(badAccuracy.ok, false);
assert.ok(/inaccurate/i.test(badAccuracy.reason));

const buffered = checkCafeGeofence(cafe, 23.6022, 58.4, 60);
// ~245m away + 60m buffer within 250+60
assert.strictEqual(buffered.ok, true);

withEnv({ LOCAL_DEV: 'true', VERCEL: '' }, () => {
  assert.strictEqual(shouldSkipGeofence(), true);
});
withEnv({ LOCAL_DEV: 'true', VERCEL: '1' }, () => {
  assert.strictEqual(shouldSkipGeofence(), false);
});
withEnv({ LOCAL_DEV: 'false', VERCEL: '1' }, () => {
  assert.strictEqual(shouldSkipGeofence(), false);
});

console.log(JSON.stringify({ ok: true }));
