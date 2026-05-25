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

    this.initTabs();

    setTimeout(() => {
      const map = this.mapEngine.getAdapter().getMap();
      if (map) map.invalidateSize();
    }, 100);
  }

  private activateTab(tab: string): void {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const btn = document.querySelector<HTMLElement>(`.tab-btn[data-tab="${tab}"]`);
    const panel = document.getElementById(`tab-${tab}`);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');

    if (tab === 'map') {
      setTimeout(() => {
        const map = this.mapEngine.getAdapter().getMap();
        if (map) map.invalidateSize();
      }, 50);
    }
  }

  private initTabs(): void {
    document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) this.activateTab(tab);
      });
    });

    // Switch to map tab automatically when add-mode is triggered
    document.getElementById('add-poi-btn')?.addEventListener('click', () => {
      this.activateTab('map');
    });
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
