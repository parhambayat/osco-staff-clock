'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STAFF_KEY = 'osco_staff';
const BYPASS_KEY = 'osco_location_bypass';

function pad(n) { return String(n).padStart(2, '0'); }

function formatDur(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${pad(m)}m`;
}

function loadStaff() {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStaff(staff) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

function clearStaff() {
  localStorage.removeItem(STAFF_KEY);
  localStorage.removeItem('osco_staff_name');
}

function loadBypass(staffId) {
  try {
    const raw = localStorage.getItem(BYPASS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.token || data.staffId !== staffId) return null;
    return data;
  } catch {
    return null;
  }
}

function saveBypass(data) {
  localStorage.setItem(BYPASS_KEY, JSON.stringify(data));
}

function clearBypass() {
  localStorage.removeItem(BYPASS_KEY);
}

export default function Home() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('today');
  const [now, setNow] = useState(new Date());
  const [openShift, setOpenShift] = useState(null);
  const [todayShifts, setTodayShifts] = useState([]);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [monthTotals, setMonthTotals] = useState(new Array(12).fill(0));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [hasBypass, setHasBypass] = useState(false);
  const [showBypassForm, setShowBypassForm] = useState(false);
  const [bypassCode, setBypassCode] = useState('');
  const [bypassBusy, setBypassBusy] = useState(false);

  useEffect(() => {
    const s = loadStaff();
    setStaff(s);
    if (s?.id) setHasBypass(!!loadBypass(s.id));
    setReady(true);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!staff?.id) return;
    setHasBypass(!!loadBypass(staff.id));
    fetchSummary();
    const t = setInterval(fetchSummary, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id]);

  async function fetchSummary() {
    try {
      const res = await fetch(
        `/api/summary?staffId=${encodeURIComponent(staff.id)}&year=${new Date().getFullYear()}`
      );
      const data = await res.json();
      if (data.needReregister) {
        clearStaff();
        clearBypass();
        setStaff(null);
        setHasBypass(false);
        return;
      }
      if (data.success) {
        setOpenShift(data.openShift);
        setTodayShifts(data.todayShifts);
        setTodaySeconds(data.todaySeconds);
        setMonthTotals(data.monthTotals);
      }
    } catch {
      // keep last known state
    }
  }

  async function redeemBypass(e) {
    e.preventDefault();
    if (!staff?.id || bypassBusy) return;
    setBypassBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/bypass/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staff.id, code: bypassCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setMessage(data.message || 'Invalid code.');
      } else {
        saveBypass({ token: data.token, staffId: data.staffId, label: data.label });
        setHasBypass(true);
        setShowBypassForm(false);
        setBypassCode('');
        setMessage(data.message || 'This phone can punch without GPS.');
      }
    } catch {
      setMessage('Network error — try again.');
    }
    setBypassBusy(false);
  }

  async function submitPunch() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const bypass = loadBypass(staff.id);
      let payload = { staffId: staff.id };

      if (bypass?.token) {
        payload.bypassToken = bypass.token;
      } else {
        if (!navigator.geolocation) {
          setMessage('Location is unavailable on this phone. Ask the manager for a device pass code.');
          setShowBypassForm(true);
          setBusy(false);
          return;
        }

        try {
          const coords = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                resolve({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                }),
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
            );
          });
          payload = { ...payload, ...coords };
        } catch (err) {
          if (err?.code === 1) {
            setMessage('Allow location access, or ask the manager for a device pass code.');
          } else if (err?.code === 3) {
            setMessage('Location timed out. Try near a window, or ask for a device pass code.');
          } else {
            setMessage('Could not read GPS. Ask the manager for a device pass code.');
          }
          setShowBypassForm(true);
          setBusy(false);
          return;
        }
      }

      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        if (data.needReregister) {
          clearStaff();
          clearBypass();
          setStaff(null);
          setHasBypass(false);
        }
        setMessage(data.message || 'Could not record punch.');
        if (data.needBypass) setShowBypassForm(true);
      } else {
        await fetchSummary();
      }
    } catch {
      setMessage('Network error — try again.');
    }
    setBusy(false);
  }

  const liveTodaySeconds = (() => {
    if (!openShift) return todaySeconds;
    const openIn = new Date(openShift.clock_in);
    if (openIn.toDateString() !== now.toDateString()) return todaySeconds;
    const completedOnly = todayShifts
      .filter((s) => s.clock_out)
      .reduce((sum, s) => sum + (new Date(s.clock_out) - new Date(s.clock_in)) / 1000, 0);
    return completedOnly + Math.max(0, (now - openIn) / 1000);
  })();

  if (!ready) return null;

  if (!staff) {
    return (
      <RegisterFlow
        onRegistered={(s) => {
          saveStaff(s);
          setStaff(s);
        }}
      />
    );
  }

  const clockedIn = !!openShift;

  return (
    <div className="app">
      <div className="header">
        <div className="brand">Osco Lounge</div>
        <div className="net-status">{staff.name}</div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>Today</div>
        <div className={`tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>Monthly</div>
      </div>

      {tab === 'today' ? (
        <TodayView
          now={now}
          clockedIn={clockedIn}
          todayShifts={todayShifts}
          todaySeconds={liveTodaySeconds}
          busy={busy}
          message={message}
          onConfirm={submitPunch}
        />
      ) : (
        <MonthlyView now={now} monthTotals={monthTotals} />
      )}

      {hasBypass && (
        <div className="helper-note" style={{ marginTop: 8 }}>
          This phone has a GPS bypass pass.
        </div>
      )}

      {showBypassForm && (
        <form className="bypass-form" onSubmit={redeemBypass}>
          <div className="mini-log-title">Device pass code</div>
          <p className="mgr-hint" style={{ padding: '0 24px' }}>
            Ask the manager for a one-time code for this broken-GPS phone.
          </p>
          <div style={{ padding: '0 24px' }}>
            <input
              value={bypassCode}
              onChange={(e) => setBypassCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              required
            />
            <button type="submit" disabled={bypassBusy || bypassCode.length < 6}>
              {bypassBusy ? '…' : 'Unlock this phone'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowBypassForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="footnote">
        Clock-ins only work at Osco Lounge (location check).
        {!hasBypass && (
          <>
            <br />
            <button type="button" className="text-btn" onClick={() => setShowBypassForm(true)}>
              Broken GPS? Enter device pass
            </button>
          </>
        )}
        <br />
        <Link href="/manager" style={{ color: 'var(--gray)' }}>Manager</Link>
      </div>
    </div>
  );
}

function RegisterFlow({ onRegistered }) {
  const [mode, setMode] = useState('register'); // register | restore
  const [step, setStep] = useState('form'); // form | code
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  function switchMode(next) {
    setMode(next);
    setStep('form');
    setCode('');
    setError('');
    setInfo('');
  }

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const endpoint = mode === 'restore' ? '/api/register/restore' : '/api/register/request';
      const body = mode === 'restore' ? { phone } : { name, phone };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        if (data.alreadyRegistered) {
          setError(data.message);
          setMode('restore');
        } else {
          setError(data.message || `Could not continue (${res.status}).`);
        }
      } else {
        setSavedPhone(data.phone);
        setInfo(data.message);
        setStep('code');
      }
    } catch {
      setError('Network error — try again.');
    }
    setBusy(false);
  }

  async function verifyCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const endpoint = mode === 'restore' ? '/api/register/restore-verify' : '/api/register/verify';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: savedPhone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setError(data.message || 'Invalid code.');
      } else {
        onRegistered(data.staff);
      }
    } catch {
      setError('Network error — try again.');
    }
    setBusy(false);
  }

  const subText =
    step === 'code'
      ? 'Ask the manager for the code from their panel, then enter it here.'
      : mode === 'restore'
        ? 'Enter the phone you registered with. The manager will get a code to open your account on this phone.'
        : 'New here? Register once with your name and phone. The manager will get a code in their panel.';

  return (
    <div className="app">
      <div className="name-gate">
        <div className="brand">Osco Lounge</div>
        <p className="gate-sub">{subText}</p>

        {step === 'form' && (
          <div className="mode-tabs">
            <button
              type="button"
              className={`mode-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              New register
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'restore' ? 'active' : ''}`}
              onClick={() => switchMode('restore')}
            >
              Already registered
            </button>
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={requestCode}>
            {mode === 'register' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            )}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              inputMode="tel"
              autoComplete="tel"
              required
            />
            {error && <div className="form-error">{error}</div>}
            <button type="submit" disabled={busy}>
              {busy ? 'Sending…' : mode === 'restore' ? 'Send restore code' : 'Send code to manager'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <div className="gate-phone">{savedPhone}</div>
            {info && <p className="gate-info">{info}</p>}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            {error && <div className="form-error">{error}</div>}
            <button type="submit" disabled={busy}>
              {busy ? 'Checking…' : mode === 'restore' ? 'Open my account' : 'Complete registration'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setStep('form'); setCode(''); setError(''); setInfo(''); }}
            >
              Back
            </button>
          </form>
        )}

        <Link href="/manager" className="manager-link">Manager login</Link>
      </div>
    </div>
  );
}

