/**
 * Core TypeScript types for the map engine
 * These are generic and reusable across any map-based project
 */

// Standard GeoJSON types
export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface GeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Map engine types
export interface MapConfig {
  containerId: string;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface MarkerOptions {
  draggable?: boolean;
  icon?: any;
  popup?: string;
}

export type FeatureEventType = 'click' | 'created' | 'updated' | 'deleted';

export interface FeatureEvent {
  type: FeatureEventType;
  feature: GeoJSONFeature;
}

export type EventCallback = (event: FeatureEvent) => void;