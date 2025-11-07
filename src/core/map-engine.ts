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
   * Center map on coordinates
   */
  centerOn(lat: number, lng: number, zoom?: number): void {
    const map = this.adapter.getMap();
    map.setView([lat, lng], zoom || map.getZoom());
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

    // Emit event
    this.emit('deleted', feature);
  }

  /**
   * Show only features matching a filter
   */
  showFeatures(filterFn: (feature: GeoJSONFeature) => boolean): void {
    this.adapter.clearMarkers();

    this.features.forEach((feature) => {
      if (filterFn(feature)) {
        this.renderFeature(feature);
      }
    });
  }

  /**
   * Clear all features
   */
  clear(): void {
    this.adapter.clearMarkers();
    this.features.clear();
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
    const id = feature.id?.toString() || feature.properties.id;
    const name = feature.properties.name || 'Unnamed';
    
    // Create popup content
    const popup = this.createPopupContent(feature);

    const marker = this.adapter.addMarker(feature, {
      popup,
      draggable: false,
    });

    // Handle marker click
    marker.on('click', () => {
      this.emit('click', feature);
    });
  }

  private createPopupContent(feature: GeoJSONFeature): string {
    const props = feature.properties;
    const rating = props.rating || 0;
    const stars = '⭐'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    const reviewCount = props.reviews?.length || 0;
    
    return `
      <div style="min-width: 200px;">
        <h3 style="margin: 0 0 8px 0;">${props.name || 'Unnamed'}</h3>
        ${rating > 0 ? `
          <div style="margin: 4px 0; font-size: 1.1em;">
            ${stars} <span style="color: #666; font-size: 0.9em;">(${rating.toFixed(1)})</span>
          </div>
        ` : ''}
        ${reviewCount > 0 ? `
          <p style="margin: 4px 0; color: #666; font-size: 0.9em;">
            ${reviewCount} review${reviewCount !== 1 ? 's' : ''}
          </p>
        ` : ''}
        ${props.tags ? `<p style="margin: 4px 0;"><strong>Tags:</strong> ${props.tags.join(', ')}</p>` : ''}
        ${props.comments ? `<p style="margin: 4px 0;"><em>${props.comments}</em></p>` : ''}
        ${props.last_visited ? `
          <p style="margin: 4px 0; color: #666; font-size: 0.85em;">
            Last visited: ${new Date(props.last_visited).toLocaleDateString()}
          </p>
        ` : ''}
      </div>
    `;
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
