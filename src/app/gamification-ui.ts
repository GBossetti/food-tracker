import { GamificationEngine, GamificationData, Challenge, Badge, AreaCluster, GamificationAction } from './gamification';
import { MapEngine } from '../core/map-engine';
import { escapeHtml } from '../core/escape-html';

export interface GamificationNavCallbacks {
  closeDrawer: () => void;
  expandSheet: () => void;
}

export class GamificationUI {
  private mapEngine: MapEngine;
  private nav: GamificationNavCallbacks;
  private cache: GamificationData | null = null;

  constructor(mapEngine: MapEngine, nav: GamificationNavCallbacks) {
    this.mapEngine = mapEngine;
    this.nav = nav;
    this.mapEngine.on('created', () => this.invalidate());
    this.mapEngine.on('updated', () => this.invalidate());
    this.mapEngine.on('deleted', () => this.invalidate());
    this.setupDelegatedActivation();
  }

  /** Drops the memoized calculation so the next render() recomputes it. */
  invalidate(): void {
    this.cache = null;
  }

  render(): void {
    if (!this.cache) {
      const features = this.mapEngine.getAllFeatures();
      this.cache = new GamificationEngine(features).calculateAll();
    }

    this.renderChallenges(this.cache);
    this.renderProfile(this.cache);
  }

  /** One delegated click/keydown listener per container, bound once, so
   * repeated renders never stack duplicate handlers on card elements. */
  private setupDelegatedActivation(): void {
    this.bindContainer(
      document.querySelector('#nav-drawer .challenge-list'),
      (id) => this.cache?.challenges.find(c => c.id === id)?.action
    );
    this.bindContainer(document.querySelector('#nav-drawer .badges-row'), () => ({ type: 'places' }));
    this.bindContainer(
      document.getElementById('explore-areas'),
      (id) => this.cache?.areasToExplore.find(a => a.id === id)?.action
    );
  }

  private bindContainer(container: Element | null, resolve: (id: string) => GamificationAction | undefined): void {
    if (!container) return;

    const activate = (e: Event) => {
      const target = (e.target as Element).closest<HTMLElement>('[data-id]');
      if (!target || !container.contains(target)) return;
      const action = resolve(target.dataset.id!);
      if (action) this.runAction(action);
    };

    container.addEventListener('click', activate);
    container.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        activate(e);
      }
    });
  }

  private renderChallenges(data: GamificationData): void {
    const challengeList = document.querySelector('#nav-drawer .challenge-list');
    if (challengeList) {
      challengeList.innerHTML = data.stats.total === 0
        ? `<p class="tab-sub">Save your first place to start earning badges.</p>`
        : data.challenges.map(c => this.renderChallengeCard(c)).join('');
    }

    const badgesRow = document.querySelector('#nav-drawer .badges-row');
    if (badgesRow) {
      badgesRow.innerHTML = data.badges.map(b => this.renderBadge(b)).join('');
    }

    const exploreAreas = document.getElementById('explore-areas');
    if (exploreAreas) {
      exploreAreas.innerHTML = data.areasToExplore.length > 0
        ? data.areasToExplore.map(a => this.renderAreaCard(a)).join('')
        : `<p class="tab-sub">No unexplored wishlist areas right now — every saved place nearby has been visited.</p>`;
    }
  }

  private runAction(action: GamificationAction): void {
    this.nav.closeDrawer();

    if (action.type === 'map') {
      this.mapEngine.centerOn(action.lat, action.lng, 16);
      return;
    }

    this.nav.expandSheet();
    if (action.status) {
      document.querySelector<HTMLElement>(`#sheet-list-panel .status-tab[data-status="${action.status}"]`)?.click();
    }
    if (action.sort) {
      document.querySelector<HTMLElement>(`#sheet-list-panel .sort-chip[data-sort="${action.sort}"]`)?.click();
    }
  }

  private renderChallengeCard(c: Challenge): string {
    const pct = Math.round((c.progress / c.target) * 100);
    const complete = c.progress >= c.target;
    return `
      <div class="challenge-card${complete ? ' challenge-complete' : ''}" data-id="${escapeHtml(c.id)}" role="button" tabindex="0" aria-label="${escapeHtml(c.name)}: ${escapeHtml(c.desc)}, ${c.progress} of ${c.target}">
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
      <div class="badge${b.earned ? ' badge-earned' : ''}" data-id="${escapeHtml(b.id)}" role="button" tabindex="0" aria-label="${escapeHtml(b.label)}${b.earned ? ', earned' : ', locked'}">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-label">${escapeHtml(b.label)}</span>
      </div>
    `;
  }

  private renderAreaCard(a: AreaCluster): string {
    const desc = `${a.wishlist} place${a.wishlist === 1 ? '' : 's'} on your wishlist here, ${a.visited} visited so far`;
    return `
      <div class="challenge-card" data-id="${escapeHtml(a.id)}" role="button" tabindex="0" aria-label="${escapeHtml(a.label)}: ${desc}">
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

    const streakStrip = document.getElementById('streak-strip');
    const streakText = document.getElementById('streak-text');
    if (streakStrip && streakText) {
      if (data.streak.current > 0) {
        const weekWord = data.streak.current === 1 ? 'week' : 'weeks';
        const best = data.streak.longest > data.streak.current ? ` · best: ${data.streak.longest}` : '';
        streakText.textContent = `${data.streak.current} ${weekWord} in a row${best}`;
        streakStrip.hidden = false;
      } else {
        streakStrip.hidden = true;
      }
    }

    const total = document.getElementById('you-stat-total');
    const visited = document.getElementById('you-stat-visited');
    const wishlist = document.getElementById('you-stat-wishlist');
    if (total) total.textContent = String(data.stats.total);
    if (visited) visited.textContent = String(data.stats.visited);
    if (wishlist) wishlist.textContent = String(data.stats.wishlist);
  }
}
