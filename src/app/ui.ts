/**
 * UI Controller - Food App Specific
 * Handles all user interface interactions
 */

import { GeoJSONFeature, POICategory, POIStatus, CATEGORY_CONFIG } from '../core/types';
import { matchesFilters } from '../core/poi-filters';
import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { AnalyticsUI } from './analytics-ui.ts';
import { AppController } from './app-controller';

export class UIController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private analyticsUI: AnalyticsUI;
  private appController: AppController | null = null;
  private selectedTags: Set<string> = new Set();
  private allTags: Set<string> = new Set();
  private addMode: boolean = false;
  private searchTerm: string = '';
  private activeStatus: POIStatus | 'all' = 'all';
  private userLocation: [number, number] | null = null;
  private currentRating: number = 0;
  private currentReviewRating: number = 0;
  private currentFeature: GeoJSONFeature | null = null;
  private editingReviewId: string | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;
    this.analyticsUI = new AnalyticsUI(mapEngine);
    this.setupEventListeners();
    this.updateTagList();
    this.applyFilters();
  }

  public setAppController(appController: AppController): void {
    this.appController = appController;
  }

  private setupEventListeners(): void {
    // Export button
    const exportBtn = document.getElementById('export-btn');
    exportBtn?.addEventListener('click', () => this.handleExport());

    // Import button
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input') as HTMLInputElement;
    importBtn?.addEventListener('click', () => importInput?.click());
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

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    clearFiltersBtn?.addEventListener('click', () => this.clearFilters());

    // Search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => this.handleSearch(e));

    // Rating stars in main form
    document.querySelectorAll('.rating-input .star').forEach((star) => {
      star.addEventListener('click', (e) => this.handleRatingClick(e));
    });

    // Status tabs
    document.querySelectorAll('.status-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const status = (e.currentTarget as HTMLElement).dataset.status as POIStatus | 'all';
        this.setActiveStatus(status);
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

    // Escape key: close modal and cancel add mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        if (this.addMode) this.cancelAddMode();
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

  private closeModal(): void {
    const modal = document.getElementById('poi-modal');
    if (modal) modal.style.display = 'none';
  }

  private cancelAddMode(): void {
    this.addMode = false;
    document.getElementById('add-poi-btn')?.classList.remove('active');
    document.querySelector('.header')?.classList.remove('adding');
    document.getElementById('map')?.classList.remove('adding-mode');
  }

  private setActiveStatus(status: POIStatus | 'all'): void {
    this.activeStatus = status;
    document.querySelectorAll('.status-tab').forEach((tab) => {
      (tab as HTMLElement).classList.toggle('active', (tab as HTMLElement).dataset.status === status);
    });
    this.applyFilters();
  }

  private toggleVisitedSections(status: POIStatus | 'all'): void {
    const isWishlist = status === 'wishlist';
    document.querySelectorAll('.poi-visited-only').forEach((el) => {
      (el as HTMLElement).style.display = isWishlist ? 'none' : '';
    });
  }

  private handleExport(): void {
    this.storage.exportToFile();
    this.showNotification('Data exported successfully!');
  }

  private async handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const data = await this.storage.importFromFile(file);
      this.mapEngine.load(data);
      this.updateTagList();
      this.showNotification('Data imported successfully!');
    } catch (error) {
      this.showNotification('Failed to import file', 'error');
    }
  }


  private handlePOIFormSubmit(): void {
    const form = document.getElementById('poi-form') as HTMLFormElement;
    const formData = new FormData(form);

    const id = (document.getElementById('poi-id') as HTMLInputElement).value;
    const name = formData.get('name') as string;
    const lat = parseFloat(formData.get('lat') as string);
    const lng = parseFloat(formData.get('lng') as string);
    const tags = (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean);
    const comments = formData.get('comments') as string;
    const rating = this.currentRating;
    const category = ((document.getElementById('poi-category') as HTMLInputElement).value || 'food') as POICategory;
    const status = ((document.getElementById('poi-status') as HTMLInputElement).value || 'visited') as POIStatus;

    if (!name || isNaN(lat) || isNaN(lng)) {
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
      this.showNotification('POI updated successfully!');
    } else {
      // Add new
      feature.properties.reviews = [];
      feature.properties.visit_count = 1;
      this.mapEngine.addFeature(feature);
      this.showNotification('POI added successfully!');
    }

    // Save to storage
    this.saveCurrentState();

    // Close modal
    const modal = document.getElementById('poi-modal');
    if (modal) modal.style.display = 'none';

    // Update tag list
    this.updateTagList();
  }

  private handleFeatureClick(feature: GeoJSONFeature): void {
    const modal = document.getElementById('poi-modal');
    const form = document.getElementById('poi-form') as HTMLFormElement;
    if (!modal || !form) return;

    this.currentFeature = feature;

    // Populate form
    (document.getElementById('poi-id') as HTMLInputElement).value = feature.properties.id;
    (document.getElementById('poi-name') as HTMLInputElement).value = feature.properties.name;
    const coords = feature.geometry.coordinates as [number, number];
    (document.getElementById('poi-lat') as HTMLInputElement).value = coords[1].toString();
    (document.getElementById('poi-lng') as HTMLInputElement).value = coords[0].toString();
    this.setupTagChipInput(feature.properties.tags || []);
    (document.getElementById('poi-comments') as HTMLTextAreaElement).value = feature.properties.comments || '';

    // Set category (hidden, not shown in form)
    const cat = (feature.properties.category || 'food') as POICategory;
    (document.getElementById('poi-category') as HTMLInputElement).value = cat;

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
    document.querySelectorAll('.rating-input .star').forEach((star, index) => {
      star.textContent = index < this.currentRating ? '★' : '☆';
      star.classList.toggle('active', index < this.currentRating);
    });

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

    // Delete button
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.style.display = 'block';
      deleteBtn.onclick = () => {
        if (confirm('Are you sure you want to delete this POI?')) {
          this.mapEngine.removeFeature(feature.properties.id);
          this.saveCurrentState();
          modal.style.display = 'none';
          this.showNotification('POI deleted');
          this.updateTagList();
        }
      };
    }

    modal.style.display = 'flex';
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

    // Render tag filter buttons
    const tagContainer = document.getElementById('tag-filters');
    if (!tagContainer) return;

    tagContainer.innerHTML = '';

    this.allTags.forEach((tag) => {
      const button = document.createElement('button');
      button.className = 'tag-btn';
      button.textContent = tag;
      button.onclick = () => this.toggleTag(tag, button);
      tagContainer.appendChild(button);
    });
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

  private clearFilters(): void {
    this.selectedTags.clear();
    this.searchTerm = '';
    
    // Clear search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    
    // Remove active class from all buttons
    document.querySelectorAll('.tag-btn').forEach((btn) => {
      btn.classList.remove('active');
    });

    this.applyFilters();
  }

  private applyFilters(): void {
    this.mapEngine.showFeatures((feature) =>
      matchesFilters(feature, {
        status: this.activeStatus,
        selectedTags: this.selectedTags,
        searchTerm: this.searchTerm,
      })
    );
    this.updateTabCounts();
    this.renderPOIList();
  }

  private updateTabCounts(): void {
    const all = this.mapEngine.getAllFeatures();

    document.querySelectorAll('.status-tab').forEach((btn) => {
      const st = (btn as HTMLElement).dataset.status!;
      const count = all.filter(f =>
        matchesFilters(f, {
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

    const filtered = this.mapEngine.getAllFeatures()
      .filter(f => matchesFilters(f, {
        status: this.activeStatus,
        selectedTags: this.selectedTags,
        searchTerm: this.searchTerm,
      }))
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name));

    if (countEl) countEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      items.innerHTML = '<p class="poi-list-empty">No places match the current filters.</p>';
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
      return `<div class="poi-list-item" data-lat="${lat}" data-lng="${lng}">
        <span class="poi-list-dot" style="background:${cfg.color}"></span>
        <span class="poi-list-name">${p.name}</span>
        ${stars ? `<span class="poi-list-stars">${stars}</span>` : ''}
      </div>`;
    }).join('');

    items.querySelectorAll<HTMLElement>('.poi-list-item').forEach(el => {
      el.addEventListener('click', () => {
        const lat = parseFloat(el.dataset.lat!);
        const lng = parseFloat(el.dataset.lng!);
        this.mapEngine.centerOn(lat, lng, 16);
      });
    });
  }

  private async saveCurrentState(): Promise<void> {
    const data = this.mapEngine.export();
    await this.storage.save(data);
    if (this.appController) {
      await this.appController.refreshData();
    }
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
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

    if (this.addMode) {
      addBtn?.classList.add('active');
      header?.classList.add('adding');
      mapEl?.classList.add('adding-mode');
    } else {
      addBtn?.classList.remove('active');
      header?.classList.remove('adding');
      mapEl?.classList.remove('adding-mode');
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
    this.setupTagChipInput([]);

    document.querySelectorAll('.rating-input .star').forEach((star) => {
      star.textContent = '☆';
      star.classList.remove('active');
    });

    this.currentFeature = null;

    (document.getElementById('poi-category') as HTMLInputElement).value = 'food';

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
    modal.style.display = 'flex';

    // Form handlers
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handlePOIFormSubmit();
    };
    document.getElementById('cancel-btn')!.onclick = () => {
      modal.style.display = 'none';
    };
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

        // Update distances if displayed
        this.updateDistances();
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

  /**
   * Update distance displays
   */
  private updateDistances(): void {
    if (!this.userLocation) return;

    const [userLat, userLng] = this.userLocation;
    
    // Add distance info to sidebar
    const distanceInfo = document.getElementById('distance-info');
    if (distanceInfo) {
      const features = this.mapEngine.getAllFeatures();
      const nearest = features
        .map(f => {
          const coords = f.geometry.coordinates as [number, number];
          const distance = this.calculateDistance(userLat, userLng, coords[1], coords[0]);
          return { name: f.properties.name, distance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      distanceInfo.innerHTML = `
        <h3>Nearest Places:</h3>
        <ul>
          ${nearest.map(p => `<li>${p.name} - ${p.distance.toFixed(1)} km</li>`).join('')}
        </ul>
      `;
    }
  }

  // --- RATINGS & REVIEWS FEATURES ---

  /**
   * Handle rating star clicks
   */
  private handleRatingClick(event: Event): void {
    const star = event.target as HTMLElement;
    const rating = parseInt(star.dataset.rating || '0');
    this.currentRating = rating;
    
    // Update hidden input
    const ratingInput = document.getElementById('poi-rating') as HTMLInputElement;
    if (ratingInput) ratingInput.value = rating.toString();
    
    const stars = star.parentElement?.querySelectorAll('.star');
    stars?.forEach((s, index) => {
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

    reviewsList.innerHTML = reviews
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((review: any) => {
        const date = new Date(review.date).toLocaleDateString();
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

        return `
          <div class="review-item" data-review-id="${review.id}">
            <div class="review-header">
              <span class="review-rating">${stars}</span>
              <span class="review-date">${date}</span>
            </div>
            <div class="review-text">${review.text}</div>
            <div class="review-actions">
              <button class="review-edit" onclick="window.editReview('${review.id}')">Edit</button>
              <button class="review-delete" onclick="window.deleteReview('${review.id}')">Delete</button>
            </div>
          </div>
        `;
      })
      .join('');
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
    
    const reviewStars = document.querySelectorAll('.review-star');
    reviewStars.forEach((star) => {
      star.textContent = '☆';
      star.classList.remove('active');

      (star as HTMLElement).onclick = (e) => {
        const rating = parseInt((e.target as HTMLElement).dataset.rating || '0');
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
      };
    });
    
    // Add review button
    addReviewBtn!.onclick = () => {
      if (this.editingReviewId) {
        this.updateReview(feature);
      } else {
        this.addReview(feature);
      }
    };
    
    // Make functions globally accessible
    (window as any).deleteReview = (reviewId: string) => this.deleteReview(feature, reviewId);
    (window as any).editReview = (reviewId: string) => this.startEditReview(feature, reviewId);
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
    
    const newReview = {
      id: `review-${Date.now()}`,
      date: new Date().toISOString(),
      rating: this.currentReviewRating,
      text: reviewText,
    };
    
    // Add to feature
    if (!feature.properties.reviews) {
      feature.properties.reviews = [];
    }
    feature.properties.reviews.push(newReview);
    
    // Update average rating
    const avgRating = feature.properties.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / feature.properties.reviews.length;
    feature.properties.rating = avgRating;
    
    // Update last visited
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
  private deleteReview(feature: GeoJSONFeature, reviewId: string): void {
    if (!confirm('Delete this review?')) return;
    
    feature.properties.reviews = feature.properties.reviews.filter((r: any) => r.id !== reviewId);
    
    // Recalculate average rating
    if (feature.properties.reviews.length > 0) {
      const avgRating = feature.properties.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / feature.properties.reviews.length;
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
    const review = feature.properties.reviews.find((r: any) => r.id === reviewId);
    if (!review) return;

    this.editingReviewId = reviewId;

    // Populate form with review data
    const reviewText = document.getElementById('review-text') as HTMLTextAreaElement;
    if (reviewText) reviewText.value = review.text;

    const reviewRating = document.getElementById('review-rating') as HTMLInputElement;
    if (reviewRating) reviewRating.value = review.rating.toString();

    this.currentReviewRating = review.rating;

    const reviewStars = document.querySelectorAll('.review-star');
    reviewStars.forEach((star, index) => {
      if (index < review.rating) {
        star.textContent = '★';
        star.classList.add('active');
      } else {
        star.textContent = '☆';
        star.classList.remove('active');
      }
    });

    // Change button text
    const addReviewBtn = document.getElementById('add-review-btn');
    if (addReviewBtn) {
      addReviewBtn.textContent = 'Update Review';
      addReviewBtn.classList.add('btn-warning');
    }

    // Scroll to form
    reviewText?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const reviewIndex = feature.properties.reviews.findIndex((r: any) => r.id === this.editingReviewId);
    if (reviewIndex === -1) return;

    feature.properties.reviews[reviewIndex] = {
      ...feature.properties.reviews[reviewIndex],
      rating: this.currentReviewRating,
      text: reviewText,
      // Keep original date, don't update it
    };

    // Recalculate average rating
    const avgRating = feature.properties.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / feature.properties.reviews.length;
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
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((review: any) => {
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
                  <div class="timeline-place">${feature.properties.name}</div>
                  <div class="timeline-rating" data-rating="${review.rating}"></div>
                  <div class="timeline-text">${review.text}</div>
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
    const container = document.getElementById('tag-chip-container');
    const textInput = document.getElementById('tag-chip-text') as HTMLInputElement;
    const hiddenInput = document.getElementById('poi-tags') as HTMLInputElement;
    const suggestions = document.getElementById('tag-suggestions');
    if (!container || !textInput || !hiddenInput || !suggestions) return;

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