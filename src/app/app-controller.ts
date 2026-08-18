import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { GeoJSONFeatureCollection } from '../core/types';
import { GamificationUI } from './gamification-ui';
import { NavDrawer } from './nav-drawer';
import { UIController } from './ui';

export class AppController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private data: GeoJSONFeatureCollection | null = null;
  private gamificationUI: GamificationUI;
  private navDrawer: NavDrawer;
  private uiController: UIController | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;
    this.gamificationUI = new GamificationUI(mapEngine, () => this.navDrawer.close());
    this.navDrawer = new NavDrawer({ onOpen: () => this.gamificationUI.render() });

    this.initializeViews();
    this.setupNavigation();
    this.loadData();
  }

  public setUIController(uiController: UIController): void {
    this.uiController = uiController;
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

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.mapEngine.centerOn(pos.coords.latitude, pos.coords.longitude, 13);
          this.uiController?.setUserLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => { /* denied or unavailable — stay on default centre */ }
      );
    }
  }

  private activateTab(tab: string): void {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    document.getElementById('tab-map')?.classList.remove('map-behind-decide');

    const btn = document.querySelector<HTMLElement>(`.tab-btn[data-tab="${tab}"]`);
    const panel = document.getElementById(`tab-${tab}`);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');

    if (tab === 'decide') {
      document.getElementById('tab-map')?.classList.add('map-behind-decide');
    }

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
