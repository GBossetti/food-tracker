/**
 * Analytics UI Controller
 * Renders the analytics dashboard
 */

import { AnalyticsEngine, AnalyticsData } from './analytics';
import { MapEngine } from '../core/map-engine';

export class AnalyticsUI {
  private mapEngine: MapEngine;
  private analyticsData: AnalyticsData | null = null;

  constructor(mapEngine: MapEngine) {
    this.mapEngine = mapEngine;
  }

  /**
   * Show analytics modal
   */
  showAnalytics(): void {
    const modal = document.getElementById('analytics-modal');
    if (!modal) return;

    // Calculate analytics
    const features = this.mapEngine.getAllFeatures();
    const engine = new AnalyticsEngine(features);
    this.analyticsData = engine.calculateAll();

    // Render dashboard
    this.renderDashboard();

    // Show modal
    modal.style.display = 'flex';

    // Close button
    const closeBtn = document.getElementById('close-analytics-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
      };
    }
  }

  /**
   * Render complete dashboard
   */
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

  /**
   * Render overview stats
   */
  private renderOverview(): string {
    const data = this.analyticsData!.overview;

    return `
      <div class="analytics-section">
        <h2>Overview</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="stat-icon"></div>
            <div class="stat-value">${data.totalPlaces}</div>
            <div class="stat-label">Places Tracked</div>
          </div>
          
          <div class="stat-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="stat-icon"></div>
            <div class="stat-value">${data.totalVisits}</div>
            <div class="stat-label">Total Visits</div>
          </div>
          
          <div class="stat-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="stat-icon"></div>
            <div class="stat-value">${data.totalReviews}</div>
            <div class="stat-label">Reviews Written</div>
          </div>
          
          <div class="stat-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="stat-icon"></div>
            <div class="stat-value">${data.averageRating.toFixed(1)}</div>
            <div class="stat-label">Average Rating</div>
          </div>
        </div>

        ${data.mostVisitedPlace ? `
          <div class="highlight-box">
            <strong>Most Visited:</strong> ${data.mostVisitedPlace.name} 
            (${data.mostVisitedPlace.count} visits)
          </div>
        ` : ''}

        ${data.highestRatedPlace ? `
          <div class="highlight-box">
            <strong>Highest Rated:</strong> ${data.highestRatedPlace.name} 
            (${data.highestRatedPlace.rating.toFixed(1)} stars)
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render rating distribution
   */
  private renderRatingDistribution(): string {
    const data = this.analyticsData!.ratingDistribution;
    const total = data.fiveStar + data.fourStar + data.threeStar + data.twoStar + data.oneStar + data.unrated;

    const getBarWidth = (count: number) => total > 0 ? (count / total) * 100 : 0;

    return `
      <div class="analytics-section">
        <h2>Rating Distribution</h2>
        <div class="distribution-chart">
          <div class="distribution-row">
            <span class="distribution-label">5</span>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="width: ${getBarWidth(data.fiveStar)}%"></div>
            </div>
            <span class="distribution-count">${data.fiveStar}</span>
          </div>
          
          <div class="distribution-row">
            <span class="distribution-label">4</span>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="width: ${getBarWidth(data.fourStar)}%"></div>
            </div>
            <span class="distribution-count">${data.fourStar}</span>
          </div>
          
          <div class="distribution-row">
            <span class="distribution-label">3</span>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="width: ${getBarWidth(data.threeStar)}%"></div>
            </div>
            <span class="distribution-count">${data.threeStar}</span>
          </div>
          
          <div class="distribution-row">
            <span class="distribution-label">2</span>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="width: ${getBarWidth(data.twoStar)}%"></div>
            </div>
            <span class="distribution-count">${data.twoStar}</span>
          </div>
          
          <div class="distribution-row">
            <span class="distribution-label">1</span>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="width: ${getBarWidth(data.oneStar)}%"></div>
            </div>
            <span class="distribution-count">${data.oneStar}</span>
          </div>

          ${data.unrated > 0 ? `
            <div class="distribution-row">
              <span class="distribution-label">No rating</span>
              <div class="distribution-bar-container">
                <div class="distribution-bar unrated" style="width: ${getBarWidth(data.unrated)}%"></div>
              </div>
              <span class="distribution-count">${data.unrated}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render top places
   */
  private renderTopPlaces(): string {
    const data = this.analyticsData!.topPlaces;

    return `
      <div class="analytics-section">
        <h2>🏆 Top Places</h2>
        
        <h3>Highest Rated</h3>
        <div class="ranking-list">
          ${data.byRating.slice(0, 5).map((place, index) => `
            <div class="ranking-item">
              <span class="ranking-position">${index + 1}</span>
              <span class="ranking-name">${place.name}</span>
              <span class="ranking-value">${place.rating.toFixed(1)}</span>
              <span class="ranking-meta">${place.visits} visits</span>
            </div>
          `).join('')}
        </div>

        <h3>Most Visited</h3>
        <div class="ranking-list">
          ${data.byVisits.slice(0, 5).map((place, index) => `
            <div class="ranking-item">
              <span class="ranking-position">${index + 1}</span>
              <span class="ranking-name">${place.name}</span>
              <span class="ranking-value">${place.visits} visits</span>
              <span class="ranking-meta">${place.rating > 0 ? place.rating.toFixed(1) : 'Not rated'}</span>
            </div>
          `).join('')}
        </div>

        ${data.recent.length > 0 ? `
          <h3>Recently Added</h3>
          <div class="ranking-list">
            ${data.recent.slice(0, 5).map((place) => `
              <div class="ranking-item">
                <span class="ranking-name">${place.name}</span>
                <span class="ranking-meta">${new Date(place.date).toLocaleDateString()}</span>
                <span class="ranking-value">${place.rating > 0 ? place.rating.toFixed(1) : 'Not rated'}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render tag analytics
   */
  private renderTagAnalytics(): string {
    const data = this.analyticsData!.tagAnalytics;

    return `
      <div class="analytics-section">
        <h2>Tag Analytics</h2>
        
        <h3>Most Used Tags</h3>
        <div class="tag-cloud">
          ${data.mostUsed.map(tag => {
            const size = Math.min(2, 1 + tag.count / 10);
            return `
              <span class="tag-bubble" style="font-size: ${size}em">
                ${tag.tag} (${tag.count})
              </span>
            `;
          }).join('')}
        </div>

        ${data.bestRated.length > 0 ? `
          <h3>Best Rated Tags</h3>
          <div class="ranking-list">
            ${data.bestRated.slice(0, 5).map((tag, index) => `
              <div class="ranking-item">
                <span class="ranking-position">${index + 1}</span>
                <span class="ranking-name">${tag.tag}</span>
                <span class="ranking-value">${tag.avgRating.toFixed(1)}</span>
                <span class="ranking-meta">${tag.count} places</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render timeline
   */
  private renderTimeline(): string {
    const data = this.analyticsData!.timeline;

    if (data.visitsByMonth.length === 0) {
      return `
        <div class="analytics-section">
          <h2>Activity Timeline</h2>
          <p style="text-align: center; color: #666;">No activity data yet. Start adding reviews!</p>
        </div>
      `;
    }

    const maxVisits = Math.max(...data.visitsByMonth.map(m => m.count));

    return `
      <div class="analytics-section">
        <h2>Activity Timeline</h2>
        <div class="timeline-chart">
          ${data.visitsByMonth.slice(-12).map(month => {
            const height = (month.count / maxVisits) * 100;
            const date = new Date(month.month + '-01');
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            
            return `
              <div class="timeline-bar">
                <div class="timeline-bar-fill" style="height: ${height}%">
                  <span class="timeline-bar-value">${month.count}</span>
                </div>
                <span class="timeline-bar-label">${monthName}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render insights
   */
  private renderInsights(): string {
    const data = this.analyticsData!.insights;
    const overview = this.analyticsData!.overview;

    const mostActiveMonthFormatted = data.mostActiveMonth
      ? new Date(data.mostActiveMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'N/A';

    return `
      <div class="analytics-section">
        <h2>Insights</h2>
        <div class="insights-grid">
          <div class="insight-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="insight-icon"></div>
            <div class="insight-text">
              <strong>${mostActiveMonthFormatted}</strong>
              <span>Most Active Month</span>
            </div>
          </div>

          <div class="insight-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="insight-icon"></div>
            <div class="insight-text">
              <strong>${data.daysSinceLastVisit} days</strong>
              <span>Since Last Visit</span>
            </div>
          </div>

          <div class="insight-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="insight-icon"></div>
            <div class="insight-text">
              <strong>${data.discoveryRate.toFixed(1)} per month</strong>
              <span>Discovery Rate</span>
            </div>
          </div>

          <div class="insight-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="insight-icon"></div>
            <div class="insight-text">
              <strong>${data.averageVisitsPerPlace.toFixed(1)} times</strong>
              <span>Avg Visits per Place</span>
            </div>
          </div>

          ${data.favoriteTag ? `
            <div class="insight-card">
              <!-- Add SVG icon here - see SVG_GUIDE.md -->
              <div class="insight-icon"></div>
              <div class="insight-text">
                <strong>${data.favoriteTag}</strong>
                <span>Favorite Tag</span>
              </div>
            </div>
          ` : ''}

          <div class="insight-card">
            <!-- Add SVG icon here - see SVG_GUIDE.md -->
            <div class="insight-icon"></div>
            <div class="insight-text">
              <strong>${((overview.totalReviews / overview.totalPlaces) * 100).toFixed(0)}%</strong>
              <span>Places Reviewed</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}