/**
 * Analytics Engine
 * Calculates statistics and insights from POI data
 */

import { GeoJSONFeature } from '../core/types';

export interface AnalyticsData {
  overview: {
    totalPlaces: number;
    totalVisits: number;
    totalReviews: number;
    averageRating: number;
    mostVisitedPlace: { name: string; count: number } | null;
    highestRatedPlace: { name: string; rating: number } | null;
  };
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
    unrated: number;
  };
  topPlaces: {
    byRating: Array<{ name: string; rating: number; visits: number; id: string }>;
    byVisits: Array<{ name: string; visits: number; rating: number; id: string }>;
    recent: Array<{ name: string; date: string; rating: number; id: string }>;
  };
  tagAnalytics: {
    mostUsed: Array<{ tag: string; count: number }>;
    bestRated: Array<{ tag: string; avgRating: number; count: number }>;
  };
  timeline: {
    visitsByMonth: Array<{ month: string; count: number; reviews: number }>;
    reviewsByMonth: Array<{ month: string; count: number }>;
  };
  insights: {
    mostActiveMonth: string;
    daysSinceLastVisit: number;
    discoveryRate: number; // places per month
    averageVisitsPerPlace: number;
    favoriteTag: string | null;
  };
}

export class AnalyticsEngine {
  private features: GeoJSONFeature[];

  constructor(features: GeoJSONFeature[]) {
    this.features = features;
  }

  /**
   * Calculate all analytics
   */
  calculateAll(): AnalyticsData {
    return {
      overview: this.calculateOverview(),
      ratingDistribution: this.calculateRatingDistribution(),
      topPlaces: this.calculateTopPlaces(),
      tagAnalytics: this.calculateTagAnalytics(),
      timeline: this.calculateTimeline(),
      insights: this.calculateInsights(),
    };
  }

  /**
   * Overview statistics
   */
  private calculateOverview() {
    const totalPlaces = this.features.length;
    const totalVisits = this.features.reduce(
      (sum, f) => sum + (f.properties.visit_count || 1),
      0
    );
    const totalReviews = this.features.reduce(
      (sum, f) => sum + (f.properties.reviews?.length || 0),
      0
    );

    // Calculate average rating
    const ratedPlaces = this.features.filter(f => f.properties.rating > 0);
    const averageRating = ratedPlaces.length > 0
      ? ratedPlaces.reduce((sum, f) => sum + f.properties.rating, 0) / ratedPlaces.length
      : 0;

    // Most visited place
    const mostVisited = this.features.reduce((max, f) => {
      const visits = f.properties.visit_count || 1;
      return visits > (max.count || 0) ? { name: f.properties.name, count: visits } : max;
    }, { name: '', count: 0 });

    // Highest rated place
    const highestRated = ratedPlaces.reduce((max, f) => {
      return f.properties.rating > (max.rating || 0)
        ? { name: f.properties.name, rating: f.properties.rating }
        : max;
    }, { name: '', rating: 0 });

    return {
      totalPlaces,
      totalVisits,
      totalReviews,
      averageRating,
      mostVisitedPlace: mostVisited.count > 0 ? mostVisited : null,
      highestRatedPlace: highestRated.rating > 0 ? highestRated : null,
    };
  }

  /**
   * Rating distribution
   */
  private calculateRatingDistribution() {
    const distribution = {
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
      unrated: 0,
    };

    this.features.forEach(f => {
      const rating = f.properties.rating || 0;
      if (rating === 0) {
        distribution.unrated++;
      } else if (rating >= 4.5) {
        distribution.fiveStar++;
      } else if (rating >= 3.5) {
        distribution.fourStar++;
      } else if (rating >= 2.5) {
        distribution.threeStar++;
      } else if (rating >= 1.5) {
        distribution.twoStar++;
      } else {
        distribution.oneStar++;
      }
    });

    return distribution;
  }

