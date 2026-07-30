import assert from 'assert';
import {
  createStaffLoginLinkToken,
  readStaffLoginLinkToken,
  createStaffToken,
  readStaffToken,
} from '../lib/session.js';

const staff = { id: 'staff-1', name: 'Sana', phone: '+96890000000' };

const loginToken = createStaffLoginLinkToken(staff);
const again = createStaffLoginLinkToken(staff);
assert.strictEqual(loginToken, again, 'personal QR token must be stable');

const login = readStaffLoginLinkToken(loginToken);
assert.ok(login);
assert.strictEqual(login.id, 'staff-1');

const sessionToken = createStaffToken(staff);
const session = readStaffToken(sessionToken);
assert.ok(session);
assert.strictEqual(session.id, 'staff-1');
assert.strictEqual(session.name, 'Sana');

assert.strictEqual(readStaffLoginLinkToken('bad'), null);
assert.strictEqual(readStaffToken(loginToken), null);

console.log(JSON.stringify({ ok: true }));
