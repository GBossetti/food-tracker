/**
 * Storage Layer - Modern Best Practice
 * Uses localStorage as cache, with hooks for future backend integration
 */

import { GeoJSONFeature, GeoJSONFeatureCollection } from '../core/types';

const STORAGE_KEY = 'food-map-pois';

const LEGACY_CATEGORY_MAP: Record<string, string> = { food: 'restaurant' };

export function normalizePOI(feature: GeoJSONFeature): GeoJSONFeature {
  if (!feature.properties.category) feature.properties.category = 'restaurant';
  feature.properties.category = LEGACY_CATEGORY_MAP[feature.properties.category] ?? feature.properties.category;
  if (!feature.properties.status) feature.properties.status = 'visited';
  return feature;
}

export class StorageLayer {
  private memoryCache: GeoJSONFeatureCollection | null = null;
  private backendEnabled = false; // Set to true when backend is ready

  async load(): Promise<GeoJSONFeatureCollection> {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    const cached = this.getFromLocalStorage();
    if (cached) {
      cached.features = cached.features.map(normalizePOI);
      this.memoryCache = cached;

      if (this.backendEnabled) {
        this.syncFromBackend().then((fresh) => {
          if (this.hasChanges(cached, fresh)) {
            this.memoryCache = fresh;
            this.saveToLocalStorage(fresh);
          }
        });
      }

      return cached;
    }

    const defaultData = await this.loadFromDB();
    defaultData.features = defaultData.features.map(normalizePOI);
    this.memoryCache = defaultData;
    return defaultData;
  }

  async save(data: GeoJSONFeatureCollection): Promise<void> {
    this.memoryCache = data;
    this.saveToLocalStorage(data);

    if (this.backendEnabled) {
      await this.syncToBackend(data);
    }
  }

  exportToFile(): void {
    const data = this.memoryCache || this.getFromLocalStorage() || { type: 'FeatureCollection' as const, features: [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `food-map-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<GeoJSONFeatureCollection> {
    const text = await file.text();
    const data = JSON.parse(text) as GeoJSONFeatureCollection;
    await this.save(data);
    return data;
  }

  clear(): void {
    this.memoryCache = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  // --- PRIVATE METHODS ---

  private async loadFromDB(): Promise<GeoJSONFeatureCollection> {
    // ddbb.json is personal and gitignored, so it exists locally but never ships.
    for (const url of ['/ddbb.json', '/demo-pois.geojson']) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        return await res.json() as GeoJSONFeatureCollection;
      } catch {
        continue;
      }
    }

    console.error('No seed data found, returning empty collection');
    return { type: 'FeatureCollection', features: [] };
  }

  private getFromLocalStorage(): GeoJSONFeatureCollection | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load from localStorage', error);
      return null;
    }
  }

  private saveToLocalStorage(data: GeoJSONFeatureCollection): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage', error);
    }
  }

  // --- FUTURE BACKEND STUBS ---

  private async syncToBackend(_data: GeoJSONFeatureCollection): Promise<void> {
    // No-op until backend is ready
  }

  private async syncFromBackend(): Promise<GeoJSONFeatureCollection> {
    // No-op until backend is ready; returning local data keeps hasChanges() false
    return this.getFromLocalStorage() ?? { type: 'FeatureCollection', features: [] };
  }

  private hasChanges(local: GeoJSONFeatureCollection, remote: GeoJSONFeatureCollection): boolean {
    return JSON.stringify(local) !== JSON.stringify(remote);
  }
}
