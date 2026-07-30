import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = join(process.cwd(), '.data');

export function isLocalDevMode() {
  // On Vercel always treat as production storage (needs Supabase).
  if (process.env.VERCEL === '1') return false;
  const url = process.env.SUPABASE_URL || '';
  return process.env.LOCAL_DEV === 'true' || !url || url.includes('YOUR-PROJECT');
}

export function hasDatabase() {
  if (isLocalDevMode()) return true;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  return !!(url && key && !url.includes('YOUR-PROJECT'));
}

function getSupabase() {
  if (!hasDatabase() || isLocalDevMode()) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
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

function dbMissing() {
  return {
    error:
      'Database is not configured on the server. Add SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel Environment Variables.',
  };
}

// System settings sentinels (must exist before listPending)
const SETTINGS_EXPIRES = '2099-01-01T00:00:00.000Z';
const CAFE_LOCATION_KEY = 'cafe_location';
const CAFE_LOCATION_PENDING_ID = 'settings-cafe-location';
const CAFE_LOCATION_PENDING_PHONE = '__osco_cafe_location__';
// Legacy Wi-Fi IP sentinel rows may still exist in production DBs — keep filtering them out.
const LEGACY_WIFI_PENDING_ID = 'settings-cafe-wifi';
const LEGACY_WIFI_PENDING_PHONE = '__osco_cafe_wifi__';

function isSystemPendingRow(row) {
  const phone = row?.phone;
  return (
    row?.id === CAFE_LOCATION_PENDING_ID ||
    row?.id === LEGACY_WIFI_PENDING_ID ||
    phone === CAFE_LOCATION_PENDING_PHONE ||
    phone === LEGACY_WIFI_PENDING_PHONE ||
    normalizePhone(phone) === CAFE_LOCATION_PENDING_PHONE ||
    normalizePhone(phone) === LEGACY_WIFI_PENDING_PHONE
  );
}

function isCafeLocationPendingRow(row) {
  return (
    row?.id === CAFE_LOCATION_PENDING_ID ||
    row?.phone === CAFE_LOCATION_PENDING_PHONE ||
    normalizePhone(row?.phone) === CAFE_LOCATION_PENDING_PHONE
  );
}

// ——— Staff ———

export async function listStaff() {
  if (isLocalDevMode()) {
    return readTable('staff').sort((a, b) => a.name.localeCompare(b.name));
  }
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('staff').select('*').order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getStaffById(id) {
  if (isLocalDevMode()) {
    return readTable('staff').find((s) => s.id === id) || null;
  }
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('staff').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getStaffByPhone(phone) {
  const p = normalizePhone(phone);
  if (isLocalDevMode()) {
    return readTable('staff').find((s) => normalizePhone(s.phone) === p) || null;
  }
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('staff').select('*').eq('phone', p).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createStaff({ name, phone }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const phoneNorm = normalizePhone(phone);
  const existing = await getStaffByPhone(phoneNorm);
  if (existing) return { error: 'This phone is already registered.', staff: existing };

  const staff = {
    id: newId(),
    name: name.trim(),
    phone: phoneNorm,
    created_at: new Date().toISOString(),
  };

  if (isLocalDevMode()) {
    const rows = readTable('staff');
    rows.push(staff);
    writeTable('staff', rows);
    return { staff };
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('staff').insert(staff).select().single();
  if (error) return { error: error.message };
  return { staff: data };
}

export async function deleteStaff(id) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const staffId = String(id || '').trim();
  if (!staffId) return { error: 'staffId required' };

  if (isLocalDevMode()) {
    const rows = readTable('staff');
    const next = rows.filter((s) => s.id !== staffId);
    if (next.length === rows.length) return { error: 'Staff not found.' };
    writeTable('staff', next);
    writeTable(
      'shifts',
      readTable('shifts').filter((s) => s.staff_id !== staffId)
    );
    return { ok: true };
  }

  const sb = getSupabase();
  const { data: existing, error: findErr } = await sb
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!existing) return { error: 'Staff not found.' };

  const { error } = await sb.from('staff').delete().eq('id', staffId);
  if (error) return { error: error.message };
  return { ok: true };
}

// ——— Pending registration ———

export async function createPending({ name, phone }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const phoneNorm = normalizePhone(phone);
  if (await getStaffByPhone(phoneNorm)) {
    return {
      error: 'This phone is already registered. Use “Already registered” below to open it on this phone.',
      alreadyRegistered: true,
    };
  }

  const pending = {
    id: newId(),
    name: name.trim(),
    phone: phoneNorm,
    code: String(Math.floor(100000 + Math.random() * 900000)),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  if (isLocalDevMode()) {
    let rows = readTable('pending').filter((p) => normalizePhone(p.phone) !== phoneNorm);
    rows.push(pending);
    writeTable('pending', rows);
    return { pending };
  }

  const sb = getSupabase();
  await sb.from('pending').delete().eq('phone', phoneNorm);
  const { data, error } = await sb.from('pending').insert(pending).select().single();
  if (error) return { error: error.message };
  return { pending: data };
}

/** Existing staff wants to open their account on a new phone — manager gets a code. */
export async function createRestorePending({ phone }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const phoneNorm = normalizePhone(phone);
  const staff = await getStaffByPhone(phoneNorm);
  if (!staff) {
    return { error: 'This phone is not registered yet. Use Register instead.' };
  }

  const pending = {
    id: newId(),
    name: `[Restore] ${staff.name}`,
    phone: phoneNorm,
    code: String(Math.floor(100000 + Math.random() * 900000)),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  if (isLocalDevMode()) {
    let rows = readTable('pending').filter((p) => normalizePhone(p.phone) !== phoneNorm);
    rows.push(pending);
    writeTable('pending', rows);
    return { pending, staff };
  }

  const sb = getSupabase();
  await sb.from('pending').delete().eq('phone', phoneNorm);
  const { data, error } = await sb.from('pending').insert(pending).select().single();
  if (error) return { error: error.message };
  return { pending: data, staff };
}

export async function verifyRestore({ phone, code }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const phoneNorm = normalizePhone(phone);
  const codeStr = String(code).trim();
  const staff = await getStaffByPhone(phoneNorm);
  if (!staff) {
    return { error: 'This phone is not registered.' };
  }

  if (isLocalDevMode()) {
    const rows = readTable('pending');
    const pending = rows.find(
      (p) => normalizePhone(p.phone) === phoneNorm && p.code === codeStr
    );
    if (!pending) return { error: 'Invalid code. Ask the manager for the code from their panel.' };
    if (new Date(pending.expires_at).getTime() < Date.now()) {
      return { error: 'Code expired. Try again.' };
    }
    writeTable(
      'pending',
      rows.filter((p) => p.id !== pending.id)
    );
    return { staff };
  }

  const sb = getSupabase();
  const { data: pending, error } = await sb
    .from('pending')
    .select('*')
    .eq('phone', phoneNorm)
    .eq('code', codeStr)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!pending) return { error: 'Invalid code. Ask the manager for the code from their panel.' };
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return { error: 'Code expired. Try again.' };
  }

  await sb.from('pending').delete().eq('id', pending.id);
  return { staff };
}

export async function listPending() {
  const now = new Date().toISOString();
  if (isLocalDevMode()) {
    const rows = readTable('pending')
      .filter((p) => new Date(p.expires_at).getTime() > Date.now())
      .filter((p) => !isSystemPendingRow(p));
    writeTable(
      'pending',
      readTable('pending').filter(
        (p) => isSystemPendingRow(p) || new Date(p.expires_at).getTime() > Date.now()
      )
    );
    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (!hasDatabase()) return [];
  const sb = getSupabase();
  await sb
    .from('pending')
    .delete()
    .lt('expires_at', now)
    .neq('id', CAFE_LOCATION_PENDING_ID)
    .neq('id', LEGACY_WIFI_PENDING_ID);
  const { data, error } = await sb
    .from('pending')
    .select('*')
    .gt('expires_at', now)
    .neq('id', CAFE_LOCATION_PENDING_ID)
    .neq('id', LEGACY_WIFI_PENDING_ID)
    .neq('phone', CAFE_LOCATION_PENDING_PHONE)
    .neq('phone', LEGACY_WIFI_PENDING_PHONE)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function verifyPending({ phone, code }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const phoneNorm = normalizePhone(phone);
  const codeStr = String(code).trim();

  if (isLocalDevMode()) {
    const rows = readTable('pending');
    const pending = rows.find(
      (p) => normalizePhone(p.phone) === phoneNorm && p.code === codeStr
    );
    if (!pending) return { error: 'Invalid code. Ask the manager for the code from their panel.' };
    if (new Date(pending.expires_at).getTime() < Date.now()) {
      return { error: 'Code expired. Register again.' };
    }
    writeTable(
      'pending',
      rows.filter((p) => p.id !== pending.id)
    );
    return createStaff({ name: pending.name, phone: pending.phone });
  }

  const sb = getSupabase();
  const { data: pending, error } = await sb
    .from('pending')
    .select('*')
    .eq('phone', phoneNorm)
    .eq('code', codeStr)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!pending) return { error: 'Invalid code. Ask the manager for the code from their panel.' };
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return { error: 'Code expired. Register again.' };
  }

  await sb.from('pending').delete().eq('id', pending.id);
  return createStaff({ name: pending.name, phone: pending.phone });
}

// ——— Shifts ———

export async function listShifts({ staffId, staffName, from, to } = {}) {
  if (isLocalDevMode()) {
    let rows = readTable('shifts');
    if (staffId) rows = rows.filter((s) => s.staff_id === staffId);
    if (staffName) rows = rows.filter((s) => s.staff_name === staffName);
    if (from) rows = rows.filter((s) => s.clock_in >= from);
    if (to) rows = rows.filter((s) => s.clock_in < to);
    return rows.sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
  }
  if (!hasDatabase()) return [];
  const sb = getSupabase();
  let q = sb.from('shifts').select('*');
  if (staffId) q = q.eq('staff_id', staffId);
  if (staffName) q = q.eq('staff_name', staffName);
  if (from) q = q.gte('clock_in', from);
  if (to) q = q.lt('clock_in', to);
  const { data, error } = await q.order('clock_in', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getOpenShift(staffId) {
  if (isLocalDevMode()) {
    return readTable('shifts').find((s) => s.staff_id === staffId && s.clock_out == null) || null;
  }
  if (!hasDatabase()) return null;
  const sb = getSupabase();
  // Use limit(1) without maybeSingle — maybeSingle throws if duplicates exist.
  const { data, error } = await sb
    .from('shifts')
    .select('*')
    .eq('staff_id', staffId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

export async function clockIn(staff) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  // Prevent duplicate open shifts (race-safe enough with unique index + this check)
  const existing = await getOpenShift(staff.id);
  if (existing) return existing;

  const shift = {
    id: newId(),
    staff_id: staff.id,
    staff_name: staff.name,
    clock_in: new Date().toISOString(),
    clock_out: null,
    created_at: new Date().toISOString(),
  };

  if (isLocalDevMode()) {
    const rows = readTable('shifts');
    if (rows.some((s) => s.staff_id === staff.id && s.clock_out == null)) {
      return rows.find((s) => s.staff_id === staff.id && s.clock_out == null);
    }
    rows.unshift(shift);
    writeTable('shifts', rows);
    return shift;
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('shifts').insert(shift).select().single();
  if (error) {
    // Unique violation on open shift — return the existing one
    if (String(error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') {
      return getOpenShift(staff.id);
    }
    throw new Error(error.message);
  }
  return data;
}

export async function clockOut(shiftId) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const clock_out = new Date().toISOString();
  if (isLocalDevMode()) {
    const rows = readTable('shifts');
    const idx = rows.findIndex((s) => s.id === shiftId && s.clock_out == null);
    if (idx < 0) return { error: 'Shift not found or already closed.' };
    rows[idx] = { ...rows[idx], clock_out };
    writeTable('shifts', rows);
    return { shift: rows[idx] };
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('shifts')
    .update({ clock_out })
    .eq('id', shiftId)
    .is('clock_out', null)
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Shift not found or already closed.' };
  return { shift: data };
}

export async function updateShift(id, { clock_in, clock_out }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  if (isLocalDevMode()) {
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
    if (next.clock_out == null) {
      const otherOpen = rows.find((s) => s.staff_id === next.staff_id && s.id !== id && s.clock_out == null);
      if (otherOpen) return { error: 'This staff already has an open shift.' };
    }
    rows[idx] = next;
    writeTable('shifts', rows);
    return { shift: next };
  }

  const sb = getSupabase();
  const { data: current, error: curErr } = await sb.from('shifts').select('*').eq('id', id).single();
  if (curErr || !current) return { error: curErr?.message || 'Shift not found.' };

  const next = {
    clock_in: clock_in !== undefined ? clock_in : current.clock_in,
    clock_out:
      clock_out !== undefined
        ? clock_out === '' || clock_out === null
          ? null
          : clock_out
        : current.clock_out,
  };

  if (next.clock_out && new Date(next.clock_out) < new Date(next.clock_in)) {
    return { error: 'Clock out must be after clock in.' };
  }

  if (next.clock_out == null) {
    const { data: others } = await sb
      .from('shifts')
      .select('id')
      .eq('staff_id', current.staff_id)
      .is('clock_out', null)
      .neq('id', id)
      .limit(1);
    if (others?.length) return { error: 'This staff already has an open shift.' };
  }

  const { data, error } = await sb.from('shifts').update(next).eq('id', id).select().single();
  if (error) return { error: error.message };
  return { shift: data };
}

export async function deleteShift(id) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  if (isLocalDevMode()) {
    const rows = readTable('shifts');
    const next = rows.filter((s) => s.id !== id);
    if (next.length === rows.length) return { error: 'Shift not found.' };
    writeTable('shifts', next);
    return { ok: true };
  }

  const sb = getSupabase();
  const { error } = await sb.from('shifts').delete().eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}

export function checkManagerCredentials(username, password) {
  const u = process.env.MANAGER_USERNAME || 'manager';
  const p = process.env.MANAGER_PASSWORD || 'in yek ramze';
  return username === u && password === p;
}

// ——— App / system settings (stored in pending sentinels; no SQL migrations) ———

async function readPendingSetting(sb, { id, phone, isRow }) {
  if (isLocalDevMode()) {
    const row = readTable('pending').find(isRow);
    return row?.name ? String(row.name) : null;
  }
  if (!sb) return null;

  const { data, error } = await sb.from('pending').select('name').eq('id', id).maybeSingle();
  if (!error && data?.name) return String(data.name);
  if (error) console.warn('[settings pending]', id, error.message);

  const { data: byPhone, error: phoneErr } = await sb
    .from('pending')
    .select('name')
    .eq('phone', phone)
    .limit(1);
  if (phoneErr) {
    console.warn('[settings pending phone]', phone, phoneErr.message);
    return null;
  }
  return byPhone?.[0]?.name ? String(byPhone[0].name) : null;
}

async function writePendingSetting(sb, { id, phone, value, isRow }) {
  const row = {
    id,
    name: value,
    phone,
    code: '000000',
    created_at: new Date().toISOString(),
    expires_at: SETTINGS_EXPIRES,
  };

  if (isLocalDevMode()) {
    const rows = readTable('pending').filter((p) => !isRow(p));
    rows.push(row);
    writeTable('pending', rows);
    return { ok: true, value, source: 'pending' };
  }

  await sb.from('pending').delete().eq('phone', phone);
  await sb.from('pending').delete().eq('id', id);
  const { error } = await sb.from('pending').insert(row);
  if (error) return { error: error.message };
  return { ok: true, value, source: 'pending' };
}

async function readAppSetting(key) {
  if (isLocalDevMode()) {
    const rows = readTable('app_settings');
    const row = rows.find((r) => r.key === key);
    return row?.value ? String(row.value) : null;
  }
  if (!hasDatabase()) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error) {
    console.warn('[app_settings]', key, error.message);
    return null;
  }
  return data?.value ? String(data.value) : null;
}

async function writeAppSetting(key, value) {
  if (isLocalDevMode()) {
    const rows = readTable('app_settings');
    const idx = rows.findIndex((r) => r.key === key);
    const row = { key, value, updated_at: new Date().toISOString() };
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    writeTable('app_settings', rows);
    return { ok: true, value, source: 'db' };
  }
  if (!hasDatabase()) return dbMissing();
  const sb = getSupabase();
  const { error } = await sb.from('app_settings').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) {
    console.warn('[app_settings write]', key, error.message);
    return { error: error.message };
  }
  return { ok: true, value, source: 'db' };
}

export async function getCafeLocationSetting() {
  const fromApp = await readAppSetting(CAFE_LOCATION_KEY);
  if (fromApp) return { raw: fromApp, source: 'db' };

  const sb = !isLocalDevMode() && hasDatabase() ? getSupabase() : null;
  const pendingVal = await readPendingSetting(sb, {
    id: CAFE_LOCATION_PENDING_ID,
    phone: CAFE_LOCATION_PENDING_PHONE,
    isRow: isCafeLocationPendingRow,
  });
  if (pendingVal) return { raw: pendingVal, source: 'pending' };
  return { raw: null, source: 'none' };
}

export async function setCafeLocationSetting(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const radiusM = Number(location?.radiusM);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Valid lat/lng required.' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'Invalid GPS coordinates.' };
  }
  const value = JSON.stringify({
    lat,
    lng,
    radiusM: Number.isFinite(radiusM) && radiusM > 0 ? Math.min(radiusM, 2000) : 250,
    updatedAt: new Date().toISOString(),
  });

  const app = await writeAppSetting(CAFE_LOCATION_KEY, value);
  if (app.ok) {
    const sb = !isLocalDevMode() && hasDatabase() ? getSupabase() : null;
    await writePendingSetting(sb, {
      id: CAFE_LOCATION_PENDING_ID,
      phone: CAFE_LOCATION_PENDING_PHONE,
      value,
      isRow: isCafeLocationPendingRow,
    });
    return { ...app, value };
  }

  const sb = !isLocalDevMode() && hasDatabase() ? getSupabase() : null;
  if (!sb && !isLocalDevMode()) return app;
  const pending = await writePendingSetting(sb, {
    id: CAFE_LOCATION_PENDING_ID,
    phone: CAFE_LOCATION_PENDING_PHONE,
    value,
    isRow: isCafeLocationPendingRow,
  });
  return pending.ok ? { ...pending, value } : pending;
}

// Legacy no-ops kept so old imports don't break during transition
export function createManagerSession() {
  throw new Error('Use createManagerToken from lib/session.js');
}
export function validateManagerSession() {
  return false;
}
export function destroyManagerSession() {}
