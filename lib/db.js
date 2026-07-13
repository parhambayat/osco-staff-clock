import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes, createHash } from 'crypto';

const DATA_DIR = join(process.cwd(), '.data');

export function isLocalDevMode() {
  const url = process.env.SUPABASE_URL || '';
  return process.env.LOCAL_DEV === 'true' || !url || url.includes('YOUR-PROJECT');
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return join(DATA_DIR, `${name}.json`);
}

function readTable(name) {
  ensureDir();
  const path = filePath(name);
  if (!existsSync(path)) {
    writeFileSync(path, '[]', 'utf8');
    return [];
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeTable(name, rows) {
  ensureDir();
  writeFileSync(filePath(name), JSON.stringify(rows, null, 2), 'utf8');
}

function newId() {
  return `${Date.now()}-${randomBytes(3).toString('hex')}`;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-()]/g, '');
}

// ——— Staff ———

export function listStaff() {
  return readTable('staff').sort((a, b) => a.name.localeCompare(b.name));
}

export function getStaffById(id) {
  return readTable('staff').find((s) => s.id === id) || null;
}

export function getStaffByPhone(phone) {
  const p = normalizePhone(phone);
  return readTable('staff').find((s) => normalizePhone(s.phone) === p) || null;
}

export function createStaff({ name, phone }) {
  const rows = readTable('staff');
  const existing = rows.find((s) => normalizePhone(s.phone) === normalizePhone(phone));
  if (existing) return { error: 'This phone is already registered.', staff: existing };

  const staff = {
    id: newId(),
    name: name.trim(),
    phone: normalizePhone(phone),
    created_at: new Date().toISOString(),
  };
  rows.push(staff);
  writeTable('staff', rows);
  return { staff };
}

// ——— Pending registration ———

export function createPending({ name, phone }) {
  const phoneNorm = normalizePhone(phone);
  if (getStaffByPhone(phoneNorm)) {
    return { error: 'This phone is already registered. Ask the manager if you need help.' };
  }

  let rows = readTable('pending').filter((p) => normalizePhone(p.phone) !== phoneNorm);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const pending = {
    id: newId(),
    name: name.trim(),
    phone: phoneNorm,
    code,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
  rows.push(pending);
  writeTable('pending', rows);
  return { pending };
}

export function listPending() {
  const now = Date.now();
  const rows = readTable('pending').filter((p) => new Date(p.expires_at).getTime() > now);
  writeTable('pending', rows);
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function verifyPending({ phone, code }) {
  const phoneNorm = normalizePhone(phone);
  const rows = readTable('pending');
  const pending = rows.find(
    (p) => normalizePhone(p.phone) === phoneNorm && p.code === String(code).trim()
  );

  if (!pending) return { error: 'Invalid code. Ask the manager for the WhatsApp code.' };
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return { error: 'Code expired. Register again.' };
  }

  writeTable(
    'pending',
    rows.filter((p) => p.id !== pending.id)
  );

  return createStaff({ name: pending.name, phone: pending.phone });
}

// ——— Shifts ———

export function listShifts({ staffId, staffName, from, to } = {}) {
  let rows = readTable('shifts');
  if (staffId) rows = rows.filter((s) => s.staff_id === staffId);
  if (staffName) rows = rows.filter((s) => s.staff_name === staffName);
  if (from) rows = rows.filter((s) => s.clock_in >= from);
  if (to) rows = rows.filter((s) => s.clock_in < to);
  return rows.sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
}

export function getOpenShift(staffId) {
  return (
    readTable('shifts').find((s) => s.staff_id === staffId && s.clock_out == null) || null
  );
}

export function clockIn(staff) {
  const rows = readTable('shifts');
  const shift = {
    id: newId(),
    staff_id: staff.id,
    staff_name: staff.name,
    clock_in: new Date().toISOString(),
    clock_out: null,
    created_at: new Date().toISOString(),
  };
  rows.unshift(shift);
  writeTable('shifts', rows);
  return shift;
}

export function clockOut(shiftId) {
  const rows = readTable('shifts');
  const idx = rows.findIndex((s) => s.id === shiftId);
  if (idx < 0) return { error: 'Shift not found.' };
  rows[idx] = { ...rows[idx], clock_out: new Date().toISOString() };
  writeTable('shifts', rows);
  return { shift: rows[idx] };
}

export function updateShift(id, { clock_in, clock_out }) {
  const rows = readTable('shifts');
  const idx = rows.findIndex((s) => s.id === id);
  if (idx < 0) return { error: 'Shift not found.' };

  const next = { ...rows[idx] };
  if (clock_in !== undefined) next.clock_in = clock_in;
  if (clock_out !== undefined) {
    next.clock_out = clock_out === '' || clock_out === null ? null : clock_out;
  }

  if (next.clock_out && new Date(next.clock_out) < new Date(next.clock_in)) {
    return { error: 'Clock out must be after clock in.' };
  }

  rows[idx] = next;
  writeTable('shifts', rows);
  return { shift: next };
}

export function deleteShift(id) {
  const rows = readTable('shifts');
  const next = rows.filter((s) => s.id !== id);
  if (next.length === rows.length) return { error: 'Shift not found.' };
  writeTable('shifts', next);
  return { ok: true };
}

// ——— Manager sessions ———

export function createManagerSession() {
  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  const rows = readTable('sessions');
  rows.push({
    hash,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  writeTable('sessions', rows);
  return token;
}

export function validateManagerSession(token) {
  if (!token) return false;
  const hash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  let rows = readTable('sessions').filter((s) => new Date(s.expires_at).getTime() > now);
  writeTable('sessions', rows);
  return rows.some((s) => s.hash === hash);
}

export function destroyManagerSession(token) {
  if (!token) return;
  const hash = createHash('sha256').update(token).digest('hex');
  writeTable(
    'sessions',
    readTable('sessions').filter((s) => s.hash !== hash)
  );
}

export function checkManagerCredentials(username, password) {
  const u = process.env.MANAGER_USERNAME || 'manager';
  const p = process.env.MANAGER_PASSWORD || 'in yek ramze';
  return username === u && password === p;
}
