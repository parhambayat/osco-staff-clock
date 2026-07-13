'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function pad(n) { return String(n).padStart(2, '0'); }

function formatDur(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${pad(m)}m`;
}

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

function fromLocalInputValue(val) {
  if (!val) return null;
  return new Date(val).toISOString();
}

export default function ManagerPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [pending, setPending] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [editShift, setEditShift] = useState(null);
  const [message, setMessage] = useState('');
  const pendingCountRef = useRef(0);

  useEffect(() => {
    fetch('/api/manager/login')
      .then((r) => r.json())
      .then((d) => {
        setAuthed(!!d.authenticated);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadStaff();
    const t = setInterval(loadStaff, 5000);
    return () => clearInterval(t);
  }, [authed]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId, selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedDate]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setLoginError('');
    try {
      const res = await fetch('/api/manager/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.success) setLoginError(data.message || 'Login failed');
      else setAuthed(true);
    } catch {
      setLoginError('Network error');
    }
    setBusy(false);
  }

  async function logout() {
    await fetch('/api/manager/login', { method: 'DELETE' });
    setAuthed(false);
    setStaffList([]);
    setSelectedId(null);
    setDetail(null);
  }

  async function loadStaff() {
    const res = await fetch('/api/manager/staff');
    const data = await res.json();
    if (data.success) {
      const nextPending = data.pending || [];
      if (nextPending.length > pendingCountRef.current) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.value = 0.05;
          o.start();
          o.stop(ctx.currentTime + 0.2);
        } catch {
          // ignore audio errors
        }
      }
      pendingCountRef.current = nextPending.length;
      setStaffList(data.staff || []);
      setPending(nextPending);
    } else if (res.status === 401) {
      setAuthed(false);
    }
  }

  async function loadDetail(staffId, date) {
    const year = new Date().getFullYear();
    const q = new URLSearchParams({ staffId, year: String(year) });
    if (date) q.set('date', date);
    const res = await fetch(`/api/manager/shifts?${q}`);
    const data = await res.json();
    if (data.success) setDetail(data);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/manager/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editShift.id,
          clock_in: fromLocalInputValue(editShift.clock_in_local),
          clock_out: editShift.clock_out_local
            ? fromLocalInputValue(editShift.clock_out_local)
            : null,
        }),
      });
      const data = await res.json();
      if (!data.success) setMessage(data.message || 'Update failed');
      else {
        setEditShift(null);
        setMessage('Shift updated.');
        await loadDetail(selectedId, selectedDate);
        await loadStaff();
      }
    } catch {
      setMessage('Network error');
    }
    setBusy(false);
  }

  async function removeShift(id) {
    if (!confirm('Delete this shift?')) return;
    const res = await fetch(`/api/manager/shifts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setEditShift(null);
      await loadDetail(selectedId, selectedDate);
    } else {
      setMessage(data.message || 'Delete failed');
    }
  }

  if (!authChecked) return null;

  if (!authed) {
    return (
      <div className="app">
        <div className="name-gate">
          <div className="brand">Osco Lounge</div>
          <p className="gate-sub">Manager panel</p>
          <form onSubmit={login}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
            />
            {loginError && <div className="form-error">{loginError}</div>}
            <button type="submit" disabled={busy}>{busy ? '…' : 'Login'}</button>
          </form>
          <Link href="/" className="manager-link">← Staff clock</Link>
        </div>
      </div>
    );
  }

  const selected = staffList.find((s) => s.id === selectedId);

  return (
    <div className="app manager-app">
      <div className="header">
        <div className="brand">Manager</div>
        <button type="button" className="text-btn" onClick={logout}>Logout</button>
      </div>

      <section className="mgr-section">
        <div className="mini-log-title">Registration codes</div>
        <p className="mgr-hint">
          When a staff member registers, the code appears below in <strong>Pending</strong>.
          Tell them the code (or type it on their phone). No external WhatsApp bot needed.
        </p>
      </section>

      <section className="mgr-section">
        <div className="mini-log-title">Pending registrations {pending.length > 0 ? `(${pending.length})` : ''}</div>
        <p className="mgr-hint">Auto-refreshes every 5s. Enter this code on the staff phone to approve.</p>
        {pending.length === 0 ? (
          <div className="empty-note">No pending codes right now.</div>
        ) : (
          pending.map((p) => (
            <div className="pending-card" key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <div className="muted">{p.phone}</div>
              </div>
              <div className="pending-code">{p.code}</div>
            </div>
          ))
        )}
      </section>

      <section className="mgr-section">
        <div className="mini-log-title">Staff</div>
        {staffList.length === 0 ? (
          <div className="empty-note">No registered staff yet.</div>
        ) : (
          staffList.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`staff-row ${selectedId === s.id ? 'active' : ''}`}
              onClick={() => { setSelectedId(s.id); setSelectedDate(''); setMessage(''); }}
            >
              <span>{s.name}</span>
              <span className="muted">{s.phone}</span>
            </button>
          ))
        )}
      </section>

      {selected && detail && (
        <section className="mgr-section">
          <div className="mgr-staff-head">
            <div>
              <div className="full-date">{detail.staff.name}</div>
              <div className="muted">{detail.staff.phone}</div>
            </div>
          </div>

          <div className="year-label">{new Date().getFullYear()} · monthly totals</div>
          {MONTH_NAMES.map((name, i) => {
            const has = detail.monthTotals[i] > 0;
            return (
              <div className={`month-row ${i === new Date().getMonth() ? 'current' : ''}`} key={name}>
                <div className="month-name">{name}</div>
                <div className={`month-hours ${!has ? 'empty' : ''}`}>
                  {has ? formatDur(detail.monthTotals[i]) : '—'}
                </div>
              </div>
            );
          })}

          <div className="mini-log-title" style={{ marginTop: 28 }}>By day</div>
          <input
            type="date"
            className="date-filter"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          {(selectedDate ? (detail.dayDetail ? [detail.dayDetail] : []) : detail.days).map((day) => (
            <div key={day.date} className="day-block">
              <div className="day-head">
                <strong>{day.date}</strong>
                <span className="dur">{formatDur(day.seconds)}</span>
              </div>
              {(day.shifts || []).map((s) => (
                <div className="mini-log-entry" key={s.id}>
                  <span className="times">
                    {new Date(s.clock_in).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {s.clock_out
                      ? new Date(s.clock_out).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                      : 'open'}
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      setEditShift({
                        id: s.id,
                        clock_in_local: toLocalInputValue(s.clock_in),
                        clock_out_local: s.clock_out ? toLocalInputValue(s.clock_out) : '',
                      })
                    }
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          ))}

          {message && <div className="helper-note" style={{ color: message.includes('updated') ? 'var(--black)' : 'var(--red)' }}>{message}</div>}
        </section>
      )}

      {editShift && (
        <div className="modal-backdrop" onClick={() => setEditShift(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="brand" style={{ marginBottom: 12 }}>Edit shift</div>
            <label className="field-label">Clock in</label>
            <input
              type="datetime-local"
              value={editShift.clock_in_local}
              onChange={(e) => setEditShift({ ...editShift, clock_in_local: e.target.value })}
              required
            />
            <label className="field-label">Clock out (empty = still open)</label>
            <input
              type="datetime-local"
              value={editShift.clock_out_local}
              onChange={(e) => setEditShift({ ...editShift, clock_out_local: e.target.value })}
            />
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="btn-ghost" onClick={() => removeShift(editShift.id)}>Delete shift</button>
            <button type="button" className="btn-ghost" onClick={() => setEditShift(null)}>Cancel</button>
          </form>
        </div>
      )}

      <div className="footnote">
        <Link href="/">← Staff clock</Link>
      </div>
    </div>
  );
}
