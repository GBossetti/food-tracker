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
