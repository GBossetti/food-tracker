import { describe, it, expect } from 'vitest';
import { matchesFilters, FilterOptions } from './poi-filters';
import { GeoJSONFeature } from './types';

function makeFeature(overrides: Partial<GeoJSONFeature['properties']> = {}): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: {
      id: 'test-1',
      name: 'Test Place',
      category: 'restaurant',
      status: 'visited',
      tags: ['tapas', 'local'],
      comments: 'Great spot',
      ...overrides,
    },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
  };
}

const baseOptions: FilterOptions = {
  category: 'all',
  status: 'all',
  selectedTags: new Set(),
  searchTerm: '',
};

describe('matchesFilters — category', () => {
  it('passes when category is "all"', () => {
    expect(matchesFilters(makeFeature({ category: 'restaurant' }), { ...baseOptions, category: 'all' })).toBe(true);
    expect(matchesFilters(makeFeature({ category: 'cafe' }), { ...baseOptions, category: 'all' })).toBe(true);
  });

  it('passes when category matches', () => {
    expect(matchesFilters(makeFeature({ category: 'restaurant' }), { ...baseOptions, category: 'restaurant' })).toBe(true);
    expect(matchesFilters(makeFeature({ category: 'bar' }), { ...baseOptions, category: 'bar' })).toBe(true);
  });

  it('fails when category does not match', () => {
    expect(matchesFilters(makeFeature({ category: 'restaurant' }), { ...baseOptions, category: 'cafe' })).toBe(false);
    expect(matchesFilters(makeFeature({ category: 'bakery' }), { ...baseOptions, category: 'market' })).toBe(false);
  });

  it('defaults missing category to "restaurant"', () => {
    const feature = makeFeature();
    delete feature.properties.category;
    expect(matchesFilters(feature, { ...baseOptions, category: 'restaurant' })).toBe(true);
    expect(matchesFilters(feature, { ...baseOptions, category: 'cafe' })).toBe(false);
  });
});

describe('matchesFilters — status', () => {
  it('passes when status is "all"', () => {
    expect(matchesFilters(makeFeature({ status: 'visited' }), { ...baseOptions, status: 'all' })).toBe(true);
    expect(matchesFilters(makeFeature({ status: 'wishlist' }), { ...baseOptions, status: 'all' })).toBe(true);
  });

  it('passes when status matches', () => {
    expect(matchesFilters(makeFeature({ status: 'visited' }), { ...baseOptions, status: 'visited' })).toBe(true);
    expect(matchesFilters(makeFeature({ status: 'wishlist' }), { ...baseOptions, status: 'wishlist' })).toBe(true);
  });

  it('fails when status does not match', () => {
    expect(matchesFilters(makeFeature({ status: 'visited' }), { ...baseOptions, status: 'wishlist' })).toBe(false);
    expect(matchesFilters(makeFeature({ status: 'wishlist' }), { ...baseOptions, status: 'visited' })).toBe(false);
  });

  it('defaults missing status to "visited"', () => {
    const feature = makeFeature();
    delete feature.properties.status;
    expect(matchesFilters(feature, { ...baseOptions, status: 'visited' })).toBe(true);
    expect(matchesFilters(feature, { ...baseOptions, status: 'wishlist' })).toBe(false);
  });
});

describe('matchesFilters — tags', () => {
  it('passes when no tags are selected', () => {
    expect(matchesFilters(makeFeature(), { ...baseOptions, selectedTags: new Set() })).toBe(true);
  });

  it('passes when feature has at least one selected tag', () => {
    expect(matchesFilters(makeFeature({ tags: ['tapas', 'local'] }), { ...baseOptions, selectedTags: new Set(['tapas']) })).toBe(true);
    expect(matchesFilters(makeFeature({ tags: ['tapas', 'local'] }), { ...baseOptions, selectedTags: new Set(['local', 'fancy']) })).toBe(true);
  });

  it('fails when feature has none of the selected tags', () => {
    expect(matchesFilters(makeFeature({ tags: ['tapas'] }), { ...baseOptions, selectedTags: new Set(['fancy']) })).toBe(false);
    expect(matchesFilters(makeFeature({ tags: [] }), { ...baseOptions, selectedTags: new Set(['tapas']) })).toBe(false);
  });

  it('passes for a feature with no tags when no tags are selected', () => {
    expect(matchesFilters(makeFeature({ tags: [] }), baseOptions)).toBe(true);
  });
});

describe('matchesFilters — search', () => {
  it('passes when searchTerm is empty', () => {
    expect(matchesFilters(makeFeature(), { ...baseOptions, searchTerm: '' })).toBe(true);
  });

  it('matches by name (case-insensitive)', () => {
    expect(matchesFilters(makeFeature({ name: 'Casa Lucio' }), { ...baseOptions, searchTerm: 'casa' })).toBe(true);
    expect(matchesFilters(makeFeature({ name: 'Casa Lucio' }), { ...baseOptions, searchTerm: 'LUCIO' })).toBe(true);
  });

  it('matches by comments', () => {
    expect(matchesFilters(makeFeature({ comments: 'Amazing huevos rotos' }), { ...baseOptions, searchTerm: 'huevos' })).toBe(true);
  });

  it('matches by tag', () => {
    expect(matchesFilters(makeFeature({ tags: ['tapas', 'cheap'] }), { ...baseOptions, searchTerm: 'tapas' })).toBe(true);
  });

  it('fails when searchTerm matches nothing', () => {
    expect(matchesFilters(makeFeature({ name: 'Casa Lucio', comments: '', tags: [] }), { ...baseOptions, searchTerm: 'sushi' })).toBe(false);
  });
});

describe('matchesFilters — accent-insensitive search', () => {
  it('an unaccented term matches an accented name', () => {
    expect(matchesFilters(makeFeature({ name: 'Café Central', comments: '', tags: [] }), { ...baseOptions, searchTerm: 'cafe' })).toBe(true);
  });

  it('an accented term matches an unaccented name', () => {
    expect(matchesFilters(makeFeature({ name: 'Cafe Central', comments: '', tags: [] }), { ...baseOptions, searchTerm: 'café' })).toBe(true);
  });

  it('matches accented tags', () => {
    expect(matchesFilters(makeFeature({ name: 'Ramen X', comments: '', tags: ['Japón'] }), { ...baseOptions, searchTerm: 'japon' })).toBe(true);
  });
});

describe('matchesFilters — combined filters', () => {
  it('all filters must pass simultaneously', () => {
    const feature = makeFeature({ category: 'restaurant', status: 'visited', tags: ['tapas'], name: 'Bar X' });

    expect(matchesFilters(feature, {
      category: 'restaurant', status: 'visited', selectedTags: new Set(['tapas']), searchTerm: 'bar',
    })).toBe(true);

    expect(matchesFilters(feature, {
      category: 'cafe', status: 'visited', selectedTags: new Set(['tapas']), searchTerm: 'bar',
    })).toBe(false);

    expect(matchesFilters(feature, {
      category: 'restaurant', status: 'wishlist', selectedTags: new Set(['tapas']), searchTerm: 'bar',
    })).toBe(false);

    expect(matchesFilters(feature, {
      category: 'restaurant', status: 'visited', selectedTags: new Set(['fancy']), searchTerm: 'bar',
    })).toBe(false);

    expect(matchesFilters(feature, {
      category: 'restaurant', status: 'visited', selectedTags: new Set(['tapas']), searchTerm: 'museum',
    })).toBe(false);
  });
});
