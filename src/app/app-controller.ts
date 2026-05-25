import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { GeoJSONFeatureCollection } from '../core/types';

export class AppController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private data: GeoJSONFeatureCollection | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;

    this.initializeViews();
    this.setupNavigation();
    this.loadData();
  }

  private initializeViews(): void {
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    if (landingView) landingView.classList.add('active');
    if (appView) appView.classList.remove('active');
  }

  private setupNavigation(): void {
    document.getElementById('start-app-btn')?.addEventListener('click', () => {
      this.showApp();
    });
  }

  private showApp(): void {
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    if (landingView) landingView.classList.remove('active');
    if (appView) appView.classList.add('active');

    setTimeout(() => {
      const map = this.mapEngine.getAdapter().getMap();
      if (map) map.invalidateSize();
    }, 100);
  }

  private async loadData(): Promise<void> {
    try {
      this.data = await this.storage.load();
    } catch {
      this.data = { type: 'FeatureCollection', features: [] };
    }
  }

  public getData(): GeoJSONFeatureCollection {
    return this.data || { type: 'FeatureCollection', features: [] };
  }

  public async refreshData(): Promise<void> {
    await this.loadData();
  }
}
