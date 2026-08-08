import { AnalyticsEngine, AnalyticsData } from './analytics';
import { MapEngine } from '../core/map-engine';
import { trapFocus } from '../core/focus-trap';
import { pushOverlay, popOverlay } from '../core/overlay-stack';

export class AnalyticsUI {
  private mapEngine: MapEngine;
  private analyticsData: AnalyticsData | null = null;
  private releaseFocusTrap: (() => void) | null = null;

  constructor(mapEngine: MapEngine) {
    this.mapEngine = mapEngine;
  }

  showAnalytics(): void {
    const modal = document.getElementById('analytics-modal');
    if (!modal) return;

    const features = this.mapEngine.getAllFeatures();
    const engine = new AnalyticsEngine(features);
    this.analyticsData = engine.calculateAll();

    this.renderDashboard();
    modal.style.display = 'flex';
    pushOverlay(modal);
    this.releaseFocusTrap = trapFocus(modal, { onEscape: () => this.closeAnalytics() });

    const closeBtn = document.getElementById('close-analytics-btn');
    if (closeBtn) closeBtn.onclick = () => this.closeAnalytics();
  }

  private closeAnalytics(): void {
    const modal = document.getElementById('analytics-modal');
    if (modal) modal.style.display = 'none';
    this.releaseFocusTrap?.();
    this.releaseFocusTrap = null;
    if (modal) popOverlay(modal);
  }

  private renderDashboard(): void {
    const container = document.getElementById('analytics-content');
    if (!container || !this.analyticsData) return;

    container.innerHTML = `
      ${this.renderOverview()}
      ${this.renderRatingDistribution()}
      ${this.renderTopPlaces()}
      ${this.renderTagAnalytics()}
      ${this.renderTimeline()}
      ${this.renderInsights()}
    `;
  }

  private renderOverview(): string {
    const d = this.analyticsData!.overview;

    const cards = [
      { value: d.totalPlaces,              label: 'Places Tracked',  accent: 'var(--accent)' },
      { value: d.totalVisits,              label: 'Total Visits',     accent: '#9B5C6E' },
      { value: d.totalReviews,             label: 'Reviews Written',  accent: '#CD942F' },
      { value: d.averageRating.toFixed(1), label: 'Average Rating',   accent: '#D49A4E' },
    ];

    return `
      <div class="analytics-section">
        <h2>Overview</h2>
        <div class="stats-grid">
          ${cards.map(c => `
            <div class="stat-card" style="--card-accent:${c.accent}">
              <div class="stat-value">${c.value}</div>
              <div class="stat-label">${c.label}</div>
            </div>
          `).join('')}
        </div>
        ${d.mostVisitedPlace ? `
          <div class="highlight-row">
            <span class="highlight-key">Most visited</span>
            <span class="highlight-val">${d.mostVisitedPlace.name}</span>
            <span class="highlight-meta">${d.mostVisitedPlace.count}×</span>
          </div>` : ''}
        ${d.highestRatedPlace ? `
          <div class="highlight-row">
            <span class="highlight-key">Highest rated</span>
            <span class="highlight-val">${d.highestRatedPlace.name}</span>
            <span class="highlight-meta">${d.highestRatedPlace.rating.toFixed(1)} ★</span>
          </div>` : ''}
      </div>
    `;
  }