function TodayView({ now, clockedIn, todayShifts, todaySeconds, busy, message, onConfirm }) {
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const fullDate = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()].map(pad).join(':');

  return (
    <div className="view">
      <div className="date-block">
        <div className="weekday">{weekday}</div>
        <div className="full-date">{fullDate}</div>
      </div>
      <div className="clock">{timeStr}</div>
      <div className="status-text">
        You are <strong>{clockedIn ? 'clocked in' : 'clocked out'}</strong>
        {todaySeconds > 0 && <> · Today <strong>{formatDur(todaySeconds)}</strong></>}
      </div>

      <SlideButton clockedIn={clockedIn} busy={busy} onConfirm={onConfirm} />

      {message && <div className="helper-note" style={{ color: 'var(--red)' }}>{message}</div>}

      <div className="mini-log-title">Today&apos;s Shifts</div>
      {todayShifts.length === 0 ? (
        <div className="empty-note">No entries yet.</div>
      ) : (
        todayShifts.map((s) => {
          const inT = new Date(s.clock_in).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          const isOpen = !s.clock_out;
          const outT = isOpen
            ? 'now'
            : new Date(s.clock_out).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          const dur = isOpen
            ? (now - new Date(s.clock_in)) / 1000
            : (new Date(s.clock_out) - new Date(s.clock_in)) / 1000;
          return (
            <div className="mini-log-entry" key={s.id}>
              <span className="times">{inT} → {outT}</span>
              <span className="dur">{formatDur(Math.max(0, dur))}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function MonthlyView({ now, monthTotals }) {
  const currentMonth = now.getMonth();
  return (
    <div className="view">
      <div className="year-label">{now.getFullYear()}</div>
      {MONTH_NAMES.map((name, i) => {
        const isCurrent = i === currentMonth;
        const hasHours = monthTotals[i] > 0;
        return (
          <div className={`month-row ${isCurrent ? 'current' : ''}`} key={name}>
            <div className="month-name">{name}</div>
            <div className={`month-hours ${!hasHours ? 'empty' : ''}`}>
              {hasHours ? formatDur(monthTotals[i]) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlideButton({ clockedIn, busy, onConfirm }) {
  const trackRef = useRef(null);
  const knobRef = useRef(null);
  const fillRef = useRef(null);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  const busyRef = useRef(busy);
  const confirmingRef = useRef(false);

  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  function getMaxX() {
    if (!trackRef.current || !knobRef.current) return 0;
    return trackRef.current.offsetWidth - knobRef.current.offsetWidth - 8;
  }

  function setPos(delta) {
    if (!knobRef.current || !fillRef.current) return;
    knobRef.current.style.left = (4 + delta) + 'px';
    fillRef.current.style.width = (64 + delta) + 'px';
  }

  function resetPos(animate) {
    if (!knobRef.current || !fillRef.current) return;
    const t = animate ? '0.25s ease' : 'none';
    knobRef.current.style.transition = `left ${t}`;
    fillRef.current.style.transition = `width ${t}`;
    setPos(0);
  }

  function onDown(e) {
    if (busyRef.current || confirmingRef.current) return;
    draggingRef.current = true;
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
    maxX.current = getMaxX();
    if (knobRef.current) knobRef.current.style.transition = 'none';
    if (fillRef.current) fillRef.current.style.transition = 'none';
  }

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      let delta = x - startX.current;
      delta = Math.max(0, Math.min(delta, maxX.current));
      setPos(delta);
    }

    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (!knobRef.current || !fillRef.current) return;

      knobRef.current.style.transition = 'left 0.25s ease';
      fillRef.current.style.transition = 'width 0.25s ease';

      const currentLeft = parseFloat(knobRef.current.style.left || '4');
      const threshold = maxX.current * 0.82;

      if (currentLeft - 4 >= threshold) {
        if (confirmingRef.current || busyRef.current) {
          resetPos(true);
          return;
        }
        confirmingRef.current = true;
        setPos(maxX.current);
        setTimeout(() => {
          try {
            onConfirmRef.current();
          } finally {
            resetPos(false);
            setTimeout(() => {
              confirmingRef.current = false;
            }, 800);
            requestAnimationFrame(() => {
              if (knobRef.current) knobRef.current.style.transition = 'left 0.25s ease';
              if (fillRef.current) fillRef.current.style.transition = 'width 0.25s ease';
            });
          }
        }, 180);
      } else {
        resetPos(true);
      }
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <div className="slider-wrap">
      <div ref={trackRef} className={`slider-track ${clockedIn ? 'out' : ''} ${busy ? 'disabled' : ''}`}>
        <div ref={fillRef} className="slider-fill" />
        <div className="slider-label">{busy ? 'Recording…' : clockedIn ? 'Slide to clock out' : 'Slide to clock in'}</div>
        <div ref={knobRef} className="slider-knob" onMouseDown={onDown} onTouchStart={onDown}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CE1126" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
