/**
 * Weekly visit-streak math. Pure — takes timestamps and "now" as arguments,
 * never reads the clock or the DOM itself (mirrors sheet-snap.ts).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StreakData {
  current: number; // consecutive weeks, one-week grace period applied
  longest: number;
  activeWeeks: number; // distinct weeks with any recorded visit
  lastActive: string | null; // ISO date of the most recent visit
}

/** Monday 00:00 local time for the week containing `d`. */
export function weekStart(d: Date): Date {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = local.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  local.setDate(local.getDate() - diffToMonday);
  return local;
}

/** Parses an ISO datetime or a date-only (YYYY-MM-DD) string as local time. */
function parseLocal(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

/** Days since the UTC epoch for a date's Y/M/D, ignoring time-of-day and the
 * local clock's own DST offset — so "7 days apart" always means exactly a
 * calendar week, even across a spring-forward/fall-back transition. */
function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function computeWeeklyStreak(isoDates: string[], now: Date): StreakData {
  if (isoDates.length === 0) {
    return { current: 0, longest: 0, activeWeeks: 0, lastActive: null };
  }

  const weekDays = new Set<number>();
  let lastActive = isoDates[0];
  for (const iso of isoDates) {
    weekDays.add(dayNumber(weekStart(parseLocal(iso))));
    if (parseLocal(iso).getTime() > parseLocal(lastActive).getTime()) lastActive = iso;
  }

  const sorted = [...weekDays].sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 7) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  // Current streak: walk back from "this week", allowing one empty week
  // (the grace period) before the streak is considered broken.
  const thisWeek = dayNumber(weekStart(now));
  let current = 0;
  let cursor = thisWeek;
  if (!weekDays.has(cursor)) {
    cursor -= 7; // grace: try last week instead
    if (!weekDays.has(cursor)) {
      return { current: 0, longest, activeWeeks: sorted.length, lastActive };
    }
  }
  while (weekDays.has(cursor)) {
    current++;
    cursor -= 7;
  }

  return { current, longest, activeWeeks: sorted.length, lastActive };
}
