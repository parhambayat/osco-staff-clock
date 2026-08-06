import {
  cafeDateKey,
  cafeCalendarDateKey,
  cafeMonthIndex,
  cafeYear,
  nextAutoClockOutMs,
  isOpenShiftOverdue,
  overdueClockOutIso,
  shiftDateKey,
} from '../lib/time.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Tuesday 2026-08-04 00:30 Muscat (+04) → still Monday business day
const beforeOne = new Date('2026-08-03T20:30:00.000Z'); // 00:30 Tue Muscat
assert(cafeCalendarDateKey(beforeOne) === '2026-08-04', 'calendar should be Tue');
assert(cafeDateKey(beforeOne) === '2026-08-03', 'business day before 01:00 is previous');
assert(cafeMonthIndex(beforeOne) === 7, 'Aug month');
assert(cafeYear(beforeOne) === 2026, 'year');

// Tuesday 01:00 Muscat → Tuesday business day
const atOne = new Date('2026-08-03T21:00:00.000Z');
assert(cafeDateKey(atOne) === '2026-08-04', '01:00 starts new business day');

// Monday 18:00 clock-in → auto out Tuesday 00:40
const monEve = new Date('2026-08-03T14:00:00.000Z'); // 18:00 Mon
const autoMs = nextAutoClockOutMs(monEve);
assert(
  new Date(autoMs).toISOString() === new Date('2026-08-03T20:40:00.000Z').toISOString(),
  `auto out should be Tue 00:40 Muscat, got ${new Date(autoMs).toISOString()}`
);
assert(!isOpenShiftOverdue(monEve, new Date('2026-08-03T20:39:00.000Z')), 'not overdue at 00:39');
assert(isOpenShiftOverdue(monEve, new Date('2026-08-03T20:40:00.000Z')), 'overdue at 00:40');
assert(
  overdueClockOutIso(monEve) === '2026-08-03T20:40:00.000Z',
  'overdue iso'
);

// Clock-in at 00:20 → same morning 00:40
const late = new Date('2026-08-03T20:20:00.000Z');
assert(
  nextAutoClockOutMs(late) === new Date('2026-08-03T20:40:00.000Z').getTime(),
  '00:20 in → 00:40 out same night'
);

// Clock-in at 00:50 → next day 00:40
const afterAuto = new Date('2026-08-03T20:50:00.000Z');
assert(
  nextAutoClockOutMs(afterAuto) === new Date('2026-08-04T20:40:00.000Z').getTime(),
  '00:50 in → next 00:40'
);

assert(shiftDateKey('2026-03-01', -1) === '2026-02-28', 'month borrow');
assert(shiftDateKey('2026-01-01', -1) === '2025-12-31', 'year borrow');

console.log('time helpers OK');
