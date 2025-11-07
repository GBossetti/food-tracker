/**
 * UI Controller - Food App Specific
 * Handles all user interface interactions
 */

import { GeoJSONFeature } from '../core/types';
import { MapEngine } from '../core/map-engine';
import { StorageLayer } from './storage';
import { ModalService } from './modal-service';

export class UIController {
  private mapEngine: MapEngine;
  private storage: StorageLayer;
  private modalService: ModalService;
  private appController: any; // Will be set later
  private selectedTags: Set<string> = new Set();
  private allTags: Set<string> = new Set();

  // Cached DOM elements for performance
  private modal: HTMLElement | null;
  private form: HTMLFormElement | null;
  private deleteBtn: HTMLElement | null;
  private poiIdInput: HTMLInputElement | null;
  private poiNameInput: HTMLInputElement | null;
  private poiLatInput: HTMLInputElement | null;
  private poiLngInput: HTMLInputElement | null;
  private poiTagsInput: HTMLInputElement | null;
  private poiCommentsInput: HTMLTextAreaElement | null;

  constructor(mapEngine: MapEngine, storage: StorageLayer, modalService: ModalService) {
    this.mapEngine = mapEngine;
    this.storage = storage;
    this.modalService = modalService;
    this.appController = null;

    // Cache DOM elements once
    this.modal = document.getElementById('poi-modal');
    this.form = document.getElementById('poi-form') as HTMLFormElement | null;
    this.deleteBtn = document.getElementById('delete-btn');
    this.poiIdInput = document.getElementById('poi-id') as HTMLInputElement | null;
    this.poiNameInput = document.getElementById('poi-name') as HTMLInputElement | null;
    this.poiLatInput = document.getElementById('poi-lat') as HTMLInputElement | null;
    this.poiLngInput = document.getElementById('poi-lng') as HTMLInputElement | null;
    this.poiTagsInput = document.getElementById('poi-tags') as HTMLInputElement | null;
    this.poiCommentsInput = document.getElementById('poi-comments') as HTMLTextAreaElement | null;

    console.log('🎨 UIController initializing...');
    this.setupEventListeners();
    this.updateTagList();
    console.log('✅ UIController ready!');
  }

  /**
   * Set app controller reference (for dashboard updates)
   */
  public setAppController(appController: any): void {
    this.appController = appController;
  }

