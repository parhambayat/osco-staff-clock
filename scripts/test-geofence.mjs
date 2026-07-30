import assert from 'assert';
import {
  haversineMeters,
  parseCafeLocation,
  checkCafeGeofence,
  DEFAULT_CAFE_RADIUS_M,
} from '../lib/geofence.js';

assert.ok(haversineMeters(23.6, 58.4, 23.6, 58.4) < 1);
assert.ok(haversineMeters(23.6, 58.4, 23.601, 58.4) > 50);
assert.ok(haversineMeters(23.6, 58.4, 23.601, 58.4) < 150);

const cafe = parseCafeLocation({ lat: 23.6, lng: 58.4, radiusM: 250 });
assert.strictEqual(cafe.radiusM, 250);
assert.strictEqual(parseCafeLocation('nope'), null);
assert.strictEqual(DEFAULT_CAFE_RADIUS_M, 250);

const ok = checkCafeGeofence(cafe, 23.6001, 58.4);
assert.strictEqual(ok.ok, true);

const far = checkCafeGeofence(cafe, 24.0, 58.4);
assert.strictEqual(far.ok, false);
assert.ok(/Osco Lounge/.test(far.reason));

const missing = checkCafeGeofence(cafe, null, null);
assert.strictEqual(missing.ok, false);
assert.ok(/Location permission/.test(missing.reason));

console.log(JSON.stringify({ ok: true }));