  private renderRatingDistribution(): string {
    const d = this.analyticsData!.ratingDistribution;
    const total = d.fiveStar + d.fourStar + d.threeStar + d.twoStar + d.oneStar + d.unrated;
    if (total === 0) return '';

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
    const rows: Array<{ label: string; count: number; color: string }> = [
      { label: '★★★★★', count: d.fiveStar,  color: '#D49A4E' },
      { label: '★★★★',  count: d.fourStar,  color: '#C9803A' },
      { label: '★★★',   count: d.threeStar, color: '#B8822E' },
      { label: '★★',    count: d.twoStar,   color: '#9B6A3A' },
      { label: '★',     count: d.oneStar,   color: '#C9603F' },
    ];
    if (d.unrated > 0) rows.push({ label: '—', count: d.unrated, color: '#5C5045' });

    return `
      <div class="analytics-section">
        <h2>Rating Distribution</h2>
        <div class="distribution-chart">
          ${rows.map((r, i) => `
            <div class="distribution-row">
              <span class="distribution-label">${r.label}</span>
              <div class="distribution-bar-container">
                <div class="distribution-bar"
                     style="--bar-pct:${pct(r.count)}%;background:${r.color};animation-delay:${i * 0.07}s">
                </div>
              </div>
              <span class="distribution-count">${r.count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderTopPlaces(): string {
    const d = this.analyticsData!.topPlaces;
    if (d.byRating.length === 0 && d.byVisits.length === 0) return '';

    const rankBadge = (i: number) => {
      const colors = ['#D49A4E', '#B6A892', '#9A8B79'];
      const bg = colors[i] ?? 'rgba(242,233,219,0.08)';
      return `<span class="ranking-position" style="background:${bg};color:${i < 3 ? '#1A1208' : 'var(--text-primary)'}">${i + 1}</span>`;
    };

    return `
      <div class="analytics-section">
        <h2>Top Places</h2>
        <div class="top-places-grid">
          <div>
            <h3>By Rating</h3>
            <div class="ranking-list">
              ${d.byRating.slice(0, 5).map((p, i) => `
                <div class="ranking-item">
                  ${rankBadge(i)}
                  <span class="ranking-name">${p.name}</span>
                  <span class="ranking-value">${p.rating.toFixed(1)} ★</span>
                  <span class="ranking-meta">${p.visits}×</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <h3>By Visits</h3>
            <div class="ranking-list">
              ${d.byVisits.slice(0, 5).map((p, i) => `
                <div class="ranking-item">
                  ${rankBadge(i)}
                  <span class="ranking-name">${p.name}</span>
                  <span class="ranking-value">${p.visits}×</span>
                  <span class="ranking-meta">${p.rating > 0 ? p.rating.toFixed(1) + ' ★' : '—'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        ${d.recent.length > 0 ? `
          <h3>Recently Added</h3>
          <div class="ranking-list">
            ${d.recent.slice(0, 4).map(p => `
              <div class="ranking-item">
                <span class="ranking-name">${p.name}</span>
                <span class="ranking-meta">${new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span class="ranking-value">${p.rating > 0 ? p.rating.toFixed(1) + ' ★' : '—'}</span>
              </div>
            `).join('')}
          </div>` : ''}
      </div>
    `;
  }

  private renderTagAnalytics(): string {
    const d = this.analyticsData!.tagAnalytics;
    if (d.mostUsed.length === 0) return '';

    const maxCount = d.mostUsed[0]?.count ?? 1;

    return `
      <div class="analytics-section">
        <h2>Tags</h2>
        <div class="tag-bar-chart">
          ${d.mostUsed.slice(0, 10).map((t, i) => {
            const pct = Math.round((t.count / maxCount) * 100);
            return `
              <div class="tag-bar-row">
                <span class="tag-bar-label">${t.tag}</span>
                <div class="tag-bar-track">
                  <div class="tag-bar-fill" style="--bar-pct:${pct}%;animation-delay:${i * 0.06}s"></div>
                </div>
                <span class="tag-bar-count">${t.count}</span>
              </div>`;
          }).join('')}
        </div>

        ${d.bestRated.length > 0 ? `
          <h3>Best Rated Tags</h3>
          <div class="ranking-list">
            ${d.bestRated.slice(0, 5).map((t, i) => `
              <div class="ranking-item">
                <span class="ranking-position">${i + 1}</span>
                <span class="ranking-name">${t.tag}</span>
                <span class="ranking-value">${t.avgRating.toFixed(1)} ★</span>
                <span class="ranking-meta">${t.count} places</span>
              </div>
            `).join('')}
          </div>` : ''}
      </div>
    `;
  }

  private renderTimeline(): string {
    const d = this.analyticsData!.timeline;
    if (d.visitsByMonth.length === 0) return '';

    const months = d.visitsByMonth.slice(-12);
    const maxCount = Math.max(...months.map(m => m.count), 1);

    return `
      <div class="analytics-section">
        <h2>Activity</h2>
        <div class="timeline-chart">
          ${months.map((m, i) => {
            const pct = Math.round((m.count / maxCount) * 100);
            const label = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            return `
              <div class="timeline-bar">
                <div class="timeline-bar-fill" style="--bar-pct:${pct}%;animation-delay:${i * 0.05}s">
                  <span class="timeline-bar-value">${m.count}</span>
                </div>
                <span class="timeline-bar-label">${label}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderInsights(): string {
    const d = this.analyticsData!.insights;
    const ov = this.analyticsData!.overview;

    const activeMonth = d.mostActiveMonth
      ? new Date(d.mostActiveMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'N/A';

    const reviewedPct = ov.totalPlaces > 0
      ? Math.round((ov.totalReviews / ov.totalPlaces) * 100)
      : 0;

    const svgCalendar = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const svgClock   = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const svgCompass = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
    const svgRepeat  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
    const svgTag     = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
    const svgStar    = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const cards = [
      { icon: svgCalendar, value: activeMonth,                          label: 'Most Active Month',      accent: 'var(--accent)' },
      { icon: svgClock,    value: `${d.daysSinceLastVisit}d`,           label: 'Since Last Visit',       accent: '#9B5C6E' },
      { icon: svgCompass,  value: `${d.discoveryRate.toFixed(1)}/mo`,   label: 'Discovery Rate',         accent: '#CD942F' },
      { icon: svgRepeat,   value: `${d.averageVisitsPerPlace.toFixed(1)}×`, label: 'Avg Visits / Place', accent: '#8A9A4E' },
      ...(d.favoriteTag ? [{ icon: svgTag, value: d.favoriteTag, label: 'Favourite Tag', accent: '#5E9A93' }] : []),
      { icon: svgStar,     value: `${reviewedPct}%`,                    label: 'Places Reviewed',        accent: '#D49A4E' },
    ];

    return `
      <div class="analytics-section">
        <h2>Insights</h2>
        <div class="insights-grid">
          ${cards.map(c => `
            <div class="insight-card" style="--card-accent:${c.accent}">
              <div class="insight-icon">${c.icon}</div>
              <div class="insight-text">
                <strong>${c.value}</strong>
                <span>${c.label}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
