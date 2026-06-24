import { GamificationEngine, GamificationData, Challenge, Badge, AreaCluster } from './gamification';
import { MapEngine } from '../core/map-engine';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class GamificationUI {
  private mapEngine: MapEngine;

  constructor(mapEngine: MapEngine) {
    this.mapEngine = mapEngine;
  }

  render(): void {
    const features = this.mapEngine.getAllFeatures();
    const engine = new GamificationEngine(features);
    const data = engine.calculateAll();

    this.renderChallenges(data);
    this.renderProfile(data);
  }

  private renderChallenges(data: GamificationData): void {
    const challengeList = document.querySelector('#tab-challenges .challenge-list');
    if (challengeList) challengeList.innerHTML = data.challenges.map(c => this.renderChallengeCard(c)).join('');

    const badgesRow = document.querySelector('#tab-challenges .badges-row');
    if (badgesRow) badgesRow.innerHTML = data.badges.map(b => this.renderBadge(b)).join('');

    const exploreAreas = document.getElementById('explore-areas');
    if (exploreAreas) {
      exploreAreas.innerHTML = data.areasToExplore.length > 0
        ? data.areasToExplore.map(a => this.renderAreaCard(a)).join('')
        : `<p class="tab-sub">No unexplored wishlist areas right now — every saved place nearby has been visited.</p>`;
    }
  }

  private renderChallengeCard(c: Challenge): string {
    const pct = Math.round((c.progress / c.target) * 100);
    const complete = c.progress >= c.target;
    return `
      <div class="challenge-card${complete ? ' challenge-complete' : ''}">
        <div class="challenge-icon">${c.icon}</div>
        <div class="challenge-body">
          <div class="challenge-name">${escapeHtml(c.name)}</div>
          <div class="challenge-desc">${escapeHtml(c.desc)}</div>
          <div class="challenge-progress-wrap">
            <div class="challenge-progress"><div class="progress-fill" style="--pct:${pct}%"></div></div>
            <span class="challenge-meta">${c.progress} / ${c.target}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderBadge(b: Badge): string {
    return `
      <div class="badge${b.earned ? ' badge-earned' : ''}">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-label">${escapeHtml(b.label)}</span>
      </div>
    `;
  }

  private renderAreaCard(a: AreaCluster): string {
    return `
      <div class="challenge-card">
        <div class="challenge-icon">📌</div>
        <div class="challenge-body">
          <div class="challenge-name">${escapeHtml(a.label)}</div>
          <div class="challenge-desc">${a.wishlist} place${a.wishlist === 1 ? '' : 's'} on your wishlist here, ${a.visited} visited so far</div>
        </div>
      </div>
    `;
  }

  private renderProfile(data: GamificationData): void {
    const profileLevel = document.querySelector('#tab-you .profile-level');
    if (profileLevel) profileLevel.textContent = `Level ${data.profile.level} · ${data.profile.levelName}`;

    const total = document.getElementById('you-stat-total');
    const visited = document.getElementById('you-stat-visited');
    const wishlist = document.getElementById('you-stat-wishlist');
    if (total) total.textContent = String(data.stats.total);
    if (visited) visited.textContent = String(data.stats.visited);
    if (wishlist) wishlist.textContent = String(data.stats.wishlist);
  }
}
