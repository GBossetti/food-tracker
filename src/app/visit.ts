import { POIProperties, Review } from '../core/types';

export function logVisit(props: POIProperties): void {
  props.status = 'visited';
  const now = new Date().toISOString();
  if (!props.visited_date) {
    props.visited_date = now.split('T')[0];
  }
  props.last_visited = now;
  props.visit_count = (props.visit_count ?? 0) + 1;
}

export function attachVisitReview(props: POIProperties, rating: number, text: string): void {
  if (!props.reviews) props.reviews = [];
  const review: Review = {
    id: `review-${Date.now()}`,
    date: new Date().toISOString(),
    rating,
    text,
  };
  props.reviews.push(review);
  props.rating = props.reviews.reduce((sum, r) => sum + r.rating, 0) / props.reviews.length;
}
