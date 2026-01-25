/**
 * App Controller
 * Manages views, navigation, and theme
 */

import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { GeoJSONFeatureCollection } from '../core/types';

export class AppController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private currentView: 'landing' | 'app' = 'landing';
  private currentAppView: 'dashboard' | 'map' = 'dashboard';
  private data: GeoJSONFeatureCollection | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;

    this.initializeViews();
    this.setupTheme();
    this.setupNavigation();
    this.loadData();
  }

  /**
   * Initialize view states
   */
  private initializeViews(): void {
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    
    // Show landing, hide app by default
    if (landingView) landingView.classList.add('active');
    if (appView) appView.classList.remove('active');
  }

  /**
   * Setup theme toggle functionality
   */
  private setupTheme(): void {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcons(theme);

    // Landing theme toggle
    document.getElementById('theme-toggle-landing')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // App theme toggle
    document.getElementById('theme-toggle-app')?.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  private toggleTheme(): void {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateThemeIcons(next);
  }

  private updateThemeIcons(theme: string): void {
    // Replace with SVG icons - see SVG_GUIDE.md
    const icons = document.querySelectorAll('.theme-icon');
    icons.forEach(icon => {
      icon.textContent = '';
      // Add SVG icon here based on theme
    });
  }

  /**
   * Setup navigation between views
   */
  private setupNavigation(): void {
    // Start app button - go directly to map
    document.getElementById('start-app-btn')?.addEventListener('click', () => {
      this.showApp('map');
    });

    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const view = target.getAttribute('data-view') as 'dashboard' | 'map';
        this.showAppView(view);
      });
    });

    // Quick actions
    document.getElementById('quick-add-btn')?.addEventListener('click', () => {
      // Will be handled by UIController
      this.showAppView('map');
      setTimeout(() => {
        document.getElementById('add-poi-btn')?.click();
      }, 100);
    });

    document.getElementById('quick-export-btn')?.addEventListener('click', () => {
      this.storage.exportToFile();
    });

    document.getElementById('quick-import-btn')?.addEventListener('click', () => {
      document.getElementById('import-input')?.click();
    });

    document.getElementById('quick-map-btn')?.addEventListener('click', () => {
      this.showAppView('map');
    });
  }

  /**
   * Load data from storage
   */
  private async loadData(): Promise<void> {
    try {
      this.data = await this.storage.load();
    } catch (error) {
      this.data = { type: 'FeatureCollection', features: [] };
    }
  }

  /**
   * Show app (hide landing)
   */
  private showApp(view: 'dashboard' | 'map'): void {
    // Hide landing
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    
    if (landingView) landingView.classList.remove('active');
    if (appView) appView.classList.add('active');

    this.currentView = 'app';
    
    // Show specific app view
    this.showAppView(view);

    // Initialize stats if going to dashboard
    if (view === 'dashboard') {
      this.updateDashboard();
    }

    // Ensure map is properly sized when first shown
    if (view === 'map') {
      setTimeout(() => {
        const map = (this.mapEngine as any).adapter?.getMap();
        if (map) {
          map.invalidateSize();
        }
      }, 100);
    }
  }

  /**
   * Switch between dashboard and map views
   */
  private showAppView(view: 'dashboard' | 'map'): void {
    this.currentAppView = view;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const tabView = tab.getAttribute('data-view');
      if (tabView === view) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update content
    const dashboardContent = document.getElementById('dashboard-content');
    const mapContent = document.getElementById('map-content');

    if (view === 'dashboard') {
      dashboardContent?.classList.add('active');
      mapContent?.classList.remove('active');
      this.updateDashboard();
    } else {
      dashboardContent?.classList.remove('active');
      mapContent?.classList.add('active');
      
      // Invalidate map size (Leaflet needs this after showing)
      setTimeout(() => {
        const map = (this.mapEngine as any).adapter?.getMap();
        if (map) {
          map.invalidateSize();
        }
      }, 100);
    }
  }

  /**
   * Update dashboard statistics
   */
  public updateDashboard(): void {
    if (!this.data) return;

    const features = this.data.features;

    // Total places
    const totalEl = document.getElementById('stat-total');
    if (totalEl) totalEl.textContent = features.length.toString();

    // Unique tags
    const allTags = new Set<string>();
    features.forEach(f => {
      if (Array.isArray(f.properties.tags)) {
        f.properties.tags.forEach(tag => allTags.add(tag));
      }
    });
    const tagsEl = document.getElementById('stat-tags');
    if (tagsEl) tagsEl.textContent = allTags.size.toString();

    // Top tag
    const tagCounts = new Map<string, number>();
    features.forEach(f => {
      if (Array.isArray(f.properties.tags)) {
        f.properties.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    let topTag = '-';
    let maxCount = 0;
    tagCounts.forEach((count, tag) => {
      if (count > maxCount) {
        maxCount = count;
        topTag = tag;
      }
    });

    const topTagEl = document.getElementById('stat-top');
    if (topTagEl) topTagEl.textContent = topTag;

    // Recent places
    this.updateRecentPlaces();
  }

  /**
   * Update recent places list
   */
  private updateRecentPlaces(): void {
    if (!this.data) return;

    const recentPlacesEl = document.getElementById('recent-places');
    if (!recentPlacesEl) return;

    const features = [...this.data.features]
      .sort((a, b) => {
        const dateA = a.properties.visited_date || '';
        const dateB = b.properties.visited_date || '';
        return dateB.localeCompare(dateA);
      })
      .slice(0, 5);

    if (features.length === 0) {
      recentPlacesEl.innerHTML = '<p style="color: var(--color-text-secondary);">No places yet. Add your first place!</p>';
      return;
    }

    recentPlacesEl.innerHTML = features.map(f => `
      <div class="place-item" data-id="${f.properties.id}">
        <div class="place-info">
          <h4>${f.properties.name}</h4>
          <div class="place-tags">
            ${(f.properties.tags || []).map((tag: string) => 
              `<span class="place-tag">${tag}</span>`
            ).join('')}
          </div>
        </div>
        <div class="place-date" style="color: var(--color-text-tertiary); font-size: 0.875rem;">
          ${this.formatDate(f.properties.visited_date)}
        </div>
      </div>
    `).join('');

    // Add click handlers
    recentPlacesEl.querySelectorAll('.place-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showAppView('map');
        // Emit event to show this POI on map
        const id = item.getAttribute('data-id');
        // UIController will handle showing the POI
      });
    });
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }

  /**
   * Get current data (for other controllers to use)
   */
  public getData(): GeoJSONFeatureCollection {
    return this.data || { type: 'FeatureCollection', features: [] };
  }

  /**
   * Refresh data and update views
   */
  public async refreshData(): Promise<void> {
    await this.loadData();
    if (this.currentAppView === 'dashboard') {
      this.updateDashboard();
    }
  }
}