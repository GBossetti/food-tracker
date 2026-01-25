/**
 * UI Controller - Food App Specific
 * Handles all user interface interactions
 */

import { GeoJSONFeature } from '../core/types';
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
  private userLocation: [number, number] | null = null;
  private currentPOIId: string | null = null;
  private currentRating: number = 0;
  private currentReviewRating: number = 0;
  private editingReviewId: string | null = null;

  constructor(mapEngine: MapEngine, storage: StorageLayer) {
    this.mapEngine = mapEngine;
    this.storage = storage;
    this.analyticsUI = new AnalyticsUI(mapEngine);
    this.setupEventListeners();
    this.updateTagList();
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

    // Listen to map events
    this.mapEngine.on('click', (event) => this.handleFeatureClick(event.feature));
    this.mapEngine.on('map:click', (event) => this.handleMapClick(event.feature));
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

    if (!name || isNaN(lat) || isNaN(lng)) {
      this.showNotification('Please fill all required fields', 'error');
      return;
    }

    const feature: GeoJSONFeature = {
      type: 'Feature',
      properties: {
        id: id || `poi-${Date.now()}`,
        name,
        tags,
        comments,
        rating,
        visited_date: new Date().toISOString().split('T')[0],
        created_at: id ? undefined : new Date().toISOString(),
        last_visited: new Date().toISOString(),
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
    // Show edit form with feature data
    const modal = document.getElementById('poi-modal');
    const form = document.getElementById('poi-form') as HTMLFormElement;
    
    if (!modal || !form) return;

    // Populate form
    (document.getElementById('poi-id') as HTMLInputElement).value = feature.properties.id;
    (document.getElementById('poi-name') as HTMLInputElement).value = feature.properties.name;
    
    const coords = feature.geometry.coordinates as [number, number];
    (document.getElementById('poi-lat') as HTMLInputElement).value = coords[1].toString();
    (document.getElementById('poi-lng') as HTMLInputElement).value = coords[0].toString();
    (document.getElementById('poi-tags') as HTMLInputElement).value = feature.properties.tags?.join(', ') || '';
    (document.getElementById('poi-comments') as HTMLTextAreaElement).value = feature.properties.comments || '';

    // Set rating
    const rating = feature.properties.rating || 0;
    this.currentRating = Math.round(rating);
    (document.getElementById('poi-rating') as HTMLInputElement).value = this.currentRating.toString();
    
    // Update rating stars - Replace with SVG icons (see SVG_GUIDE.md)
    document.querySelectorAll('.rating-input .star').forEach((star, index) => {
      if (index < this.currentRating) {
        star.textContent = '';
        star.classList.add('active');
      } else {
        star.textContent = '';
        star.classList.remove('active');
      }
    });

    // Show modal
    modal.style.display = 'flex';

    // Show extra buttons for existing POIs
    const deleteBtn = document.getElementById('delete-btn');
    const reviewsBtn = document.getElementById('reviews-btn');
    const historyBtn = document.getElementById('history-btn');
    
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
    
    if (reviewsBtn) {
      reviewsBtn.style.display = 'block';
      reviewsBtn.onclick = () => {
        modal.style.display = 'none';
        this.showReviewsModal(feature);
      };
    }
    
    if (historyBtn) {
      historyBtn.style.display = 'block';
      historyBtn.onclick = () => {
        modal.style.display = 'none';
        this.showTimelineModal(feature);
      };
    }
  }

  private updateTagList(): void {
    // Collect all unique tags
    this.allTags.clear();
    this.mapEngine.getAllFeatures().forEach((feature) => {
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
    // Combine tag filters and search
    this.mapEngine.showFeatures((feature) => {
      // Check tag filter
      let matchesTags = true;
      if (this.selectedTags.size > 0) {
        const featureTags = feature.properties.tags || [];
        matchesTags = featureTags.some((tag: string) => this.selectedTags.has(tag));
      }

      // Check search filter
      let matchesSearch = true;
      if (this.searchTerm) {
        const name = (feature.properties.name || '').toLowerCase();
        const comments = (feature.properties.comments || '').toLowerCase();
        const tags = (feature.properties.tags || []).join(' ').toLowerCase();
        matchesSearch = name.includes(this.searchTerm) || 
                       comments.includes(this.searchTerm) ||
                       tags.includes(this.searchTerm);
      }

      return matchesTags && matchesSearch;
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
    
    if (this.addMode) {
      addBtn?.classList.add('active');
      this.showNotification('Click on the map to add a place', 'success');
    } else {
      addBtn?.classList.remove('active');
    }
  }

  /**
   * Handle map click - either add POI or ignore
   */
  private handleMapClick(feature: GeoJSONFeature): void {
    if (this.addMode) {
      // Pre-fill form with coordinates from map click
      this.showAddPOIForm(feature.properties.lat, feature.properties.lng);
      this.addMode = false;
      const addBtn = document.getElementById('add-poi-btn');
      addBtn?.classList.remove('active');
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

    // Reset rating stars - Replace with SVG icons (see SVG_GUIDE.md)
    document.querySelectorAll('.rating-input .star').forEach((star) => {
      star.textContent = '';
      star.classList.remove('active');
    });

    // Pre-fill coordinates if provided
    if (lat !== undefined && lng !== undefined) {
      (document.getElementById('poi-lat') as HTMLInputElement).value = lat.toFixed(6);
      (document.getElementById('poi-lng') as HTMLInputElement).value = lng.toFixed(6);
    }

    // Show modal
    modal.style.display = 'flex';

    // Setup form submission
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handlePOIFormSubmit();
    };

    // Setup cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    cancelBtn!.onclick = () => {
      modal.style.display = 'none';
    };

    // Hide extra buttons for new POIs
    const deleteBtn = document.getElementById('delete-btn');
    const reviewsBtn = document.getElementById('reviews-btn');
    const historyBtn = document.getElementById('history-btn');
    
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (reviewsBtn) reviewsBtn.style.display = 'none';
    if (historyBtn) historyBtn.style.display = 'none';
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
    
    // Update visual stars - Replace with SVG icons (see SVG_GUIDE.md)
    const stars = star.parentElement?.querySelectorAll('.star');
    stars?.forEach((s, index) => {
      if (index < rating) {
        s.textContent = '';
        s.classList.add('active');
      } else {
        s.textContent = '';
        s.classList.remove('active');
      }
    });
  }

  /**
   * Show reviews modal
   */
  private showReviewsModal(feature: GeoJSONFeature): void {
    const modal = document.getElementById('reviews-modal');
    if (!modal) return;

    this.currentPOIId = feature.properties.id;
    
    // Render existing reviews
    this.renderReviews(feature);
    
    // Setup review form
    this.setupReviewForm(feature);
    
    // Show modal
    modal.style.display = 'flex';
    
    // Close button
    const closeBtn = document.getElementById('close-reviews-btn');
    closeBtn!.onclick = () => {
      modal.style.display = 'none';
    };
  }

  /**
   * Render reviews list
   */
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
        // Replace stars with SVG icons - see SVG_GUIDE.md
        const date = new Date(review.date).toLocaleDateString();
        
        return `
          <div class="review-item" data-review-id="${review.id}">
            <div class="review-header">
              <span class="review-rating" data-rating="${review.rating}"></span>
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
    
    // Setup rating stars for review - Replace with SVG icons (see SVG_GUIDE.md)
    const reviewStars = document.querySelectorAll('.review-star');
    reviewStars.forEach((star) => {
      star.textContent = '';
      star.classList.remove('active');
      
      (star as HTMLElement).onclick = (e) => {
        const rating = parseInt((e.target as HTMLElement).dataset.rating || '0');
        this.currentReviewRating = rating;
        
        if (reviewRating) reviewRating.value = rating.toString();
        
        reviewStars.forEach((s, index) => {
          if (index < rating) {
            s.textContent = '';
            s.classList.add('active');
          } else {
            s.textContent = '';
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

    // Update stars - Replace with SVG icons (see SVG_GUIDE.md)
    const reviewStars = document.querySelectorAll('.review-star');
    reviewStars.forEach((star, index) => {
      if (index < review.rating) {
        star.textContent = '';
        star.classList.add('active');
      } else {
        star.textContent = '';
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

  /**
   * Show timeline/history modal
   */
  private showTimelineModal(feature: GeoJSONFeature): void {
    const modal = document.getElementById('history-modal');
    if (!modal) return;
    
    // Render timeline
    this.renderTimeline(feature);
    
    // Show modal
    modal.style.display = 'flex';
    
    // Close button
    const closeBtn = document.getElementById('close-history-btn');
    closeBtn!.onclick = () => {
      modal.style.display = 'none';
    };
  }

  /**
   * Render timeline view
   */
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
            // Replace stars with SVG icons - see SVG_GUIDE.md
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
}