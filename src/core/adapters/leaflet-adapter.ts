/**
 * Leaflet Adapter
 * Isolates Leaflet-specific implementation from the core map engine
 * Future: Can swap with mapbox-adapter.ts without changing core
 */

import L from 'leaflet';
import { GeoJSONFeature, MarkerOptions, POICategory, POIStatus, CATEGORY_CONFIG } from '../types';

export class LeafletAdapter {
  private map: L.Map;
  private markers: Map<string, L.Marker> = new Map();
  private layerGroup: L.LayerGroup;

  constructor(containerId: string, center: [number, number], zoom: number) {
    if (!document.getElementById(containerId)) {
      throw new Error(`Map container #${containerId} not found in DOM`);
    }
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

    const rawCat = (feature.properties.category || 'restaurant') as POICategory;
    const category: POICategory = CATEGORY_CONFIG[rawCat] ? rawCat : 'other';
    const status = (feature.properties.status || 'visited') as POIStatus;
    const { color } = CATEGORY_CONFIG[category];
    const isWishlist = status === 'wishlist';

    const innerDot = isWishlist ? '' : `<div style="width:8px;height:8px;border-radius:50%;background:#fff;opacity:0.6;"></div>`;

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: ${isWishlist ? 'transparent' : color};
        border: 2px ${isWishlist ? 'dashed' : 'solid'} ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${isWishlist ? 'none' : `0 2px 8px ${color}88`};
        cursor: pointer;
        box-sizing: border-box;
      ">${innerDot}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker(latLng, {
      icon,
      draggable: options?.draggable || false,
    });

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
   * Center on a coordinate, shifted up by half of offsetYPx so the point
   * lands in the visible band above a bottom sheet of that height rather
   * than the exact viewport center (which the sheet may cover).
   */
  centerWithOffset(lat: number, lng: number, zoom?: number, offsetYPx = 0, animate = true): void {
    const targetZoom = zoom ?? this.map.getZoom();
    if (offsetYPx === 0) {
      this.map.setView([lat, lng], targetZoom, { animate });
      return;
    }
    const point = this.map.project([lat, lng], targetZoom).add([0, offsetYPx / 2]);
    const target = this.map.unproject(point, targetZoom);
    this.map.setView(target, targetZoom, { animate });
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
   * Fit map bounds to show all markers. `bottomPadding` widens the bottom
   * edge alone (in px) — pass a bottom sheet's height so fitted markers
   * don't land hidden behind it.
   */
  fitBounds(bottomPadding = 50): void {
    // Only fit bounds if there are markers
    if (this.markers.size === 0) {
      return;
    }

    try {
      const group = new L.FeatureGroup(Array.from(this.markers.values()));
      const bounds = group.getBounds();

      if (bounds.isValid()) {
        this.map.fitBounds(bounds, {
          paddingTopLeft: [50, 50],
          paddingBottomRight: [50, bottomPadding],
        });
      }
    } catch (error) {
      // Silently handle bounds fitting errors
    }
  }
}