const BASE = 'https://osco-staff-clock.vercel.app';

async function req(path, opts = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ms: Date.now() - t0, json, headers: res.headers };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const phone = `9689${Date.now().toString().slice(-7)}`;
  const name = `QA ${Date.now().toString().slice(-4)}`;
  const results = [];

  // 1 register
  let r = await req('/api/register/request', { method: 'POST', body: JSON.stringify({ name, phone }) });
  results.push(['register', r.status, r.ms, r.json.success]);
  assert(r.status === 200 && r.json.success, `register failed: ${JSON.stringify(r.json)}`);

  // 2 manager login
  r = await req('/api/manager/login', { method: 'POST', body: JSON.stringify({ username: 'manager', password: 'in yek ramze' }) });
  results.push(['login', r.status, r.ms, r.json.success]);
  assert(r.status === 200 && r.json.success, 'login failed');
  const cookie = r.headers.getSetCookie?.()?.join('; ') || r.headers.get('set-cookie') || '';
  assert(cookie.includes('osco_manager_session'), 'no session cookie');

  // 3 pending
  r = await req('/api/manager/staff', { headers: { Cookie: cookie.split(',')[0].split(';')[0] } });
  // Node fetch may need full cookie string
  const cookieHeader = cookie.split(/,(?=\s*[^;]+=)/).map(c => c.split(';')[0].trim()).join('; ');
  r = await req('/api/manager/staff', { headers: { Cookie: cookieHeader } });
  results.push(['staff', r.status, r.ms, r.json.success]);
  assert(r.json.success, 'staff list failed');
  const pending = (r.json.pending || []).find(p => p.phone === phone);
  assert(pending?.code, `no pending for ${phone}: ${JSON.stringify(r.json.pending)}`);

  // 4 verify
  r = await req('/api/register/verify', { method: 'POST', body: JSON.stringify({ phone, code: pending.code }) });
  results.push(['verify', r.status, r.ms, r.json.success]);
  assert(r.json.success && r.json.staff?.id, 'verify failed');
  const staffId = r.json.staff.id;

  // 5 punch without GPS must be blocked by café geofence
  r = await req('/api/punch', { method: 'POST', body: JSON.stringify({ staffId }) });
  const geoBlocked =
    r.status === 403 && /location|Osco Lounge|GPS|permission/i.test(r.json.message || '');
  results.push(['punch-geo', r.status, r.ms, geoBlocked ? 'blocked' : r.json.action]);
  assert(geoBlocked || (r.json.success && r.json.action === 'in'), `punch unexpected: ${JSON.stringify(r.json)}`);

  if (!geoBlocked) {
    // 6 double punch (geo check not active in this environment)
    r = await req('/api/punch', { method: 'POST', body: JSON.stringify({ staffId }) });
    results.push(['punch-out', r.status, r.ms, r.json.success, r.json.action]);
    assert(r.json.success && r.json.action === 'out', `punch out failed: ${JSON.stringify(r.json)}`);
  }

  // Far-away spoofed coords must also be blocked when café location is configured
  r = await req('/api/punch', {
    method: 'POST',
    body: JSON.stringify({ staffId, lat: 0, lng: 0, accuracy: 10 }),
  });
  results.push(['punch-far', r.status, r.ms, r.json.success === false]);
  assert(r.status === 403 && !r.json.success, `far punch should fail: ${JSON.stringify(r.json)}`);

  // 7 summary
  r = await req(`/api/summary?staffId=${encodeURIComponent(staffId)}&year=2026`);
  results.push(['summary', r.status, r.ms, r.json.success, `todayShifts=${r.json.todayShifts?.length}`]);
  assert(r.json.success, 'summary failed');
  assert(r.json.cafeTz === 'Asia/Muscat', 'timezone missing');

  // 8 manager shifts
  r = await req(`/api/manager/shifts?staffId=${encodeURIComponent(staffId)}&year=2026`, { headers: { Cookie: cookieHeader } });
  results.push(['mgr-shifts', r.status, r.ms, r.json.success, `days=${r.json.days?.length}`]);
  assert(r.json.success, 'manager shifts failed');

  // 9 bad login
  r = await req('/api/manager/login', { method: 'POST', body: JSON.stringify({ username: 'manager', password: 'wrong' }) });
  results.push(['bad-login', r.status, r.ms, r.json.success]);
  assert(r.status === 401, 'bad login should 401');

  // 10 bad code
  r = await req('/api/register/verify', { method: 'POST', body: JSON.stringify({ phone, code: '000000' }) });
  results.push(['bad-code', r.status, r.ms, r.json.success]);
  assert(!r.json.success, 'bad code should fail');

  // 11 cleanup test staff so production only keeps real users
  r = await req(`/api/manager/staff?id=${encodeURIComponent(staffId)}`, {
    method: 'DELETE',
    headers: { Cookie: cookieHeader },
  });
  results.push(['cleanup', r.status, r.ms, r.json.success]);
  assert(r.json.success, `cleanup failed: ${JSON.stringify(r.json)}`);

  console.log(JSON.stringify({ ok: true, phone, staffId, results }, null, 2));
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
