/**
 * UI Controller - Food App Specific
 * Handles all user interface interactions
 */

import { GeoJSONFeature, GeoJSONFeatureCollection, POICategory, POIStatus, CATEGORY_CONFIG, Review } from '../core/types';
import { matchesFilters } from '../core/poi-filters';
import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { AnalyticsUI } from './analytics-ui.ts';
import { AppController } from './app-controller';
import { logVisit, attachVisitReview } from './visit';
import { QuickVisitSheet } from './quick-visit-sheet';
import { trapFocus } from '../core/focus-trap';
import { pushOverlay, popOverlay } from '../core/overlay-stack';
import { setupStarRadiogroup, syncStarAria } from '../core/star-rating';
import { escapeHtml } from '../core/escape-html';

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export class UIController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private analyticsUI: AnalyticsUI;
  private appController: AppController | null = null;
  private selectedTags: Set<string> = new Set();
  private allTags: Set<string> = new Set();
  private addMode: boolean = false;
  private searchTerm: string = '';
  private activeCategory: POICategory | 'all' = 'all';
  private activeStatus: POIStatus | 'all' = 'all';
  private userLocation: [number, number] | null = null;
  private currentRating: number = 0;
  private currentReviewRating: number = 0;
  private currentFeature: GeoJSONFeature | null = null;
  private editingReviewId: string | null = null;
  private quickVisitSheet: QuickVisitSheet;
  private sortMode: 'name' | 'rating' | 'recent' | 'distance' = 'name';
  private _listenersAttached = false;
  private pendingImport: GeoJSONFeatureCollection | null = null;
  private releasePoiModalTrap: (() => void) | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;
    this.analyticsUI = new AnalyticsUI(mapEngine);
    this.quickVisitSheet = new QuickVisitSheet();
    this.setupEventListeners();
    this.updateTagList();
    this.applyFilters();
  }

  public setAppController(appController: AppController): void {
    this.appController = appController;
  }

  public setUserLocation(lat: number, lng: number): void {
    this.userLocation = [lat, lng];
  }

  private setupEventListeners(): void {
    if (this._listenersAttached) return;
    this._listenersAttached = true;

    // Export button
    const exportBtn = document.getElementById('export-btn');
    exportBtn?.addEventListener('click', () => this.handleExport());

    // Import button — a second tap while an import is armed confirms it
    // instead of reopening the file picker (see handleImport / armImportConfirm)
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input') as HTMLInputElement;
    importBtn?.addEventListener('click', () => {
      if (this.pendingImport) {
        this.confirmImport();
      } else {
        importInput?.click();
      }
    });
    importInput?.addEventListener('change', (e) => this.handleImport(e));

    // Add POI button
    const addBtn = document.getElementById('add-poi-btn');
    addBtn?.addEventListener('click', () => this.toggleAddMode());

    // Locate me button
    const locateBtn = document.getElementById('locate-btn');
    locateBtn?.addEventListener('click', () => this.locateUser());

    // Analytics button
    const analyticsBtn = document.getElementById('analytics-btn');
    analyticsBtn?.addEventListener('click', () => this.analyticsUI.showAnalytics());

    // Decide: clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    clearFiltersBtn?.addEventListener('click', () => this.clearDecideFilters());

    // Decide: filters toggle (show/hide the tag-filter row)
    const filtersToggleBtn = document.getElementById('filters-toggle-btn');
    const tagFilterSection = document.getElementById('tag-filter-section') as HTMLElement | null;
    filtersToggleBtn?.addEventListener('click', () => {
      if (!tagFilterSection) return;
      const expanded = tagFilterSection.hidden;
      tagFilterSection.hidden = !expanded;
      filtersToggleBtn.classList.toggle('active', expanded);
      filtersToggleBtn.setAttribute('aria-expanded', String(expanded));
    });

    // Decide: search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => this.handleSearch(e));

    // Tab change: reset map markers when leaving Decide
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab;
        if (tab !== 'decide') {
          this.mapEngine.showFeatures(() => true);
        } else {
          this.applyFilters();
        }
      });
    });

    // Rating stars in main form (scoped to the Details panel so the Reviews
    // panel's own .rating-input .star elements aren't double-bound — both
    // share the .star class and would otherwise also set the place rating)
    setupStarRadiogroup(
      Array.from(document.querySelectorAll<HTMLElement>('#poi-panel-details .rating-input .star')),
      (rating) => this.setMainRating(rating)
    );

    // POI form: submit and cancel — wired once so both the "Add" and
    // marker-click ("edit") entry points share the same handlers.
    const poiForm = document.getElementById('poi-form') as HTMLFormElement;
    poiForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePOIFormSubmit();
    });
    document.getElementById('cancel-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('poi-name')?.addEventListener('input', (e) => {
      if ((e.target as HTMLInputElement).value.trim()) this.setNameFieldInvalid(false);
    });

    // Decide: category tabs
    document.querySelectorAll('#tab-decide .category-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).dataset.category as POICategory | 'all';
        this.setActiveCategory(cat);
      });
    });

    // Category tile selector in modal
    document.querySelectorAll('.cat-tile').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const cat = target.dataset.category as POICategory;
        (document.getElementById('poi-category') as HTMLInputElement).value = cat;
        document.querySelectorAll('.cat-tile').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.updateHeroAccent(cat);
      });
    });

    // Decide: status tabs
    document.querySelectorAll('#tab-decide .status-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const status = (e.currentTarget as HTMLElement).dataset.status as POIStatus | 'all';
        this.setActiveStatus(status);
      });
    });


    // Decide: sort chips
    document.querySelectorAll('#tab-decide .sort-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.sortMode = target.dataset.sort as typeof this.sortMode;
        document.querySelectorAll('#tab-decide .sort-chip').forEach(c => c.classList.toggle('active', c === target));
        if (this.sortMode === 'distance' && !this.userLocation) {
          this.locateUser();
        } else {
          this.renderPOIList();
        }
      });
    });

    // Status tile selector in modal
    document.querySelectorAll('.status-tile').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const status = target.dataset.status as POIStatus;
        (document.getElementById('poi-status') as HTMLInputElement).value = status;
        document.querySelectorAll('.status-tile').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.toggleVisitedSections(status);
      });
    });

    // POI modal tab switching
    document.querySelectorAll('.poi-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab!;
        this.switchPOITab(tabName);
        if (tabName === 'reviews' && this.currentFeature) {
          this.renderReviews(this.currentFeature);
          this.setupReviewForm(this.currentFeature);
        }
        if (tabName === 'history' && this.currentFeature) {
          this.renderTimeline(this.currentFeature);
        }
      });
    });

    // Escape key: cancel add mode. Closing the POI modal on Escape is handled
    // by its own focus trap (see openPoiModal) so it only fires when the modal
    // actually holds focus, and doesn't fight with other open overlays.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.addMode) {
        this.cancelAddMode();
      }
    });

    // Backdrop click: close modal
    document.getElementById('poi-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('poi-modal')) this.closeModal();
    });

    // Listen to map events
    this.mapEngine.on('click', (event) => this.handleFeatureClick(event.feature));
    this.mapEngine.on('map:click', (event) => this.handleMapClick(event.feature));
  }

  private openPoiModal(modal: HTMLElement): void {
    modal.style.display = 'flex';
    pushOverlay(modal);
    this.releasePoiModalTrap = trapFocus(modal, { onEscape: () => this.closeModal() });
  }

  private closeModal(): void {
    const modal = document.getElementById('poi-modal');
    if (modal) modal.style.display = 'none';
    this.releasePoiModalTrap?.();
    this.releasePoiModalTrap = null;
    if (modal) popOverlay(modal);
  }

  private setNameFieldInvalid(invalid: boolean): void {
    const nameInput = document.getElementById('poi-name') as HTMLInputElement | null;
    const nameError = document.getElementById('poi-name-error');
    if (!nameInput) return;

    if (invalid) {
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.setAttribute('aria-describedby', 'poi-name-error');
      if (nameError) nameError.hidden = false;
      nameInput.focus();
    } else {
      nameInput.removeAttribute('aria-invalid');
      nameInput.removeAttribute('aria-describedby');
      if (nameError) nameError.hidden = true;
    }
  }

  private cancelAddMode(): void {
    this.addMode = false;
    document.getElementById('add-poi-btn')?.classList.remove('active');
    document.querySelector('.header')?.classList.remove('adding');
    document.getElementById('map')?.classList.remove('adding-mode');
    const hint = document.getElementById('add-mode-hint');
    if (hint) hint.style.display = 'none';
  }

  private setActiveCategory(category: POICategory | 'all'): void {
    this.activeCategory = category;
    document.querySelectorAll('#tab-decide .category-tab').forEach((tab) => {
      (tab as HTMLElement).classList.toggle('active', (tab as HTMLElement).dataset.category === category);
    });
    document.querySelector<HTMLElement>('#tab-decide .category-tab.active')
      ?.scrollIntoView({ behavior: scrollBehavior(), inline: 'start', block: 'nearest' });
    this.applyFilters();
  }

  private setActiveStatus(status: POIStatus | 'all'): void {
    this.activeStatus = status;
    document.querySelectorAll('#tab-decide .status-tab').forEach((tab) => {
      (tab as HTMLElement).classList.toggle('active', (tab as HTMLElement).dataset.status === status);
    });
    const decideRow = document.querySelector<HTMLElement>('#tab-decide .chip-row');
    if (decideRow) decideRow.scrollLeft = 0;
    this.applyFilters();
  }


  private toggleVisitedSections(status: POIStatus | 'all'): void {
    const isWishlist = status === 'wishlist';
    document.querySelectorAll('.poi-visited-only').forEach((el) => {
      (el as HTMLElement).style.display = isWishlist ? 'none' : '';
    });
    document.querySelectorAll('.poi-wishlist-only').forEach((el) => {
      (el as HTMLElement).style.display = isWishlist ? '' : 'none';
    });
  }

  private handleExport(): void {
    this.storage.exportToFile();
    this.showNotification('Data exported successfully!');
  }

  private async handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later

    if (!file) return;

    try {
      const data = await this.storage.parseImportFile(file);
      const existingCount = this.mapEngine.getAllFeatures().length;

      if (existingCount > 0) {
        this.armImportConfirm(data, existingCount);
      } else {
        await this.applyImport(data);
      }
    } catch (error) {
      this.showNotification('Failed to import file', 'error');
    }
  }

  private armImportConfirm(data: GeoJSONFeatureCollection, existingCount: number): void {
    this.pendingImport = data;
    const importBtn = document.getElementById('import-btn');
    const label = importBtn?.querySelector('span');
    if (label) label.textContent = `Replace ${existingCount} places?`;
    importBtn?.classList.add('confirming');

    setTimeout(() => {
      if (this.pendingImport === data) this.cancelImportConfirm();
    }, 5000);
  }

  private cancelImportConfirm(): void {
    this.pendingImport = null;
    const importBtn = document.getElementById('import-btn');
    const label = importBtn?.querySelector('span');
    if (label) label.textContent = 'Import data';
    importBtn?.classList.remove('confirming');
  }

  private async confirmImport(): Promise<void> {
    const data = this.pendingImport;
    if (!data) return;
    this.cancelImportConfirm();
    await this.applyImport(data);
  }

  private async applyImport(data: GeoJSONFeatureCollection): Promise<void> {
    // Back up the current data before it gets overwritten
    this.storage.exportToFile();

    try {
      await this.storage.save(data);
    } catch (error) {
      this.showNotification('Failed to import file', 'error');
      return;
    }

    this.mapEngine.load(data);
    this.updateTagList();
    this.renderPOIList();
    this.showNotification('Data imported successfully!');
  }


  private async handlePOIFormSubmit(): Promise<void> {
    const form = document.getElementById('poi-form') as HTMLFormElement;
    const formData = new FormData(form);

    const id = (document.getElementById('poi-id') as HTMLInputElement).value;
    const name = formData.get('name') as string;
    const lat = parseFloat(formData.get('lat') as string);
    const lng = parseFloat(formData.get('lng') as string);
    const tags = (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean);
    const comments = formData.get('comments') as string;
    const rating = this.currentRating;
    const category = ((document.getElementById('poi-category') as HTMLInputElement).value || 'restaurant') as POICategory;
    const status = ((document.getElementById('poi-status') as HTMLInputElement).value || 'visited') as POIStatus;

    if (!name) {
      this.setNameFieldInvalid(true);
      this.showNotification('Please fill all required fields', 'error');
      return;
    }
    this.setNameFieldInvalid(false);

    if (isNaN(lat) || isNaN(lng)) {
      this.showNotification('Please fill all required fields', 'error');
      return;
    }

    const feature: GeoJSONFeature = {
      type: 'Feature',
      properties: {
        id: id || `poi-${Date.now()}`,
        name,
        category,
        status,
        tags,
        comments,
        rating: status === 'wishlist' ? 0 : rating,
        visited_date: status === 'visited' ? new Date().toISOString().split('T')[0] : undefined,
        created_at: id ? undefined : new Date().toISOString(),
        last_visited: status === 'visited' ? new Date().toISOString() : undefined,
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    };

    if (id) {
      // Update existing - preserve reviews
      const existing = this.mapEngine.getAllFeatures().find(f => f.properties.id === id);
      if (existing?.properties.reviews) {
        feature.properties.reviews = existing.properties.reviews;
      }
      if (existing?.properties.visit_count) {
        feature.properties.visit_count = existing.properties.visit_count;
      }
      if (existing?.properties.created_at) {
        feature.properties.created_at = existing.properties.created_at;
      }
      
      this.mapEngine.updateFeature(id, feature.properties);
    } else {
      // Add new
      feature.properties.reviews = [];
      feature.properties.visit_count = 1;
      this.mapEngine.addFeature(feature);
    }

    // Save to storage — only report success once the save actually lands
    const saved = await this.saveCurrentState();
    if (saved) {
      this.showNotification(id ? 'POI updated successfully!' : 'POI added successfully!');
    }

    // Close modal
    this.closeModal();

    // Update tag list and refresh the list
    this.updateTagList();
    this.renderPOIList();
  }

  private handleFeatureClick(feature: GeoJSONFeature): void {
    const modal = document.getElementById('poi-modal');
    const form = document.getElementById('poi-form') as HTMLFormElement;
    if (!modal || !form) return;

    this.currentFeature = feature;
    this.setNameFieldInvalid(false);

    // Populate form
    (document.getElementById('poi-id') as HTMLInputElement).value = feature.properties.id;
    (document.getElementById('poi-name') as HTMLInputElement).value = feature.properties.name;
    const coords = feature.geometry.coordinates as [number, number];
    (document.getElementById('poi-lat') as HTMLInputElement).value = coords[1].toString();
    (document.getElementById('poi-lng') as HTMLInputElement).value = coords[0].toString();
    this.setupTagChipInput(feature.properties.tags || []);
    (document.getElementById('poi-comments') as HTMLTextAreaElement).value = feature.properties.comments || '';

    // Set category tiles
    const cat = (feature.properties.category || 'restaurant') as POICategory;
    (document.getElementById('poi-category') as HTMLInputElement).value = cat;
    document.querySelectorAll('.cat-tile').forEach((b) => {
      (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.category === cat);
    });

    // Set status tiles
    const status = (feature.properties.status || 'visited') as POIStatus;
    (document.getElementById('poi-status') as HTMLInputElement).value = status;
    document.querySelectorAll('.status-tile').forEach((btn) => {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.status === status);
    });
    this.toggleVisitedSections(status);

    // Set rating stars
    const rating = feature.properties.rating || 0;
    this.currentRating = Math.round(rating);
    (document.getElementById('poi-rating') as HTMLInputElement).value = this.currentRating.toString();
    const mainStars = Array.from(document.querySelectorAll<HTMLElement>('#poi-panel-details .rating-input .star'));
    mainStars.forEach((star, index) => {
      star.textContent = index < this.currentRating ? '★' : '☆';
      star.classList.toggle('active', index < this.currentRating);
    });
    syncStarAria(mainStars);

    // Hero
    (document.getElementById('poi-hero-title') as HTMLElement).textContent = feature.properties.name;
    this.updateHeroAccent(cat);

    // Tabs — show reviews/history only for visited places
    const isVisited = status === 'visited';
    const tabReviews = document.getElementById('poi-tab-reviews');
    const tabHistory = document.getElementById('poi-tab-history');
    if (tabReviews) tabReviews.style.display = isVisited ? '' : 'none';
    if (tabHistory) tabHistory.style.display = isVisited ? '' : 'none';
    this.switchPOITab('details');

    // Delete button — inline confirmation
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.style.display = 'block';
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.remove('confirming');
      deleteBtn.onclick = () => {
        if (deleteBtn.classList.contains('confirming')) {
          this.mapEngine.removeFeature(feature.properties.id);
          this.saveCurrentState();
          this.closeModal();
          this.showNotification('POI deleted');
          this.updateTagList();
          this.renderPOIList();
        } else {
          deleteBtn.classList.add('confirming');
          deleteBtn.textContent = 'Confirm delete?';
          setTimeout(() => {
            if (deleteBtn.classList.contains('confirming')) {
              deleteBtn.classList.remove('confirming');
              deleteBtn.textContent = 'Delete';
            }
          }, 3000);
        }
      };
    }

    // Wire up "I went" modal button
    const logVisitBtn = document.getElementById('log-visit-btn');
    if (logVisitBtn) {
      logVisitBtn.onclick = () => this.handleLogVisit(feature);
    }

    this.openPoiModal(modal);
  }

  private updateTagList(): void {
    this.allTags.clear();
    this.mapEngine.getAllFeatures()
      .filter(f => {
        const status = f.properties.status || 'visited';
        return this.activeStatus === 'all' || status === this.activeStatus;
      })
      .forEach((feature) => {
        feature.properties.tags?.forEach((tag: string) => {
          this.allTags.add(tag);
        });
      });

    const tagContainer = document.getElementById('tag-filters');
    if (!tagContainer) return;

    const sorted = [...this.allTags].sort((a, b) => {
      const aSelected = this.selectedTags.has(a) ? 0 : 1;
      const bSelected = this.selectedTags.has(b) ? 0 : 1;
      return aSelected - bSelected;
    });

    tagContainer.innerHTML = '';
    sorted.forEach((tag) => {
      const button = document.createElement('button');
      button.className = this.selectedTags.has(tag) ? 'tag-btn active' : 'tag-btn';
      button.textContent = tag;
      button.onclick = () => this.toggleTag(tag, button);
      tagContainer.appendChild(button);
    });

    this.updateFiltersToggleBadge();
  }

  private updateFiltersToggleBadge(): void {
    const badge = document.getElementById('filters-toggle-badge');
    if (!badge) return;
    const count = this.selectedTags.size;
    badge.textContent = count > 0 ? `(${count})` : '';
  }

  private toggleTag(tag: string, button: HTMLElement): void {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
      button.classList.remove('active');
    } else {
      this.selectedTags.add(tag);
      button.classList.add('active');
    }
    this.applyFilters();
  }

  private clearDecideFilters(): void {
    this.selectedTags.clear();
    this.searchTerm = '';
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('#tag-filters .tag-btn').forEach((btn) => btn.classList.remove('active'));
    this.applyFilters();
  }

  private applyFilters(): void {
    this.mapEngine.showFeatures((feature) =>
      matchesFilters(feature, {
        category: this.activeCategory,
        status: this.activeStatus,
        selectedTags: this.selectedTags,
        searchTerm: this.searchTerm,
      })
    );
    this.updateTabCounts();
    this.updateTagList();
    this.renderPOIList();
  }

  private updateTabCounts(): void {
    const all = this.mapEngine.getAllFeatures();
    document.querySelectorAll('#tab-decide .status-tab').forEach((btn) => {
      const st = (btn as HTMLElement).dataset.status!;
      const count = all.filter(f =>
        matchesFilters(f, {
          category: this.activeCategory,
          status: st === 'all' ? 'all' : st as POIStatus,
          selectedTags: this.selectedTags,
          searchTerm: this.searchTerm,
        })
      ).length;
      const badge = btn.querySelector('.tab-count');
      if (badge) badge.textContent = count > 0 ? String(count) : '';
    });
  }

  private renderPOIList(): void {
    const items = document.getElementById('poi-list-items');
    const countEl = document.getElementById('poi-list-count');
    if (!items) return;

    // renderPOIList() rebuilds every row on each keystroke in the search box;
    // once rows are focusable, preserve focus across that rebuild so a
    // keyboard user doesn't lose their place while typing.
    const focusedId = document.activeElement instanceof HTMLElement
      && items.contains(document.activeElement)
      && document.activeElement.classList.contains('poi-list-item')
      ? document.activeElement.dataset.id
      : null;

    const filtered = this.mapEngine.getAllFeatures()
      .filter(f => matchesFilters(f, {
        category: this.activeCategory,
        status: this.activeStatus,
        selectedTags: this.selectedTags,
        searchTerm: this.searchTerm,
      }))
      .sort((a, b) => {
        switch (this.sortMode) {
          case 'rating':
            return (b.properties.rating ?? 0) - (a.properties.rating ?? 0);
          case 'recent':
            return new Date(b.properties.created_at ?? 0).getTime()
                 - new Date(a.properties.created_at ?? 0).getTime();
          case 'distance': {
            if (!this.userLocation) return 0;
            const [aLng, aLat] = a.geometry.coordinates as [number, number];
            const [bLng, bLat] = b.geometry.coordinates as [number, number];
            return this.calculateDistance(this.userLocation[0], this.userLocation[1], aLat, aLng)
                 - this.calculateDistance(this.userLocation[0], this.userLocation[1], bLat, bLng);
          }
          default:
            return a.properties.name.localeCompare(b.properties.name);
        }
      });

    if (countEl) countEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      const total = this.mapEngine.getAllFeatures().length;
      let message: string;
      if (total === 0) {
        message = 'No places saved yet. Tap + on the map to add your first.';
      } else if (this.searchTerm) {
        message = `No results for &ldquo;${escapeHtml(this.searchTerm)}&rdquo;.`;
      } else {
        message = 'No places match these filters. Try clearing some.';
      }
      items.innerHTML = `<p class="poi-list-empty">${message}</p>`;
      return;
    }

    items.innerHTML = filtered.map(f => {
      const p = f.properties;
      const cfg = CATEGORY_CONFIG[p.category as POICategory] ?? CATEGORY_CONFIG['other'];
      const rating = p.rating ?? 0;
      const stars = rating > 0
        ? '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating))
        : '';
      const [lng, lat] = f.geometry.coordinates;
      const isWishlist = p.status === 'wishlist';
      return `<div class="poi-list-item" data-lat="${lat}" data-lng="${lng}" data-id="${escapeHtml(p.id)}" role="button" tabindex="0" aria-label="Show ${escapeHtml(p.name)} on the map">
        <span class="poi-list-dot" style="background:${cfg.color}"></span>
        <span class="poi-list-name">${escapeHtml(p.name)}</span>
        ${stars ? `<span class="poi-list-stars">${stars}</span>` : ''}
        ${isWishlist ? `<button type="button" class="log-visit-btn" data-id="${escapeHtml(p.id)}" title="Log visit">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        </button>` : ''}
      </div>`;
    }).join('');

    items.querySelectorAll<HTMLElement>('.poi-list-item').forEach(el => {
      const activate = () => {
        const lat = parseFloat(el.dataset.lat!);
        const lng = parseFloat(el.dataset.lng!);
        this.mapEngine.centerOn(lat, lng, 16);
      };
      el.addEventListener('click', activate);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });

    items.querySelectorAll<HTMLElement>('.log-visit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id!;
        const feature = this.mapEngine.getAllFeatures().find(f => f.properties.id === id);
        if (feature) this.handleLogVisit(feature);
      });
    });

    if (focusedId) {
      const rows = items.querySelectorAll<HTMLElement>('.poi-list-item');
      Array.from(rows).find(row => row.dataset.id === focusedId)?.focus();
    }
  }


  private async saveCurrentState(): Promise<boolean> {
    const data = this.mapEngine.export();
    try {
      await this.storage.save(data);
    } catch (error) {
      this.showNotification('Failed to save — your changes may not persist', 'error');
      return false;
    }
    if (this.appController) {
      await this.appController.refreshData();
    }
    return true;
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    // role="alert"/"status" carry their own implicit aria-live (assertive/
    // polite respectively), so an error toast interrupts immediately while a
    // success toast waits its turn — independent of the region's own
    // aria-live="polite" default (index.html #toast-region).
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const region = document.getElementById('toast-region');
    (region ?? document.body).appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  private async handleLogVisit(feature: GeoJSONFeature): Promise<void> {
    logVisit(feature.properties);
    this.mapEngine.updateFeature(feature.properties.id, feature.properties);
    await this.saveCurrentState();
    this.renderPOIList();
    this.showNotification('Visit logged!');

    if (this.currentFeature?.properties.id === feature.properties.id) {
      this.syncModalToVisited(feature);
    }

    this.quickVisitSheet.open(feature.properties.name, (rating, text) => {
      if (rating > 0 || text) {
        attachVisitReview(feature.properties, rating, text);
        this.mapEngine.updateFeature(feature.properties.id, feature.properties);
        this.saveCurrentState();
        this.renderPOIList();
        if (this.currentFeature?.properties.id === feature.properties.id) {
          this.renderReviews(feature);
        }
      }
    });
  }

  private syncModalToVisited(feature: GeoJSONFeature): void {
    (document.getElementById('poi-status') as HTMLInputElement).value = 'visited';
    document.querySelectorAll('.status-tile').forEach((btn) => {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.status === 'visited');
    });
    this.toggleVisitedSections('visited');
    const tabReviews = document.getElementById('poi-tab-reviews');
    const tabHistory = document.getElementById('poi-tab-history');
    if (tabReviews) tabReviews.style.display = '';
    if (tabHistory) tabHistory.style.display = '';
    (document.getElementById('poi-hero-title') as HTMLElement).textContent = feature.properties.name;
  }

  // --- NEW FEATURES ---

  /**
   * Toggle "Add POI" mode - click map to add
   */
  private toggleAddMode(): void {
    this.addMode = !this.addMode;
    const addBtn = document.getElementById('add-poi-btn');
    const header = document.querySelector('.header');
    const mapEl = document.getElementById('map');
    const hint = document.getElementById('add-mode-hint');

    if (this.addMode) {
      addBtn?.classList.add('active');
      header?.classList.add('adding');
      mapEl?.classList.add('adding-mode');
      if (hint) hint.style.display = 'flex';
    } else {
      addBtn?.classList.remove('active');
      header?.classList.remove('adding');
      mapEl?.classList.remove('adding-mode');
      if (hint) hint.style.display = 'none';
    }
  }

  private handleMapClick(feature: GeoJSONFeature): void {
    if (this.addMode) {
      this.showAddPOIForm(feature.properties.lat, feature.properties.lng);
      this.cancelAddMode();
    }
  }

  /**
   * Show add/edit form with optional coordinates
   */
  private showAddPOIForm(lat?: number, lng?: number): void {
    const modal = document.getElementById('poi-modal');
    const form = document.getElementById('poi-form') as HTMLFormElement;
    
    if (!modal || !form) return;

    // Reset form
    form.reset();
    (document.getElementById('poi-id') as HTMLInputElement).value = '';
    this.currentRating = 0;
    this.setNameFieldInvalid(false);
    this.setupTagChipInput([]);

    const resetStars = Array.from(document.querySelectorAll<HTMLElement>('#poi-panel-details .rating-input .star'));
    resetStars.forEach((star) => {
      star.textContent = '☆';
      star.classList.remove('active');
    });
    syncStarAria(resetStars);

    this.currentFeature = null;

    (document.getElementById('poi-category') as HTMLInputElement).value = 'restaurant';
    document.querySelectorAll('.cat-tile').forEach((b) => {
      (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.category === 'restaurant');
    });

    // Default status tiles
    const defaultStatus = (this.activeStatus === 'all' ? 'visited' : this.activeStatus) as POIStatus;
    (document.getElementById('poi-status') as HTMLInputElement).value = defaultStatus;
    document.querySelectorAll('.status-tile').forEach((btn) => {
      (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.status === defaultStatus);
    });
    this.toggleVisitedSections(defaultStatus);

    // Pre-fill coordinates if provided
    if (lat !== undefined && lng !== undefined) {
      (document.getElementById('poi-lat') as HTMLInputElement).value = lat.toFixed(6);
      (document.getElementById('poi-lng') as HTMLInputElement).value = lng.toFixed(6);
    }

    // Hero
    (document.getElementById('poi-hero-title') as HTMLElement).textContent = 'New Place';
    const heroBar = document.getElementById('poi-hero-bar');
    if (heroBar) heroBar.style.background = 'rgba(255,255,255,0.08)';

    // Hide reviews/history tabs, reset to details
    const tabReviews = document.getElementById('poi-tab-reviews');
    const tabHistory = document.getElementById('poi-tab-history');
    if (tabReviews) tabReviews.style.display = 'none';
    if (tabHistory) tabHistory.style.display = 'none';
    this.switchPOITab('details');

    // Hide delete button for new places
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    // Show modal
    this.openPoiModal(modal);
  }

  /**
   * Locate user using GPS
   */
  private locateUser(): void {
    if (!navigator.geolocation) {
      this.showNotification('Geolocation not supported', 'error');
      return;
    }

    const locateBtn = document.getElementById('locate-btn');
    locateBtn?.classList.add('loading');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.userLocation = [lat, lng];
        this.mapEngine.centerOn(lat, lng, 15);

        locateBtn?.classList.remove('loading');
        this.showNotification('Location found!', 'success');

        if (this.sortMode === 'distance') this.renderPOIList();
      },
      (error) => {
        locateBtn?.classList.remove('loading');
        this.showNotification('Could not get location', 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  /**
   * Handle search input
   */
  private handleSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value.toLowerCase().trim();
    this.applyFilters();
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- RATINGS & REVIEWS FEATURES ---

  /**
   * Handle rating star clicks
   */
  private setMainRating(rating: number): void {
    this.currentRating = rating;

    const ratingInput = document.getElementById('poi-rating') as HTMLInputElement;
    if (ratingInput) ratingInput.value = rating.toString();

    document.querySelectorAll('#poi-panel-details .rating-input .star').forEach((s, index) => {
      if (index < rating) {
        s.textContent = '★';
        s.classList.add('active');
      } else {
        s.textContent = '☆';
        s.classList.remove('active');
      }
    });
  }

  /**
   * Show reviews modal
   */
  private switchPOITab(tab: string): void {
    document.querySelectorAll('.poi-tab').forEach((t) => {
      t.classList.toggle('active', (t as HTMLElement).dataset.tab === tab);
    });
    document.querySelectorAll('.poi-panel').forEach((p) => {
      (p as HTMLElement).classList.toggle('active', p.id === `poi-panel-${tab}`);
    });
  }

  private updateHeroAccent(cat: POICategory): void {
    const bar = document.getElementById('poi-hero-bar');
    if (bar) bar.style.background = CATEGORY_CONFIG[cat]?.color ?? '#0088AA';
  }

  private renderReviews(feature: GeoJSONFeature): void {
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewsList) return;

    const reviews = feature.properties.reviews || [];

    if (reviews.length === 0) {
      reviewsList.innerHTML = '<p style="color: #666; text-align: center;">No reviews yet. Be the first!</p>';
      return;
    }

    reviewsList.innerHTML = '';

    [...reviews]
      .sort((a: Review, b: Review) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((review: Review) => {
        const item = document.createElement('div');
        item.className = 'review-item';
        item.dataset.reviewId = review.id;

        const header = document.createElement('div');
        header.className = 'review-header';

        const ratingSpan = document.createElement('span');
        ratingSpan.className = 'review-rating';
        ratingSpan.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

        const dateSpan = document.createElement('span');
        dateSpan.className = 'review-date';
        dateSpan.textContent = new Date(review.date).toLocaleDateString();

        header.appendChild(ratingSpan);
        header.appendChild(dateSpan);

        const textDiv = document.createElement('div');
        textDiv.className = 'review-text';
        textDiv.textContent = review.text;

        const actions = document.createElement('div');
        actions.className = 'review-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'review-edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => this.startEditReview(feature, review.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'review-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.dataset.reviewId = review.id;
        deleteBtn.addEventListener('click', (e) => this.deleteReview(feature, review.id, e.currentTarget as HTMLElement));

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(header);
        item.appendChild(textDiv);
        item.appendChild(actions);

        reviewsList.appendChild(item);
      });
  }

  /**
   * Setup review form
   */
  private setupReviewForm(feature: GeoJSONFeature): void {
    this.currentReviewRating = 0;
    this.editingReviewId = null;
    
    // Reset review form
    const reviewText = document.getElementById('review-text') as HTMLTextAreaElement;
    if (reviewText) reviewText.value = '';
    
    const reviewRating = document.getElementById('review-rating') as HTMLInputElement;
    if (reviewRating) reviewRating.value = '0';
    
    // Update button text
    const addReviewBtn = document.getElementById('add-review-btn');
    if (addReviewBtn) addReviewBtn.textContent = 'Add Review';
    
    const reviewStars = Array.from(document.querySelectorAll<HTMLElement>('.review-star'));
    reviewStars.forEach((star) => {
      star.textContent = '☆';
      star.classList.remove('active');
    });
    setupStarRadiogroup(reviewStars, (rating) => {
      this.currentReviewRating = rating;
      if (reviewRating) reviewRating.value = rating.toString();
      reviewStars.forEach((s, index) => {
        if (index < rating) {
          s.textContent = '★';
          s.classList.add('active');
        } else {
          s.textContent = '☆';
          s.classList.remove('active');
        }
      });
    });
    
    // Add review button
    addReviewBtn!.onclick = () => {
      if (this.editingReviewId) {
        this.updateReview(feature);
      } else {
        this.addReview(feature);
      }
    };
    
  }

  /**
   * Add a new review
   */
  private addReview(feature: GeoJSONFeature): void {
    const reviewText = (document.getElementById('review-text') as HTMLTextAreaElement).value.trim();
    
    if (!reviewText) {
      this.showNotification('❌ Please write a review', 'error');
      return;
    }
    
    if (this.currentReviewRating === 0) {
      this.showNotification('❌ Please select a rating', 'error');
      return;
    }
    
    attachVisitReview(feature.properties, this.currentReviewRating, reviewText);
    feature.properties.last_visited = new Date().toISOString();
    feature.properties.visit_count = (feature.properties.visit_count || 0) + 1;
    
    // Update map
    this.mapEngine.updateFeature(feature.properties.id, feature.properties);
    
    // Save to storage
    this.saveCurrentState();
    
    // Re-render reviews
    this.renderReviews(feature);
    
    // Reset form
    this.setupReviewForm(feature);
    
    this.showNotification('Review added!', 'success');
  }

  /**
   * Delete a review
   */
  private deleteReview(feature: GeoJSONFeature, reviewId: string, btn?: HTMLElement): void {
    if (btn && !btn.dataset.confirming) {
      btn.dataset.confirming = '1';
      btn.textContent = 'Confirm?';
      setTimeout(() => {
        if (btn.dataset.confirming) {
          delete btn.dataset.confirming;
          btn.textContent = 'Delete';
        }
      }, 3000);
      return;
    }
    if (btn) delete btn.dataset.confirming;
    
    feature.properties.reviews = feature.properties.reviews.filter((r: Review) => r.id !== reviewId);
    
    // Recalculate average rating
    if (feature.properties.reviews.length > 0) {
      const avgRating = feature.properties.reviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / feature.properties.reviews.length;
      feature.properties.rating = avgRating;
    } else {
      feature.properties.rating = 0;
    }
    
    // Update map
    this.mapEngine.updateFeature(feature.properties.id, feature.properties);
    
    // Save to storage
    this.saveCurrentState();
    
    // Re-render reviews
    this.renderReviews(feature);
    
    this.showNotification('Review deleted', 'success');
  }

  /**
   * Start editing a review
   */
  private startEditReview(feature: GeoJSONFeature, reviewId: string): void {
    const review = feature.properties.reviews.find((r: Review) => r.id === reviewId);
    if (!review) return;

    this.editingReviewId = reviewId;

    // Populate form with review data
    const reviewText = document.getElementById('review-text') as HTMLTextAreaElement;
    if (reviewText) reviewText.value = review.text;

    const reviewRating = document.getElementById('review-rating') as HTMLInputElement;
    if (reviewRating) reviewRating.value = review.rating.toString();

    this.currentReviewRating = review.rating;

    const reviewStars = Array.from(document.querySelectorAll<HTMLElement>('.review-star'));
    reviewStars.forEach((star, index) => {
      if (index < review.rating) {
        star.textContent = '★';
        star.classList.add('active');
      } else {
        star.textContent = '☆';
        star.classList.remove('active');
      }
    });
    syncStarAria(reviewStars);

    // Change button text
    const addReviewBtn = document.getElementById('add-review-btn');
    if (addReviewBtn) {
      addReviewBtn.textContent = 'Update Review';
      addReviewBtn.classList.add('btn-warning');
    }

    // Scroll to form
    reviewText?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    reviewText?.focus();

    this.showNotification('Editing review...', 'success');
  }

  /**
   * Update an existing review
   */
  private updateReview(feature: GeoJSONFeature): void {
    const reviewText = (document.getElementById('review-text') as HTMLTextAreaElement).value.trim();
    
    if (!reviewText) {
      this.showNotification('Please write a review', 'error');
      return;
    }
    
    if (this.currentReviewRating === 0) {
      this.showNotification('Please select a rating', 'error');
      return;
    }

    // Find and update the review
    const reviewIndex = feature.properties.reviews.findIndex((r: Review) => r.id === this.editingReviewId);
    if (reviewIndex === -1) return;

    feature.properties.reviews[reviewIndex] = {
      ...feature.properties.reviews[reviewIndex],
      rating: this.currentReviewRating,
      text: reviewText,
      // Keep original date, don't update it
    };

    // Recalculate average rating
    const avgRating = feature.properties.reviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / feature.properties.reviews.length;
    feature.properties.rating = avgRating;

    // Update map
    this.mapEngine.updateFeature(feature.properties.id, feature.properties);

    // Save to storage
    this.saveCurrentState();

    // Re-render reviews
    this.renderReviews(feature);

    // Reset form
    this.setupReviewForm(feature);

    // Reset button
    const addReviewBtn = document.getElementById('add-review-btn');
    if (addReviewBtn) {
      addReviewBtn.classList.remove('btn-warning');
    }

    this.showNotification('Review updated!', 'success');
  }

  private renderTimeline(feature: GeoJSONFeature): void {
    const timelineView = document.getElementById('timeline-view');
    if (!timelineView) return;

    const reviews = feature.properties.reviews || [];
    const visitCount = feature.properties.visit_count || reviews.length;
    const avgRating = feature.properties.rating || 0;
    const firstVisit = feature.properties.created_at || (reviews[0]?.date);
    const lastVisit = feature.properties.last_visited || (reviews[reviews.length - 1]?.date);

    // Stats box
    const statsHTML = `
      <div class="stats-box">
        <div class="stat-item">
          <div class="stat-value">${visitCount}</div>
          <div class="stat-label">Total Visits</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avgRating.toFixed(1)}</div>
          <div class="stat-label">Avg Rating</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${reviews.length}</div>
          <div class="stat-label">Reviews</div>
        </div>
      </div>
    `;

    // Timeline items
    const timelineHTML = reviews.length > 0 ? `
      <div class="timeline">
        ${reviews
          .sort((a: Review, b: Review) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((review: Review) => {
            const date = new Date(review.date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            return `
              <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-date">${date}</div>
                  <div class="timeline-place">${escapeHtml(feature.properties.name)}</div>
                  <div class="timeline-rating" data-rating="${review.rating}"></div>
                  <div class="timeline-text">${escapeHtml(review.text)}</div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    ` : '<p style="text-align: center; color: #666;">No visit history yet. Add reviews to build your timeline!</p>';

    timelineView.innerHTML = statsHTML + timelineHTML;
  }

  private setupTagChipInput(existingTags: string[]): void {
    const containerEl = document.getElementById('tag-chip-container');
    if (!containerEl) return;
    // Clone-and-replace to flush any previously attached listeners
    const container = containerEl.cloneNode(true) as HTMLElement;
    containerEl.parentNode!.replaceChild(container, containerEl);

    const textInput = document.getElementById('tag-chip-text') as HTMLInputElement;
    const hiddenInput = document.getElementById('poi-tags') as HTMLInputElement;
    const suggestions = document.getElementById('tag-suggestions');
    if (!textInput || !hiddenInput || !suggestions) return;

    let chipTags: string[] = [...existingTags];

    const syncHidden = () => {
      hiddenInput.value = chipTags.join(', ');
    };

    const renderChips = () => {
      container.querySelectorAll('.tag-chip').forEach(c => c.remove());
      chipTags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `${tag}<span class="tag-chip-remove" data-tag="${tag}">×</span>`;
        chip.querySelector('.tag-chip-remove')!.addEventListener('click', () => {
          chipTags = chipTags.filter(t => t !== tag);
          renderChips();
          syncHidden();
        });
        container.insertBefore(chip, textInput);
      });
    };

    const addTag = (raw: string) => {
      const tag = raw.trim().toLowerCase();
      if (tag && !chipTags.includes(tag)) {
        chipTags.push(tag);
        renderChips();
        syncHidden();
      }
      textInput.value = '';
      suggestions.style.display = 'none';
    };

    const renderSuggestions = (query: string) => {
      const q = query.toLowerCase();
      const matches = [...this.allTags]
        .filter(t => t.includes(q) && !chipTags.includes(t))
        .slice(0, 8);
      if (!q || matches.length === 0) {
        suggestions.style.display = 'none';
        return;
      }
      suggestions.innerHTML = matches.map(t =>
        `<div class="tag-suggestion-item">${t}</div>`
      ).join('');
      suggestions.style.display = 'block';
      suggestions.querySelectorAll<HTMLElement>('.tag-suggestion-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          addTag(el.textContent!);
        });
      });
    };

    textInput.addEventListener('input', () => renderSuggestions(textInput.value));
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(textInput.value);
      } else if (e.key === 'Backspace' && textInput.value === '' && chipTags.length > 0) {
        chipTags.pop();
        renderChips();
        syncHidden();
      }
    });
    textInput.addEventListener('blur', () => {
      setTimeout(() => { suggestions.style.display = 'none'; }, 150);
    });
    container.addEventListener('click', () => textInput.focus());

    renderChips();
    syncHidden();
  }
}