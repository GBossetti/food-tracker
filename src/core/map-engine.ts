/**
 * Map Engine - Core (Library Agnostic)
 * This is the reusable heart of your map application
 * It doesn't know about Leaflet, Mapbox, or any specific library
 */

import { LeafletAdapter } from './adapters/leaflet-adapter';
import {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  MapConfig,
  EventCallback,
  FeatureEvent,
} from './types';

export class MapEngine {
  private adapter: LeafletAdapter;
  private features: Map<string, GeoJSONFeature> = new Map();
  private eventListeners: Map<string, EventCallback[]> = new Map();
  // Ids currently rendered as markers on the adapter — kept in sync by every
  // method that adds/removes a marker, so showFeatures() can diff instead of
  // tearing down and rebuilding every marker on each call (e.g. per keystroke).
  private shownIds: Set<string> = new Set();

  constructor(config: MapConfig) {
    const center = config.center || [40.4168, -3.7038]; // Default: Madrid
    const zoom = config.zoom || 13;

    // Initialize adapter (can be swapped with MapboxAdapter later)
    this.adapter = new LeafletAdapter(config.containerId, center, zoom);

    // Setup map click handler
    this.adapter.onMapClick((lat, lng) => {
      this.handleMapClick(lat, lng);
    });
  }

  /**
   * Get the underlying map adapter (for advanced features)
   */
  getAdapter(): LeafletAdapter {
    return this.adapter;
  }

  /**
   * Center map on coordinates. `offsetY` shifts the point up by half that
   * many pixels — pass the height of a bottom sheet so the point lands in
   * the visible band above it instead of behind it.
   */
  centerOn(lat: number, lng: number, zoom?: number, offsetY = 0, animate = true): void {
    this.adapter.centerWithOffset(lat, lng, zoom, offsetY, animate);
  }

  /**
   * Load GeoJSON data into the map
   */
  load(data: GeoJSONFeatureCollection): void {
    this.clear();

    data.features.forEach((feature) => {
      this.addFeature(feature, false); // false = don't emit event for bulk load
    });

    // Fit map to show all features
    this.adapter.fitBounds();
  }

  /**
   * Add a single feature to the map
   */
  addFeature(feature: GeoJSONFeature, emitEvent = true): void {
    const id = this.ensureFeatureId(feature);

    // Store feature
    this.features.set(id, feature);

    // Render on map
    this.renderFeature(feature);
    this.shownIds.add(id);

    // Emit event
    if (emitEvent) {
      this.emit('created', feature);
    }
  }

  /**
   * Update an existing feature
   */
  updateFeature(id: string, properties: Record<string, any>): void {
    const feature = this.features.get(id);
    if (!feature) {
      console.warn(`Feature ${id} not found`);
      return;
    }

    // Update properties
    feature.properties = { ...feature.properties, ...properties };

    // Re-render
    this.adapter.removeMarker(id);
    this.renderFeature(feature);
    this.shownIds.add(id);

    // Emit event
    this.emit('updated', feature);
  }

  /**
   * Remove a feature from the map
   */
  removeFeature(id: string): void {
    const feature = this.features.get(id);
    if (!feature) {
      console.warn(`Feature ${id} not found`);
      return;
    }

    // Remove from map
    this.adapter.removeMarker(id);

    // Remove from store
    this.features.delete(id);
    this.shownIds.delete(id);

    // Emit event
    this.emit('deleted', feature);
  }

  /**
   * Show only features matching a filter.
   * Diffs against the currently shown markers rather than clearing and
   * rebuilding all of them, so a search keystroke only touches the markers
   * whose match state actually changed.
   */
  showFeatures(filterFn: (feature: GeoJSONFeature) => boolean): void {
    const matchedIds = new Set<string>();
    this.features.forEach((feature, id) => {
      if (filterFn(feature)) matchedIds.add(id);
    });

    for (const id of this.shownIds) {
      if (!matchedIds.has(id)) this.adapter.removeMarker(id);
    }
    for (const id of matchedIds) {
      if (!this.shownIds.has(id)) {
        const feature = this.features.get(id);
        if (feature) this.renderFeature(feature);
      }
    }

    this.shownIds = matchedIds;
  }

  /**
   * Clear all features
   */
  clear(): void {
    this.adapter.clearMarkers();
    this.features.clear();
    this.shownIds.clear();
  }

  /**
   * Export current features as GeoJSON
   */
  export(): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: Array.from(this.features.values()),
    };
  }

  /**
   * Register event listener
   */
  on(eventType: string, callback: EventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Get all features
   */
  getAllFeatures(): GeoJSONFeature[] {
    return Array.from(this.features.values());
  }

  // --- PRIVATE METHODS ---

  private renderFeature(feature: GeoJSONFeature): void {
    const marker = this.adapter.addMarker(feature, {
      draggable: false,
    });

    // Handle marker click
    marker.on('click', () => {
      this.emit('click', feature);
    });
  }

  private handleMapClick(lat: number, lng: number): void {
    // Emit event so app layer can handle it
    this.emit('map:click', {
      type: 'Feature',
      properties: { lat, lng },
      geometry: { type: 'Point', coordinates: [lng, lat] }
    } as any);
  }

  private ensureFeatureId(feature: GeoJSONFeature): string {
    if (feature.id) return feature.id.toString();
    if (feature.properties.id) return feature.properties.id;

    // Generate unique ID
    const id = `poi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    feature.properties.id = id;
    return id;
  }

  private emit(type: string, feature: GeoJSONFeature): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event: FeatureEvent = { type: type as any, feature };
      listeners.forEach((callback) => callback(event));
    }
  }
}
