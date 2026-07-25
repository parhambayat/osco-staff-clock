/**
 * Deletes all staff whose name starts with "QA " from a deployed app.
 * Usage: node scripts/cleanup-qa-staff.mjs [baseUrl]
 * Default baseUrl: https://osco-staff-clock.vercel.app
 */
const BASE = process.argv[2] || 'https://osco-staff-clock.vercel.app';
const USERNAME = process.env.MANAGER_USERNAME || 'manager';
const PASSWORD = process.env.MANAGER_PASSWORD || 'in yek ramze';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

function cookieHeaderFrom(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (raw.length) return raw.map((c) => c.split(';')[0].trim()).join('; ');
  const single = res.headers.get('set-cookie') || '';
  return single
    .split(/,(?=\s*[^;]+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

(async () => {
  const login = await req('/api/manager/login', {
    method: 'POST',
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!login.json.success) {
    console.error(JSON.stringify({ ok: false, step: 'login', ...login.json }));
    process.exit(1);
  }
  const cookie = cookieHeaderFrom(login);
  if (!cookie) {
    console.error(JSON.stringify({ ok: false, step: 'login', error: 'no session cookie' }));
    process.exit(1);
  }

  const list = await req('/api/manager/staff', { headers: { Cookie: cookie } });
  if (!list.json.success) {
    console.error(JSON.stringify({ ok: false, step: 'list', ...list.json }));
    process.exit(1);
  }

  const qa = (list.json.staff || []).filter((s) => /^QA\b/i.test(String(s.name || '').trim()));
  const deleted = [];
  const failed = [];

  for (const s of qa) {
    const del = await req(`/api/manager/staff?id=${encodeURIComponent(s.id)}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    if (del.json.success) deleted.push({ id: s.id, name: s.name, phone: s.phone });
    else failed.push({ id: s.id, name: s.name, message: del.json.message || del.status });
  }

  const after = await req('/api/manager/staff', { headers: { Cookie: cookie } });
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        base: BASE,
        deleted,
        failed,
        remaining: (after.json.staff || []).map((s) => ({ name: s.name, phone: s.phone })),
      },
      null,
      2
    )
  );
  if (failed.length) process.exit(1);
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
