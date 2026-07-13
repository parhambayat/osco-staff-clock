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

// ——— Pending registration ———

export async function createPending({ name, phone }) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const phoneNorm = normalizePhone(phone);
  if (await getStaffByPhone(phoneNorm)) {
    return { error: 'This phone is already registered. Ask the manager if you need help.' };
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
  // Replace any previous pending for same phone
  await sb.from('pending').delete().eq('phone', phoneNorm);
  const { data, error } = await sb.from('pending').insert(pending).select().single();
  if (error) return { error: error.message };
  return { pending: data };
}

export async function listPending() {
  const now = new Date().toISOString();
  if (isLocalDevMode()) {
    const rows = readTable('pending').filter((p) => new Date(p.expires_at).getTime() > Date.now());
    writeTable('pending', rows);
    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (!hasDatabase()) return [];
  const sb = getSupabase();
  await sb.from('pending').delete().lt('expires_at', now);
  const { data, error } = await sb
    .from('pending')
    .select('*')
    .gt('expires_at', now)
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
  const { data, error } = await sb
    .from('shifts')
    .select('*')
    .eq('staff_id', staffId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function clockIn(staff) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

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
    rows.unshift(shift);
    writeTable('shifts', rows);
    return shift;
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('shifts').insert(shift).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function clockOut(shiftId) {
  if (!hasDatabase() && !isLocalDevMode()) return dbMissing();

  const clock_out = new Date().toISOString();
  if (isLocalDevMode()) {
    const rows = readTable('shifts');
    const idx = rows.findIndex((s) => s.id === shiftId);
    if (idx < 0) return { error: 'Shift not found.' };
    rows[idx] = { ...rows[idx], clock_out };
    writeTable('shifts', rows);
    return { shift: rows[idx] };
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('shifts')
    .update({ clock_out })
    .eq('id', shiftId)
    .select()
    .single();
  if (error) return { error: error.message };
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
    rows[idx] = next;
    writeTable('shifts', rows);
    return { shift: next };
  }

  const patch = {};
  if (clock_in !== undefined) patch.clock_in = clock_in;
  if (clock_out !== undefined) {
    patch.clock_out = clock_out === '' || clock_out === null ? null : clock_out;
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('shifts').update(patch).eq('id', id).select().single();
  if (error) return { error: error.message };
  if (data.clock_out && new Date(data.clock_out) < new Date(data.clock_in)) {
    return { error: 'Clock out must be after clock in.' };
  }
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

// Legacy no-ops kept so old imports don't break during transition
export function createManagerSession() {
  throw new Error('Use createManagerToken from lib/session.js');
}
export function validateManagerSession() {
  return false;
}
export function destroyManagerSession() {}
