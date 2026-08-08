/**
 * Re-derives aria-checked and roving tabindex from whichever prefix of
 * `stars` currently carries the app's own `.active` class. Call this after
 * changing `.active` directly (e.g. populating an existing rating when a
 * modal opens) without going through the `onSelect` callback passed to
 * `setupStarRadiogroup`, so ARIA state doesn't go stale.
 */
export function syncStarAria(stars: HTMLElement[]): void {
  const activeCount = stars.filter((s) => s.classList.contains('active')).length;
  const focusIndex = Math.max(0, activeCount - 1);
  stars.forEach((s, i) => {
    s.setAttribute('aria-checked', String(i < activeCount));
    s.setAttribute('tabindex', i === focusIndex ? '0' : '-1');
  });
}

/**
 * Wires a set of star elements as an accessible role="radio" group: roving
 * tabindex, arrow/Home/End keyboard navigation, and aria-checked reflecting
 * whichever prefix of stars carries the app's own `.active` class.
 *
 * `onSelect` is the single source of truth for "what does choosing rating N
 * mean" (updating app state, `.active`/glyph visuals, hidden form inputs) —
 * this module never touches that; it just decides *which* rating was chosen
 * from a click or key press and re-syncs the ARIA state afterward.
 *
 * Click/keydown are wired via property assignment (`.onclick`/`.onkeydown`),
 * not `addEventListener`, so calling this again on the same elements — e.g.
 * every time a review form is reopened — overwrites cleanly instead of
 * stacking duplicate handlers.
 */
export function setupStarRadiogroup(stars: HTMLElement[], onSelect: (rating: number) => void): void {
  stars.forEach((star, i) => {
    star.setAttribute('role', 'radio');
    star.setAttribute('aria-label', `${i + 1} star${i === 0 ? '' : 's'}`);

    star.onclick = () => {
      onSelect(i + 1);
      syncStarAria(stars);
    };

    star.onkeydown = (e) => {
      let target = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = Math.min(i + 1, stars.length - 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = Math.max(i - 1, 0);
      else if (e.key === 'Home') target = 0;
      else if (e.key === 'End') target = stars.length - 1;
      else if (e.key === 'Enter' || e.key === ' ') target = i;
      else return;

      e.preventDefault();
      onSelect(target + 1);
      stars[target].focus();
      syncStarAria(stars);
    };
  });

  syncStarAria(stars);
}
