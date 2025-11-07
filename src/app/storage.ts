/**
 * Storage Layer - Modern Best Practice
 * Uses localStorage as cache, with fallback to demo POIs
 */

import { GeoJSONFeatureCollection, GeoJSONFeature } from '../core/types';

const STORAGE_KEY = 'food-map-pois';
const SYNC_QUEUE_KEY = 'food-map-sync-queue';

export class StorageLayer {
  private memoryCache: GeoJSONFeatureCollection | null = null;
  private backendEnabled = false; // Set to true when backend is ready

  async load(): Promise<GeoJSONFeatureCollection> {
    if (this.memoryCache) return this.memoryCache;

    const cached = this.getFromLocalStorage();
    if (cached) {
      this.memoryCache = cached;
      return cached;
    }

    // Fallback to demo POIs
    const defaultData = await this.getDefaultData();
    this.memoryCache = defaultData;
    return defaultData;
  }

  async save(data: GeoJSONFeatureCollection): Promise<void> {
    this.memoryCache = data;
    this.saveToLocalStorage(data);

    if (this.backendEnabled) {
      try {
        await this.syncToBackend(data);
      } catch (err) {
        console.warn('⚠️ Backend sync failed, queuing for retry', err);
        this.queueForSync(data);
      }
    }
  }

  exportToFile(): void {
    const data = this.memoryCache || this.getFromLocalStorage() || { type: 'FeatureCollection', features: [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
    localStorage.removeItem(SYNC_QUEUE_KEY);
    console.log('🗑️ Cleared all data');
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

  private async getDefaultData(): Promise<GeoJSONFeatureCollection> {
    try {
      const response = await fetch('/demo-pois.geojson');
      const demoData = await response.json();

      const features: GeoJSONFeature[] = demoData.map((poi: any) => ({
        type: 'Feature',
        properties: {
          id: poi.name.replace(/\s+/g, '-').toLowerCase(),
          name: poi.name,
          tags: poi.tags || [],
          comments: poi.note || '',
          visited_date: poi.date_added || new Date().toISOString().split('T')[0],
        },
        geometry: {
          type: 'Point',
          coordinates: [poi.lng, poi.lat],
        },
      }));

      return { type: 'FeatureCollection', features };
    } catch (err) {
      console.error('Failed to load demo POIs', err);
      return { type: 'FeatureCollection', features: [] };
    }
  }

  // --- Future backend placeholders ---

  private async syncToBackend(data: GeoJSONFeatureCollection): Promise<void> {
    throw new Error('Backend not implemented yet');
  }

  private async syncFromBackend(): Promise<GeoJSONFeatureCollection> {
    throw new Error('Backend not implemented yet');
  }

  private hasChanges(local: GeoJSONFeatureCollection, remote: GeoJSONFeatureCollection): boolean {
    return JSON.stringify(local) !== JSON.stringify(remote);
  }

  private queueForSync(data: GeoJSONFeatureCollection): void {
    try {
      const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
      queue.push({ data, timestamp: Date.now() });
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to queue for sync', error);
    }
  }
}
