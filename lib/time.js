/** Café timezone: Oman / UAE (UTC+4, no DST). */
export const CAFE_TZ = 'Asia/Muscat';

/** Business day rolls at 01:00 café time (not midnight). */
export const BUSINESS_DAY_START_HOUR = 1;

/** Forgotten open shifts auto-close at 00:40 café time. */
export const AUTO_CLOCK_OUT_HOUR = 0;
export const AUTO_CLOCK_OUT_MINUTE = 40;

function cafeParts(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAFE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function ymd(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Calendar YYYY-MM-DD in café TZ (ignores business-day rollover). */
export function cafeCalendarDateKey(input = new Date()) {
  const p = cafeParts(input);
  return ymd(p.year, p.month, p.day);
}

/**
 * Shift one calendar Y-M-D by `deltaDays` using UTC noon math (safe across months).
 */
export function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Business date YYYY-MM-DD in café TZ.
 * Times before 01:00 belong to the previous calendar day
 * (night shift out at 00:40 still counts for the clock-in day).
 */
export function cafeDateKey(input = new Date()) {
  const p = cafeParts(input);
  let key = ymd(p.year, p.month, p.day);
  if (p.hour < BUSINESS_DAY_START_HOUR) {
    key = shiftDateKey(key, -1);
  }
  return key;
}

/** Month index 0-11 for the business date in café TZ */
export function cafeMonthIndex(input = new Date()) {
  const key = cafeDateKey(input);
  return Number(key.slice(5, 7)) - 1;
}

/** Full year for the business date in café TZ */
export function cafeYear(input = new Date()) {
  return Number(cafeDateKey(input).slice(0, 4));
}

/** Instant for a café-local wall time on a calendar date key. */
export function cafeWallTimeMs(dateKey, hour, minute = 0, second = 0) {
  return new Date(
    `${dateKey}T${pad(hour)}:${pad(minute)}:${pad(second)}+04:00`
  ).getTime();
}

/**
 * Next auto clock-out instant (00:40 café) strictly after `clockIn`.
 * Used to close forgotten overnight opens without cutting into the next shift.
 */
export function nextAutoClockOutMs(clockIn) {
  const inMs = (clockIn instanceof Date ? clockIn : new Date(clockIn)).getTime();
  const cal = cafeCalendarDateKey(inMs);
  let candidate = cafeWallTimeMs(cal, AUTO_CLOCK_OUT_HOUR, AUTO_CLOCK_OUT_MINUTE);
  if (candidate <= inMs) {
    candidate = cafeWallTimeMs(shiftDateKey(cal, 1), AUTO_CLOCK_OUT_HOUR, AUTO_CLOCK_OUT_MINUTE);
  }
  return candidate;
}

/** True when an open shift should already have been auto-closed. */
export function isOpenShiftOverdue(clockIn, now = new Date()) {
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  return nowMs >= nextAutoClockOutMs(clockIn);
}

export function overdueClockOutIso(clockIn) {
  return new Date(nextAutoClockOutMs(clockIn)).toISOString();
}
