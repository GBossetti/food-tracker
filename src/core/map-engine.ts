/**
 * Map Engine - Core (Library Agnostic)
 * This is the reusable heart of your map application
 * It doesn't know about Leaflet, Mapbox, or any specific library
 */

import { LeafletAdapter } from './adapters/leaflet-adapter.ts';
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
    return `
      <div style="min-width: 200px;">
        <h3 style="margin: 0 0 8px 0;">${props.name || 'Unnamed'}</h3>
        ${props.tags ? `<p style="margin: 4px 0;"><strong>Tags:</strong> ${props.tags.join(', ')}</p>` : ''}
        ${props.comments ? `<p style="margin: 4px 0;"><em>${props.comments}</em></p>` : ''}
      </div>
    `;
  }

  private handleMapClick(lat: number, lng: number): void {
    // For now, just log. App layer will handle creation UI
    console.log('Map clicked:', lat, lng);
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