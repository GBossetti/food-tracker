import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaceDetailView } from './place-detail';
import type { GeoJSONFeature } from '../core/types';
import type { MapEngine } from '../core/map-engine';

function buildDom(): void {
  document.body.innerHTML = `
    <button id="detail-back-btn" aria-label="Back to results"></button>
    <h2 id="detail-title"></h2>
    <div id="detail-body"></div>
  `;
}

function makeFakeMapEngine() {
  const listeners: Record<string, Array<(e: { type: string; feature: GeoJSONFeature }) => void>> = {};
  const features: GeoJSONFeature[] = [];
  return {
    on: vi.fn((type: string, cb: (e: { type: string; feature: GeoJSONFeature }) => void) => {
      (listeners[type] ??= []).push(cb);
    }),
    getAllFeatures: vi.fn(() => features),
    __setFeatures(list: GeoJSONFeature[]) {
      features.length = 0;
      features.push(...list);
    },
    __emit(type: string, feature: GeoJSONFeature) {
      listeners[type]?.forEach((cb) => cb({ type, feature }));
    },
  };
}

function makeFeature(overrides: Partial<GeoJSONFeature['properties']> = {}): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: { id: 'p1', name: 'Bar Manolo', category: 'restaurant', status: 'visited', ...overrides },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
  };
}

describe('PlaceDetailView', () => {
  let mapEngine: ReturnType<typeof makeFakeMapEngine>;
  let onLogVisit: ReturnType<typeof vi.fn>;
  let onBack: ReturnType<typeof vi.fn>;
  let view: PlaceDetailView;

  beforeEach(() => {
    buildDom();
    mapEngine = makeFakeMapEngine();
    onLogVisit = vi.fn();
    onBack = vi.fn();
    view = new PlaceDetailView({
      mapEngine: mapEngine as unknown as MapEngine,
      onLogVisit,
      onBack,
    });
  });

  it('renders the place name as the title', () => {
    view.show(makeFeature({ name: 'Café Sur' }));
    expect(document.getElementById('detail-title')!.textContent).toBe('Café Sur');
  });

  it('shows the category label and a color dot', () => {
    view.show(makeFeature({ category: 'bakery' }));
    const body = document.getElementById('detail-body')!.innerHTML;
    expect(body).toContain('Bakery');
    expect(body).toContain('detail-category-dot');
  });

  it('shows a star rating only when rating > 0', () => {
    view.show(makeFeature({ rating: 4 }));
    expect(document.getElementById('detail-body')!.innerHTML).toContain('detail-stars');

    view.show(makeFeature({ rating: 0 }));
    expect(document.getElementById('detail-body')!.innerHTML).not.toContain('detail-stars');
  });

  it('renders tags as chips', () => {
    view.show(makeFeature({ tags: ['tapas', 'cheap'] }));
    const body = document.getElementById('detail-body')!.innerHTML;
    expect(body).toContain('tapas');
    expect(body).toContain('cheap');
    expect(body).toContain('tag-chip');
  });

  it('escapes user-entered content in name, notes, and tags', () => {
    view.show(makeFeature({
      name: '<img src=x onerror=alert(1)>',
      comments: '<script>evil()</script>',
      tags: ['<b>bold</b>'],
    }));

    expect(document.getElementById('detail-title')!.textContent).toBe('<img src=x onerror=alert(1)>');
    const body = document.getElementById('detail-body')!.innerHTML;
    expect(body).not.toContain('<script>');
    expect(body).not.toContain('<b>bold</b>');
    expect(body).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('shows "I went here" only for wishlist places, not visited ones', () => {
    view.show(makeFeature({ status: 'wishlist' }));
    expect(document.getElementById('detail-log-visit-btn')).not.toBeNull();

    view.show(makeFeature({ status: 'visited' }));
    expect(document.getElementById('detail-log-visit-btn')).toBeNull();
  });

  it('clicking "I went here" calls onLogVisit with the feature', () => {
    const feature = makeFeature({ status: 'wishlist' });
    view.show(feature);

    document.getElementById('detail-log-visit-btn')!.click();

    expect(onLogVisit).toHaveBeenCalledWith(feature);
  });

  it('the back button calls onBack', () => {
    view.show(makeFeature());
    document.getElementById('detail-back-btn')!.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows visit count and last-visited date for a visited place', () => {
    view.show(makeFeature({ status: 'visited', visit_count: 3, last_visited: '2026-01-05T00:00:00.000Z' }));
    const body = document.getElementById('detail-body')!.innerHTML;
    expect(body).toContain('Visited 3 times');
    expect(body).toContain('detail-meta');
  });

  it('currentId() reflects the currently shown feature', () => {
    expect(view.currentId()).toBeNull();
    view.show(makeFeature({ id: 'p42' }));
    expect(view.currentId()).toBe('p42');
  });

  it('refresh() re-renders from the latest mapEngine data for the current id', () => {
    mapEngine.__setFeatures([makeFeature({ id: 'p1', name: 'Original Name' })]);
    view.show(makeFeature({ id: 'p1', name: 'Original Name' }));

    mapEngine.__setFeatures([makeFeature({ id: 'p1', name: 'Renamed' })]);
    view.refresh();

    expect(document.getElementById('detail-title')!.textContent).toBe('Renamed');
  });

  it('refresh() is a no-op before show() has been called', () => {
    view.refresh();
    expect(document.getElementById('detail-title')!.textContent).toBe('');
  });

  it('a mapEngine "updated" event for the shown feature auto-refreshes the view', () => {
    view.show(makeFeature({ id: 'p1', name: 'Before' }));
    mapEngine.__emit('updated', makeFeature({ id: 'p1', name: 'After' }));
    expect(document.getElementById('detail-title')!.textContent).toBe('After');
  });

  it('a mapEngine "updated" event for a different feature does not re-render', () => {
    view.show(makeFeature({ id: 'p1', name: 'Mine' }));
    mapEngine.__emit('updated', makeFeature({ id: 'other', name: 'Someone else' }));
    expect(document.getElementById('detail-title')!.textContent).toBe('Mine');
  });

  it('a mapEngine "deleted" event for the shown feature clears currentId and calls onBack', () => {
    const feature = makeFeature({ id: 'p1' });
    view.show(feature);
    mapEngine.__emit('deleted', feature);

    expect(view.currentId()).toBeNull();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('a mapEngine "deleted" event for a different feature does not call onBack', () => {
    view.show(makeFeature({ id: 'p1' }));
    mapEngine.__emit('deleted', makeFeature({ id: 'other' }));
    expect(onBack).not.toHaveBeenCalled();
  });
});
