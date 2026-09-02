import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CATEGORY_CONFIG } from '../types';
import { GeoJSONFeature } from '../types';

// Mock Leaflet before importing the adapter
const mockMarkerInstance = { on: vi.fn(), addTo: vi.fn().mockReturnThis() };
const mockMarker = vi.fn().mockReturnValue(mockMarkerInstance);
const mockDivIcon = vi.fn().mockReturnValue({});

const mockSetView = vi.fn().mockReturnThis(); // chainable: L.map(id).setView(...) in the constructor
const mockProject = vi.fn().mockReturnValue({ x: 100, y: 200, add: (d: [number, number]) => ({ x: 100 + d[0], y: 200 + d[1] }) });
const mockUnproject = vi.fn().mockReturnValue({ lat: 41, lng: -3.6 });
const mockGetZoom = vi.fn().mockReturnValue(13);
const mockMapFitBounds = vi.fn();
const mockGetGroupBounds = vi.fn().mockReturnValue({ isValid: () => true });
const mockFeatureGroup = vi.fn(function (this: any) {
  this.getBounds = mockGetGroupBounds;
});

vi.mock('leaflet', () => ({
  default: {
    marker: mockMarker,
    divIcon: mockDivIcon,
    layerGroup: vi.fn().mockReturnValue({ addLayer: vi.fn(), removeLayer: vi.fn(), clearLayers: vi.fn(), addTo: vi.fn() }),
    FeatureGroup: mockFeatureGroup,
    map: vi.fn().mockReturnValue({
      addLayer: vi.fn(), setView: mockSetView, on: vi.fn(), fitBounds: mockMapFitBounds,
      getBounds: vi.fn().mockReturnValue({ isValid: () => false }),
      getZoom: mockGetZoom, project: mockProject, unproject: mockUnproject,
    }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  },
}));

function makeFeature(overrides: Partial<GeoJSONFeature['properties']> = {}): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: { id: 'test-1', name: 'Test', category: 'food', status: 'visited', ...overrides },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
  };
}

describe('LeafletAdapter — marker icons', () => {
  beforeEach(() => {
    mockDivIcon.mockClear();
    mockMarker.mockClear();
    const el = document.createElement('div');
    el.id = 'map';
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.getElementById('map')?.remove();
  });

  it('creates a DivIcon for each marker', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature());
    expect(mockDivIcon).toHaveBeenCalledOnce();
  });

  it('visited marker HTML contains solid background color', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature({ category: 'restaurant', status: 'visited' }));

    const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain(`background: ${CATEGORY_CONFIG.restaurant.color}`);
    expect(iconHtml).not.toContain('background: transparent');
  });

  it('wishlist marker HTML uses transparent background and dashed border', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature({ category: 'food', status: 'wishlist' }));

    const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain('background: transparent');
    expect(iconHtml).toContain('dashed');
  });

  it('uses the correct category color for each category', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });

    const categories = ['restaurant', 'cafe', 'bar', 'bakery', 'market', 'heladeria', 'other'] as const;
    for (const cat of categories) {
      mockDivIcon.mockClear();
      adapter.addMarker(makeFeature({ category: cat, status: 'visited' }));
      const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
      expect(iconHtml).toContain(CATEGORY_CONFIG[cat].color);
    }
  });

  it('sets iconSize to 26x26', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature());

    const iconOptions = mockDivIcon.mock.calls[0][0];
    expect(iconOptions.iconSize).toEqual([26, 26]);
  });

  it('centers the icon on the coordinate point', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature());

    const iconOptions = mockDivIcon.mock.calls[0][0];
    expect(iconOptions.iconAnchor).toEqual([13, 13]);
  });

  it('defaults missing category to restaurant color', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    const feature = makeFeature();
    delete feature.properties.category;
    adapter.addMarker(feature);

    const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain(CATEGORY_CONFIG.restaurant.color);
  });
});

describe('LeafletAdapter — centerWithOffset', () => {
  beforeEach(() => {
    mockSetView.mockClear();
    mockProject.mockClear();
    mockUnproject.mockClear();
    mockGetZoom.mockClear();
    const el = document.createElement('div');
    el.id = 'map';
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.getElementById('map')?.remove();
  });

  it('with no offset, sets the view directly on the given coordinates', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.centerWithOffset(41, -3.6, 16);

    expect(mockProject).not.toHaveBeenCalled();
    expect(mockSetView).toHaveBeenCalledWith([41, -3.6], 16, { animate: true });
  });

  it('with an offset, shifts the projected point down before unprojecting and centering', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.centerWithOffset(41, -3.6, 16, 200);

    expect(mockProject).toHaveBeenCalledWith([41, -3.6], 16);
    expect(mockUnproject).toHaveBeenCalledWith({ x: 100, y: 300 }, 16); // y shifted by +100 (offset/2)
    expect(mockSetView).toHaveBeenCalledWith({ lat: 41, lng: -3.6 }, 16, { animate: true });
  });

  it('falls back to the current zoom when none is given', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.centerWithOffset(41, -3.6);

    expect(mockGetZoom).toHaveBeenCalledOnce();
    expect(mockSetView).toHaveBeenCalledWith([41, -3.6], 13, { animate: true });
  });

  it('passes animate through to setView', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.centerWithOffset(41, -3.6, 16, 0, false);

    expect(mockSetView).toHaveBeenCalledWith([41, -3.6], 16, { animate: false });
  });
});

describe('LeafletAdapter — fitBounds', () => {
  beforeEach(() => {
    mockMapFitBounds.mockClear();
    mockFeatureGroup.mockClear();
    const el = document.createElement('div');
    el.id = 'map';
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.getElementById('map')?.remove();
  });

  it('no-ops with no markers', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.fitBounds();

    expect(mockMapFitBounds).not.toHaveBeenCalled();
  });

  it('pads the bottom edge with the given value, defaulting to 50', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature());

    adapter.fitBounds();
    expect(mockMapFitBounds).toHaveBeenCalledWith(
      expect.anything(),
      { paddingTopLeft: [50, 50], paddingBottomRight: [50, 50] }
    );

    adapter.fitBounds(200);
    expect(mockMapFitBounds).toHaveBeenLastCalledWith(
      expect.anything(),
      { paddingTopLeft: [50, 50], paddingBottomRight: [50, 200] }
    );
  });
});
