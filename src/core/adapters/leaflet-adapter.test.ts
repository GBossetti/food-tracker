import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CATEGORY_CONFIG } from '../types';
import { GeoJSONFeature } from '../types';

// Mock Leaflet before importing the adapter
const mockMarkerInstance = { bindPopup: vi.fn().mockReturnThis(), on: vi.fn(), addTo: vi.fn().mockReturnThis() };
const mockMarker = vi.fn().mockReturnValue(mockMarkerInstance);
const mockDivIcon = vi.fn().mockReturnValue({});

vi.mock('leaflet', () => ({
  default: {
    marker: mockMarker,
    divIcon: mockDivIcon,
    layerGroup: vi.fn().mockReturnValue({ addLayer: vi.fn(), removeLayer: vi.fn(), clearLayers: vi.fn(), addTo: vi.fn() }),
    map: vi.fn().mockReturnValue({
      addLayer: vi.fn(), setView: vi.fn(), on: vi.fn(), fitBounds: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ isValid: () => false }),
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
    adapter.addMarker(makeFeature({ category: 'food', status: 'visited' }));

    const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain(`background: ${CATEGORY_CONFIG.food.color}`);
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

    const categories = ['food', 'culture', 'entertainment', 'other'] as const;
    for (const cat of categories) {
      mockDivIcon.mockClear();
      adapter.addMarker(makeFeature({ category: cat, status: 'visited' }));
      const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
      expect(iconHtml).toContain(CATEGORY_CONFIG[cat].color);
      expect(iconHtml).toContain(CATEGORY_CONFIG[cat].symbol);
    }
  });

  it('sets iconSize to 28x28', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature());

    const iconOptions = mockDivIcon.mock.calls[0][0];
    expect(iconOptions.iconSize).toEqual([28, 28]);
  });

  it('centers the icon on the coordinate point', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    adapter.addMarker(makeFeature());

    const iconOptions = mockDivIcon.mock.calls[0][0];
    expect(iconOptions.iconAnchor).toEqual([14, 14]);
  });

  it('defaults missing category to food color', async () => {
    const { LeafletAdapter } = await import('./leaflet-adapter');
    const adapter = new LeafletAdapter('map', { center: [40.4, -3.7], zoom: 13 });
    const feature = makeFeature();
    delete feature.properties.category;
    adapter.addMarker(feature);

    const iconHtml: string = mockDivIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain(CATEGORY_CONFIG.food.color);
  });
});
