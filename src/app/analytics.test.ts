import { describe, it, expect } from 'vitest';
import { AnalyticsEngine } from './analytics';
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

describe('AnalyticsEngine — visit counting (visit_count ?? 0)', () => {
  it('counts an unvisited place as 0 visits, not 1', () => {
    const data = new AnalyticsEngine([
      makeFeature({ status: 'wishlist', visit_count: 0 }),
    ]).calculateAll();
    expect(data.overview.totalVisits).toBe(0);
  });

  it('sums real visit counts and ignores missing/zero counts', () => {
    const data = new AnalyticsEngine([
      makeFeature({ status: 'visited', visit_count: 3 }),
      makeFeature({ status: 'wishlist', visit_count: 0 }),
      makeFeature({ status: 'visited' }), // undefined visit_count -> 0
    ]).calculateAll();
    // Old `|| 1` would have produced 3 + 1 + 1 = 5.
    expect(data.overview.totalVisits).toBe(3);
  });

  it('does not inflate averageVisitsPerPlace for unvisited places', () => {
    const data = new AnalyticsEngine([
      makeFeature({ visit_count: 4 }),
      makeFeature({ status: 'wishlist', visit_count: 0 }),
    ]).calculateAll();
    // total 4 over 2 places = 2, not the old (4 + 1) / 2 = 2.5
    expect(data.insights.averageVisitsPerPlace).toBe(2);
  });

  it('reports no most-visited place when nothing has been visited', () => {
    const data = new AnalyticsEngine([
      makeFeature({ status: 'wishlist', visit_count: 0 }),
      makeFeature({ status: 'wishlist', visit_count: 0 }),
    ]).calculateAll();
    expect(data.overview.totalVisits).toBe(0);
    expect(data.overview.mostVisitedPlace).toBeNull();
  });
});
