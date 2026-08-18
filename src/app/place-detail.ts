import { GeoJSONFeature, POICategory, CATEGORY_CONFIG } from '../core/types';
import { MapEngine } from '../core/map-engine';
import { escapeHtml } from '../core/escape-html';
import { showToast } from './toast';
import { setupMenuButton } from '../core/menu-button';

export interface PlaceDetailDeps {
  mapEngine: MapEngine;
  onLogVisit: (feature: GeoJSONFeature) => void;
  onBack: () => void;
  onEdit: (feature: GeoJSONFeature) => void;
  onDelete: (id: string) => void;
}

export class PlaceDetailView {
  private mapEngine: MapEngine;
  private onLogVisit: (feature: GeoJSONFeature) => void;
  private onBack: () => void;
  private onEdit: (feature: GeoJSONFeature) => void;
  private onDelete: (id: string) => void;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private backBtn: HTMLElement;
  private deleteMenuItem: HTMLElement | null;
  private feature: GeoJSONFeature | null = null;

  constructor(deps: PlaceDetailDeps) {
    this.mapEngine = deps.mapEngine;
    this.onLogVisit = deps.onLogVisit;
    this.onBack = deps.onBack;
    this.onEdit = deps.onEdit;
    this.onDelete = deps.onDelete;

    this.titleEl = document.getElementById('detail-title')!;
    this.bodyEl = document.getElementById('detail-body')!;
    this.backBtn = document.getElementById('detail-back-btn')!;
    this.deleteMenuItem = document.querySelector('#detail-menu [data-action="delete"]');

    this.backBtn.addEventListener('click', () => this.onBack());

    const menuBtn = document.getElementById('detail-menu-btn');
    const menu = document.getElementById('detail-menu');
    if (menuBtn && menu) {
      setupMenuButton(menuBtn, menu, (action) => this.handleMenuAction(action));
    }

    // Edits (including "I went here", logged elsewhere) and deletes can
    // happen while the detail view is open — stay in sync without the
    // caller having to remember to call refresh().
    this.mapEngine.on('updated', (event) => {
      if (event.feature.properties.id === this.currentId()) this.render(event.feature);
    });
    this.mapEngine.on('deleted', (event) => {
      if (event.feature.properties.id === this.currentId()) {
        this.feature = null;
        this.onBack();
      }
    });
  }

  show(feature: GeoJSONFeature): void {
    this.feature = feature;
    this.resetDeleteConfirm();
    this.render(feature);
  }

  refresh(): void {
    if (!this.feature) return;
    const feature = this.mapEngine.getAllFeatures().find((f) => f.properties.id === this.feature!.properties.id);
    if (feature) this.render(feature);
  }

  currentId(): string | null {
    return this.feature?.properties.id ?? null;
  }

  private render(feature: GeoJSONFeature): void {
    const p = feature.properties;
    const cfg = CATEGORY_CONFIG[p.category as POICategory] ?? CATEGORY_CONFIG['other'];
    const isWishlist = p.status === 'wishlist';
    const rating = p.rating ?? 0;
    const stars = rating > 0 ? '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)) : '';

    this.titleEl.textContent = p.name;

    const tagsHtml = p.tags?.length
      ? `<div class="detail-tags">${p.tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const metaParts: string[] = [];
    if (!isWishlist && p.visit_count) {
      metaParts.push(`Visited ${p.visit_count} time${p.visit_count === 1 ? '' : 's'}`);
    }
    if (p.last_visited) {
      metaParts.push(`Last visit ${new Date(p.last_visited).toLocaleDateString()}`);
    }

    this.bodyEl.innerHTML = `
      <div class="detail-category">
        <span class="detail-category-dot" style="background:${cfg.color}"></span>
        <span>${escapeHtml(cfg.label)}</span>
      </div>
      ${stars ? `<div class="detail-stars" aria-label="Rated ${rating} out of 5">${stars}</div>` : ''}
      ${tagsHtml}
      ${p.comments ? `<p class="detail-notes">${escapeHtml(p.comments)}</p>` : ''}
      ${metaParts.length ? `<p class="detail-meta">${escapeHtml(metaParts.join(' · '))}</p>` : ''}
      ${isWishlist ? `<button type="button" id="detail-log-visit-btn" class="btn btn-primary log-visit-btn-modal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        I went here
      </button>` : ''}
    `;

    document.getElementById('detail-log-visit-btn')?.addEventListener('click', () => this.onLogVisit(feature));
  }

  /** Returns true to keep the menu open — used only by the delete confirm step. */
  private handleMenuAction(action: string): boolean | void {
    const feature = this.feature;
    if (!feature) return;

    switch (action) {
      case 'edit':
        this.onEdit(feature);
        return;
      case 'share':
        void this.handleShare(feature);
        return;
      case 'copy-coords':
        void this.handleCopyCoords(feature);
        return;
      case 'delete':
        return this.handleDeleteAction(feature.properties.id);
    }
  }

  private handleDeleteAction(id: string): boolean {
    const item = this.deleteMenuItem;
    if (!item) {
      this.onDelete(id);
      return false;
    }

    if (item.classList.contains('confirming')) {
      this.resetDeleteConfirm();
      this.onDelete(id);
      return false;
    }

    item.classList.add('confirming');
    item.textContent = 'Confirm delete?';
    setTimeout(() => {
      if (item.classList.contains('confirming')) this.resetDeleteConfirm();
    }, 3000);
    return true;
  }

  private resetDeleteConfirm(): void {
    const item = this.deleteMenuItem;
    if (!item) return;
    item.classList.remove('confirming');
    item.textContent = 'Delete place';
  }

  private async handleShare(feature: GeoJSONFeature): Promise<void> {
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const text = `${feature.properties.name} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

    if (navigator.share) {
      try {
        await navigator.share({ title: feature.properties.name, text });
      } catch {
        // User cancelled or the platform declined — not an error worth a toast.
      }
      return;
    }

    await this.copyText(text, 'Copied place info to clipboard');
  }

  private async handleCopyCoords(feature: GeoJSONFeature): Promise<void> {
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    await this.copyText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'Coordinates copied');
  }

  private async copyText(text: string, successMessage: string): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  }
}
