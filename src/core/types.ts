/**
 * Core TypeScript types for the map engine
 * These are generic and reusable across any map-based project
 */

// POI Categories
export type POICategory = 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'market' | 'heladeria' | 'other';
export type POIStatus = 'visited' | 'wishlist';

export const CATEGORY_CONFIG: Record<POICategory, { label: string; color: string; textColor: string }> = {
  restaurant: { label: 'Restaurant', color: '#0088AA', textColor: '#000' },
  cafe:       { label: 'Café',       color: '#CC8800', textColor: '#000' },
  bar:        { label: 'Bar',        color: '#7700AA', textColor: '#fff' },
  bakery:     { label: 'Bakery',     color: '#CC5500', textColor: '#000' },
  market:     { label: 'Market',     color: '#007744', textColor: '#fff' },
  heladeria:  { label: 'Ice Cream',  color: '#0066BB', textColor: '#fff' },
  other:      { label: 'Other',      color: '#556677', textColor: '#fff' },
};

// Standard GeoJSON types
export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface Review {
  id: string;
  date: string;
  rating: number;
  text: string;
  photos?: string[];
}

export interface POIProperties {
  id: string;
  name: string;
  category?: POICategory;
  status?: POIStatus;
  tags?: string[];
  comments?: string;
  visited_date?: string;
  rating?: number; // Overall rating (1-5)
  reviews?: Review[]; // Array of reviews with individual ratings
  visit_count?: number; // How many times visited
  last_visited?: string; // Last visit date
  created_at?: string; // When POI was created
  [key: string]: any; // Allow custom properties
}

export interface GeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJSONGeometry;
  properties: POIProperties;
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