  /**
   * Top places by various metrics
   */
  private calculateTopPlaces() {
    // By rating
    const byRating = this.features
      .filter(f => f.properties.rating > 0)
      .map(f => ({
        name: f.properties.name,
        rating: f.properties.rating,
        visits: f.properties.visit_count || 1,
        id: f.properties.id,
      }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10);

    // By visits
    const byVisits = this.features
      .map(f => ({
        name: f.properties.name,
        visits: f.properties.visit_count || 1,
        rating: f.properties.rating || 0,
        id: f.properties.id,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    // Recent additions
    const recent = this.features
      .filter(f => f.properties.created_at)
      .map(f => ({
        name: f.properties.name,
        date: f.properties.created_at!,
        rating: f.properties.rating || 0,
        id: f.properties.id,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return { byRating, byVisits, recent };
  }

  /**
   * Tag analytics
   */
  private calculateTagAnalytics() {
    const tagCounts = new Map<string, number>();
    const tagRatings = new Map<string, number[]>();

    this.features.forEach(f => {
      const tags = f.properties.tags || [];
      const rating = f.properties.rating || 0;

      tags.forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        
        if (rating > 0) {
          if (!tagRatings.has(tag)) {
            tagRatings.set(tag, []);
          }
          tagRatings.get(tag)!.push(rating);
        }
      });
    });

    // Most used tags
    const mostUsed = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Best rated tags
    const bestRated = Array.from(tagRatings.entries())
      .map(([tag, ratings]) => ({
        tag,
        avgRating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
        count: ratings.length,
      }))
      .filter(t => t.count >= 2) // At least 2 places
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 10);

    return { mostUsed, bestRated };
  }

  /**
   * Timeline data
   */
  private calculateTimeline() {
    const visitsByMonth = new Map<string, { count: number; reviews: number }>();

    this.features.forEach(f => {
      const reviews = f.properties.reviews || [];
      
      reviews.forEach((review: any) => {
        const date = new Date(review.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!visitsByMonth.has(monthKey)) {
          visitsByMonth.set(monthKey, { count: 0, reviews: 0 });
        }
        
        const data = visitsByMonth.get(monthKey)!;
        data.count++;
        data.reviews++;
      });

      // Also count places without reviews
      if (reviews.length === 0 && f.properties.visited_date) {
        const date = new Date(f.properties.visited_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!visitsByMonth.has(monthKey)) {
          visitsByMonth.set(monthKey, { count: 0, reviews: 0 });
        }
        visitsByMonth.get(monthKey)!.count++;
      }
    });

    // Convert to array and sort by date
    const visitsByMonthArray = Array.from(visitsByMonth.entries())
      .map(([month, data]) => ({
        month,
        count: data.count,
        reviews: data.reviews,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const reviewsByMonth = visitsByMonthArray.map(v => ({
      month: v.month,
      count: v.reviews,
    }));

    return { visitsByMonth: visitsByMonthArray, reviewsByMonth };
  }

  /**
   * Insights and patterns
   */
  private calculateInsights() {
    const timeline = this.calculateTimeline();
    
    // Most active month
    const mostActiveMonth = timeline.visitsByMonth.length > 0
      ? timeline.visitsByMonth.reduce((max, curr) => 
          curr.count > max.count ? curr : max
        ).month
      : '';

    // Days since last visit
    const allDates = this.features
      .flatMap(f => f.properties.reviews?.map((r: any) => new Date(r.date)) || [])
      .concat(
        this.features
          .filter(f => f.properties.last_visited)
          .map(f => new Date(f.properties.last_visited!))
      );
    
    const mostRecentDate = allDates.length > 0
      ? Math.max(...allDates.map(d => d.getTime()))
      : Date.now();
    
    const daysSinceLastVisit = Math.floor(
      (Date.now() - mostRecentDate) / (1000 * 60 * 60 * 24)
    );

    // Discovery rate
    const placesWithDates = this.features.filter(f => f.properties.created_at);
    const discoveryRate = placesWithDates.length > 0 ? (() => {
      const dates = placesWithDates.map(f => new Date(f.properties.created_at!).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const monthsSpan = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30);
      return monthsSpan > 0 ? placesWithDates.length / monthsSpan : 0;
    })() : 0;

    // Average visits per place
    const averageVisitsPerPlace = this.features.length > 0
      ? this.features.reduce((sum, f) => sum + (f.properties.visit_count || 1), 0) / this.features.length
      : 0;

    // Favorite tag
    const tagAnalytics = this.calculateTagAnalytics();
    const favoriteTag = tagAnalytics.mostUsed.length > 0
      ? tagAnalytics.mostUsed[0].tag
      : null;

    return {
      mostActiveMonth,
      daysSinceLastVisit,
      discoveryRate,
      averageVisitsPerPlace,
      favoriteTag,
    };
  }
}