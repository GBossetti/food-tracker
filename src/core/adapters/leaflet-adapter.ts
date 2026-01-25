/**
 * Leaflet Adapter
 * Isolates Leaflet-specific implementation from the core map engine
 * Future: Can swap with mapbox-adapter.ts without changing core
 */

import L from 'leaflet';
import { GeoJSONFeature, MarkerOptions } from '../types';

export class LeafletAdapter {
  private map: L.Map;
  private markers: Map<string, L.Marker> = new Map();
  private layerGroup: L.LayerGroup;

  constructor(containerId: string, center: [number, number], zoom: number) {
    // Initialize Leaflet map
    this.map = L.map(containerId).setView(center, zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    // Create layer group for markers
    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  /**
   * Add a marker to the map
   */
  addMarker(feature: GeoJSONFeature, options?: MarkerOptions): L.Marker {
    const coords = feature.geometry.coordinates as [number, number];
    const latLng: L.LatLngExpression = [coords[1], coords[0]]; // GeoJSON is [lng, lat], Leaflet is [lat, lng]

    const marker = L.marker(latLng, {
      draggable: options?.draggable || false,
    });

    // Add popup if provided
    if (options?.popup) {
      marker.bindPopup(options.popup);
    }

    marker.addTo(this.layerGroup);

    // Store marker reference
    const id = feature.id?.toString() || feature.properties.id;
    if (id) {
      this.markers.set(id, marker);
    }

    return marker;
  }

  /**
   * Remove a marker from the map
   */
  removeMarker(id: string): boolean {
    const marker = this.markers.get(id);
    if (marker) {
      this.layerGroup.removeLayer(marker);
      this.markers.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.layerGroup.clearLayers();
    this.markers.clear();
  }

  /**
   * Get the underlying Leaflet map (for advanced use)
   */
  getMap(): L.Map {
    return this.map;
  }

  /**
   * Add click listener to map
   */
  onMapClick(callback: (lat: number, lng: number) => void): void {
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      callback(e.latlng.lat, e.latlng.lng);
    });
  }

  /**
   * Fit map bounds to show all markers
   */
  fitBounds(): void {
    // Only fit bounds if there are markers
    if (this.markers.size === 0) {
      return;
    }

    try {
      const group = new L.FeatureGroup(Array.from(this.markers.values()));
      const bounds = group.getBounds();
      
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      // Silently handle bounds fitting errors
    }
  }
}