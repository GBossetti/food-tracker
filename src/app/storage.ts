/**
 * Storage Layer - Modern Best Practice
 * Uses localStorage as cache, with hooks for future backend integration
 */

import { GeoJSONFeatureCollection } from '../core/types';

const STORAGE_KEY = 'food-map-pois';
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
      console.log('📦 Loaded from memory cache');
      return this.memoryCache;
    }

    // 2. Check localStorage (fast)
    const cached = this.getFromLocalStorage();
    if (cached) {
      console.log('💾 Loaded from localStorage');
      this.memoryCache = cached;

      // 3. Sync from backend in background (if enabled)
      if (this.backendEnabled) {
        this.syncFromBackend().then((fresh) => {
          if (this.hasChanges(cached, fresh)) {
            console.log('🔄 Backend had newer data, updating...');
            this.memoryCache = fresh;
            this.saveToLocalStorage(fresh);
            // TODO: Emit event to update UI
          }
        });
      }

      return cached;
    }

    // 4. No cached data, return default
    console.log('🆕 No cached data, using defaults');
    const defaultData = this.getDefaultData();
    this.memoryCache = defaultData;
    return defaultData;
  }

  /**
   * Save POIs - Updates all cache layers and syncs to backend
   */
  async save(data: GeoJSONFeatureCollection): Promise<void> {
    console.log('💾 Saving data...');

    // 1. Update memory cache (instant)
    this.memoryCache = data;

    // 2. Update localStorage (fast, persists locally)
    this.saveToLocalStorage(data);

    // 3. Sync to backend (background, if enabled)
    if (this.backendEnabled) {
      try {
        await this.syncToBackend(data);
        console.log('✅ Synced to backend');
      } catch (error) {
        console.warn('⚠️ Backend sync failed, queuing for retry', error);
        this.queueForSync(data);
      }
    }
  }

  /**
   * Export data as downloadable GeoJSON file
   */
  exportToFile(): void {
    const data = this.memoryCache || this.getFromLocalStorage() || this.getDefaultData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `food-map-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('📥 Exported to file');
  }

  /**
   * Import data from file
   */
  async importFromFile(file: File): Promise<GeoJSONFeatureCollection> {
    const text = await file.text();
    const data = JSON.parse(text) as GeoJSONFeatureCollection;
    await this.save(data);
    console.log('📤 Imported from file');
    return data;
  }

  /**
   * Clear all data (useful for testing/reset)
   */
  clear(): void {
    this.memoryCache = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_QUEUE_KEY);
    console.log('🗑️ Cleared all data');
  }

  // --- PRIVATE METHODS ---

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

  private getDefaultData(): GeoJSONFeatureCollection {
    // Sample data for Madrid - you can replace this with your own
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'poi-1',
            name: 'Casa Lucio',
            tags: ['fancy', 'good food', 'traditional'],
            comments: 'Famous for huevos rotos. Book in advance!',
            visited_date: '2024-10-15',
            rating: 4.5,
            visit_count: 3,
            created_at: '2024-08-20T10:00:00Z',
            last_visited: '2024-10-15T20:30:00Z',
            reviews: [
              {
                id: 'review-1',
                date: '2024-10-15T20:30:00Z',
                rating: 5,
                text: 'Amazing huevos rotos! The atmosphere is traditional and cozy. Service was excellent.'
              },
              {
                id: 'review-2',
                date: '2024-09-10T21:00:00Z',
                rating: 4,
                text: 'Great food but a bit pricey. Worth it for special occasions.'
              }
            ]
          },
          geometry: {
            type: 'Point',
            coordinates: [-3.7082, 40.4138],
          },
        },
        {
          type: 'Feature',
          properties: {
            id: 'poi-2',
            name: 'Mercado de San Miguel',
            tags: ['tapas', 'tourist-friendly', 'good food'],
            comments: 'Great variety of tapas. Can be crowded.',
            visited_date: '2024-09-20',
            rating: 4,
            visit_count: 5,
            created_at: '2024-07-15T12:00:00Z',
            last_visited: '2024-09-20T19:00:00Z',
            reviews: [
              {
                id: 'review-3',
                date: '2024-09-20T19:00:00Z',
                rating: 4,
                text: 'Love the variety! Try the jamón ibérico. Gets very crowded on weekends.'
              }
            ]
          },
          geometry: {
            type: 'Point',
            coordinates: [-3.7088, 40.4154],
          },
        },
        {
          type: 'Feature',
          properties: {
            id: 'poi-3',
            name: 'La Carmencita',
            tags: ['cheap', 'local', 'good tapas'],
            comments: 'Hidden gem! Amazing menu del día.',
            visited_date: '2024-08-10',
            rating: 5,
            visit_count: 2,
            created_at: '2024-06-05T14:00:00Z',
            last_visited: '2024-08-10T14:30:00Z',
            reviews: [
              {
                id: 'review-4',
                date: '2024-08-10T14:30:00Z',
                rating: 5,
                text: 'Best menu del día in the neighborhood! Locals only, authentic Spanish food.'
              },
              {
                id: 'review-5',
                date: '2024-06-25T13:00:00Z',
                rating: 5,
                text: 'Found this by accident. Amazing! Will definitely come back.'
              }
            ]
          },
          geometry: {
            type: 'Point',
            coordinates: [-3.6987, 40.4260],
          },
        },
      ],
    };
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