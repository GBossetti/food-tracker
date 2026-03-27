import { describe, it, expect } from 'vitest';
import { normalizePOI } from './storage';
import { GeoJSONFeature } from '../core/types';

function makeFeature(overrides: Partial<GeoJSONFeature['properties']> = {}): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: { id: 'test-1', name: 'Test Place', ...overrides },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
  };
}

describe('normalizePOI', () => {
  it('sets category to "food" when missing', () => {
    const result = normalizePOI(makeFeature());
    expect(result.properties.category).toBe('food');
  });

  it('sets status to "visited" when missing', () => {
    const result = normalizePOI(makeFeature());
    expect(result.properties.status).toBe('visited');
  });

  it('preserves existing category', () => {
    const result = normalizePOI(makeFeature({ category: 'culture' }));
    expect(result.properties.category).toBe('culture');
  });

  it('preserves existing status', () => {
    const result = normalizePOI(makeFeature({ status: 'wishlist' }));
    expect(result.properties.status).toBe('wishlist');
  });

  it('does not modify features that already have both fields', () => {
    const result = normalizePOI(makeFeature({ category: 'entertainment', status: 'wishlist' }));
    expect(result.properties.category).toBe('entertainment');
    expect(result.properties.status).toBe('wishlist');
  });

  it('returns the same feature reference', () => {
    const feature = makeFeature();
    const result = normalizePOI(feature);
    expect(result).toBe(feature);
  });

  it('preserves all other properties', () => {
    const feature = makeFeature({ name: 'Casa Lucio', tags: ['tapas'], rating: 4.5 });
    const result = normalizePOI(feature);
    expect(result.properties.name).toBe('Casa Lucio');
    expect(result.properties.tags).toEqual(['tapas']);
    expect(result.properties.rating).toBe(4.5);
  });
});
