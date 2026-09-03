import { describe, it, expect } from 'vitest';
import { logVisit, recordVisit, attachVisitReview } from './visit';
import { POIProperties } from '../core/types';

function makeProps(overrides: Partial<POIProperties> = {}): POIProperties {
  return { id: 'p-1', name: 'Test Place', ...overrides };
}

describe('recordVisit', () => {
  it('appends a timestamp to visits and increments visit_count together', () => {
    const props = makeProps();
    recordVisit(props);
    expect(props.visits).toHaveLength(1);
    expect(props.visit_count).toBe(1);

    recordVisit(props);
    expect(props.visits).toHaveLength(2);
    expect(props.visit_count).toBe(2);
    expect(props.visits!.length).toBe(props.visit_count);
  });

  it('preserves prior visits entries rather than replacing the array', () => {
    const props = makeProps({ visits: ['2026-01-01T00:00:00.000Z'] });
    recordVisit(props);
    expect(props.visits![0]).toBe('2026-01-01T00:00:00.000Z');
    expect(props.visits).toHaveLength(2);
  });

  it('does not touch status', () => {
    const props = makeProps({ status: 'wishlist' });
    recordVisit(props);
    expect(props.status).toBe('wishlist');
  });

  it('sets visited_date only on the first call', () => {
    const props = makeProps();
    recordVisit(props);
    const firstDate = props.visited_date;
    recordVisit(props);
    expect(props.visited_date).toBe(firstDate);
  });
});

describe('logVisit', () => {
  it('flips status to visited and records a visit', () => {
    const props = makeProps({ status: 'wishlist' });
    logVisit(props);
    expect(props.status).toBe('visited');
    expect(props.visits).toHaveLength(1);
    expect(props.visit_count).toBe(1);
  });
});

describe('attachVisitReview', () => {
  it('does not itself append to visits (recordVisit is the only writer)', () => {
    const props = makeProps();
    attachVisitReview(props, 5, 'Great!');
    expect(props.visits).toBeUndefined();
    expect(props.reviews).toHaveLength(1);
  });
});
