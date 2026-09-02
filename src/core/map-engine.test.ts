import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GeoJSONFeature } from './types';

const addMarker = vi.fn();
const removeMarker = vi.fn();
const clearMarkers = vi.fn();
const onMapClick = vi.fn();
const fitBounds = vi.fn();
const centerWithOffset = vi.fn();

vi.mock('./adapters/leaflet-adapter', () => ({
  LeafletAdapter: vi.fn().mockImplementation(function (this: any) {
    this.addMarker = addMarker;
    this.removeMarker = removeMarker;
    this.clearMarkers = clearMarkers;
    this.onMapClick = onMapClick;
    this.fitBounds = fitBounds;
    this.centerWithOffset = centerWithOffset;
    this.getMap = vi.fn();
  }),
}));

function makeFeature(id: string, overrides: Partial<GeoJSONFeature['properties']> = {}): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: { id, name: id, category: 'restaurant', status: 'visited', ...overrides },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
  };
}

describe('MapEngine — showFeatures diffing', () => {
  beforeEach(() => {
    addMarker.mockClear();
    removeMarker.mockClear();
    clearMarkers.mockClear();
    fitBounds.mockClear();
    centerWithOffset.mockClear();
    addMarker.mockReturnValue({ on: vi.fn() });
  });

  async function makeEngine() {
    const { MapEngine } = await import('./map-engine');
    return new MapEngine({ containerId: 'map' });
  }

  it('renders a marker for every feature that matches on first call', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a'), false);
    engine.addFeature(makeFeature('b'), false);
    addMarker.mockClear();

    engine.showFeatures(() => true);

    expect(addMarker).not.toHaveBeenCalled(); // already shown via addFeature
    expect(removeMarker).not.toHaveBeenCalled();
  });

  it('does not touch markers whose match state is unchanged', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a'), false);
    engine.addFeature(makeFeature('b'), false);

    engine.showFeatures(() => true);
    addMarker.mockClear();
    removeMarker.mockClear();

    engine.showFeatures(() => true);

    expect(addMarker).not.toHaveBeenCalled();
    expect(removeMarker).not.toHaveBeenCalled();
  });

  it('removes only markers that stop matching', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a', { name: 'Alpha' }), false);
    engine.addFeature(makeFeature('b', { name: 'Beta' }), false);
    engine.showFeatures(() => true);
    addMarker.mockClear();
    removeMarker.mockClear();

    engine.showFeatures((f) => f.properties.name === 'Alpha');

    expect(removeMarker).toHaveBeenCalledExactlyOnceWith('b');
    expect(addMarker).not.toHaveBeenCalled();
  });

  it('re-adds only markers that newly match, without duplicating', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a', { name: 'Alpha' }), false);
    engine.addFeature(makeFeature('b', { name: 'Beta' }), false);
    engine.showFeatures((f) => f.properties.name === 'Alpha');
    addMarker.mockClear();
    removeMarker.mockClear();

    engine.showFeatures(() => true);

    expect(addMarker).toHaveBeenCalledOnce();
    expect(removeMarker).not.toHaveBeenCalled();
  });

  it('never calls clearMarkers (full rebuild) from showFeatures', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a'), false);
    clearMarkers.mockClear();

    engine.showFeatures(() => true);
    engine.showFeatures(() => false);
    engine.showFeatures(() => true);

    expect(clearMarkers).not.toHaveBeenCalled();
  });

  it('load() renders every feature once with no duplicate markers on a following showFeatures', async () => {
    const engine = await makeEngine();
    const data = {
      type: 'FeatureCollection' as const,
      features: [makeFeature('a'), makeFeature('b'), makeFeature('c')],
    };
    engine.load(data);
    addMarker.mockClear();

    engine.showFeatures(() => true);

    expect(addMarker).not.toHaveBeenCalled();
  });

  it('removeFeature drops the id so a later matching showFeatures does not try to remove it again', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a'), false);
    engine.showFeatures(() => true);
    removeMarker.mockClear();

    engine.removeFeature('a');
    removeMarker.mockClear();
    engine.showFeatures(() => true);

    expect(removeMarker).not.toHaveBeenCalled();
  });

  it('clear() resets shown-id tracking so a fresh load does not think markers already exist', async () => {
    const engine = await makeEngine();
    engine.addFeature(makeFeature('a'), false);
    engine.showFeatures(() => true);

    engine.clear();
    addMarker.mockClear();
    engine.addFeature(makeFeature('a'), false);
    engine.showFeatures(() => true);

    expect(addMarker).toHaveBeenCalledOnce();
  });
});

describe('MapEngine — focusOn (search follows the map)', () => {
  beforeEach(() => {
    fitBounds.mockClear();
    centerWithOffset.mockClear();
    addMarker.mockReturnValue({ on: vi.fn() });
  });

  async function makeEngine() {
    const { MapEngine } = await import('./map-engine');
    return new MapEngine({ containerId: 'map' });
  }

  it('does nothing on zero matches', async () => {
    const engine = await makeEngine();
    engine.focusOn([], 100, true);

    expect(centerWithOffset).not.toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('centers with offset on a single match, at a fixed close zoom', async () => {
    const engine = await makeEngine();
    const feature = makeFeature('a');
    engine.focusOn([feature], 120, false);

    expect(centerWithOffset).toHaveBeenCalledExactlyOnceWith(40.4, -3.7, 16, 120, false);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('fits bounds (passing the offset through as bottom padding) on several matches', async () => {
    const engine = await makeEngine();
    engine.focusOn([makeFeature('a'), makeFeature('b')], 120, true);

    expect(fitBounds).toHaveBeenCalledExactlyOnceWith(120);
    expect(centerWithOffset).not.toHaveBeenCalled();
  });
});