  private setupEventListeners(): void {
    console.log('🔌 Setting up event listeners...');

    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExport());
    } else {
      console.warn('Export button not found');
    }

    // Import button
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input') as HTMLInputElement | null;
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => this.handleImport(e));
    } else {
      console.warn('Import button or input not found');
    }

    // Add POI button
    const addBtn = document.getElementById('add-poi-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddPOIForm());
    } else {
      console.warn('Add POI button not found');
    }

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    } else {
      console.warn('Clear filters button not found');
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn && this.modal) {
      cancelBtn.addEventListener('click', () => this.modalService.close(this.modal!));
    }

    // Listen to map events
    this.mapEngine.on('click', (event) => this.handleFeatureClick(event.feature));

    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase();
        this.handleSearch(query);
      });
    }

    // Locate button (fit all markers)
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
      locateBtn.addEventListener('click', () => {
        const map = (this.mapEngine as any).adapter?.getMap();
        if (map) {
          (this.mapEngine as any).adapter?.fitBounds();
        }
      });
    }

    // Modal close button
    const modalCloseBtn = document.getElementById('modal-close');
    if (modalCloseBtn && this.modal) {
      modalCloseBtn.addEventListener('click', () => this.modalService.close(this.modal!));
    }

    // Form submission
    if (this.form) {
      this.form.onsubmit = (e) => {
        e.preventDefault();
        this.handlePOIFormSubmit();
      };
    }

    console.log('✅ Event listeners ready');
  }

  private handleExport(): void {
    try {
      this.storage.exportToFile();
      this.showNotification('✅ Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('❌ Export failed', 'error');
    }
  }

  private async handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    try {
      const data = await this.storage.importFromFile(file);
      this.mapEngine.load(data);
      this.updateTagList();
      this.showNotification('✅ Data imported successfully!');
      
      // Reset input so same file can be imported again
      input.value = '';
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('❌ Failed to import file', 'error');
    }
  }

  private showAddPOIForm(): void {
    if (!this.modal || !this.form) {
      console.error('Modal or form not found');
      return;
    }

    // Reset form
    this.form.reset();
    if (this.poiIdInput) this.poiIdInput.value = '';
    
    // Hide delete button for new POI
    if (this.deleteBtn) this.deleteBtn.style.display = 'none';

    // Open modal
    this.modalService.open(this.modal, {
      closeOnBackdrop: true,
      closeOnEsc: true,
      trapFocus: true,
    });
  }

  private handlePOIFormSubmit(): void {
    if (!this.form) return;

    const id = this.poiIdInput?.value || '';
    const name = this.poiNameInput?.value.trim() || '';
    const lat = parseFloat(this.poiLatInput?.value || '');
    const lng = parseFloat(this.poiLngInput?.value || '');
    const tags = (this.poiTagsInput?.value || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const comments = this.poiCommentsInput?.value.trim() || '';

    // Validation
    if (!name) {
      this.showNotification('❌ Name is required', 'error');
      this.poiNameInput?.focus();
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      this.showNotification('❌ Valid coordinates are required', 'error');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.showNotification('❌ Coordinates out of range', 'error');
      return;
    }

    const feature: GeoJSONFeature = {
      type: 'Feature',
      properties: {
        id: id || `poi-${Date.now()}`,
        name,
        tags,
        comments,
        visited_date: new Date().toISOString().split('T')[0],
      },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    };

    if (id) {
      // Update existing POI
      console.log('Updating POI:', id);
      this.mapEngine.updateFeature(id, feature.properties);
      this.showNotification('✅ POI updated successfully!');
    } else {
      // Add new POI
      console.log('Adding new POI');
      this.mapEngine.addFeature(feature);
      this.showNotification('✅ POI added successfully!');
    }

    // Save and update UI
    this.saveCurrentState();
    if (this.modal) this.modalService.close(this.modal);
    this.updateTagList();
    
    // Update dashboard if app controller exists
    if (this.appController) {
      this.appController.refreshData();
    }
  }

  private handleFeatureClick(feature: GeoJSONFeature): void {
    if (!this.modal || !this.form) return;

    console.log('Editing POI:', feature.properties.name);

    // Populate form with feature data
    if (this.poiIdInput) this.poiIdInput.value = feature.properties.id;
    if (this.poiNameInput) this.poiNameInput.value = feature.properties.name;
    
    const coords = feature.geometry.coordinates as [number, number];
    if (this.poiLatInput) this.poiLatInput.value = coords[1].toString();
    if (this.poiLngInput) this.poiLngInput.value = coords[0].toString();
    if (this.poiTagsInput) this.poiTagsInput.value = feature.properties.tags?.join(', ') || '';
    if (this.poiCommentsInput) this.poiCommentsInput.value = feature.properties.comments || '';

    // Show delete button and setup handler
    if (this.deleteBtn) {
      // Clone button to remove old event listeners
      const newDeleteBtn = this.deleteBtn.cloneNode(true) as HTMLElement;
      this.deleteBtn.parentNode?.replaceChild(newDeleteBtn, this.deleteBtn);
      this.deleteBtn = newDeleteBtn;

      this.deleteBtn.style.display = 'block';
      this.deleteBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete "${feature.properties.name}"?`)) {
          console.log('Deleting POI:', feature.properties.id);
          this.mapEngine.removeFeature(feature.properties.id);
          this.saveCurrentState();
          if (this.modal) this.modalService.close(this.modal);
          this.showNotification('✅ POI deleted');
          this.updateTagList();
          
          // Update dashboard
          if (this.appController) {
            this.appController.refreshData();
          }
        }
      });
    }

    // Open modal
    this.modalService.open(this.modal, {
      closeOnBackdrop: true,
      closeOnEsc: true,
      trapFocus: true,
    });
  }

  private updateTagList(): void {
    console.log('Updating tag list...');
    
    // Collect all unique tags
    this.allTags.clear();
    const features = this.mapEngine.getAllFeatures();
    
    features.forEach((feature) => {
      const tags = feature.properties.tags;
      if (Array.isArray(tags)) {
        tags.forEach((tag: string) => this.allTags.add(tag));
      }
    });

    // Render tag filter buttons
    const tagContainer = document.getElementById('tag-filters');
    if (!tagContainer) {
      console.warn('Tag filters container not found');
      return;
    }

    tagContainer.innerHTML = '';

    if (this.allTags.size === 0) {
      tagContainer.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No tags yet. Add places to see tags here.</p>';
      return;
    }

    // Sort tags alphabetically for better UX
    const sortedTags = Array.from(this.allTags).sort();

    sortedTags.forEach((tag) => {
      const button = document.createElement('button');
      button.className = 'tag-btn';
      button.textContent = tag;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => this.toggleTag(tag, button);
      tagContainer.appendChild(button);
    });

    console.log(`✅ Created ${this.allTags.size} tag buttons`);
  }

  private toggleTag(tag: string, button: HTMLElement): void {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
      console.log('Tag deselected:', tag);
    } else {
      this.selectedTags.add(tag);
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      console.log('Tag selected:', tag);
    }

    this.applyFilters();
  }

  private handleSearch(query: string): void {
    if (!query) {
      // No search, apply tag filters only
      this.applyFilters();
      return;
    }

    console.log('Searching for:', query);

    // Search in name, tags, and comments
    this.mapEngine.showFeatures((feature) => {
      const name = (feature.properties.name || '').toLowerCase();
      const tags = (feature.properties.tags || []).join(' ').toLowerCase();
      const comments = (feature.properties.comments || '').toLowerCase();
      
      const matchesSearch = name.includes(query) || tags.includes(query) || comments.includes(query);
      
      // Also apply tag filters if any are selected
      if (this.selectedTags.size > 0) {
        const featureTags = feature.properties.tags || [];
        const matchesTags = featureTags.some((tag: string) => this.selectedTags.has(tag));
        return matchesSearch && matchesTags;
      }
      
      return matchesSearch;
    });
  }

  private clearFilters(): void {
    console.log('Clearing all filters...');
    this.selectedTags.clear();

    // Remove active class from all buttons
    document.querySelectorAll('.tag-btn').forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });

    this.applyFilters();
  }

  private applyFilters(): void {
    if (this.selectedTags.size === 0) {
      console.log('No filters, showing all features');
      this.mapEngine.showFeatures(() => true);
    } else {
      console.log('Filtering by tags:', Array.from(this.selectedTags));
      this.mapEngine.showFeatures((feature) => {
        const featureTags = feature.properties.tags || [];
        return featureTags.some((tag: string) => this.selectedTags.has(tag));
      });
    }
  }

  private async saveCurrentState(): Promise<void> {
    console.log('Saving current state...');
    try {
      const data = this.mapEngine.export();
      await this.storage.save(data);
      console.log('✅ State saved');
    } catch (error) {
      console.error('Failed to save state:', error);
      this.showNotification('⚠️ Failed to save changes', 'error');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    console.log(`Notification [${type}]:`, message);
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}