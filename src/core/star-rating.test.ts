import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStarRadiogroup, syncStarAria } from './star-rating';

function makeStars(count: number): HTMLElement[] {
  return Array.from({ length: count }, () => {
    const el = document.createElement('span');
    document.body.appendChild(el);
    return el;
  });
}

// Mimics how the app's own onSelect callbacks mark stars .active — a
// contiguous prefix from index 0 up to (rating - 1).
function applyRating(stars: HTMLElement[], rating: number): void {
  stars.forEach((s, i) => s.classList.toggle('active', i < rating));
}

describe('setupStarRadiogroup', () => {
  let stars: HTMLElement[];
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stars = makeStars(5);
    onSelect = vi.fn((rating: number) => applyRating(stars, rating));
    setupStarRadiogroup(stars, onSelect);
  });

  afterEach(() => {
    stars.forEach((s) => s.remove());
  });

  it('sets role and a per-star aria-label', () => {
    stars.forEach((s, i) => {
      expect(s.getAttribute('role')).toBe('radio');
      expect(s.getAttribute('aria-label')).toBe(`${i + 1} star${i === 0 ? '' : 's'}`);
    });
  });

  it('defaults roving tabindex to the first star when nothing is active', () => {
    expect(stars[0].getAttribute('tabindex')).toBe('0');
    stars.slice(1).forEach((s) => expect(s.getAttribute('tabindex')).toBe('-1'));
  });

  it('calls onSelect with the 1-based rating on click', () => {
    stars[2].onclick?.(new MouseEvent('click'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('marks stars up to the chosen rating as aria-checked and moves roving tabindex', () => {
    stars[2].onclick?.(new MouseEvent('click'));
    expect(stars[0].getAttribute('aria-checked')).toBe('true');
    expect(stars[1].getAttribute('aria-checked')).toBe('true');
    expect(stars[2].getAttribute('aria-checked')).toBe('true');
    expect(stars[3].getAttribute('aria-checked')).toBe('false');
    expect(stars[2].getAttribute('tabindex')).toBe('0');
    expect(stars[0].getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowRight moves focus to and selects the next star', () => {
    stars[0].focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    stars[0].onkeydown?.(event);
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(document.activeElement).toBe(stars[1]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ArrowLeft does not go below the first star', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    stars[0].onkeydown?.(event);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(stars[0]);
  });

  it('End selects the last star, Home selects the first', () => {
    stars[0].onkeydown?.(new KeyboardEvent('keydown', { key: 'End', cancelable: true }));
    expect(onSelect).toHaveBeenLastCalledWith(5);
    expect(document.activeElement).toBe(stars[4]);

    stars[4].onkeydown?.(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    expect(document.activeElement).toBe(stars[0]);
  });

  it('ignores unrelated keys', () => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    stars[0].onkeydown?.(event);
    expect(onSelect).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('syncStarAria reflects .active changes made outside onSelect', () => {
    applyRating(stars, 4);
    syncStarAria(stars);
    expect(stars[3].getAttribute('aria-checked')).toBe('true');
    expect(stars[4].getAttribute('aria-checked')).toBe('false');
    expect(stars[3].getAttribute('tabindex')).toBe('0');

    applyRating(stars, 0);
    syncStarAria(stars);
    stars.forEach((s) => expect(s.getAttribute('aria-checked')).toBe('false'));
    expect(stars[0].getAttribute('tabindex')).toBe('0');
  });

  it('re-running on the same elements overwrites handlers instead of stacking', () => {
    const secondOnSelect = vi.fn((rating: number) => applyRating(stars, rating));
    setupStarRadiogroup(stars, secondOnSelect);

    stars[1].onclick?.(new MouseEvent('click'));
    expect(secondOnSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
