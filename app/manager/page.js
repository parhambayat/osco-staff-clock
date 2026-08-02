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
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [editShift, setEditShift] = useState(null);
  const [manualEntry, setManualEntry] = useState(null);
  const [message, setMessage] = useState('');
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [exemptIds, setExemptIds] = useState([]);
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
    loadLocation();
    loadExempt();
    const t = setInterval(loadStaff, 10000);
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

  async function loadLocation() {
    try {
      const res = await fetch('/api/manager/location');
      const data = await res.json();
      if (data.success) setLocationInfo(data);
      else if (res.status === 401) setAuthed(false);
    } catch {
      // ignore
    }
  }

  function readGps() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('This phone does not support location.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => {
          if (err?.code === 1) {
            reject(new Error('Location permission denied. Allow location for this site and try again.'));
          } else if (err?.code === 3) {
            reject(new Error('Location timed out. Step near a window and try again.'));
          } else {
            reject(new Error(err?.message || 'Could not read GPS location.'));
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }

  async function setCafeLocationHere() {
    setLocationBusy(true);
    setMessage('');
    try {
      const coords = await readGps();
      const res = await fetch('/api/manager/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || 'Could not save café location.');
      } else {
        setLocationInfo(data);
        setMessage(data.message || 'Café location saved.');
      }
    } catch (e) {
      setMessage(e.message || 'Could not read GPS. Allow location access and try again.');
    }
    setLocationBusy(false);
  }

  async function loadExempt() {
    try {
      const res = await fetch('/api/manager/exempt');
      const data = await res.json();
      if (data.success) setExemptIds(data.staffIds || []);
      else if (res.status === 401) setAuthed(false);
    } catch {
      // ignore
    }
  }

  async function toggleExempt(enabled) {
    if (!selectedId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/manager/exempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedId, enabled }),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || 'Could not update.');
      } else {
        setExemptIds(data.staffIds || []);
        setMessage(data.message || 'Updated.');
      }
    } catch {
      setMessage('Network error');
    }
    setBusy(false);
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

  function openManualEntry(seedDate) {
    const year = new Date().getFullYear();
    let datePart = seedDate || selectedDate;
    if (!datePart && selectedMonth != null) {
      datePart = `${year}-${pad(selectedMonth + 1)}-01`;
    }
    if (!datePart) {
      const now = new Date();
      datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
    setManualEntry({
      clock_in_local: `${datePart}T09:00`,
      clock_out_local: `${datePart}T17:00`,
    });
    setMessage('');
  }

  async function saveManualEntry(e) {
    e.preventDefault();
    if (!selectedId || !manualEntry) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/manager/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedId,
          clock_in: fromLocalInputValue(manualEntry.clock_in_local),
          clock_out: manualEntry.clock_out_local
            ? fromLocalInputValue(manualEntry.clock_out_local)
            : null,
        }),
      });
      const data = await res.json();
      if (!data.success) setMessage(data.message || 'Could not create entry');
      else {
        setManualEntry(null);
        setMessage('Manual entry created.');
        await loadDetail(selectedId, selectedDate);
        await loadStaff();
      }
    } catch {
      setMessage('Network error');
    }
    setBusy(false);
  }

  function selectMonth(monthIndex) {
    const next = selectedMonth === monthIndex ? null : monthIndex;
    setSelectedMonth(next);
    setSelectedDate('');
    setMessage('');
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

  async function removeStaff(staffId, staffName) {
    if (!confirm(`Delete staff “${staffName}”? Their shifts will be removed too.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/manager/staff?id=${encodeURIComponent(staffId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || 'Delete failed');
      } else {
        if (selectedId === staffId) {
          setSelectedId(null);
          setDetail(null);
        }
        setMessage('Staff deleted.');
        await loadStaff();
      }
    } catch {
      setMessage('Network error');
    }
    setBusy(false);
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
        <div className="mini-log-title">Café location</div>
        <p className="mgr-hint">
          Staff can clock in/out only when they are at Osco Lounge.
          Open this panel <strong>at the café</strong>, allow Location, then tap the button once.
        </p>
        {locationInfo ? (
          <div className="cafe-box">
            <div className={`cafe-status ${locationInfo.configured ? 'ok' : 'bad'}`}>
              {locationInfo.configured
                ? `Location set — punches allowed within ~${locationInfo.location?.radiusM || 250}m`
                : 'Not set — staff punches are blocked until you set it'}
            </div>
            {locationInfo.configured && locationInfo.location && (
              <div className="cafe-row">
                <span className="muted">Saved point</span>
                <span className="mono">
                  {locationInfo.location.lat.toFixed(5)}, {locationInfo.location.lng.toFixed(5)}
                </span>
              </div>
            )}
            <button type="button" disabled={locationBusy} onClick={setCafeLocationHere}>
              {locationBusy ? 'Saving…' : locationInfo.configured ? 'Update café location here' : 'Set café location here'}
            </button>
            {message && /location|GPS|café location/i.test(message) && (
              <div
                className="helper-note"
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  color: /saved|Location set/i.test(message) ? 'var(--black)' : 'var(--red)',
                }}
              >
                {message}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-note">Loading location status…</div>
        )}
      </section>

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
              onClick={() => {
                setSelectedId(s.id);
                setSelectedDate('');
                setSelectedMonth(new Date().getMonth());
                setMessage('');
              }}
            >
              <span>{s.name}</span>
              <span className="muted">
                {exemptIds.includes(s.id) ? 'no GPS · ' : ''}
                {s.phone}
              </span>
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
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() => removeStaff(detail.staff.id, detail.staff.name)}
            >
              Delete staff
            </button>
          </div>

          <div className="cafe-box" style={{ marginBottom: 18 }}>
            <div className="mini-log-title" style={{ marginBottom: 8 }}>Location requirement</div>
            <p className="mgr-hint">
              Turn this on for staff whose phone GPS does not work. They can punch without location — no codes needed.
            </p>
            <div className={`cafe-status ${exemptIds.includes(detail.staff.id) ? 'ok' : 'bad'}`}>
              {exemptIds.includes(detail.staff.id)
                ? 'No location required for this staff'
                : 'Must be at café (GPS required)'}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => toggleExempt(!exemptIds.includes(detail.staff.id))}
            >
              {busy
                ? '…'
                : exemptIds.includes(detail.staff.id)
                  ? 'Require location again'
                  : 'Allow punch without location'}
            </button>
            {message && /location|GPS|punch without|must use café/i.test(message) && (
              <div
                className="helper-note"
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  color: /without location|Updated|can punch/i.test(message) ? 'var(--black)' : 'var(--red)',
                }}
              >
                {message}
              </div>
            )}
          </div>

          <div className="year-label">{new Date().getFullYear()} · tap a month to edit</div>
          {MONTH_NAMES.map((name, i) => {
            const has = detail.monthTotals[i] > 0;
            const isSelected = selectedMonth === i;
            const isCalendarCurrent = i === new Date().getMonth();
            return (
              <button
                type="button"
                className={`month-row ${isSelected || (selectedMonth == null && isCalendarCurrent) ? 'current' : ''} ${isSelected ? 'selected' : ''}`}
                key={name}
                onClick={() => selectMonth(i)}
              >
                <div className="month-name">{name}</div>
                <div className={`month-hours ${!has ? 'empty' : ''}`}>
                  {has ? formatDur(detail.monthTotals[i]) : '—'}
                </div>
              </button>
            );
          })}

          <div className="day-section-head" style={{ marginTop: 28 }}>
            <div className="mini-log-title" style={{ margin: 0 }}>
              By day
              {selectedMonth != null ? ` · ${MONTH_NAMES[selectedMonth]}` : ''}
            </div>
            <button type="button" className="text-btn" onClick={() => openManualEntry()}>
              + Manual entry
            </button>
          </div>
          <p className="mgr-hint">
            Add a missing clock-in/out for any date, or tap Edit on an existing shift.
          </p>
          <input
            type="date"
            className="date-filter"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              if (e.target.value) {
                const m = Number(e.target.value.split('-')[1]) - 1;
                if (m >= 0 && m <= 11) setSelectedMonth(m);
              }
            }}
          />

          {(selectedDate
            ? (detail.dayDetail ? [detail.dayDetail] : [])
            : detail.days.filter((day) => {
                if (selectedMonth == null) return true;
                const m = Number(String(day.date).split('-')[1]) - 1;
                return m === selectedMonth;
              })
          ).map((day) => (
            <div key={day.date} className="day-block">
              <div className="day-head">
                <strong>{day.date}</strong>
                <span className="dur">{formatDur(day.seconds)}</span>
              </div>
              {(day.shifts || []).length === 0 ? (
                <div className="mini-log-entry">
                  <span className="times muted">No shifts</span>
                  <button type="button" className="text-btn" onClick={() => openManualEntry(day.date)}>
                    Add
                  </button>
                </div>
              ) : (
                (day.shifts || []).map((s) => (
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
                ))
              )}
            </div>
          ))}

          {!selectedDate &&
            selectedMonth != null &&
            detail.days.filter((day) => Number(String(day.date).split('-')[1]) - 1 === selectedMonth).length === 0 && (
              <div className="empty-note">
                No days in {MONTH_NAMES[selectedMonth]} yet.{' '}
                <button type="button" className="text-btn" onClick={() => openManualEntry()}>
                  Add manual entry
                </button>
              </div>
            )}

          {message && (
            <div
              className="helper-note"
              style={{
                color: /updated|deleted|created/i.test(message) ? 'var(--black)' : 'var(--red)',
              }}
            >
              {message}
            </div>
          )}
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

      {manualEntry && (
        <div className="modal-backdrop" onClick={() => setManualEntry(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveManualEntry}>
            <div className="brand" style={{ marginBottom: 12 }}>Manual entry</div>
            <p className="mgr-hint" style={{ marginBottom: 8 }}>
              Create a clock-in/out for {selected?.name || 'this staff'} on any date.
            </p>
            <label className="field-label">Clock in</label>
            <input
              type="datetime-local"
              value={manualEntry.clock_in_local}
              onChange={(e) => setManualEntry({ ...manualEntry, clock_in_local: e.target.value })}
              required
            />
            <label className="field-label">Clock out (empty = still open)</label>
            <input
              type="datetime-local"
              value={manualEntry.clock_out_local}
              onChange={(e) => setManualEntry({ ...manualEntry, clock_out_local: e.target.value })}
            />
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create entry'}</button>
            <button type="button" className="btn-ghost" onClick={() => setManualEntry(null)}>Cancel</button>
          </form>
        </div>
      )}

      <div className="footnote">
        <Link href="/">← Staff clock</Link>
      </div>
    </div>
  );
}
