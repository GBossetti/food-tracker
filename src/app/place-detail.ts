import { GeoJSONFeature, POICategory, CATEGORY_CONFIG } from '../core/types';
import { MapEngine } from '../core/map-engine';
import { escapeHtml } from '../core/escape-html';

export interface PlaceDetailDeps {
  mapEngine: MapEngine;
  onLogVisit: (feature: GeoJSONFeature) => void;
  onBack: () => void;
}

export class PlaceDetailView {
  private mapEngine: MapEngine;
  private onLogVisit: (feature: GeoJSONFeature) => void;
  private onBack: () => void;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private backBtn: HTMLElement;
  private currentFeatureId: string | null = null;

  constructor(deps: PlaceDetailDeps) {
    this.mapEngine = deps.mapEngine;
    this.onLogVisit = deps.onLogVisit;
    this.onBack = deps.onBack;

    this.titleEl = document.getElementById('detail-title')!;
    this.bodyEl = document.getElementById('detail-body')!;
    this.backBtn = document.getElementById('detail-back-btn')!;

    this.backBtn.addEventListener('click', () => this.onBack());

    // Edits (including "I went here", logged elsewhere) and deletes can
    // happen while the detail view is open — stay in sync without the
    // caller having to remember to call refresh().
    this.mapEngine.on('updated', (event) => {
      if (event.feature.properties.id === this.currentFeatureId) this.render(event.feature);
    });
    this.mapEngine.on('deleted', (event) => {
      if (event.feature.properties.id === this.currentFeatureId) {
        this.currentFeatureId = null;
        this.onBack();
      }
    });
  }

  show(feature: GeoJSONFeature): void {
    this.currentFeatureId = feature.properties.id;
    this.render(feature);
  }

  refresh(): void {
    if (!this.currentFeatureId) return;
    const feature = this.mapEngine.getAllFeatures().find((f) => f.properties.id === this.currentFeatureId);
    if (feature) this.render(feature);
  }

  currentId(): string | null {
    return this.currentFeatureId;
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
}
