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
  it('sets category to "restaurant" when missing', () => {
    const result = normalizePOI(makeFeature());
    expect(result.properties.category).toBe('restaurant');
  });

  it('migrates legacy "food" category to "restaurant"', () => {
    const result = normalizePOI(makeFeature({ category: 'food' }));
    expect(result.properties.category).toBe('restaurant');
  });

  it('sets status to "visited" when missing', () => {
    const result = normalizePOI(makeFeature());
    expect(result.properties.status).toBe('visited');
  });

  it('preserves existing category', () => {
    const result = normalizePOI(makeFeature({ category: 'cafe' }));
    expect(result.properties.category).toBe('cafe');
  });

  it('preserves existing status', () => {
    const result = normalizePOI(makeFeature({ status: 'wishlist' }));
    expect(result.properties.status).toBe('wishlist');
  });

  it('does not modify features that already have both fields', () => {
    const result = normalizePOI(makeFeature({ category: 'bar', status: 'wishlist' }));
    expect(result.properties.category).toBe('bar');
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

  it('backfills visits from last_visited when visits is missing', () => {
    const result = normalizePOI(makeFeature({ last_visited: '2026-01-05T10:00:00.000Z' }));
    expect(result.properties.visits).toEqual(['2026-01-05T10:00:00.000Z']);
  });

  it('falls back to visited_date when last_visited is absent', () => {
    const result = normalizePOI(makeFeature({ visited_date: '2026-01-05' }));
    expect(result.properties.visits).toEqual(['2026-01-05']);
  });

  it('backfills an empty array when no visit timestamp exists at all', () => {
    const result = normalizePOI(makeFeature());
    expect(result.properties.visits).toEqual([]);
  });

  it('leaves an existing visits array untouched', () => {
    const existing = ['2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z'];
    const result = normalizePOI(makeFeature({ visits: existing, last_visited: '2026-01-05T10:00:00.000Z' }));
    expect(result.properties.visits).toBe(existing);
  });
});
