/** Café timezone: Oman / UAE (UTC+4, no DST). */
export const CAFE_TZ = 'Asia/Muscat';

/** Local calendar date YYYY-MM-DD in café TZ */
export function cafeDateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAFE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Month index 0-11 in café TZ */
export function cafeMonthIndex(input = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAFE_TZ,
    month: 'numeric',
  }).formatToParts(input instanceof Date ? input : new Date(input));
  return Number(parts.find((p) => p.type === 'month').value) - 1;
}

/** Full year in café TZ */
export function cafeYear(input = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAFE_TZ,
    year: 'numeric',
  }).formatToParts(input instanceof Date ? input : new Date(input));
  return Number(parts.find((p) => p.type === 'year').value);
}
