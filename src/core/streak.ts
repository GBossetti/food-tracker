/**
 * Weekly visit-streak math. Pure — takes timestamps and "now" as arguments,
 * never reads the clock or the DOM itself (mirrors sheet-snap.ts).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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

export function computeWeeklyStreak(isoDates: string[], now: Date): StreakData {
  if (isoDates.length === 0) {
    return { current: 0, longest: 0, activeWeeks: 0, lastActive: null };
  }

  const weekEpochs = new Set<number>();
  let lastActive = isoDates[0];
  for (const iso of isoDates) {
    weekEpochs.add(weekStart(parseLocal(iso)).getTime());
    if (parseLocal(iso).getTime() > parseLocal(lastActive).getTime()) lastActive = iso;
  }

  const sorted = [...weekEpochs].sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === WEEK_MS) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  // Current streak: walk back from "this week", allowing one empty week
  // (the grace period) before the streak is considered broken.
  const thisWeek = weekStart(now).getTime();
  const weekSet = weekEpochs;
  let current = 0;
  let cursor = thisWeek;
  if (!weekSet.has(cursor)) {
    cursor -= WEEK_MS; // grace: try last week instead
    if (!weekSet.has(cursor)) {
      return { current: 0, longest, activeWeeks: sorted.length, lastActive };
    }
  }
  while (weekSet.has(cursor)) {
    current++;
    cursor -= WEEK_MS;
  }

  return { current, longest, activeWeeks: sorted.length, lastActive };
}
