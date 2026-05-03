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
const SYNC_QUEUE_KEY = 'food-map-sync-queue';

export class StorageLayer {
  private memoryCache: GeoJSONFeatureCollection | null = null;
  private backendEnabled = false; // Set to true when backend is ready

  /**
   * Load POIs - Returns cached data immediately, syncs from backend in background
   */
  async load(): Promise<GeoJSONFeatureCollection> {
    // 1. Check memory cache (instant)
    if (this.memoryCache) {
      return this.memoryCache;
    }

    // 2. Check localStorage (fast)
    const cached = this.getFromLocalStorage();
    if (cached) {
      cached.features = cached.features.map(normalizePOI);
      this.memoryCache = cached;

      // 3. Sync from backend in background (if enabled)
      if (this.backendEnabled) {
        this.syncFromBackend().then((fresh) => {
          if (this.hasChanges(cached, fresh)) {
            this.memoryCache = fresh;
            this.saveToLocalStorage(fresh);
            // TODO: Emit event to update UI
          }
        });
      }

      return cached;
    }

    // 4. No cached data, load from ddbb.json
    const defaultData = await this.loadFromDB();
    defaultData.features = defaultData.features.map(normalizePOI);
    this.memoryCache = defaultData;
    return defaultData;
  }

  /**
   * Save POIs - Updates all cache layers and syncs to backend
   */
  async save(data: GeoJSONFeatureCollection): Promise<void> {
    // 1. Update memory cache (instant)
    this.memoryCache = data;

    // 2. Update localStorage (fast, persists locally)
    this.saveToLocalStorage(data);

    // 3. Sync to backend (background, if enabled)
    if (this.backendEnabled) {
      try {
        await this.syncToBackend(data);
      } catch (error) {
        this.queueForSync(data);
      }
    }
  }

  /**
   * Export data as downloadable GeoJSON file
   */
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

  /**
   * Import data from file
   */
  async importFromFile(file: File): Promise<GeoJSONFeatureCollection> {
    const text = await file.text();
    const data = JSON.parse(text) as GeoJSONFeatureCollection;
    await this.save(data);
    return data;
  }

  /**
   * Clear all data (useful for testing/reset)
   */
  clear(): void {
    this.memoryCache = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_QUEUE_KEY);
  }

  // --- PRIVATE METHODS ---

  private async loadFromDB(): Promise<GeoJSONFeatureCollection> {
    try {
      const res = await fetch('/ddbb.json');
      if (!res.ok) throw new Error(`Failed to fetch ddbb.json: ${res.status}`);
      return await res.json() as GeoJSONFeatureCollection;
    } catch (error) {
      console.error('Failed to load ddbb.json, returning empty collection', error);
      return { type: 'FeatureCollection', features: [] };
    }
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

  // --- FUTURE BACKEND METHODS (not implemented yet) ---

  private async syncToBackend(data: GeoJSONFeatureCollection): Promise<void> {
    // TODO: Implement when backend is ready
    // await fetch('/api/pois', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data),
    // });
    throw new Error('Backend not implemented yet');
  }

  private async syncFromBackend(): Promise<GeoJSONFeatureCollection> {
    // TODO: Implement when backend is ready
    // const res = await fetch('/api/pois');
    // return res.json();
    throw new Error('Backend not implemented yet');
  }

  private hasChanges(local: GeoJSONFeatureCollection, remote: GeoJSONFeatureCollection): boolean {
    // Simple comparison - you might want more sophisticated logic
    return JSON.stringify(local) !== JSON.stringify(remote);
  }

  private queueForSync(data: GeoJSONFeatureCollection): void {
    // Store in queue for retry when back online
    try {
      const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
      queue.push({ data, timestamp: Date.now() });
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to queue for sync', error);
    }
  }
}