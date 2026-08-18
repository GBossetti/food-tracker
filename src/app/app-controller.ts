import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { GeoJSONFeatureCollection } from '../core/types';
import { GamificationUI } from './gamification-ui';
import { NavDrawer } from './nav-drawer';
import { SearchSheet } from './search-sheet';
import { UIController } from './ui';

export class AppController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private data: GeoJSONFeatureCollection | null = null;
  private gamificationUI: GamificationUI;
  private navDrawer: NavDrawer;
  private searchSheet: SearchSheet;
  private uiController: UIController | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;
    this.gamificationUI = new GamificationUI(mapEngine, {
      closeDrawer: () => this.navDrawer.close(),
      expandSheet: () => this.searchSheet.setSnap('half'),
    });
    this.navDrawer = new NavDrawer({ onOpen: () => this.gamificationUI.render() });
    this.searchSheet = new SearchSheet();

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

    // Collapse the sheet so the map is tappable when add-mode starts
    document.getElementById('add-poi-btn')?.addEventListener('click', () => {
      this.searchSheet.setSnap('collapsed');
    });

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
