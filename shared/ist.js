/**
 * Asia/Kolkata (IST, UTC+05:30, no daylight saving) helpers, used to stamp the lead email with the time it was received.
 * Works identically in browsers and Node, using only Intl.
 */
export const TIMEZONE = 'Asia/Kolkata';
export const TIMEZONE_LABEL = 'Asia/Kolkata (IST, UTC+05:30)';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Returns today's calendar date and minutes-since-midnight in IST for the given instant. */
export function getIstNow(now = new Date()) {
  const p = Object.fromEntries(partsFormatter.formatToParts(now).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Minutes since midnight (870) -> "2:30 PM". */
export function formatTime12(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Submission timestamp for emails, e.g. "Thursday, 15 October 2026, 2:21 PM IST". */
export function formatIstTimestamp(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const { minutes } = getIstNow(now);
  return `${date}, ${formatTime12(minutes)} IST`;
}
