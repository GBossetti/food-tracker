import { describe, it, expect, beforeEach } from 'vitest';
import { GamificationEngine } from './gamification';
import { GeoJSONFeature } from '../core/types';

let counter = 0;
function makeFeature(overrides: Partial<GeoJSONFeature['properties']> = {}): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: {
      id: `p-${counter++}`,
      name: 'Test Place',
      category: 'restaurant',
      status: 'visited',
      ...overrides,
    },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
  };
}

function badgeEarned(features: GeoJSONFeature[], id: string): boolean {
  const data = new GamificationEngine(features).calculateAll();
  return !!data.badges.find(b => b.id === id)?.earned;
}

describe('GamificationEngine — 50 Visits badge (visit_count ?? 0)', () => {
  // Badges are persisted+merged in localStorage; isolate each test.
  beforeEach(() => localStorage.clear());

  it('awards the 50 Visits badge from real recorded visit counts', () => {
    expect(badgeEarned([makeFeature({ status: 'visited', visit_count: 50 })], '50-visits')).toBe(true);
  });

  it('does not award 50 Visits for 50 visited places that have no recorded visits', () => {
    // Under the old `|| 1`, 50 visited places each counted as 1 visit = 50 -> wrongly earned.
    const features = Array.from({ length: 50 }, () => makeFeature({ status: 'visited' }));
    expect(badgeEarned(features, '50-visits')).toBe(false);
  });

  it('ignores wishlist places when totalling visits', () => {
    const features = [
      makeFeature({ status: 'visited', visit_count: 49 }),
      ...Array.from({ length: 10 }, () => makeFeature({ status: 'wishlist', visit_count: 0 })),
    ];
    expect(badgeEarned(features, '50-visits')).toBe(false); // 49 < 50
  });
});

function isoWeeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString();
}

describe('GamificationEngine — streak badges', () => {
  beforeEach(() => localStorage.clear());

  it('awards the 4-week-streak badge once the longest run reaches 4 weeks', () => {
    const visits = [isoWeeksAgo(0), isoWeeksAgo(1), isoWeeksAgo(2), isoWeeksAgo(3)];
    expect(badgeEarned([makeFeature({ visits })], '4-week-streak')).toBe(true);
  });

  it('does not award 4-week-streak for 3 consecutive weeks', () => {
    const visits = [isoWeeksAgo(0), isoWeeksAgo(1), isoWeeksAgo(2)];
    expect(badgeEarned([makeFeature({ visits })], '4-week-streak')).toBe(false);
  });

  it('awards 4-week-streak off the longest historical run, not just the current one', () => {
    // A 4-week run far in the past, then a gap — current streak is broken but longest isn't.
    const visits = [isoWeeksAgo(20), isoWeeksAgo(21), isoWeeksAgo(22), isoWeeksAgo(23)];
    expect(badgeEarned([makeFeature({ visits })], '4-week-streak')).toBe(true);
  });

  it('awards the 12-week-streak badge at 12 consecutive weeks', () => {
    const visits = Array.from({ length: 12 }, (_, i) => isoWeeksAgo(i));
    expect(badgeEarned([makeFeature({ visits })], '12-week-streak')).toBe(true);
  });
});

describe('GamificationEngine — newlyEarned', () => {
  beforeEach(() => localStorage.clear());

  it('lists a badge the first time it is earned', () => {
    const data = new GamificationEngine([makeFeature({ status: 'visited' })]).calculateAll();
    expect(data.newlyEarned).toContain('first-save');
  });

  it('does not list the same badge again on a later call', () => {
    const features = [makeFeature({ status: 'visited' })];
    new GamificationEngine(features).calculateAll();
    const second = new GamificationEngine(features).calculateAll();
    expect(second.newlyEarned).not.toContain('first-save');
  });

  it('is empty when no places exist yet', () => {
    const data = new GamificationEngine([]).calculateAll();
    expect(data.newlyEarned).toEqual([]);
  });
});
