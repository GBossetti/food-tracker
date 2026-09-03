/**
 * Gamification Engine
 * Calculates challenge progress, badges, areas to explore, and profile level from POI data
 */

import { GeoJSONFeature } from '../core/types';
import { haversineDistanceKm } from '../core/geo';
import { computeWeeklyStreak, StreakData } from '../core/streak';

const BADGES_STORAGE_KEY = 'food-map-badges';
const CLUSTER_RADIUS_KM = 0.35;

const LEVEL_THRESHOLDS: Array<{ points: number; name: string }> = [
  { points: 0, name: 'Newcomer' },
  { points: 50, name: 'Food Enthusiast' },
  { points: 150, name: 'Local Explorer' },
  { points: 300, name: 'Neighborhood Foodie' },
  { points: 600, name: 'City Connoisseur' },
];

export type GamificationAction =
  | { type: 'map'; lat: number; lng: number }
  | { type: 'places'; status?: 'all' | 'visited' | 'wishlist'; sort?: 'name' | 'rating' | 'recent' | 'distance' };

export interface AreaCluster {
  id: string;
  label: string;
  total: number;
  visited: number;
  wishlist: number;
  lat: number;
  lng: number;
  action: GamificationAction;
}

export interface Challenge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  progress: number;
  target: number;
  action: GamificationAction;
}

export interface Badge {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
}

export interface GamificationData {
  challenges: Challenge[];
  badges: Badge[];
  areasToExplore: AreaCluster[];
  profile: { points: number; level: number; levelName: string };
  stats: { total: number; visited: number; wishlist: number };
  streak: StreakData;
  /** Badge ids earned for the first time by this call — a hook for a future
   * "unlocked" celebration. Nothing consumes this yet (deliberately quiet). */
  newlyEarned: string[];
}

export class GamificationEngine {
  private features: GeoJSONFeature[];

  constructor(features: GeoJSONFeature[]) {
    this.features = features;
  }

  calculateAll(): GamificationData {
    const stats = this.calculateStats();
    const clusters = this.clusterByProximity();
    const streak = this.calculateStreak();
    const { badges, newlyEarned } = this.calculateBadges(stats, clusters, streak);
    const challenges = this.calculateChallenges(stats, clusters);
    const areasToExplore = this.calculateAreasToExplore(clusters);
    const profile = this.calculateProfile(stats, badges);

    return { challenges, badges, areasToExplore, profile, stats, streak, newlyEarned };
  }

  private calculateStats() {
    const total = this.features.length;
    const visited = this.features.filter(f => this.isVisited(f)).length;
    const wishlist = this.features.filter(f => f.properties.status === 'wishlist').length;
    return { total, visited, wishlist };
  }

  private isVisited(f: GeoJSONFeature): boolean {
    return f.properties.status === 'visited' || (f.properties.visit_count ?? 0) > 0;
  }

  private calculateStreak(): StreakData {
    const allVisits = this.features.flatMap(f => f.properties.visits ?? []);
    return computeWeeklyStreak(allVisits, new Date());
  }

  private clusterByProximity(): AreaCluster[] {
    const unclustered = [...this.features];
    const clusters: AreaCluster[] = [];
    let clusterIndex = 0;

    while (unclustered.length > 0) {
      const seed = unclustered.shift()!;
      const seedCoords = seed.geometry.coordinates as [number, number];
      const members: GeoJSONFeature[] = [seed];

      for (let i = unclustered.length - 1; i >= 0; i--) {
        const candidate = unclustered[i];
        const candidateCoords = candidate.geometry.coordinates as [number, number];
        const distance = haversineDistanceKm(seedCoords[1], seedCoords[0], candidateCoords[1], candidateCoords[0]);
        if (distance <= CLUSTER_RADIUS_KM) {
          members.push(candidate);
          unclustered.splice(i, 1);
        }
      }

      const labelPlace = members.reduce((best, f) =>
        (f.properties.visit_count || 0) > (best.properties.visit_count || 0) ? f : best
      , members[0]);
      const [lng, lat] = labelPlace.geometry.coordinates as [number, number];

      clusters.push({
        id: `cluster-${clusterIndex++}`,
        label: `Near ${labelPlace.properties.name}`,
        total: members.length,
        visited: members.filter(f => this.isVisited(f)).length,
        wishlist: members.filter(f => f.properties.status === 'wishlist').length,
        lat,
        lng,
        action: { type: 'map', lat, lng },
      });
    }

    return clusters;
  }

