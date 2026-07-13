import assert from 'assert';
import {
  getAllowedCafeIp,
  shouldRejectPunch,
  getClientIp,
} from '../lib/wifi.js';

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

withEnv({ CAFE_WIFI_IP: '37.40.226.51', LOCAL_DEV: 'false', SKIP_WIFI_CHECK: '' }, () => {
  assert.strictEqual(getAllowedCafeIp(), '37.40.226.51');
  assert.strictEqual(shouldRejectPunch('1.2.3.4'), true);
  assert.strictEqual(shouldRejectPunch('37.40.226.51'), false);
});

withEnv({ OSCO_ENFORCE_WIFI: 'true', SKIP_WIFI_CHECK: 'true', LOCAL_DEV: 'true' }, () => {
  assert.strictEqual(shouldRejectPunch('1.2.3.4'), true);
  assert.strictEqual(shouldRejectPunch('37.40.226.51'), false);
});

withEnv({ LOCAL_DEV: 'true' }, () => {
  assert.strictEqual(shouldRejectPunch('1.2.3.4'), false);
});

withEnv({ LOCAL_DEV: 'false', CAFE_WIFI_IP: '' }, () => {
  assert.strictEqual(getAllowedCafeIp(), '37.40.226.51');
  assert.strictEqual(shouldRejectPunch('1.2.3.4'), true);
});

const fakeReq = (headers) => ({ headers: { get: (k) => headers[k.toLowerCase()] || null } });
assert.strictEqual(getClientIp(fakeReq({ 'x-forwarded-for': '37.40.226.51, 10.0.0.1' })), '37.40.226.51');
assert.strictEqual(getClientIp(fakeReq({ 'x-vercel-forwarded-for': '37.40.226.51' })), '37.40.226.51');

console.log(JSON.stringify({ ok: true }));
