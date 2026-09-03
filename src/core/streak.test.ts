import { describe, it, expect } from 'vitest';
import { computeWeeklyStreak, weekStart } from './streak';

// Wednesday, so "this week" runs Mon 2026-08-31 .. Sun 2026-09-06.
const NOW = new Date('2026-09-02T10:00:00');

function isoWeeksAgo(n: number, dayOffset = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n * 7 + dayOffset);
  return d.toISOString();
}

describe('weekStart', () => {
  it('returns the Monday for a mid-week date', () => {
    expect(weekStart(new Date('2026-09-02T10:00:00')).getDay()).toBe(1);
  });

  it('returns the same date when given a Monday', () => {
    const monday = new Date('2026-08-31T00:00:00');
    expect(weekStart(monday).getTime()).toBe(weekStart(monday).getTime());
    expect(weekStart(monday).getDate()).toBe(31);
  });

  it('rolls a Sunday back to the preceding Monday', () => {
    const sunday = new Date('2026-09-06T23:00:00');
    expect(weekStart(sunday).getDate()).toBe(31);
  });
});

describe('computeWeeklyStreak', () => {
  it('returns all zeros / null for no visits', () => {
    expect(computeWeeklyStreak([], NOW)).toEqual({
      current: 0,
      longest: 0,
      activeWeeks: 0,
      lastActive: null,
    });
  });

  it('counts a single visit as a 1-week streak', () => {
    const data = computeWeeklyStreak([isoWeeksAgo(0)], NOW);
    expect(data.current).toBe(1);
    expect(data.longest).toBe(1);
    expect(data.activeWeeks).toBe(1);
  });

  it('collapses multiple visits in the same week to one active week', () => {
    const data = computeWeeklyStreak([isoWeeksAgo(0, 0), isoWeeksAgo(0, 1), isoWeeksAgo(0, 2)], NOW);
    expect(data.activeWeeks).toBe(1);
    expect(data.current).toBe(1);
  });

  it('counts consecutive weeks as a growing streak', () => {
    const data = computeWeeklyStreak([isoWeeksAgo(0), isoWeeksAgo(1), isoWeeksAgo(2)], NOW);
    expect(data.current).toBe(3);
    expect(data.longest).toBe(3);
  });

  it('keeps the streak alive with a one-week grace period', () => {
    // No visit this week yet, but last week and the week before both have one.
    const data = computeWeeklyStreak([isoWeeksAgo(1), isoWeeksAgo(2)], NOW);
    expect(data.current).toBe(2);
  });

  it('breaks the streak after a two-week gap', () => {
    const data = computeWeeklyStreak([isoWeeksAgo(2), isoWeeksAgo(3)], NOW);
    expect(data.current).toBe(0);
  });

  it('reports longest separately from a broken current streak', () => {
    // Weeks -5,-4,-3 in a row (longest=3), then nothing until -0 (current).
    const data = computeWeeklyStreak(
      [isoWeeksAgo(5), isoWeeksAgo(4), isoWeeksAgo(3), isoWeeksAgo(0)],
      NOW
    );
    expect(data.longest).toBe(3);
    expect(data.current).toBe(1);
  });

  it('finds the longest run across a year boundary', () => {
    const dates = [
      '2025-12-15T10:00:00Z',
      '2025-12-22T10:00:00Z',
      '2025-12-29T10:00:00Z',
      '2026-01-05T10:00:00Z',
    ];
    const data = computeWeeklyStreak(dates, new Date('2026-01-06T10:00:00'));
    expect(data.longest).toBe(4);
  });

  it('parses a date-only string (YYYY-MM-DD) as local time', () => {
    // A date-only visited_date backfill; should land in the same local week
    // as an ISO timestamp for the same calendar day, not shift a day via UTC.
    const iso = computeWeeklyStreak(['2026-09-02T23:30:00'], NOW);
    const dateOnly = computeWeeklyStreak(['2026-09-02'], NOW);
    expect(dateOnly.activeWeeks).toBe(iso.activeWeeks);
    expect(dateOnly.current).toBe(iso.current);
  });

  it('tracks lastActive as the most recent timestamp regardless of input order', () => {
    const data = computeWeeklyStreak([isoWeeksAgo(2), isoWeeksAgo(0), isoWeeksAgo(1)], NOW);
    expect(data.lastActive).toBe(isoWeeksAgo(0));
  });
});