  private calculateChallenges(
    stats: { total: number; visited: number; wishlist: number },
    clusters: AreaCluster[]
  ): Challenge[] {
    const now = new Date();
    const newThisMonth = this.features.filter(f => {
      if (!f.properties.created_at) return false;
      const created = new Date(f.properties.created_at);
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;

    const visitedCategories = new Set(
      this.features
        .filter(f => this.isVisited(f) && f.properties.category)
        .map(f => f.properties.category)
    );

    const busiestCluster = clusters.reduce<AreaCluster | null>(
      (best, c) => (!best || c.visited > best.visited) ? c : best, null
    );
    const maxClusterVisits = busiestCluster?.visited ?? 0;
    const neighborhoodAction: GamificationAction = busiestCluster
      ? { type: 'map', lat: busiestCluster.lat, lng: busiestCluster.lng }
      : { type: 'places', status: 'visited' };

    return [
      {
        id: 'explorer',
        icon: '🗺️',
        name: 'Explorer',
        desc: 'Try 3 new places this month',
        progress: Math.min(newThisMonth, 3),
        target: 3,
        action: { type: 'places', sort: 'recent' },
      },
      {
        id: 'cuisine-hopper',
        icon: '🍝',
        name: 'Cuisine Hopper',
        desc: 'Visit 5 different cuisine types',
        progress: Math.min(visitedCategories.size, 5),
        target: 5,
        action: { type: 'places', status: 'visited' },
      },
      {
        id: 'neighborhood-regular',
        icon: '🏙️',
        name: 'Neighborhood Regular',
        desc: 'Visit 10 places in one neighborhood',
        progress: Math.min(maxClusterVisits, 10),
        target: 10,
        action: neighborhoodAction,
      },
    ];
  }

  private calculateBadges(
    stats: { total: number; visited: number; wishlist: number },
    clusters: AreaCluster[],
    streak: StreakData
  ): { badges: Badge[]; newlyEarned: string[] } {
    const totalVisits = this.features
      .filter(f => this.isVisited(f))
      .reduce((sum, f) => sum + (f.properties.visit_count ?? 0), 0);

    const distinctVisitedClusters = clusters.filter(c => c.visited >= 1).length;

    const liveEarned: Record<string, boolean> = {
      'first-save': stats.total >= 1,
      '10-places': stats.total >= 10,
      '5-hoods': distinctVisitedClusters >= 5,
      '50-visits': totalVisits >= 50,
      '4-week-streak': streak.longest >= 4,
      '12-week-streak': streak.longest >= 12,
    };

    const persisted = this.loadEarnedBadges();
    const newlyEarned = Object.keys(liveEarned).filter(id => liveEarned[id] && !persisted.has(id));

    const merged = new Set(persisted);
    for (const [id, earned] of Object.entries(liveEarned)) {
      if (earned) merged.add(id);
    }
    this.persistEarnedBadges(merged);

    const badges: Badge[] = [
      { id: 'first-save', icon: '🌟', label: 'First Save', earned: merged.has('first-save') },
      { id: '10-places', icon: '📍', label: '10 Places', earned: merged.has('10-places') },
      { id: '5-hoods', icon: '🏙️', label: '5 Hoods', earned: merged.has('5-hoods') },
      { id: '50-visits', icon: '🍴', label: '50 Visits', earned: merged.has('50-visits') },
      { id: '4-week-streak', icon: '🔥', label: 'Four in a Row', earned: merged.has('4-week-streak') },
      { id: '12-week-streak', icon: '🏆', label: 'Regular', earned: merged.has('12-week-streak') },
    ];

    return { badges, newlyEarned };
  }

  private calculateAreasToExplore(clusters: AreaCluster[]): AreaCluster[] {
    return clusters
      .filter(c => c.wishlist > 0)
      .sort((a, b) => (a.visited / a.total) - (b.visited / b.total))
      .slice(0, 3);
  }

  private calculateProfile(stats: { visited: number }, badges: Badge[]) {
    const totalReviews = this.features.reduce((sum, f) => sum + (f.properties.reviews?.length || 0), 0);
    const earnedBadges = badges.filter(b => b.earned).length;
    const points = stats.visited * 10 + totalReviews * 5 + earnedBadges * 25;

    let level = 0;
    let levelName = LEVEL_THRESHOLDS[0].name;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (points >= LEVEL_THRESHOLDS[i].points) {
        level = i + 1;
        levelName = LEVEL_THRESHOLDS[i].name;
      }
    }

    return { points, level, levelName };
  }

  private loadEarnedBadges(): Set<string> {
    try {
      const stored = localStorage.getItem(BADGES_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
      console.error('Failed to load earned badges from localStorage', error);
      return new Set();
    }
  }

  private persistEarnedBadges(ids: Set<string>): void {
    try {
      localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify([...ids]));
    } catch (error) {
      console.error('Failed to save earned badges to localStorage', error);
    }
  }
}
