import { GamificationEngine, GamificationData, Challenge, Badge, AreaCluster, GamificationAction } from './gamification';
import { MapEngine } from '../core/map-engine';
import { escapeHtml } from '../core/escape-html';

export class GamificationUI {
  private mapEngine: MapEngine;
  private onNavigate: (() => void) | null;

  constructor(mapEngine: MapEngine, onNavigate?: () => void) {
    this.mapEngine = mapEngine;
    this.onNavigate = onNavigate ?? null;
  }

  render(): void {
    const features = this.mapEngine.getAllFeatures();
    const engine = new GamificationEngine(features);
    const data = engine.calculateAll();

    this.renderChallenges(data);
    this.renderProfile(data);
  }

  private bindActivation(el: Element, action: () => void): void {
    el.addEventListener('click', action);
    el.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        action();
      }
    });
  }

  private renderChallenges(data: GamificationData): void {
    const challengeList = document.querySelector('#nav-drawer .challenge-list');
    if (challengeList) {
      challengeList.innerHTML = data.challenges.map(c => this.renderChallengeCard(c)).join('');
      Array.from(challengeList.children).forEach((el, i) => {
        this.bindActivation(el, () => this.runAction(data.challenges[i].action));
      });
    }

    const badgesRow = document.querySelector('#nav-drawer .badges-row');
    if (badgesRow) {
      badgesRow.innerHTML = data.badges.map(b => this.renderBadge(b)).join('');
      Array.from(badgesRow.children).forEach(el => {
        this.bindActivation(el, () => this.runAction({ type: 'places' }));
      });
    }

    const exploreAreas = document.getElementById('explore-areas');
    if (exploreAreas) {
      if (data.areasToExplore.length > 0) {
        exploreAreas.innerHTML = data.areasToExplore.map(a => this.renderAreaCard(a)).join('');
        Array.from(exploreAreas.children).forEach((el, i) => {
          this.bindActivation(el, () => this.runAction(data.areasToExplore[i].action));
        });
      } else {
        exploreAreas.innerHTML = `<p class="tab-sub">No unexplored wishlist areas right now — every saved place nearby has been visited.</p>`;
      }
    }
  }

  private runAction(action: GamificationAction): void {
    this.onNavigate?.();

    if (action.type === 'map') {
      document.querySelector<HTMLElement>('.tab-btn[data-tab="map"]')?.click();
      setTimeout(() => this.mapEngine.centerOn(action.lat, action.lng, 16), 60);
      return;
    }

    document.querySelector<HTMLElement>('.tab-btn[data-tab="decide"]')?.click();
    if (action.status) {
      document.querySelector<HTMLElement>(`#tab-decide .status-tab[data-status="${action.status}"]`)?.click();
    }
    if (action.sort) {
      document.querySelector<HTMLElement>(`#tab-decide .sort-chip[data-sort="${action.sort}"]`)?.click();
    }
  }

  private renderChallengeCard(c: Challenge): string {
    const pct = Math.round((c.progress / c.target) * 100);
    const complete = c.progress >= c.target;
    return `
      <div class="challenge-card${complete ? ' challenge-complete' : ''}" role="button" tabindex="0" aria-label="${escapeHtml(c.name)}: ${escapeHtml(c.desc)}, ${c.progress} of ${c.target}">
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
      <div class="badge${b.earned ? ' badge-earned' : ''}" role="button" tabindex="0" aria-label="${escapeHtml(b.label)}${b.earned ? ', earned' : ', locked'}">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-label">${escapeHtml(b.label)}</span>
      </div>
    `;
  }

  private renderAreaCard(a: AreaCluster): string {
    const desc = `${a.wishlist} place${a.wishlist === 1 ? '' : 's'} on your wishlist here, ${a.visited} visited so far`;
    return `
      <div class="challenge-card" role="button" tabindex="0" aria-label="${escapeHtml(a.label)}: ${desc}">
        <div class="challenge-icon">📌</div>
        <div class="challenge-body">
          <div class="challenge-name">${escapeHtml(a.label)}</div>
          <div class="challenge-desc">${desc}</div>
        </div>
      </div>
    `;
  }

  private renderProfile(data: GamificationData): void {
    const profileLevel = document.querySelector('#nav-drawer .profile-level');
    if (profileLevel) profileLevel.textContent = `Level ${data.profile.level} · ${data.profile.levelName}`;

    const total = document.getElementById('you-stat-total');
    const visited = document.getElementById('you-stat-visited');
    const wishlist = document.getElementById('you-stat-wishlist');
    if (total) total.textContent = String(data.stats.total);
    if (visited) visited.textContent = String(data.stats.visited);
    if (wishlist) wishlist.textContent = String(data.stats.wishlist);
  }
}
